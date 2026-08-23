import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const output = execFileSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
const [report] = JSON.parse(output);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (report.name !== "@nexa/solver-integration" || report.version !== packageJson.version) {
  throw new Error("Public package identity mismatch");
}
const files = new Set(report.files.map(({ path }) => path.replaceAll("\\", "/")));
const required = [
  "README.md",
  "manifest.json",
  "nexa-mainnet-v6.json",
  "abi/solver-facing.json",
  "contracts/NexaSolverDiscoveryV6.sol",
  "events/events.json",
  "networks/network-ids.json",
  "openapi/openapi.json",
  "onboarding/nexa-v6-solver-operator.json",
  "scripts/verify-onboarding.mjs",
  "public/.well-known/nexa-solver.json",
  "standards/standard-ids.json",
  "verification/checksums.sha256",
  "verification/erc7683-resolver-vetting.json",
  "verification/facade-deployment.json",
  "sdk-spec/nexa-v6-sdk-contract.json",
  "sdk-spec/test-vectors.json",
  "sdks/typescript/package.json",
  "sdks/python/pyproject.toml",
  "sdks/rust/Cargo.toml",
  "sdks/go/go.mod",
  "sdks/jvm/pom.xml",
  "sdks/dotnet/src/Nexa.V6.Sdk/Nexa.V6.Sdk.csproj",
  "distribution/targets.json",
];
for (const file of required) {
  if (!files.has(file)) throw new Error("Public package missing " + file);
}
for (const file of files) {
  if (/(^|\/)(?:\.env|\.git)(?:\/|$)/.test(file)
      || /private[-_]?key|mnemonic|credential/i.test(file)) {
    throw new Error("Forbidden package file: " + file);
  }
}
console.log(JSON.stringify({
  name: report.name,
  version: report.version,
  files: files.size,
  size: report.size,
  unpackedSize: report.unpackedSize,
  integrity: report.integrity,
}, null, 2));
