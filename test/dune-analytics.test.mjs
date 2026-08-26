import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  ACTIVATION_BASELINES,
  buildCanonicalSql,
  buildSourceBindings,
  contractEvents,
  evaluateNetworkStates,
  schemaTypeMatchesAbi,
  validateDownstreamExecutions,
} from "../scripts/sync-dune-v6.mjs";

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

function fixtureBindings(config) {
  return Object.fromEntries(["base", "hyperevm", "bsc"].map((slug) => {
    const duneSlug = slug === "bsc" ? "bnb" : slug;
    const bindings = contractEvents(config, slug).map((event) => ({
      contractRole: event.contractKey === "registry"
        ? "REGISTRY"
        : (event.contractKey === "router" ? "ROUTER" : "STANDARD_MODULE_REGISTRY"),
      contract: event.contractName,
      event: event.eventName,
      table: `nexa_v6_${duneSlug}.${event.contractName.toLowerCase()}_evt_${event.eventName.toLowerCase()}`,
      datasetId: `${slug}-${event.eventName}`,
      status: "QUERYABLE",
    }));
    return [slug, { expectedCount: 9, bindings }];
  }));
}

function fixtureStateResult(config, discovered, overrides = {}) {
  const resultRows = [];
  for (const slug of ["base", "hyperevm", "bsc"]) {
    for (const event of contractEvents(config, slug)) {
      const binding = discovered[slug].bindings.find(({ event: name }) => name === event.eventName);
      const canonicalRows = overrides[`${slug}:${event.eventName}`]
        ?? ACTIVATION_BASELINES[slug][event.eventName]
        ?? 0;
      resultRows.push({
        network_slug: slug,
        event_name: event.eventName,
        table_name: binding.table,
        table_rows: canonicalRows,
        canonical_rows: canonicalRows,
        pre_start_same_address_rows: 0,
        other_address_rows: 0,
        min_canonical_block: canonicalRows === 0 ? null : event.startBlock,
        max_canonical_block: canonicalRows === 0 ? null : event.startBlock,
      });
    }
  }
  return { result: { rows: resultRows } };
}

test("Dune manifest records one passive canonical pipeline", async () => {
  const manifest = await json("analytics/dune/dune-manifest.json");
  const final = manifest.status === "DUNE_ALL_NETWORKS_ANALYTICS_READY";
  assert.ok(final || manifest.status === "DUNE_V6_BACKFILLING");
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
  assert.equal(manifest.canonicalQuery.id, 8437473);
  assert.equal(manifest.queries.length, 9);
  assert.deepEqual(manifest.queries.map(({ id }) => id), [
    8437486, 8437487, 8437488, 8437489, 8437490,
    8437491, 8437492, 8437493, 8437494,
  ]);
  const expectedNetworkStatus = final ? "ACTIVE" : "BACKFILLING";
  assert.deepEqual(manifest.activeNetworks, final
    ? ["Base", "HyperEVM", "BNB Smart Chain"]
    : []);
  assert.deepEqual(manifest.pendingNetworks, final
    ? []
    : ["Base", "HyperEVM", "BNB Smart Chain"]);
  assert.deepEqual(manifest.networkStatus, {
    Base: expectedNetworkStatus,
    HyperEVM: expectedNetworkStatus,
    "BNB Smart Chain": expectedNetworkStatus,
  });
  assert.equal(manifest.lifecycle.resourceProvisioning, "COMPLETE");
  assert.deepEqual(new Set(Object.values(manifest.lifecycle.datasetDiscovery)), new Set(["DISCOVERED"]));
  assert.deepEqual(new Set(Object.values(manifest.lifecycle.decodeBackfill)),
    new Set([final ? "COMPLETE" : "BACKFILLING"]));
  assert.deepEqual(new Set(Object.values(manifest.lifecycle.analyticsActivation)),
    new Set([final ? "ACTIVE" : "GATED"]));
  if (final) {
    assert.deepEqual(manifest.validation.remoteMutations, [
      "PATCH /query/8437473",
      "POST /materialized-views/result_nexa_v6_events_canonical/refresh",
    ]);
    assert.deepEqual(new Set(Object.keys(manifest.validation.downstream)), new Set([
      "overview", "networksCurrent", "assetsCurrent", "routesCurrent",
      "routeStatusHistory", "routerState", "standardModules", "sourceFills",
      "recentActivity",
    ]));
  }
  assert.equal(manifest.signedFeedIngested, false);
  assert.equal(manifest.permitApiIngested, false);
  assert.equal(manifest.nexaRpcUsed, false);
  assert.equal(manifest.nexaDbUsed, false);
  assert.equal(manifest.runtimeDependency, false);
});

