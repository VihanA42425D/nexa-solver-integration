import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const CHECKSUM_FILES = Object.freeze([
  "README.md",
  "manifest.json",
  "nexa-mainnet-v6.json",
  "public/.well-known/nexa-solver.json",
  "abi/solver-facing.json",
  "contracts/NexaSolverDiscoveryV6.sol",
  "events/events.json",
  "networks/network-ids.json",
  "openapi/openapi.json",
  "onboarding/README.md",
  "onboarding/nexa-v6-solver-operator.json",
  "distribution/targets.json",
  "distribution/submissions/rabby-bridge-provider.md",
  "sdk-spec/README.md",
  "sdk-spec/nexa-v6-sdk-contract.json",
  "sdk-spec/test-vectors.json",
  "sdks/typescript/package.json",
  "sdks/typescript/src/index.js",
  "sdks/typescript/src/index.d.ts",
  "sdks/python/pyproject.toml",
  "sdks/python/src/nexa_v6_sdk/__init__.py",
  "sdks/python/src/nexa_v6_sdk/client.py",
  "sdks/rust/Cargo.toml",
  "sdks/rust/src/lib.rs",
  "sdks/go/go.mod",
  "sdks/go/core.go",
  "sdks/go/abi.go",
  "sdks/go/client.go",
  "sdks/jvm/pom.xml",
  "sdks/jvm/src/main/java/com/vsnexa/v6/NexaSdkException.java",
  "sdks/jvm/src/main/java/com/vsnexa/v6/NexaV6Abi.java",
  "sdks/jvm/src/main/java/com/vsnexa/v6/NexaV6Client.java",
  "sdks/jvm/src/main/java/com/vsnexa/v6/NexaV6Core.java",
  "sdks/dotnet/src/Nexa.V6.Sdk/Nexa.V6.Sdk.csproj",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaSdkException.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Abi.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Client.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Core.cs",
  "standards/standard-ids.json",
  "verification/NexaSolverDiscoveryV6.standard-input.json",
  "verification/explorer-ownership-signatures.json",
  "verification/erc7683-resolver-vetting.json",
  "verification/facade-deployment.json",
  "verification/onchain-identity.json",
]);

export async function buildChecksums(repositoryRoot = root) {
  const lines = [];
  for (const file of CHECKSUM_FILES) {
    const normalized = (await readFile(resolve(repositoryRoot, file), "utf8"))
      .replaceAll("\r\n", "\n");
    const digest = createHash("sha256")
      .update(normalized, "utf8")
      .digest("hex");
    lines.push(`${digest}  ${file}`);
  }
  return lines.join("\n") + "\n";
}

export async function generateChecksums(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "verification/checksums.sha256");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, await buildChecksums(repositoryRoot), "utf8");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateChecksums());
}
