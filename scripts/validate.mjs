import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id, Interface, recoverAddress } from "ethers";
import { buildAbiBundle } from "./generate-abi.mjs";
import { buildChecksums } from "./generate-checksums.mjs";
import { buildNexaSolverManifest, serializeNexaSolverManifest } from "./generate-nexa-solver-manifest.mjs";
import { buildOnboardingPackage, serializeOnboardingPackage } from "./generate-onboarding-package.mjs";
import { buildOpenApi } from "./generate-openapi.mjs";
import { buildOnchainDiscovery, serializeOnchainDiscovery } from "./generate-onchain-discovery.mjs";
import {
  buildStandardsManifest,
  serializeStandardsManifest,
} from "./generate-standards-manifest.mjs";
import { buildStandardVectors } from "./generate-standard-vectors.mjs";
import { auditRepositoryForSecrets } from "./repo-secret-audit.mjs";
import { PUBLIC_ENDPOINTS, PUBLIC_PATHS } from "../src/public-endpoints.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFile(resolve(root, file), "utf8");
const readJson = async (file) => JSON.parse(await read(file));
const same = (left, right, code) => {
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(code);
};
const hash = (value, code) => {
  if (!/^0x[0-9a-f]{64}$/i.test(String(value ?? ""))) throw new Error(code);
};

const [manifest, integration, standards, standardsManifest, standardVectors,
  events, networkIds, abi, facadeEvidence,
  inputEvidence, ownershipEvidence, identityEvidence, resolverVetting, openapi, onchainDiscovery,
  onboarding, packageJson] = await Promise.all([
  readJson("manifest.json"),
  readJson("nexa-mainnet-v6.json"),
  readJson("standards/standard-ids.json"),
  readJson("standards/nexa-standards.json"),
  readJson("standards/test-vectors.json"),
  readJson("events/events.json"),
  readJson("networks/network-ids.json"),
  readJson("abi/solver-facing.json"),
  readJson("verification/facade-deployment.json"),
  readJson("verification/NexaSolverDiscoveryV6.standard-input.json"),
  readJson("verification/explorer-ownership-signatures.json"),
  readJson("verification/onchain-identity.json"),
  readJson("verification/erc7683-resolver-vetting.json"),
  readJson("openapi/openapi.json"),
  readJson("public/.well-known/nexa-onchain-discovery.json"),
  readJson("onboarding/nexa-v6-solver-operator.json"),
  readJson("package.json"),
]);

if (manifest.publicSurfaceOnly !== true || manifest.deploymentVersion !== 6
    || manifest.deploymentStatus !== "ACTIVE" || integration.deploymentStatus !== "ACTIVE"
    || integration.activationRequired !== false
    || integration.doNotUseForExecutionUntilActivated !== false) {
  throw new Error("Public V6 release must be final ACTIVE");
}
if (manifest.releaseId !== integration.releaseId
    || manifest.releaseId !== identityEvidence.releaseId) {
  throw new Error("Release ID mismatch");
}
same(integration.solverProfile, manifest.solverProfile, "Solver profile mismatch");

const contractNames = [
  "NexaMainnetRegistryV6",
  "NexaMainnetRouterV6",
  "NexaSolverDiscoveryV6",
];
same(Object.keys(integration.contracts).sort(), [...contractNames].sort(), "Public contract allowlist drift");
for (const name of contractNames) {
  const contract = integration.contracts[name];
  getAddress(contract.address);
  hash(contract.runtimeCodeHash, `Missing runtime hash: ${name}`);
  new Interface(contract.abi);
  same(abi.contracts[name].abi, contract.abi, `ABI drift: ${name}`);
  if (abi.contracts[name].runtimeCodeHash !== contract.runtimeCodeHash) {
    throw new Error(`ABI runtime identity drift: ${name}`);
  }
}