test("Dune source bindings contain only discovered Dune metadata", async () => {
  const [bindings, manifest] = await Promise.all([
    json("analytics/dune/source-bindings.json"),
    json("analytics/dune/dune-manifest.json"),
  ]);
  const final = manifest.status === "DUNE_ALL_NETWORKS_ANALYTICS_READY";
  assert.equal(bindings.project, "nexa_v6");
  for (const slug of ["base", "hyperevm", "bsc"]) {
    const network = bindings.networks[slug];
    assert.equal(network.status, final ? "ACTIVE" : "DISCOVERED");
    assert.equal(network.decodeBackfillStatus, final ? "COMPLETE" : "BACKFILLING");
    assert.equal(network.tables.length, 9);
    assert.deepEqual(new Set(network.tables.map(({ event }) => event)), new Set(requiredEvents));
    for (const table of network.tables) {
      const duneSlug = slug === "bsc" ? "bnb" : slug;
      assert.match(table.table, new RegExp(`^nexa_v6_${duneSlug}\\.`));
      assert.equal(table.status, "QUERYABLE");
      for (const forbidden of ["address", "chainId", "startBlock", "abi", "topic0"]) {
        assert.equal(Object.hasOwn(table, forbidden), false);
      }
    }
  }
  assert.equal(JSON.stringify(bindings).includes("Pancake"), false);
});

