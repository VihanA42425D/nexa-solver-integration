import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const configPath = process.argv[2] ?? new URL("../config/example.config.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const rpcUrl = process.env[config.rpcUrlEnv];
if (!rpcUrl) throw new Error(`Set ${config.rpcUrlEnv} before reading events`);

const surface = await loadPublicSurface(config.network);
const provider = new JsonRpcProvider(rpcUrl, surface.network.chainId, { staticNetwork: true });
const coordinator = new Contract(
  surface.network.contracts.reservationCoordinator,
  surface.abis.coordinator,
  provider,
);
const latest = await provider.getBlockNumber();
const fromBlock = Math.max(0, latest - Math.max(1, Number(config.lookbackBlocks ?? 5000)));
const logs = await coordinator.queryFilter(coordinator.filters.ReservationRequestedV5(), fromBlock, latest);
console.log(JSON.stringify(logs.map((log) => ({
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
})), (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
