import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  v6OpenApiDocument,
} = require("./generated/runtime-v6-openapi.cjs");
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

// This module is a deterministic projection of the authoritative Nexa runtime
// builder. The generated CJS source is checked in so clean public clones can
// regenerate and audit OpenAPI without access to the private runtime tree.
export function buildOpenApi() {
  return v6OpenApiDocument({ publicBaseUrl: "https://solver.vsnexa.com" });
}

export async function generateOpenApi(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "openapi/openapi.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(buildOpenApi(), null, 2) + "\n");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateOpenApi());
}
