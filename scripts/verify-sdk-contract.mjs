#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFile(resolve(root, file), "utf8");
const json = async (file) => JSON.parse(await read(file));

const spec = await json("sdk-spec/nexa-v6-sdk-contract.json");
const vectors = await json("sdk-spec/test-vectors.json");
const expectedOperations = [
  "discover", "getRoutes", "getRoute", "verifyFeed", "requestPermitMessage",
  "requestPermit", "resolveExecution", "previewExecution", "buildExecutionTx",
  "getFillStatus",
];

if (spec.schema !== "NEXA_V6_SDK_CONTRACT_V1" || spec.status !== "FROZEN"
    || spec.specVersion !== "1.0.0") {
  throw new Error("SDK contract is not frozen at v1.0.0");
}
if (JSON.stringify(spec.operations.map(({ name }) => name)) !== JSON.stringify(expectedOperations)) {
  throw new Error("Frozen behavioral operation set drifted");
}
if (vectors.schema !== "NEXA_V6_SDK_TEST_VECTORS_V1"
    || vectors.specVersion !== spec.specVersion
    || vectors.feed.feedHash !== "0x2d07c27ec87174cda4aa46b990ec8b78ab22dbb61313b11e7db8a98aafe87414") {
  throw new Error("Frozen SDK vectors drifted");
}
if (!spec.canonicalization.feedSignature.includes("no EIP-191 prefix")
    || !spec.canonicalization.permitRequestSignature.includes("EIP-191")) {
  throw new Error("Feed and Permit signature schemes are not explicitly separated");
}

const packageVersion = spec.compatibility.allSdkPackages;
const sources = {
  typescript: await read("sdks/typescript/src/index.js"),
  python: await read("sdks/python/src/nexa_v6_sdk/client.py"),
  rust: await read("sdks/rust/src/lib.rs"),
  go: (await read("sdks/go/client.go")) + await read("sdks/go/core.go"),
  jvm: await read("sdks/jvm/src/main/java/io/github/vihana42425d/nexa/v6/NexaV6Client.java"),
  dotnet: await read("sdks/dotnet/src/Nexa.V6.Sdk/NexaV6Client.cs"),
};
for (const [language, methods] of Object.entries(spec.languageBindings)) {
  if (methods.length !== expectedOperations.length) throw new Error(language + " method count drifted");
  for (const method of methods) {
    if (!sources[language].includes(method)) throw new Error(language + " missing " + method);
  }
}

const typeScript = await json("sdks/typescript/package.json");
if (typeScript.version !== packageVersion) throw new Error("TypeScript SDK version drifted");
const versionFiles = {
  python: await read("sdks/python/pyproject.toml"),
  rust: await read("sdks/rust/Cargo.toml"),
  go: await read("sdks/go/VERSION"),
  jvm: await read("sdks/jvm/pom.xml"),
  dotnet: await read("sdks/dotnet/src/Nexa.V6.Sdk/Nexa.V6.Sdk.csproj"),
};
for (const [language, value] of Object.entries(versionFiles)) {
  if (!value.includes(packageVersion)) throw new Error(language + " SDK version drifted");
}

const retired = spec.protocol.version - 1;
const retiredMarkers = [`MAINNET_V${retired}`, `Nexa V${retired}`, `/v${retired}/`];
for (const [language, source] of Object.entries(sources)) {
  if (retiredMarkers.some((marker) => source.includes(marker))) {
    throw new Error(language + " SDK contains a prohibited V5 reference");
  }
}

console.log(JSON.stringify({
  schema: spec.schema,
  specVersion: spec.specVersion,
  packageVersion,
  status: "PASS",
  languages: Object.keys(spec.languageBindings),
  operations: expectedOperations,
  feedHash: vectors.feed.feedHash,
}, null, 2));
