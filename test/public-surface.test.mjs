import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { id } from "ethers";
import { isActiveV6Bundle, loadPublicSurface } from "../src/load-public-surface.mjs";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";
import { auditRepositoryForSecrets } from "../scripts/repo-secret-audit.mjs";

test("OpenAPI Route Detail preserves the canonical signed Feed route", async () => {
  const openapi = JSON.parse(await readFile(
    new URL("../openapi/openapi.json", import.meta.url),
    "utf8",
  ));
  assert.equal(
    openapi.paths["/api/v6/routes/{routeId}"].get.responses["200"]
      .content["application/json"].schema.$ref,
    "#/components/schemas/RouteDetailResponse",
  );
  assert.equal(
    openapi.components.schemas.RouteDetailResponse.properties.route.$ref,
    "#/components/schemas/Route",
  );
  const required = new Set(openapi.components.schemas.Route.required);
  for (const field of [
    "publicationLane", "serviceCategory", "feeMode", "serviceFeeBps",
    "sourceTokenDecimals", "destinationTokenDecimals", "sourceFinalityBlocks",
    "settlementWindowSeconds", "validAfter", "validUntil",
  ]) {
    assert.equal(required.has(field), true, field);
  }
});

test("active V6 bundle exposes only the Solver-facing contract surface", async () => {
  const surface = await loadPublicSurface();
  assert.equal(surface.active, true);
  assert.equal(surface.manifest.deploymentVersion, 6);
  assert.equal(surface.manifest.deploymentStatus, "ACTIVE");
  assert.equal(surface.integration.deploymentStatus, "ACTIVE");
  assert.equal(surface.integration.activationRequired, false);
  assert.equal(surface.integration.doNotUseForExecutionUntilActivated, false);
  assert.deepEqual(Object.keys(surface.integration.contracts).sort(), [
    "NexaMainnetRegistryV6",
    "NexaMainnetRouterV6",
    "NexaSolverDiscoveryV6",
  ]);
  assert.equal(
    surface.integration.contracts.NexaMainnetRegistryV6.address,
    "0x3db7752f052ACFECB3DA99BeE7c6a34D22367141",
  );
  assert.equal(
    surface.integration.contracts.NexaMainnetRouterV6.address,
    "0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938",
  );
  assert.equal(
    surface.integration.contracts.NexaSolverDiscoveryV6.address,
    "0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6",
  );
  assert.equal(
    surface.integration.contracts.NexaSolverDiscoveryV6.discoveryURI,
    "https://solver.vsnexa.com/.well-known/nexa-solver.json",
  );
  for (const [slug, chainId] of Object.entries({ base: 8453, bsc: 56, hyperevm: 999 })) {
    const network = surface.integration.networks[slug];
    assert.equal(network.chainId, chainId);
    assert.equal(network.facadeAddress, "0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6");
    assert.equal(network.registry, "0x3db7752f052ACFECB3DA99BeE7c6a34D22367141");
    assert.equal(network.router, "0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938");
    assert.equal(network.systemState.live, true);
    assert.ok(BigInt(network.systemState.routeCount) > 0n);
    assert.equal(network.verification.explorer.status, "VERIFIED_EXACT_STANDARD_JSON");
  }
  assert.equal(Object.hasOwn(surface.integration, "preparationHash"), false);
  assert.equal(Object.hasOwn(surface.integration, "deploymentSource"), false);
  assert.equal(
    surface.integration.discovery.feedSigner,
    "0xCbeC1dDeEA1f4317ce6eF6F33Ad46d1fFD81c163",
  );
  assert.equal(surface.verification.sourceVerificationComplete, true);
  assert.equal(surface.openapi.openapi, "3.1.0");
  assert.equal(surface.onchainDiscovery.status, "ACTIVE");
  assert.equal(surface.onchainDiscovery.sameAddressAcrossChains, true);
});

