import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wasmPath = resolve(
  root,
  "indexing/substreams/target/wasm32-unknown-unknown/release/nexa_v6_substreams.wasm",
);
const manifests = ["base", "bsc", "hyper-evm"];
const descriptor = JSON.parse(await readFile(
  resolve(root, "indexing/indexing-manifest.json"), "utf8",
));
const requiredModules = [
  "map_nexa_v6_events", "store_networks", "store_assets", "store_routes",
  "store_router_state", "store_standard_modules",
];

const wasm = await readFile(wasmPath).catch(() => {
  throw new Error(
    "SUBSTREAMS_WASM_MISSING: run npm run indexing:substreams:build before package validation",
  );
});
if (wasm.length < 8 || wasm.subarray(0, 4).toString("hex") !== "0061736d") {
  throw new Error("SUBSTREAMS_WASM_INVALID");
}

for (const network of manifests) {
  const source = await readFile(
    resolve(root, "indexing/substreams/substreams." + network + ".yaml"),
    "utf8",
  );
  if (!source.includes(
    "file: ./target/wasm32-unknown-unknown/release/nexa_v6_substreams.wasm",
  )) throw new Error("SUBSTREAMS_BINARY_PATH_DRIFT:" + network);
  if (!source.includes("- nexa/v6/indexing.proto")) {
    throw new Error("SUBSTREAMS_PROTO_PATH_DRIFT:" + network);
  }
  for (const module of requiredModules) {
    if (!source.includes("name: " + module)) {
      throw new Error("SUBSTREAMS_MODULE_MISSING:" + network + ":" + module);
    }
  }
}

console.log(JSON.stringify({
  status: "PACKAGE_VALID",
  externalDeploymentStatus: descriptor.externalDeploymentStatus,
  manifests: manifests.length,
  wasmBytes: wasm.length,
  wasmSha256: createHash("sha256").update(wasm).digest("hex"),
}, null, 2));
