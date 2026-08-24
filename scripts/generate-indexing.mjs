import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Interface, ZeroAddress, getAddress } from "ethers";
import {
  INDEXED_EVENT_DEFINITIONS,
  buildIndexedEventsBundle,
} from "./indexing-events.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (repositoryRoot, file) => JSON.parse(
  await readFile(resolve(repositoryRoot, file), "utf8"),
);
const NETWORK_ORDER = Object.freeze(["base", "bsc", "hyper-evm"]);
const GRAPH_NETWORKS = Object.freeze(new Set(["base", "bsc"]));
const OBSOLETE_GENERATED_ARTIFACTS = Object.freeze([
  "indexing/graph/subgraph.hyper-evm.yaml",
]);
const CONTRACT_EVENTS = Object.freeze({
  registry: Object.freeze([
    "NetworkRegisteredV6", "NetworkStatusChangedV6",
    "AssetRegisteredV6", "AssetStatusChangedV6",
    "RouteRegisteredV6", "RouteStatusChangedV6",
  ]),
  router: Object.freeze(["SourceIntakeConfigured", "SourceFillV6"]),
  standardModuleRegistry: Object.freeze(["StandardModuleConfiguredV6"]),
});
const CONTRACT_ABI_NAMES = Object.freeze({
  registry: "NexaMainnetRegistryV6",
  router: "NexaMainnetRouterV6",
  standardModuleRegistry: "NexaStandardModuleRegistryV6",
});

function fail(code) {
  throw new Error(code);
}

function normalizeValue(type, value) {
  if (type === "address") return getAddress(value).toLowerCase();
  if (type.startsWith("uint") || type.startsWith("int")) return value.toString();
  if (type.startsWith("bytes")) return String(value).toLowerCase();
  return value;
}

function graphHandlerSignature(event) {
  return `${event.signature.slice(0, event.signature.indexOf("("))}(${event.fields
    .map((field) => `${field.indexed ? "indexed " : ""}${field.type}`).join(",")})`;
}

function graphContext(chainId, releaseId, contract, standards) {
  const lines = [
    "    context:",
    "      chainId:", "        type: BigInt", `        data: '${chainId}'`,
    "      releaseId:", "        type: Bytes", `        data: '${releaseId}'`,
    "      contractName:", "        type: String", `        data: '${contract.contract}'`,
    "      startBlock:", "        type: BigInt", `        data: '${contract.startBlock}'`,
    "      runtimeCodeHash:", "        type: Bytes", `        data: '${contract.runtimeCodeHash}'`,
  ];
  if (contract.contract === "NexaStandardModuleRegistryV6") {
    lines.push(
      "      erc7683StandardId:", "        type: Bytes",
      `        data: '${standards.erc7683.standardId}'`,
      "      oifStandardId:", "        type: Bytes",
      `        data: '${standards.oif.standardId}'`,
    );
  }
  return lines;
}

function graphDataSource(network, key, config) {
  const contract = network.contracts[key];
  const abiName = CONTRACT_ABI_NAMES[key];
  const events = CONTRACT_EVENTS[key].map((name) => config.events[name]);
  return [
    "  - kind: ethereum",
    `    name: ${abiName}`,
    `    network: ${network.graphNetwork}`,
    "    source:",
    `      address: '${contract.address}'`,
    `      abi: ${abiName}`,
    `      startBlock: ${contract.startBlock}`,
    ...graphContext(network.chainId, config.releaseId, contract, config.standards),
    "    mapping:",
    "      kind: ethereum/events",
    "      apiVersion: 0.0.9",
    "      language: wasm/assemblyscript",
    "      entities:",
    ...[
      "ProtocolDeployment", "Network", "NetworkStatusChange", "Asset",
      "AssetStatusChange", "Route", "RouteStatusChange", "RouterState",
      "SourceIntakeChange", "SourceFill", "StandardModule", "StandardModuleChange",
    ].map((entity) => `        - ${entity}`),
    "      abis:",
    `        - name: ${abiName}`,
    `          file: ./abis/${abiName}.json`,
    "      eventHandlers:",
    ...events.flatMap((event) => [
      `        - event: ${graphHandlerSignature(event)}`,
      `          handler: handle${event.signature.slice(0, event.signature.indexOf("("))}`,
    ]),
    "      file: ./src/mapping.ts",
  ].join("\n");
}

