import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const CHECKSUM_FILES = Object.freeze([
  "README.md",
  "package.json",
  "package-lock.json",
  "manifest.json",
  "nexa-mainnet-v6.json",
  "public/.well-known/nexa-solver.json",
  "public/.well-known/nexa-onchain-discovery.json",
  "public/.well-known/nexa-standards.json",
  "abi/solver-facing.json",
  "contracts/NexaSolverDiscoveryV6.sol",
  "events/events.json",
  "verification/indexing-deployment-evidence.json",
  "indexing/README.md",
  "indexing/DEPLOYMENT_HANDOFF.md",
  "indexing/nexa-v6-indexing.json",
  "indexing/indexing-manifest.json",
  "indexing/external-deployments.json",
  "analytics/dune/README.md",
  "analytics/dune/DASHBOARD_HANDOFF.md",
  "analytics/dune/dune-manifest.json",
  "analytics/dune/source-bindings.json",
  "analytics/dune/sql/canonical-events.sql",
  "analytics/dune/sql/overview.sql",
  "analytics/dune/sql/networks-current.sql",
  "analytics/dune/sql/assets-current.sql",
  "analytics/dune/sql/routes-current.sql",
  "analytics/dune/sql/route-status-history.sql",
  "analytics/dune/sql/router-state.sql",
  "analytics/dune/sql/standard-modules-current.sql",
  "analytics/dune/sql/source-fills.sql",
  "analytics/dune/sql/recent-activity.sql",
  "indexing/fixtures/nexa-v6-events.json",
  "indexing/graph/package.json",
  "indexing/graph/package-lock.json",
  "indexing/graph/.npmignore",
  "indexing/graph/matchstick.yaml",
  "indexing/graph/schema.graphql",
  "indexing/graph/src/mapping.ts",
  "indexing/graph/test/fixtures.test.mjs",
  "indexing/graph/tests/mapping-fixtures.test.ts",
  "indexing/graph/abis/NexaMainnetRegistryV6.json",
  "indexing/graph/abis/NexaMainnetRouterV6.json",
  "indexing/graph/abis/NexaStandardModuleRegistryV6.json",
  "indexing/graph/subgraph.base.yaml",
  "indexing/graph/subgraph.bsc.yaml",
  "indexing/substreams/Cargo.toml",
  "indexing/substreams/Cargo.lock",
  "indexing/substreams/.npmignore",
  "indexing/substreams/README.md",
  "indexing/substreams/build.rs",
  "indexing/substreams/proto/nexa/v6/indexing.proto",
  "indexing/substreams/src/generated.rs",
  "indexing/substreams/src/lib.rs",
  "indexing/substreams/src/pb.rs",
  "indexing/substreams/substreams.base.yaml",
  "indexing/substreams/substreams.bsc.yaml",
  "indexing/substreams/substreams.hyper-evm.yaml",
  "scripts/indexing-events.mjs",
  "scripts/pack-substreams.mjs",
  "scripts/generate-indexing.mjs",
  "scripts/validate-indexing.mjs",
  "scripts/validate-substreams-package.mjs",
  "scripts/sync-dune-v6.mjs",
  ".github/workflows/indexing-validation.yml",
  "test/indexing-package.test.mjs",
  "test/dune-analytics.test.mjs",
  "networks/network-ids.json",
  "openapi/openapi.json",
  "scripts/generated/runtime-v6-openapi.cjs",
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
  "sdks/jvm/src/main/java/io/github/vihana42425d/nexa/v6/NexaSdkException.java",
  "sdks/jvm/src/main/java/io/github/vihana42425d/nexa/v6/NexaV6Abi.java",
  "sdks/jvm/src/main/java/io/github/vihana42425d/nexa/v6/NexaV6Client.java",
  "sdks/jvm/src/main/java/io/github/vihana42425d/nexa/v6/NexaV6Core.java",
  "sdks/dotnet/src/Nexa.V6.Sdk/Nexa.V6.Sdk.csproj",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaSdkException.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Abi.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Client.cs",
  "sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Core.cs",
  "standards/standard-ids.json",
  "standards/nexa-standards.json",
  "standards/test-vectors.json",
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
