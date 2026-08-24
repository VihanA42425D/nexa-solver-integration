import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Interface, getAddress, id } from "ethers";
import { buildIndexingArtifacts } from "./generate-indexing.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const NETWORKS = Object.freeze([
  Object.freeze({ graphNetwork: "base", chainId: 8453 }),
  Object.freeze({ graphNetwork: "bsc", chainId: 56 }),
  Object.freeze({ graphNetwork: "hyper-evm", chainId: 999 }),
]);
const INDEXED_CONTRACTS = Object.freeze(["registry", "router", "standardModuleRegistry"]);
const SOURCE_FILL_FIELDS = Object.freeze([
  "fillId", "routeId", "quoteId", "payer", "recipient", "sourceAsset",
  "destinationAsset", "destinationChainId", "amountInRaw", "amountOutRaw",
  "sourceFinalityBlocks", "settlementDeadline", "permitNonce", "executionGeneration",
]);

const read = (root, file) => readFile(resolve(root, file), "utf8");
const readJson = async (root, file) => JSON.parse(await read(root, file));
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

function normalize(type, value) {
  if (type === "address") return getAddress(value).toLowerCase();
  if (type.startsWith("uint") || type.startsWith("int")) return value.toString();
  if (type.startsWith("bytes")) return String(value).toLowerCase();
  return value;
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["build", "generated", "node_modules", "target"].includes(entry.name)) continue;
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(resolve(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function validateFixture(fixture, config) {
  const event = config.events[fixture.eventName];
  assert(event, "INDEXING_FIXTURE_EVENT_UNKNOWN:" + fixture.fixtureId);
  const parsed = new Interface([event.abi]).parseLog({
    topics: fixture.topics,
    data: fixture.data,
  });
  assert(parsed?.name === fixture.eventName, "INDEXING_FIXTURE_DECODE_FAILED:" + fixture.fixtureId);
  for (const [index, field] of event.fields.entries()) {
    const expected = fixture.expectedNormalized[field.name];
    assert(
      normalize(field.type, parsed.args[index]) === expected,
      "INDEXING_FIXTURE_FIELD_DRIFT:" + fixture.fixtureId + ":" + field.name,
    );
  }
  for (const field of ["chainId", "blockNumber", "blockTimestamp", "transactionHash", "logIndex"]) {
    assert(fixture.provenance[field] !== undefined, "INDEXING_FIXTURE_PROVENANCE_MISSING:" + field);
  }
}

export async function validateIndexingPackage(root = repositoryRoot) {
  const [config, evidence, integration, descriptor, fixtures, publicEvents] = await Promise.all([
    readJson(root, "indexing/nexa-v6-indexing.json"),
    readJson(root, "verification/indexing-deployment-evidence.json"),
    readJson(root, "nexa-mainnet-v6.json"),
    readJson(root, "indexing/indexing-manifest.json"),
    readJson(root, "indexing/fixtures/nexa-v6-events.json"),
    readJson(root, "events/events.json"),
  ]);

  const generated = await buildIndexingArtifacts(root);
  for (const [file, expected] of Object.entries(generated)) {
    assert(await read(root, file) === expected, "INDEXING_GENERATED_ARTIFACT_STALE:" + file);
  }

  assert(config.schema === "NEXA_V6_CANONICAL_INDEXING_CONFIG_V1", "INDEXING_SCHEMA_INVALID");
  assert(config.status === "PACKAGE_READY", "INDEXING_PACKAGE_NOT_READY");
  assert(config.authoritative === false, "INDEXING_MUST_BE_NON_AUTHORITATIVE");
  assert(config.source === "ONCHAIN_EVENTS", "INDEXING_SOURCE_INVALID");
  assert(config.releaseId === integration.releaseId && config.releaseId === evidence.releaseId,
    "INDEXING_RELEASE_ID_DRIFT");
  assert(JSON.stringify(config.events) === JSON.stringify(publicEvents.events),
    "INDEXING_PUBLIC_EVENT_CATALOG_DRIFT");

  assert(config.networks.length === NETWORKS.length, "INDEXING_NETWORK_COUNT_INVALID");
  for (const expectedNetwork of NETWORKS) {
    const network = config.networks.find(
      ({ graphNetwork }) => graphNetwork === expectedNetwork.graphNetwork,
    );
    const source = evidence.networks[expectedNetwork.graphNetwork];
    assert(network?.chainId === expectedNetwork.chainId,
      "INDEXING_CHAIN_INVALID:" + expectedNetwork.graphNetwork);
    assert(source?.chainId === expectedNetwork.chainId,
      "INDEXING_EVIDENCE_CHAIN_INVALID:" + expectedNetwork.graphNetwork);
    assert(network.releaseId === config.releaseId,
      "INDEXING_NETWORK_RELEASE_DRIFT:" + expectedNetwork.graphNetwork);

    for (const key of [...INDEXED_CONTRACTS, "facade"]) {
      const contract = network.contracts[key];
      const sourceContract = source.contracts[key];
      assert(Number.isSafeInteger(contract?.startBlock) && contract.startBlock > 0,
        "INDEXING_START_BLOCK_MISSING:" + expectedNetwork.graphNetwork + ":" + key);
      assert(contract.startBlock === sourceContract.startBlock,
        "INDEXING_START_BLOCK_DRIFT:" + expectedNetwork.graphNetwork + ":" + key);
      assert(getAddress(contract.address) === getAddress(sourceContract.address),
        "INDEXING_ADDRESS_DRIFT:" + expectedNetwork.graphNetwork + ":" + key);
      assert(contract.deploymentTransactionHash === sourceContract.deploymentTransactionHash,
        "INDEXING_DEPLOYMENT_TX_DRIFT:" + expectedNetwork.graphNetwork + ":" + key);
      assert(/^0x[0-9a-f]{64}$/i.test(contract.runtimeCodeHash),
        "INDEXING_RUNTIME_HASH_MISSING:" + expectedNetwork.graphNetwork + ":" + key);
    }
    assert(network.contracts.facade.events.length === 0,
      "INDEXING_FACADE_MUST_NOT_BE_INDEXED:" + expectedNetwork.graphNetwork);
    assert(
      network.contracts.registry.startBlock !== network.contracts.facade.startBlock
      && network.contracts.router.startBlock !== network.contracts.facade.startBlock,
      "INDEXING_FACADE_BLOCK_REUSED:" + expectedNetwork.graphNetwork,
    );

    const graphPath = "indexing/graph/subgraph." + network.graphNetwork + ".yaml";
    const graphManifest = await read(root, graphPath);
    assert(graphManifest.includes("  file: ./schema.graphql"),
      "GRAPH_SCHEMA_NOT_SHARED:" + network.graphNetwork);
    assert((graphManifest.match(/file: \.\/src\/mapping\.ts/g) ?? []).length === 3,
      "GRAPH_MAPPING_NOT_SHARED:" + network.graphNetwork);
    for (const key of INDEXED_CONTRACTS) {
      const contract = network.contracts[key];
      assert(graphManifest.includes("address: '" + contract.address + "'"),
        "GRAPH_ADDRESS_DRIFT:" + network.graphNetwork + ":" + key);
      assert(graphManifest.includes("startBlock: " + contract.startBlock),
        "GRAPH_START_BLOCK_DRIFT:" + network.graphNetwork + ":" + key);
    }

    const substreamsPath = "indexing/substreams/substreams." + network.graphNetwork + ".yaml";
    const substreamsManifest = await read(root, substreamsPath);
    assert(substreamsManifest.includes(
      "file: ./target/wasm32-unknown-unknown/release/nexa_v6_substreams.wasm",
    ), "SUBSTREAMS_BINARY_NOT_SHARED:" + network.graphNetwork);
    assert(substreamsManifest.includes("- nexa/v6/indexing.proto"),
      "SUBSTREAMS_PROTO_NOT_SHARED:" + network.graphNetwork);
    assert(substreamsManifest.includes("chain_id=" + network.chainId),
      "SUBSTREAMS_CHAIN_DRIFT:" + network.graphNetwork);
    for (const module of [
      "map_nexa_v6_events", "store_networks", "store_assets", "store_routes",
      "store_router_state", "store_standard_modules",
    ]) {
      assert(substreamsManifest.includes("name: " + module),
        "SUBSTREAMS_MODULE_MISSING:" + network.graphNetwork + ":" + module);
    }
  }

  for (const [name, event] of Object.entries(config.events)) {
    assert(id(event.signature) === event.topic0, "INDEXING_TOPIC_DRIFT:" + name);
    const fragment = new Interface([event.abi]).getEvent(name);
    assert(fragment.format("sighash") === event.signature, "INDEXING_ABI_DRIFT:" + name);
  }
  assert(
    config.events.SourceFillV6.fields.map(({ name }) => name).join(",")
      === SOURCE_FILL_FIELDS.join(","),
    "INDEXING_SOURCE_FILL_FIELDS_INCOMPLETE",
  );

  assert(fixtures.schema === "NEXA_V6_INDEXING_CANONICAL_FIXTURES_V1",
    "INDEXING_FIXTURE_SCHEMA_INVALID");
  for (const fixture of fixtures.fixtures) validateFixture(fixture, config);
  const routeStatuses = fixtures.fixtures
    .filter(({ eventName }) => eventName === "RouteStatusChangedV6")
    .map(({ expectedNormalized }) => [
      Number(expectedNormalized.status), Number(expectedNormalized.generation),
    ]);
  assert(JSON.stringify(routeStatuses) === JSON.stringify([[1, 1], [2, 2]]),
    "INDEXING_ROUTE_TRANSITION_FIXTURES_INVALID");
  const standardKinds = new Set(fixtures.fixtures
    .filter(({ eventName }) => eventName === "StandardModuleConfiguredV6")
    .map(({ expectedNormalized }) => expectedNormalized.standardKind));
  assert(standardKinds.has("ERC_7683_EXECUTABLE")
    && standardKinds.has("OIF_DISCOVERY_DESCRIPTION_ONLY"),
  "INDEXING_STANDARD_CLASSIFICATION_FIXTURES_INVALID");

  const [graphMapping, graphMatchstickTest, graphPackage] = await Promise.all([
    read(root, "indexing/graph/src/mapping.ts"),
    read(root, "indexing/graph/tests/mapping-fixtures.test.ts"),
    readJson(root, "indexing/graph/package.json"),
  ]);
  assert(!/ethereum\.call|try_[A-Za-z]|routeCount|setInterval|setTimeout|poll/i.test(graphMapping),
    "GRAPH_MAPPING_NOT_EVENT_ONLY");
  assert(graphPackage.devDependencies["matchstick-as"] === "0.6.0"
    && graphPackage.scripts["test:mapping"] === "graph test --version 0.6.0"
    && graphPackage.scripts.test.includes("test:fixtures")
    && graphPackage.scripts.test.includes("test:mapping"),
  "GRAPH_MATCHSTICK_COMMAND_NOT_PINNED");
  assert(graphMatchstickTest.includes('readFile("../fixtures/nexa-v6-events.json")')
    && graphMatchstickTest.includes('from "../src/mapping"')
    && !/0x[0-9a-f]{40,64}/i.test(graphMatchstickTest),
  "GRAPH_MATCHSTICK_NOT_CANONICAL_FIXTURE_DRIVEN");
  const mappedHandlers = [
    "handleNetworkRegisteredV6", "handleNetworkStatusChangedV6",
    "handleAssetRegisteredV6", "handleAssetStatusChangedV6",
    "handleRouteRegisteredV6", "handleRouteStatusChangedV6",
    "handleSourceIntakeConfigured", "handleSourceFillV6", "handleStandardModuleConfiguredV6",
  ];
  for (const handler of mappedHandlers) {
    assert(graphMatchstickTest.includes(handler + "(event)"),
      "GRAPH_MATCHSTICK_HANDLER_MISSING:" + handler);
  }

  const substreamsSource = await read(root, "indexing/substreams/src/lib.rs");
  assert((substreamsSource.match(/\bfn decode_log\b/g) ?? []).length === 1,
    "SUBSTREAMS_RAW_DECODER_COUNT_INVALID");
  assert(/fn map_nexa_v6_events[\s\S]+decode_log/.test(substreamsSource),
    "SUBSTREAMS_MAP_DOES_NOT_OWN_DECODING");
  for (const store of [
    "store_networks", "store_assets", "store_routes", "store_router_state",
    "store_standard_modules",
  ]) {
    const match = substreamsSource.match(new RegExp("fn " + store + "\\([\\s\\S]*?\\n\\}"));
    assert(match && /events: NexaV6Events/.test(match[0]) && !/decode_log|Block/.test(match[0]),
      "SUBSTREAMS_STORE_DUPLICATES_DECODING:" + store);
  }

  const indexingFiles = await listFiles(resolve(root, "indexing"));
  const runtimeSources = indexingFiles.filter((file) => (
    /(?:^|\/)(?:src|proto)\//.test(file) || /\.(?:yaml|graphql)$/.test(file)
  ));
  const forbidden = [
    [/\bDATABASE_URL\b|\bpostgres(?:ql)?\b|\bsqlx\b|\btokio_postgres\b|\bLISTEN\b/i,
      "INDEXING_DB_REFERENCE"],
    [/\bRPC_URL\b|\bJSON_RPC\b|process\.env|std::env|eth_call|eth_getLogs/i,
      "INDEXING_RPC_REFERENCE"],
    [/\bfetch\s*\(|\baxios\b|\breqwest\b|solver\.vsnexa\.com/i,
      "INDEXING_HTTP_REFERENCE"],
    [/\bprivate[_-]?key\b|\bmnemonic\b|\bsign_transaction\b|\bsend_transaction\b/i,
      "INDEXING_SIGNING_OR_TRANSACTION_REFERENCE"],
  ];
  for (const file of runtimeSources) {
    const source = await read(root, "indexing/" + file);
    for (const [pattern, code] of forbidden) {
      assert(!pattern.test(source), code + ":" + file);
    }
  }
  const generationSources = ["scripts/generate-indexing.mjs", "scripts/indexing-events.mjs"];
  for (const file of generationSources) {
    const source = await read(root, file);
    assert(!/process\.env|JsonRpcProvider|new\s+Contract|fetch\s*\(|https?\.request|\.query\s*\(|setInterval|setTimeout/i.test(source),
      "INDEXING_GENERATION_MUST_BE_OFFLINE:" + file);
  }

  assert(descriptor.status === "PACKAGE_READY"
    && descriptor.externalDeploymentStatus === "UNPUBLISHED"
    && descriptor.authoritative === false
    && descriptor.source === "ONCHAIN_EVENTS",
  "INDEXING_DESCRIPTOR_STATUS_INVALID");
  assert(descriptor.canonicalConfig === "./nexa-v6-indexing.json"
    && descriptor.canonicalFixtures === "./fixtures/nexa-v6-events.json"
    && descriptor.canonicalSignedFeed === "https://solver.vsnexa.com/api/v6/solver-feed"
    && descriptor.canonicalDiscovery
      === "https://solver.vsnexa.com/.well-known/nexa-solver.json",
  "INDEXING_DESCRIPTOR_CANONICAL_POINTER_DRIFT");
  assert(descriptor.graph.deploymentIds === null
    && descriptor.graph.graphqlUrls === null
    && descriptor.substreams.registryPackageIds === null,
  "INDEXING_DESCRIPTOR_ADVERTISES_UNPUBLISHED_IDS");
  assert(descriptor.executionInvariant.botSourceTransactions === 1
    && descriptor.executionInvariant.nexaDestinationTransactions === 1
    && descriptor.executionInvariant.totalTransactions === 2,
  "INDEXING_EXECUTION_INVARIANT_DRIFT");

  return {
    networks: NETWORKS.length,
    events: Object.keys(config.events).length,
    fixtures: fixtures.fixtures.length,
    generatedArtifacts: Object.keys(generated).length,
    graphHandlersExecutedByMatchstick: mappedHandlers.length,
    runtimeSourcesScanned: runtimeSources.length,
    generationSourcesScanned: generationSources.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await validateIndexingPackage(), null, 2));
}
