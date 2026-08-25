#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DUNE_ROOT = resolve(ROOT, "analytics/dune");
const SQL_ROOT = resolve(DUNE_ROOT, "sql");
const API = "https://api.dune.com/api/v1";
const CANONICAL_NAME = "Nexa V6 — Canonical Onchain Events";
const MV_NAME = "result_nexa_v6_events_canonical";
const CRON = "0 * * * *";
const TAGS = ["nexa-v6", "passive-onchain-analytics"];
const EXPECTED_QUERY_IDS = Object.freeze({
  canonical: 8437473,
  overview: 8437486,
  networksCurrent: 8437487,
  assetsCurrent: 8437488,
  routesCurrent: 8437489,
  routeStatusHistory: 8437490,
  routerState: 8437491,
  standardModules: 8437492,
  sourceFills: 8437493,
  recentActivity: 8437494,
});
const ACTIVATION_BASELINES = Object.freeze({
  base: Object.freeze({
    NetworkRegisteredV6: 3,
    AssetRegisteredV6: 19,
    RouteRegisteredV6: 108,
    RouteStatusChangedV6: 216,
    StandardModuleConfiguredV6: 2,
    SourceIntakeConfigured: 1,
    SourceFillV6: 9,
  }),
  hyperevm: Object.freeze({
    NetworkRegisteredV6: 3,
    AssetRegisteredV6: 19,
    RouteRegisteredV6: 108,
    RouteStatusChangedV6: 216,
    StandardModuleConfiguredV6: 2,
  }),
  bsc: Object.freeze({
    NetworkRegisteredV6: 3,
    AssetRegisteredV6: 19,
    RouteRegisteredV6: 126,
    RouteStatusChangedV6: 252,
    StandardModuleConfiguredV6: 2,
  }),
});
const MODES = new Set(["--audit", "--apply", "--activate-bnb"]);
const mode = process.argv[2] ?? "--audit";
if (!MODES.has(mode) || process.argv.length > 3) {
  throw new Error("Usage: node scripts/sync-dune-v6.mjs [--audit|--apply|--activate-bnb]");
}

const activeSlugs = ["base", "hyperevm"];
const networkNames = { base: "Base", hyperevm: "HyperEVM", bsc: "BNB Smart Chain" };
const roleByKey = {
  registry: "REGISTRY",
  router: "ROUTER",
  standardModuleRegistry: "STANDARD_MODULE_REGISTRY",
};
const requiredContracts = Object.keys(roleByKey);
const standardColumns = new Set([
  "contract_address", "evt_tx_hash", "evt_tx_from", "evt_tx_to", "evt_tx_index",
  "evt_index", "evt_block_time", "evt_block_number", "evt_block_date",
]);
const payloadColumns = [
  ["network_id", "varchar"], ["vm_type", "varchar"],
  ["network_reference", "varchar"], ["metadata_hash", "varchar"],
  ["asset_key", "varchar"], ["asset_id", "varchar"],
  ["local_address", "varchar"], ["has_local_binding", "boolean"],
  ["route_id", "varchar"], ["source_network_id", "varchar"],
  ["destination_network_id", "varchar"], ["source_asset_id", "varchar"],
  ["destination_asset_id", "varchar"], ["previous_status", "bigint"],
  ["status", "bigint"], ["generation", "bigint"], ["actor", "varchar"],
  ["source_intake_enabled", "boolean"], ["standard_id", "varchar"],
  ["previous_module", "varchar"], ["module", "varchar"],
  ["fill_id", "varchar"], ["quote_id", "varchar"], ["payer", "varchar"],
  ["recipient", "varchar"], ["source_asset", "varchar"],
  ["destination_asset", "varchar"], ["destination_chain_id", "varchar"],
  ["amount_in_raw", "varchar"], ["amount_out_raw", "varchar"],
  ["source_finality_blocks", "bigint"], ["settlement_deadline", "bigint"],
  ["permit_nonce", "varchar"], ["execution_generation", "varchar"],
];
const fieldNames = {
  networkId: "network_id", vmType: "vm_type", networkReference: "network_reference",
  metadataHash: "metadata_hash", assetKey: "asset_key", assetId: "asset_id",
  localAddress: "local_address", hasLocalBinding: "has_local_binding",
  routeId: "route_id", sourceNetworkId: "source_network_id",
  destinationNetworkId: "destination_network_id", sourceAssetId: "source_asset_id",
  destinationAssetId: "destination_asset_id", previousStatus: "previous_status",
  status: "status", generation: "generation", actor: "actor",
  enabled: "source_intake_enabled", standardId: "standard_id",
  previousModule: "previous_module", module: "module", fillId: "fill_id",
  quoteId: "quote_id", payer: "payer", recipient: "recipient",
  sourceAsset: "source_asset", destinationAsset: "destination_asset",
  destinationChainId: "destination_chain_id", amountInRaw: "amount_in_raw",
  amountOutRaw: "amount_out_raw", sourceFinalityBlocks: "source_finality_blocks",
  settlementDeadline: "settlement_deadline", permitNonce: "permit_nonce",
  executionGeneration: "execution_generation",
};

const readText = (path) => readFile(resolve(ROOT, path), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const stableJson = (value) => JSON.stringify(value, null, 2) + "\n";
const normalizeSql = (value) => String(value ?? "").replaceAll("\r\n", "\n").trim();
const sameSet = (left, right) => left.size === right.size && [...left].every((x) => right.has(x));
const schemaType = (field) => String(field?.type ?? field?.data_type ?? field?.dataType ?? "").toLowerCase();
const schemaTypeMatchesAbi = (actualType, abiType) => {
  if (/^(?:address|bytes\d*)$/.test(abiType)) {
    return /(?:varbinary|binary|bytea|address|bytes)/.test(actualType);
  }
  if (abiType === "bool") return /bool/.test(actualType);
  if (/^(?:u?int)\d*$/.test(abiType)) return /(?:int|decimal|numeric)/.test(actualType);
  return actualType === abiType.toLowerCase();
};
const hex = (column) => `concat('0x', lower(to_hex("${column}")))`;
const address = (column) => `concat('0x', lower(to_hex("${column}")))`;
const nullable = (type) => `CAST(NULL AS ${type})`;
let remoteMutationCount = 0;

const key = process.env.DUNE_API_KEY;

async function api(path, { method = "GET", body } = {}) {
  if (!key) throw new Error("DUNE_API_KEY is required in the process environment");
  if ((method === "PATCH" && path.startsWith("/query/"))
    || (method === "POST" && (path === "/query" || path === "/materialized-views"))) {
    remoteMutationCount += 1;
  }
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "X-Dune-Api-Key": key,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { error: text }; }
  if (!response.ok) {
    if ((response.status === 402 || response.status === 403) && method !== "GET") {
      throw new Error(`DUNE_QUERY_WRITE_NOT_AVAILABLE: HTTP ${response.status}`);
    }
    const detail = payload?.error?.message ?? payload?.error ?? payload?.message ?? "Dune API error";
    throw new Error(`DUNE_API_${response.status}: ${detail}`);
  }
  return payload;
}

