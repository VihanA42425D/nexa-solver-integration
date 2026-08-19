import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id, Interface } from "ethers";
import { auditRepositoryForSecrets } from "./repo-secret-audit.mjs";
import { buildNexaSolverManifest, serializeNexaSolverManifest } from "./generate-nexa-solver-manifest.mjs";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));
const PRE_ACTIVATION_DEPLOYMENT_STATUSES = new Set([
  "AWAITING_POST_DEPLOY_EXPORT",
  "DEPLOYED_AWAITING_CUTOVER",
]);
const [manifest, integration, standards, events] = await Promise.all([
  readJson("manifest.json"),
  readJson("nexa-mainnet-v6.json"),
  readJson("standards/standard-ids.json"),
  readJson("events/events.json"),
]);

if (manifest.publicSurfaceOnly !== true || manifest.deploymentVersion !== 6) {
  throw new Error("Manifest must remain V6 public-surface-only");
}
if (manifest.releaseId !== integration.releaseId) throw new Error("V6 release ID mismatch");

const profile = manifest.solverProfile;
if (!profile
    || JSON.stringify(profile.executionScopes) !== JSON.stringify(["INTRA_CHAIN", "CROSS_CHAIN"])
    || profile.automatedDiscovery !== true
    || profile.variableSizeExecution !== true
    || profile.machineVerifiableState !== true
    || profile.accountlessDiscovery !== true) {
  throw new Error("V6 public Solver capability profile mismatch");
}
if (JSON.stringify(integration.solverProfile) !== JSON.stringify(profile)) {
  throw new Error("V6 public Solver capability profile is not synchronized");
}

for (const standard of Object.values(standards.standards)) {
  if (id(standard.name) !== standard.id) throw new Error("Standard ID mismatch: " + standard.name);
  getAddress(standard.moduleAddress);
}
for (const event of Object.values(events.events)) {
  if (id(event.signature) !== event.topic0) throw new Error("Event topic mismatch: " + event.signature);
}
if (Object.keys(events.events).some((name) => name !== "SourceFillV6")) {
  throw new Error("Only Solver-facing source execution events may be published");
}

const active = !PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)
  && integration.activationRequired !== true
  && integration.doNotUseForExecutionUntilActivated !== true;
if (active) {
  const publicContractNames = Object.keys(integration.contracts ?? {}).sort();
  if (JSON.stringify(publicContractNames) !== JSON.stringify([
    "NexaMainnetRegistryV6",
    "NexaMainnetRouterV6",
  ])) {
    throw new Error("Active V6 bundle must expose only RegistryV6 and RouterV6 contracts");
  }
  for (const contract of Object.values(integration.contracts)) {
    getAddress(contract.address);
    new Interface(contract.abi);
  }
  const expectedNetworks = { base: 8453, bsc: 56, hyperevm: 999 };
  for (const [slug, chainId] of Object.entries(expectedNetworks)) {
    const network = integration.networks?.[slug];
    if (!network || network.chainId !== chainId
        || getAddress(network.registry) !== getAddress(integration.contracts.NexaMainnetRegistryV6.address)
        || getAddress(network.router) !== getAddress(integration.contracts.NexaMainnetRouterV6.address)
        || Object.keys(network).some((key) => !["chainId", "registry", "router"].includes(key))) {
      throw new Error("Public V6 network surface mismatch: " + slug);
    }
  }
} else {
  if (!PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)) {
    throw new Error("Inactive V6 bundle has an invalid deployment status");
  }
}