const registry = integration.contracts.NexaMainnetRegistryV6;
const router = integration.contracts.NexaMainnetRouterV6;
const facade = integration.contracts.NexaSolverDiscoveryV6;
if (getAddress(facade.registry) !== getAddress(registry.address)
    || getAddress(facade.router) !== getAddress(router.address)
    || facade.address !== facade.facadeAddress
    || facade.discoveryURI !== PUBLIC_ENDPOINTS.manifest
    || manifest.facadeAddress !== facade.address
    || manifest.discoveryURI !== facade.discoveryURI
    || manifest.onchainDiscovery !== "./public/.well-known/nexa-onchain-discovery.json") {
  throw new Error("Facade immutable binding or discovery URI drift");
}

const expectedNetworks = { base: 8453, bsc: 56, hyperevm: 999 };
for (const [slug, chainId] of Object.entries(expectedNetworks)) {
  const network = integration.networks[slug];
  const identity = networkIds.networks[slug];
  const evidence = facadeEvidence.networks[slug];
  if (network.chainId !== chainId || identity.chainId !== chainId
      || network.networkId !== identity.networkId
      || network.facadeAddress !== facade.address
      || network.runtimeCodeHash !== facade.runtimeCodeHash
      || getAddress(network.registry) !== getAddress(registry.address)
      || getAddress(network.router) !== getAddress(router.address)
      || network.discoveryURI !== facade.discoveryURI
      || network.systemState.chainId !== chainId
      || network.systemState.releaseId !== integration.releaseId
      || BigInt(network.systemState.routeCount) <= 0n
      || network.systemState.live !== true
      || network.verification.onchainIdentity.status !== "VERIFIED"
      || network.verification.explorer.status !== "VERIFIED_EXACT_STANDARD_JSON"
      || network.verification.sourcify.status !== "VERIFIED_EXACT_MATCH"
      || evidence.status !== "VERIFIED"
      || evidence.chainId !== chainId
      || evidence.isLive !== true
      || evidence.immutableBindingsVerified !== true
      || BigInt(evidence.routeCount) !== BigInt(network.systemState.routeCount)) {
    throw new Error(`Network identity mismatch: ${slug}`);
  }
}

for (const [key, standard] of Object.entries(standards.standards)) {
  if (id(standard.name) !== standard.id) throw new Error(`Standard ID mismatch: ${key}`);
  getAddress(standard.moduleAddress);
  hash(standard.runtimeCodeHash, `Standard runtime hash missing: ${key}`);
  const name = key === "erc7683" ? "NexaERC7683ModuleV6" : "NexaOIFModuleV6";
  if (abi.contracts[name].address !== standard.moduleAddress
      || abi.contracts[name].runtimeCodeHash !== standard.runtimeCodeHash) {
    throw new Error(`Standard ABI identity mismatch: ${key}`);
  }
  new Interface(abi.contracts[name].abi);
}
for (const event of Object.values(events.events)) {
  if (id(event.signature) !== event.topic0) throw new Error("Event topic mismatch");
  new Interface([event.abi]);
}