function graphManifest(network, config) {
  return [
    "specVersion: 1.3.0",
    "indexerHints:",
    "  prune: auto",
    "schema:",
    "  file: ./schema.graphql",
    "dataSources:",
    graphDataSource(network, "registry", config),
    graphDataSource(network, "router", config),
    graphDataSource(network, "standardModuleRegistry", config),
    "",
  ].join("\n");
}

function substreamsManifest(network, config) {
  const initialBlock = Math.min(
    network.contracts.registry.startBlock,
    network.contracts.router.startBlock,
    network.contracts.standardModuleRegistry.startBlock,
  );
  const params = [
    `chain_id=${network.chainId}`,
    `registry=${network.contracts.registry.address.toLowerCase()}`,
    `router=${network.contracts.router.address.toLowerCase()}`,
    `standard_module_registry=${network.contracts.standardModuleRegistry.address.toLowerCase()}`,
    `erc7683_standard_id=${config.standards.erc7683.standardId}`,
    `oif_standard_id=${config.standards.oif.standardId}`,
  ].join("&");
  return `specVersion: v0.1.0
package:
  name: nexa_v6_indexing_${network.graphNetwork.replaceAll("-", "_")}
  version: v1.0.0
  url: https://github.com/VihanA42425D/nexa-solver-integration
  description: Passive non-authoritative Nexa V6 onchain event projection.
network: ${network.graphNetwork}
protobuf:
  files:
    - nexa/v6/indexing.proto
  importPaths:
    - ./proto
binaries:
  default:
    type: wasm/rust-v1
    file: ./target/wasm32-unknown-unknown/release/nexa_v6_substreams.wasm
modules:
  - name: map_nexa_v6_events
    kind: map
    initialBlock: ${initialBlock}
    inputs:
      - params: string
      - source: sf.ethereum.type.v2.Block
    output:
      type: proto:nexa.v6.NexaV6Events
  - name: store_networks
    kind: store
    initialBlock: ${initialBlock}
    updatePolicy: set
    valueType: proto:nexa.v6.NetworkState
    inputs:
      - map: map_nexa_v6_events
  - name: store_assets
    kind: store
    initialBlock: ${initialBlock}
    updatePolicy: set
    valueType: proto:nexa.v6.AssetState
    inputs:
      - map: map_nexa_v6_events
  - name: store_routes
    kind: store
    initialBlock: ${initialBlock}
    updatePolicy: set
    valueType: proto:nexa.v6.RouteState
    inputs:
      - map: map_nexa_v6_events
  - name: store_router_state
    kind: store
    initialBlock: ${initialBlock}
    updatePolicy: set
    valueType: proto:nexa.v6.RouterState
    inputs:
      - map: map_nexa_v6_events
  - name: store_standard_modules
    kind: store
    initialBlock: ${initialBlock}
    updatePolicy: set
    valueType: proto:nexa.v6.StandardModuleState
    inputs:
      - map: map_nexa_v6_events
params:
  map_nexa_v6_events: "${params}"
`;
}

function eventAbiFiles(events) {
  const grouped = {};
  for (const [name, definition] of Object.entries(INDEXED_EVENT_DEFINITIONS)) {
    const fragment = new Interface([definition.abi]).getEvent(name);
    (grouped[definition.contract] ??= []).push(JSON.parse(fragment.format("json")));
  }
  return Object.fromEntries(Object.entries(grouped)
    .map(([contract, abi]) => [`indexing/graph/abis/${contract}.json`, `${JSON.stringify(abi, null, 2)}\n`]));
}

function rustTopicConstants(events) {
  const constantName = (name) => name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
  const rows = [
    "// Generated from indexing/nexa-v6-indexing.json; do not edit independently.",
  ];
  for (const [name, event] of Object.entries(events)) {
    const bytes = event.topic0.slice(2).match(/../g).map((value) => Number.parseInt(value, 16));
    rows.push("#[rustfmt::skip]");
    rows.push(`pub const ${constantName(name)}_TOPIC: [u8; 32] = [${bytes.join(", ")}];`);
  }
  return `${rows.join("\n")}\n`;
}