test("deployed-awaiting-cutover status cannot be promoted by partial activation fields", () => {
  assert.equal(isActiveV6Bundle({
    deploymentVersion: 6,
    releaseId: "0x" + "11".repeat(32),
    deploymentStatus: "DEPLOYED_AWAITING_CUTOVER",
    activationRequired: false,
    doNotUseForExecutionUntilActivated: false,
    contracts: { RouterV6: {} },
    networks: { base: {} },
  }), false);
});

test("public Solver profile remains capability-only", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.solverProfile, {
    executionScopes: ["INTRA_CHAIN", "CROSS_CHAIN"],
    automatedDiscovery: true,
    variableSizeExecution: true,
    machineVerifiableState: true,
    accountlessDiscovery: true,
  });
  assert.equal(Object.hasOwn(manifest, "preparationHash"), false);
  assert.equal(Object.hasOwn(manifest, "deploymentSourceCommit"), false);
  assert.equal(Object.hasOwn(manifest, "executionModel"), false);
  assert.equal(Object.hasOwn(manifest, "deprecated"), false);
});

test("standard IDs, public modules and Solver event topics are self-consistent", async () => {
  const surface = await loadPublicSurface();
  for (const standard of Object.values(surface.standards.standards)) {
    assert.equal(id(standard.name), standard.id);
  }
  for (const event of Object.values(surface.events.events)) {
    assert.equal(id(event.signature), event.topic0);
  }
  assert.deepEqual(Object.keys(surface.events.events), [
    "NetworkRegisteredV6",
    "NetworkStatusChangedV6",
    "AssetRegisteredV6",
    "AssetStatusChangedV6",
    "RouteRegisteredV6",
    "RouteStatusChangedV6",
    "SourceIntakeConfigured",
    "SourceFillV6",
    "StandardModuleConfiguredV6",
  ]);
  assert.equal(
    surface.standards.standards.erc7683.moduleAddress,
    "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522",
  );
  assert.equal(
    surface.standards.standards.oif.moduleAddress,
    "0x4f81426fE8999E982aE6b771536a4093879F6A20",
  );
  assert.equal(surface.standards.standards.oif.executable, false);
});

test("static public files contain no forbidden internal deployment details", async () => {
  const files = [
    "../.env.example",
    "../README.md",
    "../manifest.json",
    "../nexa-mainnet-v6.json",
    "../standards/standard-ids.json",
    "../events/events.json",
    "../networks/network-ids.json",
    "../abi/solver-facing.json",
    "../openapi/openapi.json",
    "../verification/facade-deployment.json",
    "../public/.well-known/nexa-solver.json",
    "../public/.well-known/nexa-onchain-discovery.json",
  ];
  const forbidden = [
    "0x13D8881F30985A0CeE8c24F897CE8B37F4299255",
    "0x16e4012ce6E87b024cAD55689B7836Dc98738438",
    "0xB247B7Aa76d9Af4C69524b1B48840050E3976896",
    "0xA149C756E611D0315bCB2d469aA642d6Be32F765",
    "0x7fF3D7F41B5C3b53F1242a0bE5a683B95e09FFB4",
    "0xA767213615Bb6f8BE5C82DD41d029572E6944E7C",
    "0xF2009b45f521A8b4E62b0B68386aB6Fc5C5F6d5b",
  ];
  for (const file of files) {
    const text = await readFile(new URL(file, import.meta.url), "utf8");
    for (const token of forbidden) assert.equal(text.toLowerCase().includes(token.toLowerCase()), false);
  }
});

test("only V6 public endpoint catalog is exported", () => {
  assert.deepEqual(Object.values(PUBLIC_ENDPOINTS), [
    "https://solver.vsnexa.com/.well-known/nexa-solver.json",
    "https://solver.vsnexa.com/.well-known/nexa-onchain-discovery.json",
    "https://solver.vsnexa.com/openapi.json",
    "https://solver.vsnexa.com/.well-known/nexa-standards.json",
    "https://solver.vsnexa.com/api/v6/solver-discovery",
    "https://solver.vsnexa.com/api/v6/solver-feed",
    "https://solver.vsnexa.com/api/v6/solver-feed/events",
    "https://solver.vsnexa.com/api/v6/routes/{routeId}",
    "https://solver.vsnexa.com/api/v6/execution-permits/request-message",
    "https://solver.vsnexa.com/api/v6/execution-permits",
    "https://solver.vsnexa.com/api/v6/execution-permits/{fillId}"
  ]);
});

