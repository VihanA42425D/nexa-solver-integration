import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = resolve(repositoryRoot, "indexing/substreams");
const target = resolve(workspace, "target");
const packages = Object.freeze({
  base: Object.freeze({
    manifest: "substreams.base.yaml",
    output: "target/nexa-v6-base.spkg",
  }),
  bsc: Object.freeze({
    manifest: "substreams.bsc.yaml",
    output: "target/nexa-v6-bsc.spkg",
  }),
  "hyper-evm": Object.freeze({
    manifest: "substreams.hyper-evm.yaml",
    output: "target/nexa-v6-hyper-evm.spkg",
  }),
});

const selection = process.argv[2] ?? "all";
const networks = selection === "all" ? Object.keys(packages) : [selection];
if (networks.some((network) => !packages[network])) {
  throw new Error("SUBSTREAMS_PACK_NETWORK_INVALID:" + selection);
}

mkdirSync(target, { recursive: true });
for (const network of networks) {
  const item = packages[network];
  const result = spawnSync(
    "substreams",
    ["pack", item.manifest, "--output-file", item.output],
    { cwd: workspace, stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!existsSync(resolve(workspace, item.output))) {
    throw new Error("SUBSTREAMS_PACK_OUTPUT_MISSING:" + network);
  }
}

console.log("Official Substreams CLI parsed and packed " + networks.length + " manifest(s)");