function standardKind(standardId, standards) {
  const value = standardId.toLowerCase();
  if (value === standards.erc7683.standardId.toLowerCase()) return "ERC_7683_EXECUTABLE";
  if (value === standards.oif.standardId.toLowerCase()) return "OIF_DISCOVERY_DESCRIPTION_ONLY";
  return "UNKNOWN";
}

function fixtureSet(config) {
  const bytes = (value) => `0x${value.repeat(64 / value.length)}`;
  const address = (value) => getAddress(`0x${value.repeat(40 / value.length)}`);
  const networkId = bytes("11");
  const vmType = bytes("22");
  const assetKey = bytes("33");
  const assetId = bytes("44");
  const routeId = bytes("55");
  const fillId = bytes("66");
  const quoteId = bytes("77");
  const permitNonce = bytes("88");
  const generation = bytes("99");
  const registry = config.networks[0].contracts.registry.address;
  const router = config.networks[0].contracts.router.address;
  const modules = config.networks[0].contracts.standardModuleRegistry.address;
  const definitions = [
    ["network-registered", "NetworkRegisteredV6", [networkId, vmType, bytes("aa"), bytes("bb")], registry],
    ["network-status-registered", "NetworkStatusChangedV6", [networkId, 0, 1, 1], registry],
    ["asset-registered", "AssetRegisteredV6", [assetKey, networkId, assetId, address("12"), true, bytes("cc")], registry],
    ["asset-status-registered", "AssetStatusChangedV6", [assetKey, 0, 1, 1], registry],
    ["route-registered", "RouteRegisteredV6", [routeId, networkId, bytes("de"), assetId, bytes("ef")], registry],
    ["route-status-registered", "RouteStatusChangedV6", [routeId, 0, 1, address("34"), 1], registry],
    ["route-status-active", "RouteStatusChangedV6", [routeId, 1, 2, address("34"), 2], registry],
    ["router-intake", "SourceIntakeConfigured", [true, address("34")], router],
    ["source-fill", "SourceFillV6", [
      fillId, routeId, quoteId, address("56"), address("78"), address("9a"), address("bc"),
      56, 1000000, 995000, 12, 2000000000, permitNonce, generation,
    ], router],
    ["standard-erc7683", "StandardModuleConfiguredV6", [
      config.standards.erc7683.standardId, ZeroAddress, config.standards.erc7683.moduleAddress,
    ], modules],
    ["standard-oif", "StandardModuleConfiguredV6", [
      config.standards.oif.standardId, ZeroAddress, config.standards.oif.moduleAddress,
    ], modules],
  ];
  const fixtures = definitions.map(([fixtureId, eventName, values, emitter], index) => {
    const definition = INDEXED_EVENT_DEFINITIONS[eventName];
    const iface = new Interface([definition.abi]);
    const fragment = iface.getEvent(eventName);
    const encoded = iface.encodeEventLog(fragment, values);
    const expectedNormalized = Object.fromEntries(fragment.inputs.map((input, fieldIndex) => [
      input.name, normalizeValue(input.type, values[fieldIndex]),
    ]));
    if (eventName === "StandardModuleConfiguredV6") {
      expectedNormalized.standardKind = standardKind(values[0], config.standards);
    }
    return {
      fixtureId,
      eventName,
      address: getAddress(emitter).toLowerCase(),
      topics: encoded.topics.map((topic) => topic.toLowerCase()),
      data: encoded.data.toLowerCase(),
      provenance: {
        chainId: "8453",
        blockNumber: String(51000000 + index),
        blockTimestamp: String(2000000100 + index),
        transactionHash: `0x${(index + 1).toString(16).padStart(64, "0")}`,
        logIndex: index,
      },
      expectedNormalized,
    };
  });
  return {
    schema: "NEXA_V6_INDEXING_CANONICAL_FIXTURES_V1",
    generatedFrom: "CANONICAL_INDEXING_EVENTS_AND_STANDARDS",
    fixtures,
  };
}

