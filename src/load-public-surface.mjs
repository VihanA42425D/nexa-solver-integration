import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
}

const abiFiles = Object.freeze({
  registry: "NexaMainnetRegistryV5.json",
  router: "NexaMainnetRouterV5.json",
  coordinator: "NexaReservationCoordinatorV5.json",
  currentResolver: "NexaERC7683ReadyFillResolverV5.json",
  resolverHubDelegate: "NexaResolverHubV5.json",
  legacy7683: "NexaLegacy7683AdapterV5.json",
  solverLaneFactory: "NexaSolverLaneFactoryV5.json",
  oif: "NexaOIFAdapterV5.json",
});

export async function loadPublicSurface(networkName) {
  const [manifest, addresses, standards, abiEntries] = await Promise.all([
    readJson("manifest.json"),
    readJson("addresses/mainnet.json"),
    readJson("standards/standard-ids.json"),
    Promise.all(Object.entries(abiFiles).map(async ([name, file]) => [
      name,
      await readJson(`abis/${file}`),
    ])),
  ]);
  const network = addresses.networks[networkName];
  if (!network) throw new Error(`Unsupported Nexa network: ${networkName}`);
  return Object.freeze({ manifest, standards, network, abis: Object.fromEntries(abiEntries) });
}
