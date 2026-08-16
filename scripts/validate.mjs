import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id, Interface } from "ethers";
import { auditRepositoryForSecrets } from "./repo-secret-audit.mjs";
import {
  buildNexaSolverManifest,
  serializeNexaSolverManifest,
} from "./generate-nexa-solver-manifest.mjs";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));
const [manifest, addresses, standards] = await Promise.all([
  readJson("manifest.json"),
  readJson("addresses/mainnet.json"),
  readJson("standards/standard-ids.json"),
]);
if (manifest.publicSurfaceOnly !== true) throw new Error("Manifest must remain public-surface-only");
if (manifest.releaseId !== addresses.releaseId) throw new Error("Release ID mismatch");
for (const standard of Object.values(standards.standards)) {
  if (id(standard.name) !== standard.id) {
    throw new Error("Standard ID mismatch: " + standard.name);
  }
}
for (const network of Object.values(addresses.networks)) {
  for (const address of Object.values(network.contracts)) getAddress(address);
}
for (const file of await readdir(resolve(root, "abis"))) {
  if (!file.endsWith(".json")) continue;
  new Interface(await readJson("abis/" + file));
}
const forbidden = /private.?key|mnemonic|kms|clearing|inventory|vault.?management|business.?logic/i;
for (const directory of ["src", "examples"]) {
  for (const file of await readdir(resolve(root, directory))) {
    const source = await readFile(resolve(root, directory, file), "utf8");
    if (forbidden.test(source)) {
      throw new Error("Forbidden internal surface in " + directory + "/" + file);
    }
  }
}

const expectedEndpointUrls = [
  "https://solver.vsnexa.com/.well-known/nexa-solver.json",
  "https://solver.vsnexa.com/api/v5/solver-discovery",
  "https://solver.vsnexa.com/api/v5/solver-feed",
  "https://solver.vsnexa.com/api/v5/solver-feed/events",
  "https://solver.vsnexa.com/api/v5/solver-feed/status",
];
if (JSON.stringify(Object.values(PUBLIC_ENDPOINTS)) !== JSON.stringify(expectedEndpointUrls)) {
  throw new Error("Public endpoint catalog mismatch");
}

const generatedManifest = serializeNexaSolverManifest(await buildNexaSolverManifest(root));
const staticManifest = await readFile(
  resolve(root, "public/.well-known/nexa-solver.json"),
  "utf8",
);
if (staticManifest !== generatedManifest) {
  throw new Error("Generated solver manifest is stale");
}

const publicEntries = (await readdir(resolve(root, "public"))).sort();
const wellKnownEntries = (await readdir(resolve(root, "public/.well-known"))).sort();
if (JSON.stringify(publicEntries) !== JSON.stringify([".well-known"])
  || JSON.stringify(wellKnownEntries) !== JSON.stringify(["nexa-solver.json"])) {
  throw new Error("Unexpected public static asset");
}

const wrangler = await readJson("wrangler.jsonc");
if (wrangler.main !== "./src/worker.mjs" || wrangler.workers_dev !== false
  || wrangler.assets?.directory !== "./public" || wrangler.assets?.binding !== "ASSETS"
  || wrangler.assets?.run_worker_first !== true) {
  throw new Error("Wrangler Worker or Static Assets configuration mismatch");
}
if (JSON.stringify(wrangler.routes) !== JSON.stringify([{
  pattern: "solver.vsnexa.com",
  custom_domain: true,
}])) {
  throw new Error("Wrangler custom domain mismatch");
}
if (Object.hasOwn(wrangler, "vars") || JSON.stringify(wrangler).includes("SOLVER_ORIGIN")) {
  throw new Error("Origin configuration must not be committed to Wrangler");
}

const workerSource = await readFile(resolve(root, "src/worker.mjs"), "utf8");
if (/https?:\/\//i.test(workerSource)) throw new Error("Worker must not hardcode an origin URL");

const auditedFiles = await auditRepositoryForSecrets(root);
console.log(
  "Nexa public solver integration surface validated ("
    + auditedFiles
    + " files secret-scanned)",
);