test("only canonical SQL reads decoded tables and enforces canonical boundaries", async () => {
  const [config, canonical, manifest] = await Promise.all([
    json("indexing/nexa-v6-indexing.json"),
    read("analytics/dune/sql/canonical-events.sql"),
    json("analytics/dune/dune-manifest.json"),
  ]);
  const final = manifest.status === "DUNE_ALL_NETWORKS_ANALYTICS_READY";
  const decoded = canonical.match(/FROM nexa_v6_(?:base|hyperevm|bnb)\.[a-z0-9_]+/g) ?? [];
  assert.equal(decoded.length, final ? 27 : 18);
  assert.equal(new Set(decoded).size, final ? 27 : 18);
  if (final) assert.match(canonical, /FROM nexa_v6_bnb\./);
  else assert.doesNotMatch(canonical, /nexa_v6_(?:bnb|bsc)/i);
  assert.doesNotMatch(canonical, /fake|raw logs/i);
  assert.match(canonical, /PARTITION BY event_id/);
  for (const graphNetwork of final ? ["base", "hyper-evm", "bsc"] : ["base", "hyper-evm"]) {
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

test("BNB tables and schemas alone cannot pass the historical activation gate", async () => {
  const config = await json("indexing/nexa-v6-indexing.json");
  const discovered = fixtureBindings(config);
  const states = evaluateNetworkStates(config, discovered, fixtureStateResult(config, discovered, {
    "bsc:RouteStatusChangedV6": 251,
  }));
  assert.equal(discovered.bsc.bindings.length, 9);
  assert.equal(states.base.status, "ACTIVE");
  assert.equal(states.hyperevm.status, "ACTIVE");
  assert.equal(states.bsc.status, "BACKFILLING");
  assert.deepEqual(states.bsc.incompleteHistory, [{
    event: "RouteStatusChangedV6", minimum: 252, actual: 251,
  }]);
  const bindings = buildSourceBindings(discovered, null, states);
  assert.equal(bindings.networks.bsc.status, "DISCOVERED");
  assert.equal(bindings.networks.bsc.decodeBackfillStatus, "BACKFILLING");
});

test("complete historical state produces ACTIVE/COMPLETE bindings for all networks", async () => {
  const config = await json("indexing/nexa-v6-indexing.json");
  const discovered = fixtureBindings(config);
  const states = evaluateNetworkStates(config, discovered, fixtureStateResult(config, discovered));
  const bindings = buildSourceBindings(discovered, null, states);
  for (const slug of ["base", "hyperevm", "bsc"]) {
    assert.equal(states[slug].status, "ACTIVE");
    assert.equal(bindings.networks[slug].status, "ACTIVE");
    assert.equal(bindings.networks[slug].decodeBackfillStatus, "COMPLETE");
  }
});

test("noncanonical decoded rows fail collision safety", async () => {
  const config = await json("indexing/nexa-v6-indexing.json");
  const discovered = fixtureBindings(config);
  const fixture = fixtureStateResult(config, discovered);
  const unsafe = fixture.result.rows.find((row) =>
    row.network_slug === "bsc" && row.event_name === "NetworkRegisteredV6");
  unsafe.table_rows += 1;
  unsafe.other_address_rows = 1;
  const states = evaluateNetworkStates(config, discovered, fixture);
  assert.equal(states.bsc.status, "BACKFILLING");
  assert.deepEqual(states.bsc.unsafeHistory, ["NetworkRegisteredV6:NONCANONICAL_ADDRESS_ROWS"]);
  assert.equal(states.bsc.collisionProtection, "UNSAFE");
});

test("all downstream validation enforces canonical three-chain minimums", () => {
  const repeated = (chainId, count) => Array.from({ length: count }, () => ({ chain_id: chainId }));
  const executions = new Map([
    ["overview", { result: { rows: [
      { chain_id: 8453, registered_networks: 3, registered_assets: 19,
        registered_routes: 108, current_route_states: "1=108", configured_standard_modules: 2,
        source_intake_events: 1, source_fill_count: 9 },
      { chain_id: 56, registered_networks: 3, registered_assets: 19,
        registered_routes: 126, current_route_states: "1=126", configured_standard_modules: 2,
        source_intake_events: 0, source_fill_count: 0 },
      { chain_id: 999, registered_networks: 3, registered_assets: 19,
        registered_routes: 108, current_route_states: "1=108", configured_standard_modules: 2,
        source_intake_events: 0, source_fill_count: 0 },
    ] } }],
    ["networksCurrent", { result: { rows: [
      ...repeated(8453, 3), ...repeated(56, 3), ...repeated(999, 3),
    ] } }],
    ["assetsCurrent", { result: { rows: [
      ...repeated(8453, 19), ...repeated(56, 19), ...repeated(999, 19),
    ] } }],
    ["routesCurrent", { result: { rows: [
      ...repeated(8453, 108), ...repeated(56, 126), ...repeated(999, 108),
    ] } }],
    ["routeStatusHistory", { result: { rows: [
      ...repeated(8453, 216), ...repeated(56, 252), ...repeated(999, 216),
    ] } }],
    ["routerState", { result: { rows: repeated(8453, 1) } }],
    ["standardModules", { result: { rows: [
      ...repeated(8453, 2), ...repeated(56, 2), ...repeated(999, 2),
    ] } }],
    ["sourceFills", { result: { rows: repeated(8453, 9) } }],
    ["recentActivity", { result: { rows: [
      ...repeated(8453, 1), ...repeated(56, 1), ...repeated(999, 1),
    ] } }],
  ]);
  const validation = validateDownstreamExecutions(executions);
  assert.equal(validation.overview["BNB Smart Chain"].registeredRoutes, 126);
  assert.equal(validation.routesCurrent.rowsByChain["BNB Smart Chain"], 126);
  assert.equal(validation.sourceFills.rowsByChain.Base, 9);
});

test("Dune decoded payload types must preserve canonical ABI semantics", () => {
  assert.equal(schemaTypeMatchesAbi("varbinary", "bytes32"), true);
  assert.equal(schemaTypeMatchesAbi("varbinary", "address"), true);
  assert.equal(schemaTypeMatchesAbi("boolean", "bool"), true);
  assert.equal(schemaTypeMatchesAbi("uint256", "uint128"), true);
  assert.equal(schemaTypeMatchesAbi("varchar", "uint128"), false);
  assert.equal(schemaTypeMatchesAbi("bigint", "bytes32"), false);
});

test("future BNB SQL reuses the canonical generator and requires every collision boundary", async () => {
  const config = await json("indexing/nexa-v6-indexing.json");
  const discovered = fixtureBindings(config);
  const currentSql = buildCanonicalSql(config, discovered, false);
  const candidateSql = buildCanonicalSql(config, discovered, true);
  const normalized = (sql) => /WITH normalized AS \(\n([\s\S]*?)\n\),\nranked/.exec(sql)[1];
  assert.ok(normalized(candidateSql).startsWith(normalized(currentSql)));
  assert.equal((candidateSql.match(/\bFROM\s+nexa_v6_(?:base|hyperevm|bnb)\./g) ?? []).length, 27);
  const bnb = config.networks.find(({ graphNetwork }) => graphNetwork === "bsc");
  for (const contractKey of ["registry", "router", "standardModuleRegistry"]) {
    const contract = bnb.contracts[contractKey];
    assert.equal(
      candidateSql.split(`evt_block_number >= ${contract.startBlock}`).length - 1,
      contract.events.length,
    );
    assert.equal(
      candidateSql.split(`AND contract_address = ${contract.address.toLowerCase()}`).length - 1,
      contract.events.length * 3,
    );
  }
});

test("sync script remains external, bounded, and header-authenticated", async () => {
  const source = await read("scripts/sync-dune-v6.mjs");
  assert.match(source, /process\.env\.DUNE_API_KEY/);
  assert.match(source, /"X-Dune-Api-Key": key/);
  assert.doesNotMatch(source, /api_key=/);
  assert.match(source, /maxChecks = 120/);
  assert.match(source, /--activate-bnb/);
  assert.match(source, /DUNE_DECODE_BACKFILL_INCOMPLETE/);
  assert.match(source, /DUNE_BNB_ADDRESS_HISTORY_UNSAFE/);
  assert.match(source, /materialized-views\/\$\{encodeURIComponent\(MV_NAME\)\}\/refresh/);
  assert.match(source, /\/sql\/execute/);
  assert.match(source, /NO DUNE MUTATIONS REQUIRED/);
  const main = source.slice(source.indexOf("async function main"));
  assert.ok(main.indexOf("DUNE_DECODE_BACKFILL_INCOMPLETE") < main.indexOf("const canonical = apply"));
  assert.doesNotMatch(main, /executeQueryOnce\(canonical\.id/);
  assert.equal((main.match(/materialized-views\/\$\{encodeURIComponent\(MV_NAME\)\}\/refresh/g) ?? []).length, 2);
  assert.match(main, /remoteMutations=\$\{remoteMutationCount\}/);
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
