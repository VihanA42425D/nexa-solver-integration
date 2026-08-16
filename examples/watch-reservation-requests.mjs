import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const configPath = process.argv[2] ?? new URL("../config/example.config.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const rpcUrl = process.env[config.rpcUrlEnv];
if (!rpcUrl) throw new Error("Set " + config.rpcUrlEnv + " before reading events");

const surface = await loadPublicSurface(config.network);
const provider = new JsonRpcProvider(rpcUrl, surface.network.chainId, { staticNetwork: true });
const coordinator = new Contract(
  surface.network.contracts.reservationCoordinator,
  surface.abis.coordinator,
  provider,
);

const positiveInteger = (value, fallback, name) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(name + " must be a positive integer");
  }
  return parsed;
};

const polling = config.reservationPolling ?? {};
const idleIntervalMs = positiveInteger(polling.idleIntervalMs, 30_000, "idleIntervalMs");
const activityIntervalMs = positiveInteger(polling.activityIntervalMs, 3_000, "activityIntervalMs");
const backlogIntervalMs = positiveInteger(polling.backlogIntervalMs, 1_000, "backlogIntervalMs");
const maxBlockRange = positiveInteger(polling.maxBlockRange, 1_000, "maxBlockRange");
const lookbackBlocks = positiveInteger(config.lookbackBlocks, 5_000, "lookbackBlocks");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const initialLatest = await provider.getBlockNumber();
let cursor = Math.max(0, initialLatest - lookbackBlocks);

const serialize = (log) => ({
  blockNumber: log.blockNumber,
  transactionHash: log.transactionHash,
  requestId: log.args.requestId,
  fillId: log.args.fillId,
  routeId: log.args.routeId,
  caller: log.args.caller,
  recipient: log.args.recipient,
  amountInRaw: log.args.amountInRaw,
  minimumAmountOutRaw: log.args.minimumAmountOutRaw,
  validUntil: log.args.validUntil,
});

while (true) {
  const latest = await provider.getBlockNumber();
  if (cursor > latest) {
    await sleep(idleIntervalMs);
    continue;
  }

  const fromBlock = cursor;
  const toBlock = Math.min(latest, fromBlock + maxBlockRange - 1);
  const logs = await coordinator.queryFilter(
    coordinator.filters.ReservationRequestedV5(),
    fromBlock,
    toBlock,
  );

  for (const log of logs) {
    console.log(JSON.stringify(serialize(log), (_, value) => (
      typeof value === "bigint" ? value.toString() : value
    )));
  }

  cursor = toBlock + 1;
  const interval = cursor <= latest
    ? backlogIntervalMs
    : logs.length > 0
      ? activityIntervalMs
      : idleIntervalMs;
  await sleep(interval);
}
