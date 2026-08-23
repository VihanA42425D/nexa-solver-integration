#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(process.argv[2] || resolve(root, "..", ".release-artifacts", "sdk-v1.0.0"));

const copies = Object.freeze([
  ["sdks/rust/target/package/nexa-v6-sdk-1.0.0.crate", "nexa-v6-sdk-1.0.0.crate"],
  ["sdks/jvm/target/nexa-v6-sdk-1.0.0.jar", "nexa-v6-sdk-1.0.0.jar"],
  ["sdks/jvm/target/nexa-v6-sdk-1.0.0-sources.jar", "nexa-v6-sdk-1.0.0-sources.jar"],
  ["sdks/jvm/target/nexa-v6-sdk-1.0.0-javadoc.jar", "nexa-v6-sdk-1.0.0-javadoc.jar"],
  ["sdks/jvm/pom.xml", "nexa-v6-sdk-1.0.0.pom"],
  ["sdk-spec/nexa-v6-sdk-contract.json", "nexa-v6-sdk-contract-v1.0.0.json"],
  ["sdk-spec/test-vectors.json", "nexa-v6-sdk-test-vectors-v1.0.0.json"],
  ["verification/checksums.sha256", "nexa-v6-source-checksums-v6.1.0.sha256"],
]);

await mkdir(output, { recursive: true });
for (const [source, destination] of copies) {
  await copyFile(resolve(root, source), resolve(output, destination));
}

const checksumName = "SHA256SUMS-sdk-v1.0.0.txt";
const entries = (await readdir(output, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== checksumName)
  .map((entry) => entry.name)
  .sort();
const lines = [];
for (const file of entries) {
  const digest = createHash("sha256")
    .update(await readFile(resolve(output, file)))
    .digest("hex");
  lines.push(digest + "  " + basename(file));
}
await writeFile(resolve(output, checksumName), lines.join("\n") + "\n", "utf8");

console.log(JSON.stringify({
  release: "sdk-v1.0.0",
  output,
  files: entries.length,
  checksumFile: checksumName,
}, null, 2));