const expectedOnchainDiscovery = await buildOnchainDiscovery(root);
same(expectedOnchainDiscovery, onchainDiscovery, "Generated onchain discovery fingerprint is stale");
if (await read("public/.well-known/nexa-onchain-discovery.json")
    !== serializeOnchainDiscovery(expectedOnchainDiscovery)) {
  throw new Error("Serialized onchain discovery fingerprint is stale");
}
const sourceFill = events.events.SourceFillV6;
if (onchainDiscovery.status !== "ACTIVE"
    || onchainDiscovery.releaseId !== integration.releaseId
    || onchainDiscovery.discoveryURI !== facade.discoveryURI
    || onchainDiscovery.onchainDiscoveryURI !== PUBLIC_ENDPOINTS.onchainDiscovery
    || onchainDiscovery.facade !== facade.address
    || onchainDiscovery.facadeRuntimeCodeHash !== facade.runtimeCodeHash
    || onchainDiscovery.registry !== registry.address
    || onchainDiscovery.registryRuntimeCodeHash !== registry.runtimeCodeHash
    || onchainDiscovery.router !== router.address
    || onchainDiscovery.routerRuntimeCodeHash !== router.runtimeCodeHash
    || onchainDiscovery.sameAddressAcrossChains !== true
    || JSON.stringify(onchainDiscovery.chains) !== JSON.stringify([8453, 56, 999])
    || onchainDiscovery.selectors.discoveryURI !== id("discoveryURI()").slice(0, 10)
    || onchainDiscovery.events.SourceFillV6.topic0 !== sourceFill.topic0
    || onchainDiscovery.events.SourceFillV6.signature !== sourceFill.signature
    || onchainDiscovery.erc7683.resolver !== standards.standards.erc7683.moduleAddress
    || onchainDiscovery.erc7683.standardId !== standards.standards.erc7683.id
    || onchainDiscovery.erc7683.erc165.nexaStandardModuleV6InterfaceId !== "0x8d60d6f9"
    || onchainDiscovery.deployment.initCodeHash !== facadeEvidence.initCodeHash
    || onchainDiscovery.sourcify.exactMatchOnEveryChain !== true
    || onchainDiscovery.sourcify.sourceFillV6Signature.status !== "REGISTERED"
    || onchainDiscovery.sourcify.sourceFillV6Signature.topic0 !== sourceFill.topic0
    || onchainDiscovery.sourcify.sourceFillV6Signature.hasVerifiedContractAssociation !== false) {
  throw new Error("Passive onchain discovery identity drift");
}
const scannerHints = onchainDiscovery.scannerHints;
if (scannerHints?.schema !== "NEXA_MAINNET_V6_SCANNER_HINTS_V1"
    || scannerHints.generatedFrom !== "CANONICAL_ONCHAIN_DISCOVERY_FINGERPRINT"
    || scannerHints.probe?.externalScannerOnly !== true
    || scannerHints.probe?.executedByNexa !== false
    || scannerHints.probe?.performsWrites !== false
    || scannerHints.probe?.pollingRequired !== false
    || scannerHints.probe?.steps?.length !== 9
    || scannerHints.eventDiscovery?.SourceFillV6?.topic0 !== sourceFill.topic0
    || scannerHints.contracts?.facade?.expectedRuntimeCodeHash !== facade.runtimeCodeHash
    || scannerHints.contracts?.router?.expectedRuntimeCodeHash !== router.runtimeCodeHash
    || scannerHints.standards?.erc7683?.resolver !== standards.standards.erc7683.moduleAddress
    || scannerHints.standards?.oif?.module !== standards.standards.oif.moduleAddress) {
  throw new Error("Scanner hints projection drift");
}
for (const [slug, chainId] of Object.entries(expectedNetworks)) {
  const chain = onchainDiscovery.chainEvidence[String(chainId)];
  const evidence = facadeEvidence.networks[slug];
  if (chain.network !== slug
      || chain.deploymentTransactionHash !== evidence.deploymentTransactionHash
      || chain.deploymentBlockNumber !== evidence.deploymentBlockNumber
      || chain.explorer !== evidence.explorer.url
      || chain.sourcify !== evidence.sourcify.url
      || chain.sourcifyMatchId !== evidence.sourcify.reference) {
    throw new Error(`Passive discovery evidence mismatch: ${slug}`);
  }
}

if (facadeEvidence.sourceVerificationComplete !== true
    || facadeEvidence.facadeAddress !== facade.address
    || facadeEvidence.runtimeCodeHash !== facade.runtimeCodeHash
    || facadeEvidence.registry !== registry.address
    || facadeEvidence.router !== router.address
    || facadeEvidence.discoveryURI !== facade.discoveryURI
    || inputEvidence.standardJsonInputHash !== facadeEvidence.standardJsonInputHash
    || inputEvidence.compiler !== facadeEvidence.compiler) {
  throw new Error("Facade verification evidence drift");
}
for (const statement of ownershipEvidence.statements) {
  const recovered = getAddress(recoverAddress(statement.messageHash, statement.signature));
  if (statement.verifiedLocally !== true
      || recovered !== getAddress(statement.recoveredAddress)
      || recovered !== getAddress(ownershipEvidence.signer)) {
    throw new Error(`Ownership signature mismatch: ${statement.network}`);
  }
}
for (const [name, value] of Object.entries(identityEvidence.contracts)) {
  const source = abi.contracts[name];
  if (!source || source.address !== value.address || source.runtimeCodeHash !== value.runtimeCodeHash) {
    throw new Error(`Pinned onchain identity drift: ${name}`);
  }
}

