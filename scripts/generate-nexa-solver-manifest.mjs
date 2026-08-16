import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const readJson = async (root, file) => JSON.parse(
  await readFile(resolve(root, file), "utf8"),
);

export const buildNexaSolverManifest = async (root = repositoryRoot) => {
  const [manifest, addresses, standards] = await Promise.all([
    readJson(root, "manifest.json"),
    readJson(root, "addresses/mainnet.json"),
    readJson(root, "standards/standard-ids.json"),
  ]);
  return {
    manifest,
    addresses,
    standards,
    endpoints: PUBLIC_ENDPOINTS,
  };
};

export const serializeNexaSolverManifest = (value) => JSON.stringify(value, null, 2) + "\n";

export const generateNexaSolverManifest = async (root = repositoryRoot) => {
  const output = resolve(root, "public/.well-known/nexa-solver.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    serializeNexaSolverManifest(await buildNexaSolverManifest(root)),
    "utf8",
  );
  return output;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await generateNexaSolverManifest();
  console.log("Generated " + output);
}