function queryItems(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["queries", "results", "items", "data"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function matviewItems(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["materialized_views", "materializedViews", "results", "items", "data"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function contractEvents(config, slug) {
  const canonicalSlug = slug === "hyperevm" ? "hyper-evm" : slug;
  const network = config.networks.find((item) => item.graphNetwork === canonicalSlug);
  if (!network) throw new Error(`Missing canonical network ${slug}`);
  return requiredContracts.flatMap((contractKey) => {
    const contract = network.contracts[contractKey];
    if (!contract) throw new Error(`Missing canonical contract ${slug}/${contractKey}`);
    return contract.events.map((event) => ({
      slug, contractKey, contractName: contract.contract, eventName: event.name,
      fields: event.fields.map(({ name, type }) => ({ name, type })),
      expectedFields: event.fields.map(({ name }) => name),
      chainId: network.chainId, startBlock: contract.startBlock, address: contract.address,
    }));
  });
}

function assertCanonicalAbis(config, abis) {
  const abiByContract = {
    registry: abis.registry,
    router: abis.router,
    standardModuleRegistry: abis.standardModuleRegistry,
  };
  for (const network of config.networks) {
    for (const contractKey of requiredContracts) {
      const canonicalEvents = new Map(abiByContract[contractKey]
        .filter(({ type }) => type === "event")
        .map((event) => [event.name, event.inputs.map((input) => ({
          name: input.name,
          type: input.type,
          indexed: input.indexed === true,
        }))]));
      const configured = network.contracts[contractKey].events;
      if (configured.length !== canonicalEvents.size) {
        throw new Error(`Canonical ABI event-count mismatch: ${network.graphNetwork}/${contractKey}`);
      }
      for (const event of configured) {
        const inputs = canonicalEvents.get(event.name);
        const fields = event.fields.map(({ name, type, indexed }) => ({
          name, type, indexed: indexed === true,
        }));
        if (!inputs || JSON.stringify(inputs) !== JSON.stringify(fields)) {
          throw new Error(`Canonical ABI mismatch: ${network.graphNetwork}/${event.name}`);
        }
      }
    }
  }
}

async function discoverDatasets(config) {
  const payload = await api("/datasets/search", {
    method: "POST",
    body: {
      query: "nexa_v6", categories: ["decoded"], dataset_types: ["decoded_table"],
      include_metadata: true, include_schema: true, limit: 250,
    },
  });
  const results = queryItems(payload);
  const addressTables = new Map();
  for (const contractKey of requiredContracts) {
    const contract = config.networks[0].contracts[contractKey];
    const byAddress = await api("/datasets/search-by-contract", {
      method: "POST",
      body: {
        contract_address: contract.address, include_schema: false, limit: 250, offset: 0,
      },
    });
    addressTables.set(contract.address.toLowerCase(), new Set(
      queryItems(byAddress).map(({ full_name }) => full_name),
    ));
  }
  const found = {};
  for (const slug of ["base", "hyperevm", "bsc"]) {
    const expected = contractEvents(config, slug);
    const duneSlug = slug === "bsc" ? "bnb" : slug;
    const bindings = [];
    for (const item of expected) {
      const suffix = `_evt_${item.eventName.toLowerCase()}`;
      const candidates = results.filter((entry) =>
        entry.full_name?.startsWith(`nexa_v6_${duneSlug}.`)
        && entry.full_name.toLowerCase().endsWith(suffix)
        && entry.metadata?.project_name === "nexa_v6"
        && entry.metadata?.contract_name === item.contractName);
      if (candidates.length === 0) continue;
      if (candidates.length !== 1) {
        throw new Error(`Ambiguous Dune dataset: ${slug}/${item.contractName}/${item.eventName}`);
      }
      const dataset = candidates[0];
      if (!addressTables.get(item.address.toLowerCase())?.has(dataset.full_name)) {
        throw new Error(`Decoded contract-address binding mismatch: ${dataset.full_name}`);
      }
      const schemaFields = dataset.schema?.fields ?? [];
      const actualFields = new Set(schemaFields.map(({ name }) => name));
      const expectedFields = new Set([...standardColumns, ...item.expectedFields]);
      if (!sameSet(actualFields, expectedFields)) {
        throw new Error(`Decoded schema mismatch: ${dataset.full_name}`);
      }
      const schemaByName = new Map(schemaFields.map((field) => [field.name, field]));
      for (const field of item.fields) {
        const actualType = schemaType(schemaByName.get(field.name));
        if (!actualType || !schemaTypeMatchesAbi(actualType, field.type)) {
          throw new Error(`Decoded ABI type mismatch: ${dataset.full_name}/${field.name} (${actualType || "missing"} != ${field.type})`);
        }
      }
      bindings.push({
        contractRole: roleByKey[item.contractKey], contract: item.contractName,
        event: item.eventName, table: dataset.full_name, status: "QUERYABLE",
      });
    }
    found[slug] = { expectedCount: expected.length, bindings };
  }
  return found;
}

function payloadExpression(event, canonicalName, type) {
  const field = event.fields.find(({ name }) => fieldNames[name] === canonicalName);
  if (!field) return nullable(type);
  const quoted = `"${field.name}"`;
  if (type === "boolean") return quoted;
  if (type === "bigint") return `CAST(${quoted} AS bigint)`;
  if (field.type.startsWith("uint") || field.type.startsWith("int")) {
    return `CAST(${quoted} AS varchar)`;
  }
  return hex(field.name);
}

function canonicalBranch(config, binding) {
  const event = contractEvents(config, binding.slug).find((candidate) =>
    candidate.contractName === binding.contract && candidate.eventName === binding.event);
  if (!event) throw new Error(`Binding is not canonical: ${binding.table}`);
  const addressLiteral = event.address.toLowerCase();
  const columns = payloadColumns.map(([name, type]) =>
    `    ${payloadExpression(event, name, type)} AS ${name}`);
  return `SELECT
    concat(cast(${event.chainId} AS varchar), ':', lower(to_hex(evt_tx_hash)), ':', cast(evt_index AS varchar)) AS event_id,
    CAST(${event.chainId} AS bigint) AS chain_id,
    '${networkNames[event.slug]}' AS chain_name,
    '${binding.contractRole}' AS contract_role,
    '${addressLiteral}' AS contract_address,
    '${event.eventName}' AS event_name,
    evt_block_time AS block_time,
    CAST(evt_block_number AS bigint) AS block_number,
    concat('0x', lower(to_hex(evt_tx_hash))) AS tx_hash,
    CAST(evt_index AS bigint) AS event_index,
${columns.join(",\n")}
FROM ${binding.table}
WHERE evt_block_number >= ${event.startBlock}
  AND contract_address = ${addressLiteral}`;
}

function buildCanonicalSql(config, discovered, includeBnb = false) {
  const slugs = includeBnb ? [...activeSlugs, "bsc"] : activeSlugs;
  const branches = slugs.flatMap((slug) =>
    discovered[slug].bindings.map((binding) => canonicalBranch(config, { ...binding, slug })));
  if (branches.length !== slugs.length * 9) {
    throw new Error(`Canonical event source is incomplete (${branches.length}/${slugs.length * 9})`);
  }
  const outputColumns = [
    "event_id", "chain_id", "chain_name", "contract_role", "contract_address",
    "event_name", "block_time", "block_number", "tx_hash", "event_index",
    ...payloadColumns.map(([name]) => name),
  ];
  return `-- GENERATED by scripts/sync-dune-v6.mjs from canonical indexing configuration.
-- This is the only Nexa query that reads Dune decoded contract tables.
WITH normalized AS (
${branches.join("\nUNION ALL\n")}
),
ranked AS (
  SELECT normalized.*,
    row_number() OVER (
      PARTITION BY event_id
      ORDER BY block_number DESC, event_index DESC
    ) AS duplicate_rank
  FROM normalized
)
SELECT
  ${outputColumns.join(",\n  ")}
FROM ranked
WHERE duplicate_rank = 1`;
}

function buildStateValidationSql(config, discovered) {
  const branches = [];
  for (const slug of ["base", "hyperevm", "bsc"]) {
    for (const binding of discovered[slug].bindings) {
      const event = contractEvents(config, slug).find((candidate) =>
        candidate.contractName === binding.contract && candidate.eventName === binding.event);
      if (!event) throw new Error(`Validation binding is not canonical: ${binding.table}`);
      if (!/^nexa_v6_(?:base|hyperevm|bnb)\.[a-z0-9_]+$/.test(binding.table)) {
        throw new Error(`Unsafe decoded dataset identifier: ${binding.table}`);
      }
      const canonicalAddress = event.address.toLowerCase();
      branches.push(`SELECT
  '${slug}' AS network_slug,
  CAST(${event.chainId} AS bigint) AS chain_id,
  '${event.eventName}' AS event_name,
  '${binding.contractRole}' AS contract_role,
  '${binding.table}' AS table_name,
  CAST(${event.startBlock} AS bigint) AS start_block,
  count(*) AS table_rows,
  count_if(evt_block_number >= ${event.startBlock}
    AND contract_address = ${canonicalAddress}) AS canonical_rows,
  count_if(evt_block_number < ${event.startBlock}
    AND contract_address = ${canonicalAddress}) AS pre_start_same_address_rows,
  count_if(contract_address <> ${canonicalAddress}) AS other_address_rows,
  min(CASE WHEN evt_block_number >= ${event.startBlock}
    AND contract_address = ${canonicalAddress} THEN evt_block_number END) AS min_canonical_block,
  max(CASE WHEN evt_block_number >= ${event.startBlock}
    AND contract_address = ${canonicalAddress} THEN evt_block_number END) AS max_canonical_block
FROM ${binding.table}`);
    }
  }
  if (branches.length < 18) {
    throw new Error(`Dune validation source is incomplete (${branches.length}/18 minimum)`);
  }
  return `-- Ephemeral bounded pre-activation audit; query_id remains 0 and is not saved.
${branches.join("\nUNION ALL\n")}`;
}

async function executeSqlOnce(sql, label) {
  const execution = await api("/sql/execute", {
    method: "POST",
    body: { sql },
  });
  return waitForExecution(execution.execution_id, label);
}

function evaluateNetworkStates(config, discovered, result) {
  const resultRows = rows(result);
  const bySource = new Map(resultRows.map((row) => [
    `${row.network_slug}:${row.event_name}`,
    row,
  ]));
  const networks = {};
  for (const slug of ["base", "hyperevm", "bsc"]) {
    const counts = {};
    const tables = [];
    const missingDatasets = [];
    const unsafeHistory = [];
    for (const event of contractEvents(config, slug)) {
      const binding = discovered[slug].bindings.find((candidate) =>
        candidate.contract === event.contractName && candidate.event === event.eventName);
      if (!binding) {
        counts[event.eventName] = null;
        missingDatasets.push(event.eventName);
        continue;
      }
      const row = bySource.get(`${slug}:${event.eventName}`);
      if (!row) throw new Error(`Dune state audit omitted ${slug}/${event.eventName}`);
      const canonicalRows = Number(row.canonical_rows);
      const minCanonicalBlock = row.min_canonical_block === null
        ? null
        : Number(row.min_canonical_block);
      if (minCanonicalBlock !== null && minCanonicalBlock < event.startBlock) {
        unsafeHistory.push(event.eventName);
      }
      counts[event.eventName] = canonicalRows;
      tables.push({
        event: event.eventName,
        table: binding.table,
        canonicalRows,
        tableRows: Number(row.table_rows),
        preStartSameAddressRows: Number(row.pre_start_same_address_rows),
        otherAddressRows: Number(row.other_address_rows),
        minCanonicalBlock,
        maxCanonicalBlock: row.max_canonical_block === null ? null : Number(row.max_canonical_block),
        startBlock: event.startBlock,
      });
    }
    const incompleteHistory = Object.entries(ACTIVATION_BASELINES[slug])
      .filter(([eventName, minimum]) => (counts[eventName] ?? -1) < minimum)
      .map(([eventName, minimum]) => ({ event: eventName, minimum, actual: counts[eventName] }));
    const active = missingDatasets.length === 0
      && incompleteHistory.length === 0
      && unsafeHistory.length === 0;
    networks[slug] = {
      status: active ? "ACTIVE" : "BACKFILLING",
      counts,
      tables,
      missingDatasets,
      incompleteHistory,
      unsafeHistory,
      schemaValidation: missingDatasets.length === 0 ? "PASS" : "INCOMPLETE",
      collisionProtection: unsafeHistory.length === 0 ? "PASS" : "UNSAFE",
    };
  }
  return networks;
}

function buildDerivedQueries(fullMvName) {
  if (!/^dune\.[a-zA-Z0-9_]+\.result_nexa_v6_events_canonical$/.test(fullMvName)) {
    throw new Error(`Invalid canonical materialized-view name: ${fullMvName}`);
  }
  const mv = fullMvName;
  const queries = [
    {
      key: "overview", file: "overview.sql", name: "Nexa V6 — Protocol Overview",
      description: "Public passive onchain coverage summary for active Nexa V6 Dune networks.",
      sql: `WITH current_route_status AS (
  SELECT chain_id, route_id, status,
    row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv}
  WHERE event_name = 'RouteStatusChangedV6'
), route_state_counts AS (
  SELECT chain_id, status, count(*) AS route_count
  FROM current_route_status WHERE rn = 1 GROUP BY 1, 2
), route_state_summary AS (
  SELECT chain_id,
    array_join(array_agg(concat(cast(status AS varchar), '=', cast(route_count AS varchar)) ORDER BY status), ', ') AS current_route_states
  FROM route_state_counts GROUP BY 1
)
SELECT e.chain_id, max(e.chain_name) AS chain_name,
  count(DISTINCT network_id) FILTER (WHERE event_name = 'NetworkRegisteredV6') AS registered_networks,
  count(DISTINCT asset_key) FILTER (WHERE event_name = 'AssetRegisteredV6') AS registered_assets,
  count(DISTINCT route_id) FILTER (WHERE event_name = 'RouteRegisteredV6') AS registered_routes,
  coalesce(max(s.current_route_states), '') AS current_route_states,
  count(DISTINCT standard_id) FILTER (WHERE event_name = 'StandardModuleConfiguredV6') AS configured_standard_modules,
  count(*) FILTER (WHERE event_name = 'SourceIntakeConfigured') AS source_intake_events,
  count(*) FILTER (WHERE event_name = 'SourceFillV6') AS source_fill_count,
  max(block_time) AS latest_indexed_nexa_event_time
FROM ${mv} e LEFT JOIN route_state_summary s ON s.chain_id = e.chain_id
GROUP BY e.chain_id ORDER BY e.chain_id`,
    },
    {
      key: "networksCurrent", file: "networks-current.sql", name: "Nexa V6 — Current Networks",
      description: "Registered Nexa V6 network identities with deterministic latest onchain status.",
      sql: `WITH registrations AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, network_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'NetworkRegisteredV6'
), statuses AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, network_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'NetworkStatusChangedV6'
)
SELECT r.chain_id, r.chain_name, r.network_id, r.vm_type, r.network_reference, r.metadata_hash,
  s.previous_status, s.status, s.generation,
  s.block_time AS status_block_time, s.block_number AS status_block_number,
  s.tx_hash AS status_tx_hash, s.event_index AS status_event_index
FROM registrations r LEFT JOIN statuses s ON s.chain_id = r.chain_id AND s.network_id = r.network_id AND s.rn = 1
WHERE r.rn = 1 ORDER BY r.chain_id, r.network_id`,
    },
    {
      key: "assetsCurrent", file: "assets-current.sql", name: "Nexa V6 — Current Assets",
      description: "Registered Nexa V6 asset identities with deterministic latest onchain status.",
      sql: `WITH registrations AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, asset_key ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'AssetRegisteredV6'
), statuses AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, asset_key ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'AssetStatusChangedV6'
)
SELECT r.chain_id, r.chain_name, r.asset_key, r.network_id, r.asset_id,
  r.local_address, r.has_local_binding, r.metadata_hash,
  s.previous_status, s.status, s.generation,
  s.block_time AS status_block_time, s.block_number AS status_block_number,
  s.tx_hash AS status_tx_hash, s.event_index AS status_event_index
FROM registrations r LEFT JOIN statuses s ON s.chain_id = r.chain_id AND s.asset_key = r.asset_key AND s.rn = 1
WHERE r.rn = 1 ORDER BY r.chain_id, r.asset_key`,
    },
    {
      key: "routesCurrent", file: "routes-current.sql", name: "Nexa V6 — Current Routes",
      description: "Registered Nexa V6 route identities and deterministic latest onchain state; live Feed terms are not inferred.",
      sql: `WITH registrations AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'RouteRegisteredV6'
), statuses AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM ${mv} WHERE event_name = 'RouteStatusChangedV6'
)
SELECT r.chain_id, r.chain_name, r.route_id, r.source_network_id, r.destination_network_id,
  r.source_asset_id, r.destination_asset_id, s.previous_status, s.status, s.generation,
  s.actor AS status_actor, s.block_time AS status_block_time,
  s.block_number AS status_block_number, s.tx_hash AS status_tx_hash,
  s.event_index AS status_event_index
FROM registrations r LEFT JOIN statuses s ON s.chain_id = r.chain_id AND s.route_id = r.route_id AND s.rn = 1
WHERE r.rn = 1 ORDER BY r.chain_id, r.route_id`,
    },
    {
      key: "routeStatusHistory", file: "route-status-history.sql", name: "Nexa V6 — Route Status History",
      description: "Immutable Nexa V6 RouteStatusChangedV6 history and transaction provenance.",
      sql: `SELECT chain_id, chain_name, route_id, previous_status, status, generation, actor,
  block_time, block_number, tx_hash, event_index, event_id
FROM ${mv}
WHERE event_name = 'RouteStatusChangedV6'
ORDER BY block_number DESC, event_index DESC`,
    },
    {
      key: "routerState", file: "router-state.sql", name: "Nexa V6 — Router Source Intake",
      description: "Current Nexa V6 Router source-intake state with onchain history and provenance.",
      sql: `WITH history AS (
  SELECT *,
    row_number() OVER (PARTITION BY chain_id ORDER BY block_number DESC, event_index DESC) AS rn,
    count(*) OVER (PARTITION BY chain_id) AS history_event_count,
    min(block_time) OVER (PARTITION BY chain_id) AS first_configured_at
  FROM ${mv} WHERE event_name = 'SourceIntakeConfigured'
)
SELECT chain_id, chain_name, source_intake_enabled, actor,
  block_time AS latest_configured_at, first_configured_at, history_event_count,
  block_number, tx_hash, event_index, event_id
FROM history WHERE rn = 1 ORDER BY chain_id`,
    },
    {
      key: "standardModules", file: "standard-modules-current.sql", name: "Nexa V6 — Standard Modules",
      description: "Current Nexa V6 standard module per chain and standard ID, reconstructed from onchain events.",
      sql: `WITH ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY chain_id, standard_id ORDER BY block_number DESC, event_index DESC
  ) AS rn
  FROM ${mv} WHERE event_name = 'StandardModuleConfiguredV6'
)
SELECT chain_id, chain_name, standard_id, previous_module, module,
  block_time, block_number, tx_hash, event_index, event_id
FROM ranked WHERE rn = 1 ORDER BY chain_id, standard_id`,
    },
    {
      key: "sourceFills", file: "source-fills.sql", name: "Nexa V6 — Source Fills",
      description: "Immutable Nexa V6 SourceFillV6 onchain events; amounts are raw integer units.",
      sql: `SELECT chain_id, chain_name, fill_id, route_id, quote_id, payer, recipient,
  source_asset, destination_asset, destination_chain_id, amount_in_raw, amount_out_raw,
  source_finality_blocks, settlement_deadline, permit_nonce, execution_generation,
  block_time, block_number, tx_hash, event_index, event_id
FROM ${mv}
WHERE event_name = 'SourceFillV6'
ORDER BY block_number DESC, event_index DESC`,
    },
    {
      key: "recentActivity", file: "recent-activity.sql", name: "Nexa V6 — Recent Protocol Activity",
      description: "Recent canonical Nexa V6 onchain event stream for public inspection.",
      sql: `SELECT event_id, chain_id, chain_name, contract_role, contract_address, event_name,
  block_time, block_number, tx_hash, event_index,
  coalesce(network_id, asset_key, route_id, standard_id, fill_id) AS primary_entity_id,
  status, generation, actor
FROM ${mv}
ORDER BY block_time DESC, block_number DESC, event_index DESC
LIMIT 500`,
    },
  ];
  return queries.map((query) => ({ ...query, sql: `${query.sql.trim()}\n` }));
}

function desiredQuery(query) {
  return {
    name: query.name,
    description: query.description,
    query_sql: normalizeSql(query.sql),
    is_private: false,
    tags: TAGS,
  };
}

function queryId(query) {
  return Number(query?.query_id ?? query?.queryId ?? query?.id);
}

async function syncQuery(listed, query, apply, queryCache = new Map()) {
  const matches = listed.filter((item) => item.name === query.name);
  if (matches.length > 1) throw new Error(`Duplicate canonical Dune query name: ${query.name}`);
  const desired = desiredQuery(query);
  if (matches.length === 0) {
    if (!apply) return { query, id: null, changed: true, reason: "CREATE_REQUIRED" };
    const created = await api("/query", { method: "POST", body: desired });
    const id = queryId(created);
    if (!Number.isInteger(id)) throw new Error(`Dune create returned no query ID: ${query.name}`);
    listed.push({ ...desired, query_id: id });
    return { query, id, changed: true, reason: "CREATED" };
  }
  const id = queryId(matches[0]);
  if (!Number.isInteger(id)) throw new Error(`Dune list returned no query ID: ${query.name}`);
  let current = queryCache.get(id);
  if (!current) {
    current = await api(`/query/${id}`);
    queryCache.set(id, current);
  }
  const tags = Array.isArray(current.tags) ? [...current.tags].sort() : [];
  const changed = current.name !== desired.name
    || String(current.description ?? "") !== desired.description
    || normalizeSql(current.query_sql) !== desired.query_sql
    || current.is_private !== false
    || JSON.stringify(tags) !== JSON.stringify([...TAGS].sort());
  if (changed && apply) {
    await api(`/query/${id}`, { method: "PATCH", body: desired });
  }
  return { query, id, changed, reason: changed ? (apply ? "UPDATED" : "UPDATE_REQUIRED") : "UNCHANGED", current };
}

async function waitForExecution(executionId, label, maxChecks = 120) {
  if (!executionId) throw new Error(`Missing execution ID for ${label}`);
  for (let check = 0; check < maxChecks; check += 1) {
    const result = await api(`/execution/${executionId}/results?limit=1000`);
    if (result.is_execution_finished || [
      "QUERY_STATE_COMPLETED", "QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED",
    ].includes(result.state)) {
      if (result.state !== "QUERY_STATE_COMPLETED") {
        const detail = result.error?.message ?? result.state ?? "unknown execution failure";
        throw new Error(`${label} failed: ${detail}`);
      }
      return result;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 5000));
  }
  throw new Error(`${label} timed out after bounded status checks`);
}

async function executeQueryOnce(id, label) {
  const execution = await api(`/query/${id}/execute`, {
    method: "POST", body: { query_parameters: {} },
  });
  return waitForExecution(execution.execution_id, label);
}

function rows(result) {
  return result?.result?.rows ?? [];
}

function executionSummary(result) {
  return {
    state: result.state,
    executionId: result.execution_id,
    rowCount: Number(result.result?.metadata?.total_row_count ?? rows(result).length),
    completedAt: result.execution_ended_at ?? null,
  };
}

async function writeSqlFiles(canonicalSql, derived) {
  await mkdir(SQL_ROOT, { recursive: true });
  await writeFile(resolve(SQL_ROOT, "canonical-events.sql"), `${normalizeSql(canonicalSql)}\n`, "utf8");
  for (const query of derived) {
    await writeFile(resolve(SQL_ROOT, query.file), query.sql, "utf8");
  }
}

function localSqlDifferences(canonicalSql, derived) {
  const desired = new Map([
    ["canonical-events.sql", `${normalizeSql(canonicalSql)}\n`],
    ...derived.map((query) => [query.file, query.sql]),
  ]);
  return Promise.all([...desired].map(async ([file, contents]) => {
    try {
      return (await readFile(resolve(SQL_ROOT, file), "utf8")) === contents ? null : file;
    } catch {
      return file;
    }
  })).then((items) => items.filter(Boolean));
}

function buildSourceBindings(discovered, timestamp, networkStates = null) {
  const network = (slug) => {
    const allDatasetsPresent = discovered[slug].bindings.length === discovered[slug].expectedCount;
    const active = networkStates?.[slug]?.status === "ACTIVE";
    return {
      status: active ? "ACTIVE" : (allDatasetsPresent ? "DISCOVERED" : "PENDING_DECODE"),
      decodeBackfillStatus: active ? "QUERYABLE" : (allDatasetsPresent ? "BACKFILLING" : "PENDING"),
      lastValidatedAt: timestamp,
      tables: discovered[slug].bindings,
    };
  };
  return {
    schemaVersion: 1,
    generatedFrom: {
      deployments: "../../indexing/nexa-v6-indexing.json",
      deploymentEvidence: "../../verification/indexing-deployment-evidence.json",
      events: "../../indexing/graph/abis/",
    },
    project: "nexa_v6",
    networks: {
      base: network("base"),
      hyperevm: network("hyperevm"),
      bsc: network("bsc"),
    },
  };
}

function validateOverview(result) {
  const byChain = new Map(rows(result).map((row) => [Number(row.chain_id), row]));
  const baseline = new Map([[8453, "Base"], [999, "HyperEVM"]]);
  const validation = {};
  for (const [chainId, name] of baseline) {
    const row = byChain.get(chainId);
    if (!row) throw new Error(`Dune overview missing ${name}`);
    const counts = {
      registeredNetworks: Number(row.registered_networks),
      registeredAssets: Number(row.registered_assets),
      registeredRoutes: Number(row.registered_routes),
      configuredStandardModules: Number(row.configured_standard_modules),
      sourceIntakeEvents: Number(row.source_intake_events),
      sourceFills: Number(row.source_fill_count),
      currentRouteStates: String(row.current_route_states ?? ""),
      latestEventTime: row.latest_indexed_nexa_event_time ?? null,
    };
    if (counts.registeredNetworks < 3 || counts.registeredAssets < 19
      || counts.registeredRoutes < 108 || counts.configuredStandardModules < 2
      || !counts.currentRouteStates) {
      throw new Error(`Dune baseline validation failed for ${name}: ${JSON.stringify(counts)}`);
    }
    validation[name] = { status: "PASS", ...counts };
  }
  return validation;
}

function mvQueryId(view) {
  return Number(view?.query_id ?? view?.queryId ?? view?.source_query_id ?? view?.sourceQueryId);
}

function mvShortName(view) {
  return String(view?.sql_id ?? view?.name ?? view?.table_name ?? "").split(".").at(-1);
}

async function auditRemoteArchitecture(
  listedQueries,
  listedViews,
  canonicalDefinition,
  derivedDefinitions,
  queryCache,
  bnbPreviouslyActive,
) {
  const viewMatches = listedViews.filter((view) => mvShortName(view) === MV_NAME);
  if (viewMatches.length !== 1) {
    throw new Error(`Expected exactly one Dune materialized view ${MV_NAME}, found ${viewMatches.length}`);
  }
  const identifier = viewMatches[0].sql_id ?? viewMatches[0].name;
  const view = { ...viewMatches[0], ...(await api(`/materialized-views/${encodeURIComponent(identifier)}`)) };
  if (mvQueryId(view) !== EXPECTED_QUERY_IDS.canonical) {
    throw new Error(`Canonical materialized view source mismatch: ${mvQueryId(view)}`);
  }
  const fullMvName = view.sql_id ?? (view.name?.includes(".") ? view.name : null);
  if (fullMvName !== "dune.nexav6.result_nexa_v6_events_canonical") {
    throw new Error(`Canonical materialized view identity mismatch: ${fullMvName}`);
  }

  const definitions = [canonicalDefinition, ...derivedDefinitions];
  for (const definition of definitions) {
    const expectedId = EXPECTED_QUERY_IDS[definition.key];
    const listedMatches = listedQueries.filter((query) => queryId(query) === expectedId);
    if (listedMatches.length !== 1) {
      throw new Error(`Expected saved Dune query ${expectedId} exactly once, found ${listedMatches.length}`);
    }
    const current = await api(`/query/${expectedId}`);
    queryCache.set(expectedId, current);
    if (current.name !== definition.name) {
      throw new Error(`Dune query identity mismatch: ${expectedId}`);
    }
    const sql = normalizeSql(current.query_sql);
    if (definition.key === "canonical") {
      const decodedSources = sql.match(/\bFROM\s+nexa_v6_(?:base|hyperevm|bnb)\.[a-z0-9_]+/gi) ?? [];
      const expectedSourceCount = bnbPreviouslyActive ? 27 : 18;
      if (decodedSources.length !== expectedSourceCount
        || new Set(decodedSources.map((source) => source.toLowerCase())).size !== expectedSourceCount) {
        throw new Error(`Canonical query ${expectedId} decoded-source count mismatch: ${decodedSources.length}`);
      }
      if (!bnbPreviouslyActive && /\bFROM\s+nexa_v6_bnb\./i.test(sql)) {
        throw new Error("DUNE_REMOTE_BNB_PREMATURELY_ACTIVE");
      }
    } else {
      if (!sql.includes(fullMvName)) {
        throw new Error(`Derived query ${expectedId} does not read the canonical MV`);
      }
      if (/\bFROM\s+nexa_v6_(?:base|hyperevm|bnb)\./i.test(sql)
        || /(?:\braw\b[^\n]*\blogs\b|\bgraph\b|\bsubstreams\b)/i.test(sql)) {
        throw new Error(`Derived query ${expectedId} bypasses the canonical MV`);
      }
    }
  }
  return { view, fullMvName };
}

function buildHandoff(resources, networkStates) {
  const byKey = new Map(resources.map((resource) => [resource.query.key, resource]));
  const item = (key, title, recommendation) => {
    const resource = byKey.get(key);
    return `${title} — query ${resource.id} (${resource.url}); ${recommendation}`;
  };
  return `# Nexa V6 — Cross-Chain Protocol Analytics

Native dashboard and visualization mutation is not exposed by the documented
Dune API. Assemble the public dashboard from these public queries.

## Header text

Nexa V6 passive onchain analytics

Registry and Router events describe onchain identity and state. Signed Feed
data supplies live route terms. Execution Permits supply final execution
authority. Dune is passive and non-authoritative.

## Coverage

- Base — ${networkStates.base.status}
- HyperEVM — ${networkStates.hyperevm.status}
- BNB Smart Chain — ${networkStates.bsc.status}

## Widget order

1. ${item("overview", "Protocol Overview", "summary table and counters by chain")}
2. ${item("routesCurrent", "Current Routes", "table grouped/filterable by chain and status")}
3. ${item("assetsCurrent", "Current Assets", "table and count by chain")}
4. ${item("routeStatusHistory", "Route Status History", "time series and provenance table")}
5. ${item("sourceFills", "Source Fills", "count/time series and raw onchain event table")}
6. ${item("routerState", "Router Source Intake", "current state table")}
7. ${item("standardModules", "Standard Modules", "current module table")}
8. ${item("recentActivity", "Recent Protocol Activity", "chronological event table")}

Do not add USD volume, TVL, inferred liquidity, live route terms, or execution
authority claims.
`;
}

function assertCanonicalEvidence(config, evidence) {
  for (const network of config.networks) {
    const slug = network.graphNetwork;
    const external = evidence.networks?.[slug];
    if (!external || external.chainId !== network.chainId) {
      throw new Error(`Canonical deployment evidence mismatch: ${slug}`);
    }
    for (const contractKey of requiredContracts) {
      const expected = network.contracts[contractKey];
      const candidate = external.contracts?.[contractKey];
      if (candidate && (candidate.address !== expected.address || candidate.startBlock !== expected.startBlock)) {
        throw new Error(`Canonical deployment evidence drift: ${slug}/${contractKey}`);
      }
    }
  }
}

async function main() {
  const [config, evidence, localManifest, localBindings, registryAbi, routerAbi, moduleRegistryAbi] = await Promise.all([
    readJson("indexing/nexa-v6-indexing.json"),
    readJson("verification/indexing-deployment-evidence.json"),
    readJson("analytics/dune/dune-manifest.json"),
    readJson("analytics/dune/source-bindings.json"),
    readJson("indexing/graph/abis/NexaMainnetRegistryV6.json"),
    readJson("indexing/graph/abis/NexaMainnetRouterV6.json"),
    readJson("indexing/graph/abis/NexaStandardModuleRegistryV6.json"),
  ]);
  assertCanonicalEvidence(config, evidence);
  assertCanonicalAbis(config, {
    registry: registryAbi,
    router: routerAbi,
    standardModuleRegistry: moduleRegistryAbi,
  });

  // The catalog request is deliberately the first Dune call: a minimal read-scope audit.
  const discovered = await discoverDatasets(config);
  for (const slug of activeSlugs) {
    if (discovered[slug].bindings.length !== discovered[slug].expectedCount) {
      throw new Error(`Decoded activation gate failed for ${networkNames[slug]} (${discovered[slug].bindings.length}/${discovered[slug].expectedCount})`);
    }
  }
  // Exactly one list call for saved queries and one for materialized views.
  const listedQueries = queryItems(await api("/queries?limit=1000&offset=0"));
  const listedViews = matviewItems(await api("/materialized-views?limit=10000&offset=0"));

  const canonicalBaseSql = buildCanonicalSql(config, discovered, false);
  const canonicalBaseDefinition = {
    key: "canonical", file: "canonical-events.sql", name: CANONICAL_NAME,
    description: "The sole normalized Nexa V6 decoded-table source for passive Dune analytics.",
    sql: canonicalBaseSql,
  };
  const queryCache = new Map();
  const architecture = await auditRemoteArchitecture(
    listedQueries,
    listedViews,
    canonicalBaseDefinition,
    buildDerivedQueries("dune.nexav6.result_nexa_v6_events_canonical"),
    queryCache,
    localManifest.networkStatus?.["BNB Smart Chain"] === "ACTIVE",
  );
  const stateExecution = await executeSqlOnce(
    buildStateValidationSql(config, discovered),
    "Nexa V6 bounded pre-activation state audit",
  );
  const networkStates = evaluateNetworkStates(config, discovered, stateExecution);
  const bnbDatasetsReady = discovered.bsc.bindings.length === discovered.bsc.expectedCount;
  let bnbCandidateSql = null;
  if (bnbDatasetsReady) {
    bnbCandidateSql = buildCanonicalSql(config, discovered, true);
    const bnbNetwork = config.networks.find(({ graphNetwork }) => graphNetwork === "bsc");
    for (const contractKey of requiredContracts) {
      const contract = bnbNetwork.contracts[contractKey];
      const boundaryCount = bnbCandidateSql.split(`evt_block_number >= ${contract.startBlock}`).length - 1;
      if (boundaryCount !== contract.events.length) {
        throw new Error(`DUNE_BNB_ADDRESS_HISTORY_UNSAFE: missing ${contractKey} start-block filters`);
      }
    }
  }
  console.log(JSON.stringify({
    audit: "DUNE_V6_PREACTIVATION_AUDIT",
    execution: executionSummary(stateExecution),
    resources: {
      canonicalQueryId: EXPECTED_QUERY_IDS.canonical,
      canonicalMaterializedView: architecture.fullMvName,
      derivedQueryIds: Object.fromEntries(Object.entries(EXPECTED_QUERY_IDS).filter(([keyName]) => keyName !== "canonical")),
      canonicalDecodedTableReaderCount: 1,
      derivedCanonicalMvReaderCount: 9,
    },
    networks: networkStates,
    bnbCandidateGenerated: bnbCandidateSql !== null,
    remoteMutationCount,
  }, null, 2));
  if (networkStates.bsc.unsafeHistory.length > 0) {
    throw new Error(`DUNE_BNB_ADDRESS_HISTORY_UNSAFE: ${networkStates.bsc.unsafeHistory.join(", ")}`);
  }
  if (mode === "--activate-bnb") {
    const incompleteNetworks = ["base", "hyperevm", "bsc"]
      .filter((slug) => networkStates[slug].status !== "ACTIVE");
    if (incompleteNetworks.length > 0) {
      throw new Error(`DUNE_BNB_BACKFILL_INCOMPLETE: ${JSON.stringify(Object.fromEntries(
        incompleteNetworks.map((slug) => [slug, networkStates[slug].incompleteHistory]),
      ))}; remoteMutations=${remoteMutationCount}`);
    }
  }
  if (mode === "--apply" && activeSlugs.some((slug) => networkStates[slug].status !== "ACTIVE")) {
    throw new Error(`DUNE_BASE_HYPEREVM_BACKFILL_INCOMPLETE; remoteMutations=${remoteMutationCount}`);
  }

  const includeBnb = networkStates.bsc.status === "ACTIVE" && (mode === "--activate-bnb"
    || localManifest.networkStatus?.["BNB Smart Chain"] === "ACTIVE");
  const apply = mode === "--apply" || mode === "--activate-bnb";
  const targetStatus = includeBnb
    ? "DUNE_ALL_NETWORKS_ANALYTICS_READY"
    : "DUNE_BASE_HYPEREVM_ANALYTICS_READY";
  const canonicalSql = includeBnb ? bnbCandidateSql : canonicalBaseSql;
  const canonicalDefinition = { ...canonicalBaseDefinition, sql: canonicalSql };
  const canonical = await syncQuery(listedQueries, canonicalDefinition, apply, queryCache);

  let view = architecture.view;
  if (view && Number.isInteger(mvQueryId(view)) && mvQueryId(view) !== canonical.id) {
    throw new Error(`Materialized view name is bound to another query: ${MV_NAME}`);
  }
  const viewDiffers = !view
    || (Number.isInteger(mvQueryId(view)) && mvQueryId(view) !== canonical.id)
    || (view.is_private !== undefined && view.is_private !== false)
    || ((view.cron_expression ?? view.schedule?.cron_expression) !== undefined
      && (view.cron_expression ?? view.schedule?.cron_expression) !== CRON)
    || (view.performance !== undefined && view.performance !== null
      && view.performance !== "default" && view.performance !== "medium");
  const canonicalNeedsRefresh = canonical.changed || viewDiffers;

  let canonicalExecution = null;
  let refreshExecution = null;
  let fullMvName = view?.sql_id ?? (view?.name?.includes(".") ? view.name : localManifest.materializedView?.fullName);
  if (apply && canonicalNeedsRefresh) {
    canonicalExecution = await executeQueryOnce(canonical.id, CANONICAL_NAME);
    const upserted = await api("/materialized-views", {
      method: "POST",
      body: {
        cron_expression: CRON, is_private: false, name: MV_NAME,
        query_id: canonical.id,
      },
    });
    fullMvName = upserted.name;
    refreshExecution = await waitForExecution(upserted.execution_id, `materialized view ${MV_NAME}`);
  }
  if (!fullMvName) fullMvName = localManifest.materializedView?.fullName;
  if (!fullMvName && !apply) {
    console.log("DUNE MUTATIONS REQUIRED: canonical materialized view is not applied");
    return;
  }

  const derivedDefinitions = buildDerivedQueries(fullMvName);
  const derived = [];
  for (const definition of derivedDefinitions) {
    derived.push(await syncQuery(listedQueries, definition, apply, queryCache));
  }

  if (!apply) {
    const timestamp = localBindings.networks?.base?.lastValidatedAt;
    const expectedBindings = buildSourceBindings(discovered, timestamp, networkStates);
    const localDiffs = await localSqlDifferences(canonicalSql, derivedDefinitions);
    const remoteDiffs = [canonical, ...derived].filter((resource) => resource.changed);
    const bindingDiff = stableJson(expectedBindings) !== stableJson(localBindings);
    const manifestIds = new Map((localManifest.queries ?? []).map((query) => [query.name, query.id]));
    const manifestDiff = localManifest.canonicalQuery?.id !== canonical.id
      || localManifest.materializedView?.fullName !== fullMvName
      || derived.some((resource) => manifestIds.get(resource.query.name) !== resource.id)
      || localManifest.networkStatus?.Base !== networkStates.base.status
      || localManifest.networkStatus?.HyperEVM !== networkStates.hyperevm.status
      || localManifest.networkStatus?.["BNB Smart Chain"] !== networkStates.bsc.status;
    if (viewDiffers || remoteDiffs.length || localDiffs.length || bindingDiff || manifestDiff) {
      console.log(JSON.stringify({
        status: "DUNE MUTATIONS REQUIRED", viewDiffers,
        remote: remoteDiffs.map(({ query, reason }) => ({ name: query.name, reason })),
        localSql: localDiffs, sourceBindingsChanged: bindingDiff, manifestChanged: manifestDiff,
      }, null, 2));
      return;
    }
    console.log(`Base: ${networkStates.base.status}`);
    console.log(`HyperEVM: ${networkStates.hyperevm.status}`);
    console.log(`BNB: ${networkStates.bsc.status}`);
    console.log("NO DUNE MUTATIONS REQUIRED");
    return;
  }

  await writeSqlFiles(canonicalSql, derivedDefinitions);
  const validationExecutions = new Map();
  const validationNeeded = canonicalNeedsRefresh
    || localManifest.status !== targetStatus
    || derived.some(({ changed }) => changed);
  let networkValidation = localManifest.validation?.networks;
  if (validationNeeded) {
    const overview = derived.find(({ query }) => query.key === "overview");
    const overviewExecution = await executeQueryOnce(overview.id, overview.query.name);
    validationExecutions.set("overview", overviewExecution);
    networkValidation = validateOverview(overviewExecution);
    for (const resource of derived.filter(({ query }) => query.key !== "overview")) {
      validationExecutions.set(resource.query.key, await executeQueryOnce(resource.id, resource.query.name));
    }
  }
  if (!networkValidation?.Base || !networkValidation?.HyperEVM) {
    throw new Error("Dune network validation results unavailable");
  }

  const ownerMatch = /^dune\.([^.]+)\./.exec(fullMvName);
  if (!ownerMatch) throw new Error(`Unable to identify Dune owner from ${fullMvName}`);
  const owner = ownerMatch[1];
  const now = new Date().toISOString();
  const sourceBindings = buildSourceBindings(discovered, now, networkStates);
  const queryRecords = derived.map((resource) => {
    const execution = validationExecutions.get(resource.query.key);
    const prior = (localManifest.queries ?? []).find(({ name }) => name === resource.query.name);
    return {
      key: resource.query.key, name: resource.query.name, id: resource.id,
      url: `https://dune.com/queries/${resource.id}`, public: true,
      validation: execution ? executionSummary(execution) : prior?.validation,
    };
  });
  const canonicalPrior = localManifest.canonicalQuery?.validation;
  const refreshPrior = localManifest.materializedView?.latestSuccessfulRefresh;
  const canonicalLatest = canonicalExecution
    ?? (await api(`/query/${canonical.id}/results?limit=1`));
  const existingRefreshId = view?.last_execution_ids?.[0];
  const existingRefresh = refreshExecution || !existingRefreshId
    ? null
    : await api(`/execution/${existingRefreshId}/results?limit=1`);
  const manifest = {
    schemaVersion: 1, mode: "PASSIVE_ONCHAIN_ANALYTICS", authoritative: false,
    ingestion: "DUNE_DIRECT_CHAIN",
    status: targetStatus,
    owner, profileUrl: `https://dune.com/${owner}`,
    capabilities: {
      queryReadWrite: "AVAILABLE", materializedViews: "AVAILABLE",
      dashboardWriteApi: "DUNE_NATIVE_DASHBOARD_API_UNAVAILABLE",
    },
    canonicalQuery: {
      id: canonical.id, name: CANONICAL_NAME, url: `https://dune.com/queries/${canonical.id}`,
      public: true, validation: canonicalLatest ? executionSummary(canonicalLatest) : canonicalPrior,
    },
    materializedView: {
      name: MV_NAME, fullName: fullMvName, sourceQueryId: canonical.id,
      isPrivate: false, performance: "default", cron: CRON,
      latestSuccessfulRefresh: refreshExecution
        ? executionSummary(refreshExecution)
        : (existingRefresh ? executionSummary(existingRefresh) : refreshPrior),
    },
    queries: queryRecords,
    lifecycle: {
      resourceProvisioning: "COMPLETE",
      datasetDiscovery: Object.fromEntries(Object.entries(networkNames).map(([slug, name]) => [
        name,
        discovered[slug].bindings.length === discovered[slug].expectedCount ? "DISCOVERED" : "PENDING",
      ])),
      decodeBackfill: Object.fromEntries(Object.entries(networkNames).map(([slug, name]) => [
        name,
        networkStates[slug].status === "ACTIVE" ? "COMPLETE" : "BACKFILLING",
      ])),
      analyticsActivation: Object.fromEntries(Object.entries(networkNames).map(([slug, name]) => [
        name,
        networkStates[slug].status === "ACTIVE" ? "ACTIVE" : "GATED",
      ])),
    },
    activeNetworks: Object.entries(networkNames)
      .filter(([slug]) => networkStates[slug].status === "ACTIVE")
      .map(([, name]) => name),
    pendingNetworks: Object.entries(networkNames)
      .filter(([slug]) => networkStates[slug].status !== "ACTIVE")
      .map(([, name]) => name),
    networkStatus: {
      Base: networkStates.base.status,
      HyperEVM: networkStates.hyperevm.status,
      "BNB Smart Chain": networkStates.bsc.status,
    },
    sourceBindings: "./source-bindings.json",
    duneSourceTables: {
      Base: discovered.base.bindings.map(({ table }) => table),
      HyperEVM: discovered.hyperevm.bindings.map(({ table }) => table),
      "BNB Smart Chain": discovered.bsc.bindings.map(({ table }) => table),
    },
    latestValidationTime: now,
    validation: {
      status: "PASS", networks: networkValidation,
      crossCheck: "PASSED_COMMITTED_INDEXING_BASELINE_LOWER_BOUNDS",
      sourceFillSchema: "PASS",
      sourceIntakePath: "PASS",
    },
    signedFeedIngested: false, permitApiIngested: false, nexaRpcUsed: false,
    nexaDbUsed: false, runtimeDependency: false,
  };

  await writeFile(resolve(DUNE_ROOT, "source-bindings.json"), stableJson(sourceBindings), "utf8");
  await writeFile(resolve(DUNE_ROOT, "dune-manifest.json"), stableJson(manifest), "utf8");
  await writeFile(resolve(DUNE_ROOT, "DASHBOARD_HANDOFF.md"), buildHandoff(derived, networkStates), "utf8");

  console.log(`Base: ${networkStates.base.status}`);
  console.log(`HyperEVM: ${networkStates.hyperevm.status}`);
  console.log(`BNB: ${networkStates.bsc.status}`);
  console.log(manifest.status);
}

export {
  ACTIVATION_BASELINES,
  EXPECTED_QUERY_IDS,
  buildCanonicalSql,
  buildSourceBindings,
  buildStateValidationSql,
  contractEvents,
  evaluateNetworkStates,
  schemaTypeMatchesAbi,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
