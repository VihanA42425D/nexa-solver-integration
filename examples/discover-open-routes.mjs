import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const configPath = process.argv[2] ?? new URL("../config/example.config.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const rpcUrl = process.env[config.rpcUrlEnv];
if (!rpcUrl) throw new Error(`Set ${config.rpcUrlEnv} before running discovery`);

const surface = await loadPublicSurface(config.network);
const provider = new JsonRpcProvider(rpcUrl, surface.network.chainId, { staticNetwork: true });
const observed = await provider.getNetwork();
if (observed.chainId !== BigInt(surface.network.chainId)) {
  throw new Error(`RPC chain mismatch: expected ${surface.network.chainId}, got ${observed.chainId}`);
}
const registry = new Contract(surface.network.contracts.registry, surface.abis.registry, provider);
const pageSize = Math.min(100, Math.max(1, Number(config.pageSize ?? 100)));
const sourceChainId = BigInt(config.sourceChainId ?? surface.network.chainId);

async function readAll(method, args = []) {
  const rows = [];
  let cursor = 0n;
  while (true) {
    const result = await registry[method](...args, cursor, pageSize);
    rows.push(...result.page);
    const next = BigInt(result.nextCursor);
    if (next <= cursor || result.page.length === 0) return { rows, result };
    cursor = next;
  }
}

const [epoch, count, catalog, active] = await Promise.all([
  registry.getActiveSetEpoch(sourceChainId),
  registry.getActiveSemanticRouteCount(sourceChainId),
  readAll("getRoutes"),
  readAll("getActiveSemanticRoutes", [sourceChainId]),
]);
const hasActiveEpoch = BigInt(epoch.currentEpoch) > 0n;
if (hasActiveEpoch && (!count.fullyDiscoverable || !active.result.fullyDiscoverable)) {
  throw new Error("Active Route set is not fully discoverable");
}
const toPlain = (value) => typeof value?.toObject === "function" ? value.toObject(true) : value;
const routesById = new Map(catalog.rows.map((route) => [route.routeId.toLowerCase(), route]));
const routes = (hasActiveEpoch ? active.rows : []).map((witness) => ({
  route: toPlain(routesById.get(witness.terms.routeId.toLowerCase())),
  terms: toPlain(witness.terms),
  proof: [...witness.proof],
}));

const json = JSON.stringify({
  network: config.network,
  sourceChainId,
  status: hasActiveEpoch ? "ACTIVE" : "NO_ACTIVE_EPOCH",
  epoch: toPlain(epoch),
  published: count.published,
  expected: count.expected,
  fullyDiscoverable: hasActiveEpoch && count.fullyDiscoverable,
  routes,
}, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
console.log(json);