test("passive onchain fingerprint pins both discovery beacons without a transaction", async () => {
  const surface = await loadPublicSurface();
  const fingerprint = surface.onchainDiscovery;
  assert.equal(fingerprint.schema, "NEXA_MAINNET_V6_ONCHAIN_DISCOVERY_FINGERPRINT_V1");
  assert.deepEqual(fingerprint.chains, [8453, 56, 999]);
  assert.equal(fingerprint.sameAddressAcrossChains, true);
  assert.equal(fingerprint.facade, surface.integration.contracts.NexaSolverDiscoveryV6.address);
  assert.equal(fingerprint.discoveryURI, PUBLIC_ENDPOINTS.manifest);
  assert.equal(fingerprint.onchainDiscoveryURI, PUBLIC_ENDPOINTS.onchainDiscovery);
  assert.equal(fingerprint.selectors.discoveryURI, id("discoveryURI()").slice(0, 10));
  assert.equal(
    fingerprint.events.SourceFillV6.topic0,
    surface.events.events.SourceFillV6.topic0,
  );
  assert.equal(
    fingerprint.erc7683.standardId,
    surface.standards.standards.erc7683.id,
  );
  assert.equal(fingerprint.erc7683.erc165.erc165InterfaceId, "0x01ffc9a7");
  assert.equal(fingerprint.erc7683.erc165.nexaStandardModuleV6InterfaceId, "0x8d60d6f9");
  assert.equal(fingerprint.sourcify.sourceFillV6Signature.status, "REGISTERED");
  assert.equal(
    fingerprint.sourcify.sourceFillV6Signature.hasVerifiedContractAssociation,
    false,
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(fingerprint.chainEvidence)
      .map(([chainId, evidence]) => [chainId, evidence.deploymentBlockNumber])),
    { "56": 117488361, "8453": 50320644, "999": 43894134 },
  );
});

test("zero-touch operator package pins the canonical Facade, Resolver and transports", async () => {
  const onboarding = JSON.parse(await readFile(
    new URL("../onboarding/nexa-v6-solver-operator.json", import.meta.url),
    "utf8",
  ));
  assert.equal(onboarding.protocol, "Nexa V6");
  assert.equal(onboarding.status, "ACTIVE");
  assert.deepEqual(onboarding.chainIds, [8453, 56, 999]);
  assert.equal(onboarding.discoveryFacade.sameAddressOnEveryChain, true);
  assert.equal(onboarding.discoveryFacade.address, "0x7942d9FcC6cCe078de6a226aDEAbf96C89a46CB6");
  assert.equal(onboarding.contracts.erc7683Resolver.address, "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522");
  assert.equal(onboarding.endpoints.feed, PUBLIC_ENDPOINTS.solverFeed);
  assert.equal(onboarding.endpoints.sse, PUBLIC_ENDPOINTS.solverFeedEvents);
  assert.equal(onboarding.standards.oif.executable, false);
  assert.equal(onboarding.zeroTouch.requiresProtocolContractDeployment, false);
});

test("secret audit covers files outside src and examples", async (context) => {
  const repository = await mkdtemp(join(tmpdir(), "nexa-public-audit-"));
  context.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(join(repository, "config"));
  const syntheticToken = ["ghp", "_", "A".repeat(36)].join("");
  await writeFile(join(repository, "config", "leak.txt"), "token=" + syntheticToken);
  await assert.rejects(
    auditRepositoryForSecrets(repository),
    /Potential GitHub access token detected in config\/leak\.txt/,
  );
});
