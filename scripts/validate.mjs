import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id, Interface } from "ethers";
import { auditRepositoryForSecrets } from "./repo-secret-audit.mjs";

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
const auditedFiles = await auditRepositoryForSecrets(root);
console.log(
  "Nexa public solver integration surface validated ("
    + auditedFiles
    + " files secret-scanned)",
);
