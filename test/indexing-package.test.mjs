import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateIndexingPackage } from "../scripts/validate-indexing.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));

test("canonical Graph/Substreams indexing package passes every repository hard gate", async () => {
  assert.deepEqual(await validateIndexingPackage(root), {
    networks: 3,
    events: 9,
    fixtures: 11,
    generatedArtifacts: 13,
    graphHandlersExecutedByMatchstick: 9,
    runtimeSourcesScanned: 12,
    generationSourcesScanned: 2,
  });
});

test("one canonical config supplies exact per-contract deployment starts to both indexers", async () => {
  const config = await readJson("indexing/nexa-v6-indexing.json");
  const expected = {
    base: [50143186, 50143190, 50143193, 50320644],
    bsc: [116699981, 116699987, 116699998, 117488361],
    "hyper-evm": [43533441, 43533563, 43533624, 43894134],
  };
  for (const network of config.networks) {
    assert.deepEqual([
      network.contracts.registry.startBlock,
      network.contracts.router.startBlock,
      network.contracts.standardModuleRegistry.startBlock,
      network.contracts.facade.startBlock,
    ], expected[network.graphNetwork]);
  }
});

test("indexing descriptor projects canonical external state and preserves passive 1+1", async () => {
  const descriptor = await readJson("indexing/indexing-manifest.json");
  assert.equal(descriptor.authoritative, false);
  assert.equal(descriptor.source, "ONCHAIN_EVENTS");
  assert.equal(descriptor.externalDeploymentStatus, "STUDIO_AND_REGISTRY_PUBLISHED");
  assert.deepEqual(descriptor.graph.supportedNetworks, ["base", "bsc"]);
  assert.equal(descriptor.graph.manifests["hyper-evm"], undefined);
  assert.deepEqual(descriptor.externalInfrastructure, {
    hosting: "MANAGED_EXTERNAL_INDEXERS",
    rpcConsumption: "INDEXER_MANAGED",
    selfHosted: false,
    nexaRpcUsed: false,
  });
  const hyper = descriptor.networks.find(({ graphNetwork }) => graphNetwork === "hyper-evm");
  assert.deepEqual(hyper, {
    graphNetwork: "hyper-evm",
    chainId: 999,
    subgraphSupported: false,
    subgraphStudioStatus: "UNSUPPORTED",
    indexingMode: "STANDALONE_SUBSTREAMS",
  });
  assert.deepEqual(descriptor.executionInvariant, {
    model: "1_BOT_SOURCE_TX_PLUS_1_NEXA_DESTINATION_TX",
    botSourceTransactions: 1,
    nexaDestinationTransactions: 1,
    totalTransactions: 2,
  });
});
