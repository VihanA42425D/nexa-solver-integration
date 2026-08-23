import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (root, file) => JSON.parse(await readFile(resolve(root, file), "utf8"));
const PRE_ACTIVATION_DEPLOYMENT_STATUSES = new Set([
  "AWAITING_POST_DEPLOY_EXPORT",
  "DEPLOYED_AWAITING_CUTOVER",
]);

export const buildNexaSolverManifest = async (root = repositoryRoot) => {
  const [manifest, integration, standards] = await Promise.all([
    readJson(root, "manifest.json"),
    readJson(root, "nexa-mainnet-v6.json"),
    readJson(root, "standards/standard-ids.json"),
  ]);
  const active = !PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)
    && integration.activationRequired !== true
    && integration.doNotUseForExecutionUntilActivated !== true
    && Object.keys(integration.contracts ?? {}).length > 0
    && Object.keys(integration.networks ?? {}).length > 0;
  return {
    ...structuredClone(integration.discovery),
    deploymentStatus: active
      ? "ACTIVE"
      : (PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)
        ? integration.deploymentStatus
        : "AWAITING_POST_DEPLOY_EXPORT"),
    endpoints: PUBLIC_ENDPOINTS,
    standards: [
      {
        standardId: standards.standards.erc7683.id,
        name: "ERC-7683",
        compatibilityLevel: standards.standards.erc7683.compatibilityLevel,
        moduleAddress: standards.standards.erc7683.moduleAddress,
        executable: true
      },
      {
        standardId: standards.standards.oif.id,
        name: "OIF",
        compatibilityLevel: standards.standards.oif.compatibilityLevel,
        moduleAddress: standards.standards.oif.moduleAddress,
        executable: false
      }
    ],
    passiveOnchainDiscovery: {
      uri: PUBLIC_ENDPOINTS.onchainDiscovery,
      facadeAddress: integration.contracts.NexaSolverDiscoveryV6.address,
      chains: [8453, 56, 999],
      sameAddressAcrossChains: true,
    },
    activationRequired: !active
  };
};

export const serializeNexaSolverManifest = (value) => JSON.stringify(value, null, 2) + "\n";

export const generateNexaSolverManifest = async (root = repositoryRoot) => {
  const output = resolve(root, "public/.well-known/nexa-solver.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serializeNexaSolverManifest(await buildNexaSolverManifest(root)), "utf8");
  return output;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateNexaSolverManifest());
}
