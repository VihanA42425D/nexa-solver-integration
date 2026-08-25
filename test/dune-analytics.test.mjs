import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));

const derivedFiles = [
  "overview.sql", "networks-current.sql", "assets-current.sql", "routes-current.sql",
  "route-status-history.sql", "router-state.sql", "standard-modules-current.sql",
  "source-fills.sql", "recent-activity.sql",
];
const requiredEvents = [
  "NetworkRegisteredV6", "NetworkStatusChangedV6", "AssetRegisteredV6",
  "AssetStatusChangedV6", "RouteRegisteredV6", "RouteStatusChangedV6",
  "SourceIntakeConfigured", "SourceFillV6", "StandardModuleConfiguredV6",
];

test("Dune manifest records one passive canonical pipeline", async () => {
  const manifest = await json("analytics/dune/dune-manifest.json");
  assert.equal(manifest.status, "DUNE_BASE_HYPEREVM_ANALYTICS_READY");
  assert.equal(manifest.mode, "PASSIVE_ONCHAIN_ANALYTICS");
  assert.equal(manifest.authoritative, false);
  assert.equal(manifest.ingestion, "DUNE_DIRECT_CHAIN");
  assert.equal(manifest.capabilities.queryReadWrite, "AVAILABLE");
  assert.equal(manifest.capabilities.materializedViews, "AVAILABLE");
  assert.equal(manifest.capabilities.dashboardWriteApi, "DUNE_NATIVE_DASHBOARD_API_UNAVAILABLE");
  assert.match(manifest.owner, /^[a-zA-Z0-9_]+$/);
  assert.match(manifest.canonicalQuery.url, /^https:\/\/dune\.com\/queries\/\d+$/);
  assert.equal(manifest.materializedView.name, "result_nexa_v6_events_canonical");
  assert.equal(manifest.materializedView.sourceQueryId, manifest.canonicalQuery.id);
  assert.equal(manifest.materializedView.isPrivate, false);
  assert.equal(manifest.materializedView.cron, "0 * * * *");
  assert.equal(manifest.materializedView.latestSuccessfulRefresh.state, "QUERY_STATE_COMPLETED");
  assert.equal(manifest.queries.length, 9);
  assert.deepEqual(manifest.activeNetworks, ["Base", "HyperEVM"]);
  assert.deepEqual(manifest.pendingNetworks, ["BNB Smart Chain"]);
  assert.equal(manifest.networkStatus["BNB Smart Chain"], "PENDING_DECODE");
  assert.equal(manifest.signedFeedIngested, false);
  assert.equal(manifest.permitApiIngested, false);
  assert.equal(manifest.nexaRpcUsed, false);
  assert.equal(manifest.nexaDbUsed, false);
  assert.equal(manifest.runtimeDependency, false);
});

test("Dune source bindings contain only discovered Dune metadata", async () => {
  const bindings = await json("analytics/dune/source-bindings.json");
  assert.equal(bindings.project, "nexa_v6");
  for (const slug of ["base", "hyperevm"]) {
    const network = bindings.networks[slug];
    assert.equal(network.status, "ACTIVE");
    assert.equal(network.decodeBackfillStatus, "QUERYABLE");
    assert.equal(network.tables.length, 9);
    assert.deepEqual(new Set(network.tables.map(({ event }) => event)), new Set(requiredEvents));
    for (const table of network.tables) {
      assert.match(table.table, new RegExp(`^nexa_v6_${slug}\\.`));
      assert.equal(table.status, "QUERYABLE");
      for (const forbidden of ["address", "chainId", "startBlock", "abi", "topic0"]) {
        assert.equal(Object.hasOwn(table, forbidden), false);
      }
    }
  }
  assert.equal(bindings.networks.bsc.status, "PENDING_DECODE");
  assert.equal(bindings.networks.bsc.tables.length, 0);
  assert.equal(JSON.stringify(bindings).includes("Pancake"), false);
});

test("only canonical SQL reads decoded tables and enforces canonical boundaries", async () => {
  const [config, canonical] = await Promise.all([
    json("indexing/nexa-v6-indexing.json"),
    read("analytics/dune/sql/canonical-events.sql"),
  ]);
  const decoded = canonical.match(/FROM nexa_v6_(?:base|hyperevm)\.[a-z0-9_]+/g) ?? [];
  assert.equal(decoded.length, 18);
  assert.equal(new Set(decoded).size, 18);
  assert.doesNotMatch(canonical, /nexa_v6_(?:bnb|bsc)|fake|raw logs/i);
  assert.match(canonical, /PARTITION BY event_id/);
  for (const graphNetwork of ["base", "hyper-evm"]) {
    const network = config.networks.find((item) => item.graphNetwork === graphNetwork);
    for (const key of ["registry", "router", "standardModuleRegistry"]) {
      const count = canonical.split(`evt_block_number >= ${network.contracts[key].startBlock}`).length - 1;
      assert.equal(count, network.contracts[key].events.length);
      assert.ok(canonical.includes(network.contracts[key].address.toLowerCase()));
    }
  }
  const requiredColumns = [
    "event_id", "chain_id", "chain_name", "contract_role", "contract_address",
    "event_name", "block_time", "block_number", "tx_hash", "event_index",
    "network_id", "asset_key", "route_id", "standard_id", "fill_id",
    "amount_in_raw", "execution_generation",
  ];
  for (const column of requiredColumns) assert.match(canonical, new RegExp(`\\b${column}\\b`));
});

test("all nine public analytics queries reuse only the canonical materialized view", async () => {
  const manifest = await json("analytics/dune/dune-manifest.json");
  const fullName = manifest.materializedView.fullName;
  for (const file of derivedFiles) {
    const sql = await read(`analytics/dune/sql/${file}`);
    assert.ok(sql.includes(fullName), `${file} must read the canonical MV`);
    assert.doesNotMatch(sql, /nexa_v6_(?:base|hyperevm|bnb|bsc|multichain)\./i);
    assert.doesNotMatch(sql, /(?:\.logs\b|graph|substreams|solver\.vsnexa|api\/v6)/i);
  }
  for (const file of ["networks-current.sql", "assets-current.sql", "routes-current.sql", "standard-modules-current.sql"]) {
    assert.match(await read(`analytics/dune/sql/${file}`), /PARTITION BY chain_id,/);
  }
});

test("sync script remains external, bounded, and header-authenticated", async () => {
  const source = await read("scripts/sync-dune-v6.mjs");
  assert.match(source, /process\.env\.DUNE_API_KEY/);
  assert.match(source, /"X-Dune-Api-Key": key/);
  assert.doesNotMatch(source, /api_key=/);
  assert.match(source, /maxChecks = 120/);
  assert.match(source, /--activate-bnb/);
  assert.match(source, /DUNE_BNB_ACTIVATION_GATE_FAILED/);
  assert.match(source, /NO DUNE MUTATIONS REQUIRED/);
  const productionRoots = ["src", "docs-ticket-worker"];
  for (const directory of productionRoots) {
    const visit = async (path) => {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const absolute = resolve(path, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        else assert.doesNotMatch(await readFile(absolute, "utf8"), /DUNE_API_KEY|api\.dune\.com/i);
      }
    };
    await visit(resolve(root, directory));
  }
  const config = await json("indexing/nexa-v6-indexing.json");
  assert.deepEqual(config.executionInvariant, {
    botSourceTransactions: 1, nexaDestinationTransactions: 1, totalTransactions: 2,
  });
});