const expectedEndpointUrls = [
  "https://solver.vsnexa.com/.well-known/nexa-solver.json",
  "https://solver.vsnexa.com/api/v6/solver-discovery",
  "https://solver.vsnexa.com/api/v6/solver-feed",
  "https://solver.vsnexa.com/api/v6/solver-feed/events",
  "https://solver.vsnexa.com/api/v6/routes/{routeId}",
  "https://solver.vsnexa.com/api/v6/execution-permits/request-message",
  "https://solver.vsnexa.com/api/v6/execution-permits",
  "https://solver.vsnexa.com/api/v6/execution-permits/{fillId}"
];
if (JSON.stringify(Object.values(PUBLIC_ENDPOINTS)) !== JSON.stringify(expectedEndpointUrls)) {
  throw new Error("Public V6 endpoint catalog mismatch");
}

const staticPublicFiles = [
  ".env.example",
  "README.md",
  "manifest.json",
  "nexa-mainnet-v6.json",
  "standards/standard-ids.json",
  "events/events.json",
  "public/.well-known/nexa-solver.json",
];
const forbiddenPublicTokens = [
  "0x13D8881F30985A0CeE8c24F897CE8B37F4299255",
  "0x16e4012ce6E87b024cAD55689B7836Dc98738438",
  "0xB247B7Aa76d9Af4C69524b1B48840050E3976896",
  "0xA149C756E611D0315bCB2d469aA642d6Be32F765",
  "0x7fF3D7F41B5C3b53F1242a0bE5a683B95e09FFB4",
  "0xA767213615Bb6f8BE5C82DD41d029572E6944E7C",
  "0xF2009b45f521A8b4E62b0B68386aB6Fc5C5F6d5b",
  "0xCbeC1dDeEA1f4317ce6eF6F33Ad46d1fFD81c163",
  "NexaMainnetVaultV6",
  "NexaMainnetAuthorizationVerifierV6",
  "NexaMainnetEntryPointV6",
  "NexaStandardModuleRegistryV6",
  "NexaClearingBatchExecutorV5",
  "NexaStargateV2AdapterV5",
  "\"feedSigner\"",
  "\"preparationHash\"",
  "\"deploymentSource\"",
];
for (const file of staticPublicFiles) {
  const source = await readFile(resolve(root, file), "utf8");
  for (const token of forbiddenPublicTokens) {
    if (source.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`Forbidden non-Solver public detail in ${file}: ${token}`);
    }
  }
}

for (const directory of ["src", "examples"]) {
  for (const file of await readdir(resolve(root, directory))) {
    const source = await readFile(resolve(root, directory, file), "utf8");
    if (/\/api\/v5\/|ReservationRequestedV5|requestReservation|reserveDestination|SolverLaneFactoryV5/.test(source)) {
      throw new Error("Active V5 reservation-first surface remains in " + directory + "/" + file);
    }
  }
}

const generatedManifest = serializeNexaSolverManifest(await buildNexaSolverManifest(root));
const staticManifest = await readFile(resolve(root, "public/.well-known/nexa-solver.json"), "utf8");
if (staticManifest !== generatedManifest) throw new Error("Generated V6 solver manifest is stale");

const wrangler = await readJson("wrangler.jsonc");
if (wrangler.main !== "./src/worker.mjs" || wrangler.workers_dev !== false
    || wrangler.assets?.directory !== "./public" || wrangler.assets?.binding !== "ASSETS"
    || wrangler.assets?.run_worker_first !== true) {
  throw new Error("Wrangler Worker or Static Assets configuration mismatch");
}
if (Object.hasOwn(wrangler, "vars") || JSON.stringify(wrangler).includes("SOLVER_ORIGIN")) {
  throw new Error("Origin configuration must not be committed to Wrangler");
}
const workerSource = await readFile(resolve(root, "src/worker.mjs"), "utf8");
if (/https?:\/\//i.test(workerSource)) throw new Error("Worker must not hardcode an origin URL");
if (!workerSource.includes("NEXA_V6_EDGE_TELEMETRY_HMAC_SECRET")) {
  throw new Error("Worker HMAC telemetry binding missing");
}

const auditedFiles = await auditRepositoryForSecrets(root);
console.log(`Nexa V6 minimal public solver surface validated (${auditedFiles} files secret-scanned; active=${active})`);