export async function buildCanonicalIndexingConfig(
  repositoryRoot = root,
  suppliedExternalDeployments = null,
) {
  const [integration, evidence, standardsManifest, externalDeployments] = await Promise.all([
    readJson(repositoryRoot, "nexa-mainnet-v6.json"),
    readJson(repositoryRoot, "verification/indexing-deployment-evidence.json"),
    readJson(repositoryRoot, "standards/nexa-standards.json"),
    suppliedExternalDeployments
      ? Promise.resolve(suppliedExternalDeployments)
      : readJson(repositoryRoot, "indexing/external-deployments.json"),
  ]);
  const eventsBundle = buildIndexedEventsBundle();
  if (integration.releaseId !== evidence.releaseId
      || integration.releaseId !== standardsManifest.releaseId) {
    fail("INDEXING_RELEASE_ID_DRIFT");
  }
  const standards = {
    erc7683: {
      standardId: standardsManifest.standards.erc7683.standardId,
      moduleAddress: getAddress(standardsManifest.standards.erc7683.moduleAddress),
      executable: true,
      compatibilityLevel: standardsManifest.standards.erc7683.compatibilityLevel,
    },
    oif: {
      standardId: standardsManifest.standards.oif.standardId,
      moduleAddress: getAddress(standardsManifest.standards.oif.moduleAddress),
      executable: false,
      compatibilityLevel: standardsManifest.standards.oif.compatibilityLevel,
    },
  };
  const networks = NETWORK_ORDER.map((graphNetwork) => {
    const source = evidence.networks[graphNetwork];
    const graphDeployment = externalDeployments.graph[graphNetwork];
    if (!source) fail(`INDEXING_NETWORK_EVIDENCE_MISSING:${graphNetwork}`);
    if (!graphDeployment) fail(`INDEXING_EXTERNAL_GRAPH_STATE_MISSING:${graphNetwork}`);
    const contracts = structuredClone(source.contracts);
    if (getAddress(contracts.registry.address) !== getAddress(integration.contracts.NexaMainnetRegistryV6.address)
        || getAddress(contracts.router.address) !== getAddress(integration.contracts.NexaMainnetRouterV6.address)
        || getAddress(contracts.facade.address) !== getAddress(integration.contracts.NexaSolverDiscoveryV6.address)) {
      fail(`INDEXING_PUBLIC_CONTRACT_DRIFT:${graphNetwork}`);
    }
    for (const [key, names] of Object.entries(CONTRACT_EVENTS)) {
      contracts[key].events = names.map((name) => ({ name, ...eventsBundle.events[name] }));
    }
    contracts.facade.events = [];
    return {
      graphNetwork,
      chainId: source.chainId,
      subgraphSupported: graphDeployment.subgraphSupported,
      subgraphStudioStatus: graphDeployment.studioStatus,
      indexingMode: graphDeployment.indexingMode,
      releaseId: integration.releaseId,
      contracts,
    };
  });
  return {
    schema: "NEXA_V6_CANONICAL_INDEXING_CONFIG_V1",
    version: "1.0.0",
    protocol: "Nexa V6",
    status: "PACKAGE_READY",
    authoritative: false,
    source: "ONCHAIN_EVENTS",
    generatedFrom: [
      "nexa-mainnet-v6.json",
      "verification/indexing-deployment-evidence.json",
      "indexing/external-deployments.json",
      "events/events.json",
      "standards/nexa-standards.json",
    ],
    releaseId: integration.releaseId,
    networks,
    events: eventsBundle.events,
    standards,
    executionInvariant: standardsManifest.executionInvariant,
  };
}

function externalDeploymentStatus(externalDeployments) {
  const graphPublished = [...GRAPH_NETWORKS]
    .every((network) => externalDeployments.graph[network].studioStatus === "DEPLOYED");
  const substreamsPublished = NETWORK_ORDER
    .every((network) => externalDeployments.substreams[network].registryStatus === "PUBLISHED");
  if (graphPublished && substreamsPublished) return "STUDIO_AND_REGISTRY_PUBLISHED";
  const anyPublished = [...GRAPH_NETWORKS]
    .some((network) => externalDeployments.graph[network].studioStatus === "DEPLOYED")
    || NETWORK_ORDER.some(
      (network) => externalDeployments.substreams[network].registryStatus === "PUBLISHED",
    );
  return anyPublished ? "PARTIALLY_PUBLISHED" : "UNPUBLISHED";
}

