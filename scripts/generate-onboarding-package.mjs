import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPOSITORY = "https://github.com/VihanA42425D/nexa-solver-integration";

const readJson = async (repositoryRoot, file) => JSON.parse(
  await readFile(resolve(repositoryRoot, file), "utf8"),
);

export async function buildOnboardingPackage(repositoryRoot = root) {
  const { version: packageVersion } = await readJson(repositoryRoot, "package.json");
  const integration = await readJson(repositoryRoot, "nexa-mainnet-v6.json");
  const facade = integration.contracts.NexaSolverDiscoveryV6;
  const registry = integration.contracts.NexaMainnetRegistryV6;
  const router = integration.contracts.NexaMainnetRouterV6;
  const erc7683 = integration.standards.erc7683;
  const oif = integration.standards.oif;

  const chains = Object.entries(integration.networks).map(([slug, network]) => ({
    slug,
    name: slug === "base" ? "Base" : slug === "bsc" ? "BNB Smart Chain" : "HyperEVM",
    chainId: network.chainId,
    networkId: network.networkId,
    discoveryFacade: network.facadeAddress,
    registry: network.registry,
    router: network.router,
    routeCountAtPublication: Number(network.systemState.routeCount),
    onchainStatus: network.systemState.live ? "ACTIVE" : "INACTIVE",
    explorerVerification: network.verification.explorer.url,
    sourcifyVerification: network.verification.sourcify.url,
  }));

  return {
    schema: "NEXA_V6_SOLVER_OPERATOR_ONBOARDING_V1",
    packageVersion,
    protocol: "Nexa V6",
    protocolVersion: 6,
    environment: "mainnet",
    status: "ACTIVE",
    releaseId: integration.releaseId,
    chains,
    chainIds: chains.map(({ chainId }) => chainId),
    discoveryFacade: {
      address: facade.address,
      sameAddressOnEveryChain: true,
      runtimeCodeHash: facade.runtimeCodeHash,
      discoveryURI: facade.discoveryURI,
    },
    contracts: {
      registry: {
        address: registry.address,
        runtimeCodeHash: registry.runtimeCodeHash,
      },
      router: {
        address: router.address,
        runtimeCodeHash: router.runtimeCodeHash,
      },
      erc7683Resolver: {
        address: erc7683.moduleAddress,
        runtimeCodeHash: erc7683.runtimeCodeHash,
        compatibilityLevel: erc7683.compatibilityLevel,
        executable: true,
      },
      oifDiscoveryModule: {
        address: oif.moduleAddress,
        runtimeCodeHash: oif.runtimeCodeHash,
        compatibilityLevel: oif.compatibilityLevel,
        executable: false,
      },
    },
    endpoints: {
      discovery: integration.discovery.endpoints.manifest,
      solverDiscovery: integration.discovery.endpoints.solverDiscovery,
      feed: integration.discovery.endpoints.solverFeed,
      sse: integration.discovery.endpoints.solverFeedEvents,
      routeDetailTemplate: integration.discovery.endpoints.routeDetailTemplate,
      permitRequestMessage: integration.discovery.endpoints.permitRequestMessage,
      permit: integration.discovery.endpoints.executionPermits,
      permitStatusTemplate: integration.discovery.endpoints.permitStatusTemplate,
    },
    feedTrust: {
      schema: "NEXA_MAINNET_V6_SIGNED_FEED_V1",
      signer: integration.discovery.feedSigner,
      signatureScheme: "SECP256K1_RECOVERABLE_ECDSA_OVER_KECCAK256_UTF8_CANONICAL_JSON_RAW_DIGEST",
      preimage: "NEXA_MAINNET_V6_SIGNED_FEED_V1\\n{canonicalSignedPayload}",
      eip191PrefixApplied: false,
      verificationModule: `${REPOSITORY}/blob/main/src/feed-verification.mjs`,
      reconnectWithLastEventId: true,
    },
    standards: {
      erc7683: {
        status: "EXECUTABLE_RESOLVER",
        resolver: erc7683.moduleAddress,
        resolutionMode: "ETH_CALL",
        vettingStatus: "READY_FOR_EXTERNAL_OPERATOR_REVIEW",
        vettingEvidence: `${REPOSITORY}/blob/main/verification/erc7683-resolver-vetting.json`,
        abi: `${REPOSITORY}/blob/main/abi/solver-facing.json`,
        example: `${REPOSITORY}/blob/main/examples/resolve-erc7683.mjs`,
      },
      oif: {
        status: "DISCOVERY_DESCRIPTION_ONLY",
        module: oif.moduleAddress,
        executable: false,
        adapterRequiredForExecution: true,
        example: `${REPOSITORY}/blob/main/examples/describe-oif-mandate.mjs`,
      },
    },
    integration: {
      repository: REPOSITORY,
      release: `${REPOSITORY}/releases/tag/v${packageVersion}`,
      canonicalBundle: `${REPOSITORY}/blob/main/nexa-mainnet-v6.json`,
      manifest: `${REPOSITORY}/blob/main/manifest.json`,
      abi: `${REPOSITORY}/blob/main/abi/solver-facing.json`,
      openapi: `${REPOSITORY}/blob/main/openapi/openapi.json`,
      events: `${REPOSITORY}/blob/main/events/events.json`,
      networkIds: `${REPOSITORY}/blob/main/networks/network-ids.json`,
      verificationEvidence: `${REPOSITORY}/tree/main/verification`,
      checksums: `${REPOSITORY}/blob/main/verification/checksums.sha256`,
    },
    zeroTouch: {
      bootstrapCommand: `npx --yes github:VihanA42425D/nexa-solver-integration#v${packageVersion}`,
      localVerificationCommand: "npm run onboard:verify",
      sequence: [
        "FETCH_AND_PIN_PACKAGE",
        "VERIFY_CHECKSUMS",
        "VERIFY_FACADE_RUNTIME_AND_BINDINGS",
        "VERIFY_FEED_SIGNATURE",
        "VET_ERC7683_RESOLVER",
        "SUBSCRIBE_SSE_WITH_HTTP_RECOVERY",
        "REQUEST_WALLET_SIGNED_EXECUTION_PERMIT",
        "PREVIEW_ROUTER_FILL",
        "EXECUTE_SOURCE_TRANSACTION",
        "TRACK_DESTINATION_PAYOUT_TO_PAID",
      ],
      requiresProtocolContractDeployment: false,
      operatorSecretsRequiredForDiscovery: false,
      operatorSignatureRequiredForDiscovery: false,
      operatorSignatureRequiredForPermit: true,
    },
  };
}

export function serializeOnboardingPackage(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

export async function generateOnboardingPackage(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "onboarding/nexa-v6-solver-operator.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serializeOnboardingPackage(await buildOnboardingPackage(repositoryRoot)), "utf8");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateOnboardingPackage());
}
