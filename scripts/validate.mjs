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
    || profile.amountBoundSignedTerms !== true
    || profile.executableCapacityPublished !== true
    || profile.machineVerifiableState !== true
    || profile.lowProtocolOverhead !== true
    || profile.periodicOnchainPublicationRequired !== false
    || profile.loginRequired !== false
    || profile.sessionRequired !== false
    || profile.cookieRequired !== false
    || profile.solverControlsCapital !== true
    || profile.solverControlsOpportunitySelection !== true
    || profile.solverControlsProfitabilityAssessment !== true) {
  throw new Error("V6 public Solver capability profile mismatch");
}
if (Object.hasOwn(manifest, "executionModel") || Object.hasOwn(manifest, "deprecated")) {
  throw new Error("Public manifest must describe Solver capabilities, not internal settlement history");
}
if (JSON.stringify(integration.solverProfile) !== JSON.stringify(profile)) {
  throw new Error("V6 public Solver capability profile is not synchronized");
}
for (const standard of Object.values(standards.standards)) {
  if (id(standard.name) !== standard.id) throw new Error("Standard ID mismatch: " + standard.name);
}
for (const event of Object.values(events.events)) {
  if (id(event.signature) !== event.topic0) throw new Error("Event topic mismatch: " + event.signature);
}

const active = !PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)
  && integration.activationRequired !== true
  && integration.doNotUseForExecutionUntilActivated !== true;
if (active) {
  if (!integration.contracts || Object.keys(integration.contracts).length === 0) {
    throw new Error("Active V6 bundle has no contracts");
  }
  if (!integration.networks || Object.keys(integration.networks).length === 0) {
    throw new Error("Active V6 bundle has no networks");
  }
  for (const contract of Object.values(integration.contracts)) {
    getAddress(contract.address);
    new Interface(contract.abi);
  }
} else {
  if (!PRE_ACTIVATION_DEPLOYMENT_STATUSES.has(integration.deploymentStatus)) {
    throw new Error("Inactive V6 bundle has an invalid deployment status");
  }
  if (manifest.deploymentStatus !== integration.deploymentStatus) {
    throw new Error("Pre-activation V6 deployment status mismatch");
  }
  if (integration.activationRequired !== true
      || integration.doNotUseForExecutionUntilActivated !== true) {
    throw new Error("Pre-activation V6 bundle must remain explicitly fail-closed");
  }
  if (Object.keys(integration.contracts ?? {}).length !== 0
      || Object.keys(integration.networks ?? {}).length !== 0) {
    throw new Error("Pre-activation bundle must not publish partial addresses or networks");
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
console.log(`Nexa V6 public solver surface validated (${auditedFiles} files secret-scanned; active=${active})`);
