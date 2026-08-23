import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));

const MODULE_ABI = Object.freeze({
  NexaERC7683ModuleV6: [
    "function STANDARD_ID() view returns (bytes32)",
    "function router() view returns (address)",
    "function standardId() pure returns (bytes32)",
    "function supportsInterface(bytes4 interfaceId) pure returns (bool)",
    "function resolveExecution(bytes payload) view returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
    "function resolve(bytes payload) view returns (tuple(bytes[] steps,bytes[] variables,bytes[] payments,tuple(string name,bytes data)[] assumptions) order)",
    "function resolveOrder(bytes payload) view returns (uint256 sourceChainId,uint256 destinationChainId,address target,bytes callData)"
  ],
  NexaOIFModuleV6: [
    "function STANDARD_ID() view returns (bytes32)",
    "function COMPATIBILITY_LEVEL() view returns (bytes32)",
    "function router() view returns (address)",
    "function standardId() pure returns (bytes32)",
    "function compatibilityLevel() pure returns (bytes32)",
    "function supportsInterface(bytes4 interfaceId) pure returns (bool)",
    "function resolveExecution(bytes payload) pure returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
    "function describeMandate(bytes payload) pure returns (tuple(bytes32 oracle,bytes32 settler,uint256 chainId,bytes32 token,uint256 amount,bytes32 recipient,bytes callbackData,bytes context) mandate)"
  ]
});

export async function buildAbiBundle(repositoryRoot = root) {
  const [integration, standards] = await Promise.all([
    readJson("nexa-mainnet-v6.json"),
    readJson("standards/standard-ids.json"),
  ]);
  const contracts = Object.fromEntries(Object.entries(integration.contracts).map(([name, value]) => [
    name,
    {
      address: value.address,
      runtimeCodeHash: value.runtimeCodeHash,
      format: "ethers-human-readable",
      abi: value.abi,
    },
  ]));
  contracts.NexaERC7683ModuleV6 = {
    address: standards.standards.erc7683.moduleAddress,
    runtimeCodeHash: standards.standards.erc7683.runtimeCodeHash,
    standardId: standards.standards.erc7683.id,
    format: "ethers-human-readable",
    abi: MODULE_ABI.NexaERC7683ModuleV6,
  };
  contracts.NexaOIFModuleV6 = {
    address: standards.standards.oif.moduleAddress,
    runtimeCodeHash: standards.standards.oif.runtimeCodeHash,
    standardId: standards.standards.oif.id,
    format: "ethers-human-readable",
    abi: MODULE_ABI.NexaOIFModuleV6,
  };
  return {
    schema: "NEXA_MAINNET_V6_SOLVER_FACING_ABI_FINAL",
    deploymentVersion: 6,
    contracts,
  };
}

export async function generateAbi(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "abi/solver-facing.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(await buildAbiBundle(repositoryRoot), null, 2) + "\n");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateAbi());
}