same(await buildAbiBundle(root), abi, "Generated ABI is stale");
same(buildOpenApi(), openapi, "Generated OpenAPI is stale");
for (const schema of [
  "SolverDiscovery",
  "OnchainDiscoveryFingerprint",
  "ScannerHints",
  "StandardsManifest",
  "SignedFeed",
  "SignedFeedPayload",
  "FeedResponse",
  "Route",
  "RouteDetailResponse",
  "PermitRequest",
  "PermitRequestMessageResponse",
  "ExecutionPermitResponse",
  "PermitStatusResponse",
  "ErrorResponse",
]) {
  if (!openapi.components?.schemas?.[schema]) throw new Error(`OpenAPI schema missing: ${schema}`);
}
if (openapi.openapi !== "3.1.0"
    || openapi.components.schemas.SignedFeed.properties.signedPayload.$ref
      !== "#/components/schemas/SignedFeedPayload"
    || openapi.components.schemas.DirectExecution.properties.transactionCount.const !== 1
    || openapi.components.schemas.ExecutionPermitEnvelope.properties.totalTransactionCount.const !== 2
    || !openapi.paths[PUBLIC_PATHS.solverFeedEvents].get.description.includes("no replay")
    || !openapi.paths[PUBLIC_PATHS.solverFeedEvents].get.description.includes(
      "equal to current suppresses the initial event",
    )
    || !openapi.paths[PUBLIC_PATHS.executionPermits].post.responses["201"]
    || !openapi.paths[PUBLIC_PATHS.executionPermits].post.responses["429"]) {
  throw new Error("OpenAPI runtime semantics drift");
}
const generatedStandardsManifest = await buildStandardsManifest(root);
same(generatedStandardsManifest, standardsManifest, "Generated standards manifest is stale");
if (await read("standards/nexa-standards.json")
      !== serializeStandardsManifest(generatedStandardsManifest)
    || await read("public/.well-known/nexa-standards.json")
      !== serializeStandardsManifest(generatedStandardsManifest)) {
  throw new Error("Serialized standards manifest is stale");
}
same(await buildStandardVectors(root), standardVectors, "Generated standard vectors are stale");
if (standardsManifest.standards.erc7683.resolve.stepCount !== 1
    || standardsManifest.standards.erc7683.resolve.stepType !== "Call"
    || standardsManifest.standards.erc7683.resolve.target !== router.address
    || standardsManifest.standards.erc7683.resolve.function !== "fillDirect"
    || standardsManifest.standards.erc7683.resolve.transactionCount !== 0
    || standardsManifest.standards.erc7683.resolveExecution.outputFields.join(",")
      !== "routeId,quoteId,target,value,callData"
    || standardsManifest.standards.oif.executable !== false
    || standardsManifest.standards.oif.resolveExecution.supported !== false
    || standardsManifest.standards.oif.resolveExecution.revertsWith
      !== "OIFExecutionUnsupported()"
    || standardVectors.erc7683.resolve.expected.stepCount !== 1
    || standardVectors.erc7683.resolveExecution.expected.target !== router.address
    || !/^0x[0-9a-f]+$/i.test(standardVectors.erc7683.resolveExecution.expected.callData)
    || standardVectors.oif.executable !== false
    || standardVectors.oif.resolveExecution.expected.supported !== false
    || standardVectors.executionInvariant.totalTransactions !== 2) {
  throw new Error("Standards machine semantics drift");
}
same(await buildOnboardingPackage(root), onboarding, "Generated onboarding package is stale");
if (await read("onboarding/nexa-v6-solver-operator.json")
    !== serializeOnboardingPackage(await buildOnboardingPackage(root))) {
  throw new Error("Serialized onboarding package is stale");
}
if (onboarding.protocol !== "Nexa V6"
    || onboarding.status !== "ACTIVE"
    || onboarding.releaseId !== integration.releaseId
    || onboarding.discoveryFacade.address !== facade.address
    || onboarding.contracts.erc7683Resolver.address !== standards.standards.erc7683.moduleAddress
    || onboarding.endpoints.feed !== PUBLIC_ENDPOINTS.solverFeed
    || onboarding.endpoints.onchainDiscovery !== PUBLIC_ENDPOINTS.onchainDiscovery
    || onboarding.endpoints.openapi !== PUBLIC_ENDPOINTS.openapi
    || onboarding.endpoints.standards !== PUBLIC_ENDPOINTS.standards
    || onboarding.endpoints.sse !== PUBLIC_ENDPOINTS.solverFeedEvents
    || JSON.stringify(onboarding.chainIds) !== JSON.stringify([8453, 56, 999])) {
  throw new Error("Zero-touch onboarding identity drift");
}
if (resolverVetting.status !== "READY_FOR_EXTERNAL_OPERATOR_REVIEW"
    || resolverVetting.sourceIdentity.externalVettingRequiredBeforeCapitalActivation !== true
    || resolverVetting.resolver.address !== standards.standards.erc7683.moduleAddress
    || resolverVetting.resolver.runtimeCodeHash !== standards.standards.erc7683.runtimeCodeHash
    || resolverVetting.resolver.router !== router.address) {
  throw new Error("ERC-7683 Resolver vetting evidence drift");
}
same(Object.keys(openapi.paths).sort(), Object.values(PUBLIC_PATHS).sort(), "OpenAPI path catalog drift");
const generatedDiscovery = serializeNexaSolverManifest(await buildNexaSolverManifest(root));
if (await read("public/.well-known/nexa-solver.json") !== generatedDiscovery) {
  throw new Error("Generated Solver discovery is stale");
}
same(JSON.parse(generatedDiscovery).endpoints, PUBLIC_ENDPOINTS, "Discovery endpoint drift");
if (packageJson.exports["./standards"] !== "./standards/nexa-standards.json"
    || packageJson.exports["./standards/test-vectors"] !== "./standards/test-vectors.json") {
  throw new Error("Standards package exports missing");
}
if (await read("verification/checksums.sha256") !== await buildChecksums(root)) {
  throw new Error("Public artifact checksums are stale");
}
if (packageJson.scripts["worker:deploy"] || packageJson.scripts["worker:dev"]) {
  throw new Error("Public integration package must not expose production deployment authority");
}

const excluded = new Set([
  ".git", "node_modules", ".wrangler", ".venv", ".pytest_cache",
  "__pycache__", "target", "dist", "build", "bin", "obj",
]);
const scan = async (directory, prefix = "") => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (excluded.has(entry.name) || entry.name.endsWith(".egg-info"))) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) await scan(absolute, relative);
    else if (entry.name !== "package-lock.json") {
      const source = await readFile(absolute, "utf8");
      const retiredMajor = integration.deploymentVersion - 1;
      const retiredMarkers = [
        `NEXA_MAINNET_V${retiredMajor}`,
        `NEXA_V${retiredMajor}`,
        `Nexa V${retiredMajor}`,
        `/api/v${retiredMajor}/`,
      ];
      if (retiredMarkers.some((marker) => source.includes(marker))) {
        throw new Error(`Retired major-version reference in ${relative}`);
      }
    }
  }
};
await scan(root);

const auditedFiles = await auditRepositoryForSecrets(root);
console.log(`Nexa V6 public integration release validated (${auditedFiles} files secret-scanned; ACTIVE)`);