function indexingDescriptor(config, externalDeployments) {
  return {
    schema: "NEXA_V6_INDEXING_PACKAGE_MANIFEST_V1",
    version: "1.0.0",
    protocol: "Nexa V6",
    status: "PACKAGE_READY",
    authoritative: false,
    authority: ["ONCHAIN_REGISTRY_ROUTER", "SIGNED_FEED", "EXECUTION_PERMIT"],
    source: "ONCHAIN_EVENTS",
    externalDeploymentStatus: externalDeploymentStatus(externalDeployments),
    canonicalConfig: "./nexa-v6-indexing.json",
    canonicalFixtures: "./fixtures/nexa-v6-events.json",
    externalDeployments: "./external-deployments.json",
    externalInfrastructure: structuredClone(externalDeployments.infrastructure),
    networks: config.networks.map(({
      graphNetwork, chainId, subgraphSupported, subgraphStudioStatus, indexingMode,
    }) => ({
      graphNetwork, chainId, subgraphSupported, subgraphStudioStatus, indexingMode,
    })),
    graph: {
      schema: "./graph/schema.graphql",
      sharedMapping: "./graph/src/mapping.ts",
      supportedNetworks: [...GRAPH_NETWORKS],
      manifests: Object.fromEntries(config.networks
        .filter((network) => network.subgraphSupported)
        .map((network) => [
          network.graphNetwork, `./graph/subgraph.${network.graphNetwork}.yaml`,
        ])),
      deployments: structuredClone(externalDeployments.graph),
    },
    substreams: {
      sharedRust: "./substreams/src",
      sharedProtobuf: "./substreams/proto/nexa/v6/indexing.proto",
      manifests: Object.fromEntries(config.networks.map((network) => [
        network.graphNetwork, `./substreams/substreams.${network.graphNetwork}.yaml`,
      ])),
      deployments: structuredClone(externalDeployments.substreams),
    },
    indexedContracts: [
      "NexaMainnetRegistryV6", "NexaMainnetRouterV6", "NexaStandardModuleRegistryV6",
    ],
    indexedEvents: Object.keys(config.events),
    canonicalSignedFeed: "https://solver.vsnexa.com/api/v6/solver-feed",
    canonicalDiscovery: "https://solver.vsnexa.com/.well-known/nexa-solver.json",
    canonicalOnchainDiscovery: "https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json",
    executionInvariant: {
      model: "1_BOT_SOURCE_TX_PLUS_1_NEXA_DESTINATION_TX",
      ...config.executionInvariant,
    },
  };
}

export async function buildIndexingArtifacts(repositoryRoot = root) {
  const externalDeployments = await readJson(repositoryRoot, "indexing/external-deployments.json");
  const config = await buildCanonicalIndexingConfig(repositoryRoot, externalDeployments);
  const events = buildIndexedEventsBundle();
  const files = {
    "events/events.json": `${JSON.stringify(events, null, 2)}\n`,
    "indexing/nexa-v6-indexing.json": `${JSON.stringify(config, null, 2)}\n`,
    "indexing/indexing-manifest.json": `${JSON.stringify(
      indexingDescriptor(config, externalDeployments), null, 2,
    )}\n`,
    "indexing/fixtures/nexa-v6-events.json": `${JSON.stringify(fixtureSet(config), null, 2)}\n`,
    "indexing/substreams/src/generated.rs": rustTopicConstants(events.events),
    ...eventAbiFiles(events.events),
  };
  for (const network of config.networks) {
    if (network.subgraphSupported) {
      files[`indexing/graph/subgraph.${network.graphNetwork}.yaml`] = graphManifest(network, config);
    }
    files[`indexing/substreams/substreams.${network.graphNetwork}.yaml`] = substreamsManifest(network, config);
  }
  return files;
}

export async function generateIndexing(repositoryRoot = root) {
  const files = await buildIndexingArtifacts(repositoryRoot);
  for (const [file, content] of Object.entries(files)) {
    const output = resolve(repositoryRoot, file);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, "utf8");
  }
  for (const file of OBSOLETE_GENERATED_ARTIFACTS) {
    await rm(resolve(repositoryRoot, file), { force: true });
  }
  return Object.keys(files);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Generated ${(await generateIndexing()).length} canonical indexing artifacts`);
}
