import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id } from "ethers";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPOSITORY = "https://github.com/VihanA42425D/nexa-solver-integration";
const STANDARD_MODULE_INTERFACE_ID = "0x8d60d6f9";
const FACADE_SELECTOR_SIGNATURES = Object.freeze({
  discoveryURI: "discoveryURI()",
  isLive: "isLive()",
  systemState: "systemState()",
  routeCount: "routeCount()",
  routeAt: "routeAt(uint256)",
  route: "route(bytes32)",
});
const ERC7683_SELECTOR_SIGNATURES = Object.freeze({
  standardId: "standardId()",
  supportsInterface: "supportsInterface(bytes4)",
  resolve: "resolve(bytes)",
  resolveExecution: "resolveExecution(bytes)",
  router: "router()",
});
const OIF_SELECTOR_SIGNATURES = Object.freeze({
  standardId: "standardId()",
  supportsInterface: "supportsInterface(bytes4)",
  resolveExecution: "resolveExecution(bytes)",
  router: "router()",
  compatibilityLevel: "compatibilityLevel()",
  describeMandate: "describeMandate(bytes)",
});
const SOURCE_FILL_PARAMETERS = Object.freeze([
  { name: "fillId", type: "bytes32", indexed: true },
  { name: "routeId", type: "bytes32", indexed: true },
  { name: "quoteId", type: "bytes32", indexed: true },
  { name: "payer", type: "address", indexed: false },
  { name: "recipient", type: "address", indexed: false },
  { name: "sourceAsset", type: "address", indexed: false },
  { name: "destinationAsset", type: "address", indexed: false },
  { name: "destinationChainId", type: "uint256", indexed: false },
  { name: "amountInRaw", type: "uint128", indexed: false },
  { name: "amountOutRaw", type: "uint128", indexed: false },
  { name: "sourceFinalityBlocks", type: "uint32", indexed: false },
  { name: "settlementDeadline", type: "uint64", indexed: false },
  { name: "permitNonce", type: "bytes32", indexed: false },
  { name: "executionGeneration", type: "bytes32", indexed: false },
]);
const readJson = async (repositoryRoot, file) => JSON.parse(
  await readFile(resolve(repositoryRoot, file), "utf8"),
);

const selectorsFor = (signatures) => Object.fromEntries(
  Object.entries(signatures).map(([name, signature]) => [name, id(signature).slice(0, 10)]),
);

function buildScannerHints(fingerprint) {
  const scannerContract = (name, role, address, expectedRuntimeCodeHash) => ({
    name, role, address, expectedRuntimeCodeHash,
    supportedChainIds: fingerprint.chains,
    sameAddressAcrossChains: fingerprint.sameAddressAcrossChains,
  });
  const scannerReadMethod = (name, returns) => ({
    contract: "facade",
    address: fingerprint.facade,
    signature: fingerprint.selectorSignatures[name],
    selector: fingerprint.selectors[name],
    stateMutability: name === "discoveryURI" ? "pure" : "view",
    returns,
  });
  const methods = {
    discoveryURI: scannerReadMethod("discoveryURI", [{ name: "uri", type: "string" }]),
    isLive: scannerReadMethod("isLive", [{ name: "live", type: "bool" }]),
    systemState: scannerReadMethod("systemState", [
      { name: "currentChainId", type: "uint256" },
      { name: "release", type: "bytes32" },
      { name: "publicRegistry", type: "address" },
      { name: "publicRouter", type: "address" },
      { name: "discoverableRouteCount", type: "uint256" },
      { name: "live", type: "bool" },
    ]),
    routeCount: scannerReadMethod(
      "routeCount",
      [{ name: "discoverableRouteCount", type: "uint256" }],
    ),
  };
  const sourceFill = fingerprint.events.SourceFillV6;
  return {
    schema: "NEXA_MAINNET_V6_SCANNER_HINTS_V1",
    generatedFrom: "CANONICAL_ONCHAIN_DISCOVERY_FINGERPRINT",
    protocol: fingerprint.protocol,
    releaseId: fingerprint.releaseId,
    deploymentVersion: fingerprint.deploymentVersion,
    status: fingerprint.status,
    supportedChainIds: fingerprint.chains,
    sameAddressAcrossChains: fingerprint.sameAddressAcrossChains,
    contracts: {
      facade: scannerContract(
        "NexaSolverDiscoveryV6", "ONCHAIN_DISCOVERY_FACADE",
        fingerprint.facade, fingerprint.facadeRuntimeCodeHash,
      ),
      registry: scannerContract(
        "NexaMainnetRegistryV6", "ROUTE_REGISTRY",
        fingerprint.registry, fingerprint.registryRuntimeCodeHash,
      ),
      router: scannerContract(
        "NexaMainnetRouterV6", "SOURCE_FILL_ROUTER",
        fingerprint.router, fingerprint.routerRuntimeCodeHash,
      ),
      erc7683Resolver: scannerContract(
        "NexaERC7683ModuleV6", "ERC_7683_RESOLVER",
        fingerprint.erc7683.resolver, fingerprint.erc7683.runtimeCodeHash,
      ),
      oifModule: scannerContract(
        "NexaOIFModuleV6", "OIF_DESCRIPTION_MODULE",
        fingerprint.oif.module, fingerprint.oif.runtimeCodeHash,
      ),
    },
    probe: {
      mode: "EXTERNAL_SCANNER_READ_ONLY",
      externalScannerOnly: true,
      executedByNexa: false,
      performsWrites: false,
      pollingRequired: false,
      methods,
      steps: [
        {
          order: 1, id: "facade-code-present", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_getCode", address: fingerprint.facade,
          supportedChainIds: fingerprint.chains,
          expected: { nonEmptyRuntimeCode: true },
        },
        {
          order: 2, id: "facade-runtime-code-hash", required: true,
          operation: "KECCAK256_RUNTIME_CODE", inputFromStep: "facade-code-present",
          expected: { equals: fingerprint.facadeRuntimeCodeHash },
        },
        {
          order: 3, id: "facade-discovery-uri", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_call", call: methods.discoveryURI,
          expected: { equals: fingerprint.discoveryURI },
        },
        {
          order: 4, id: "facade-live-status", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_call", call: methods.isLive,
          expected: { equals: true },
        },
        {
          order: 5, id: "facade-system-state", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_call", call: methods.systemState,
          expected: {
            currentChainId: "CHAIN_BEING_PROBED",
            release: fingerprint.releaseId,
            publicRegistry: fingerprint.registry,
            publicRouter: fingerprint.router,
            discoverableRouteCount: { comparison: "GREATER_THAN", value: "0" },
            live: true,
          },
        },
        {
          order: 6, id: "facade-route-count", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_call", call: methods.routeCount,
          expected: { comparison: "GREATER_THAN", value: "0" },
        },
        {
          order: 7, id: "same-facade-address-on-all-supported-chains", required: true,
          transport: "JSON_RPC", rpcMethod: "eth_getCode", address: fingerprint.facade,
          supportedChainIds: fingerprint.chains,
          expected: {
            sameAddressAcrossChains: fingerprint.sameAddressAcrossChains,
            runtimeCodeHashOnEveryChain: fingerprint.facadeRuntimeCodeHash,
          },
        },
        {
          order: 8, id: "source-fill-router-event", required: false, optional: true,
          transport: "JSON_RPC", rpcMethod: "eth_getLogs", address: sourceFill.address,
          supportedChainIds: sourceFill.chains, topics: [sourceFill.topic0],
          expected: { emittingContract: sourceFill.contract },
        },
        {
          order: 9, id: "follow-canonical-solver-discovery-uri", required: true,
          transport: "HTTPS", method: "GET", uriFromStep: "facade-discovery-uri",
          expected: { uri: fingerprint.discoveryURI },
        },
      ],
    },
    eventDiscovery: {
      SourceFillV6: {
        emittingContract: sourceFill.contract,
        address: sourceFill.address,
        supportedChainIds: sourceFill.chains,
        signature: sourceFill.signature,
        topic0: sourceFill.topic0,
        indexedFields: sourceFill.indexedFields,
        indexedTopicPositions: sourceFill.indexedTopicPositions,
        nonIndexedFields: sourceFill.nonIndexed,
        discoveryMapping: sourceFill.discoveryMapping,
      },
    },
    deterministicDeployment: {
      method: fingerprint.deployment.method,
      factory: fingerprint.deployment.factory,
      salt: fingerprint.deployment.salt,
      initCodeHash: fingerprint.deployment.initCodeHash,
      expectedFacadeAddress: fingerprint.facade,
      supportedChainIds: fingerprint.chains,
      deploymentBlocks: fingerprint.deployment.blocks,
      deploymentTransactions: fingerprint.deployment.transactions,
      sameAddressAcrossChains: fingerprint.sameAddressAcrossChains,
    },
    standards: {
      erc7683: {
        resolver: fingerprint.erc7683.resolver,
        supportedChainIds: fingerprint.erc7683.chains,
        standardId: fingerprint.erc7683.standardId,
        erc165InterfaceIds: [
          fingerprint.erc7683.erc165.erc165InterfaceId,
          fingerprint.erc7683.erc165.nexaStandardModuleV6InterfaceId,
        ],
        selectors: fingerprint.erc7683.selectors,
        selectorSignatures: fingerprint.erc7683.selectorSignatures,
        router: fingerprint.erc7683.router,
        expectedRuntimeCodeHash: fingerprint.erc7683.runtimeCodeHash,
      },
      oif: {
        module: fingerprint.oif.module,
        supportedChainIds: fingerprint.oif.chains,
        standardId: fingerprint.oif.standardId,
        compatibilityLevel: fingerprint.oif.compatibilityLevel,
        compatibilityLevelName: fingerprint.oif.compatibilityLevelName,
        executable: fingerprint.oif.executable,
        erc165InterfaceIds: [
          fingerprint.oif.erc165.erc165InterfaceId,
          fingerprint.oif.erc165.nexaStandardModuleV6InterfaceId,
        ],
        selectors: fingerprint.oif.selectors,
        selectorSignatures: fingerprint.oif.selectorSignatures,
        router: fingerprint.oif.router,
        expectedRuntimeCodeHash: fingerprint.oif.runtimeCodeHash,
      },
    },
  };
}

export async function buildOnchainDiscovery(repositoryRoot = root) {
  const [integration, facadeEvidence, inputEvidence, events, ownership] = await Promise.all([
    readJson(repositoryRoot, "nexa-mainnet-v6.json"),
    readJson(repositoryRoot, "verification/facade-deployment.json"),
    readJson(repositoryRoot, "verification/NexaSolverDiscoveryV6.standard-input.json"),
    readJson(repositoryRoot, "events/events.json"),
    readJson(repositoryRoot, "verification/explorer-ownership-signatures.json"),
  ]);
  const facade = integration.contracts.NexaSolverDiscoveryV6;
  const registry = integration.contracts.NexaMainnetRegistryV6;
  const router = integration.contracts.NexaMainnetRouterV6;
  const erc7683 = integration.standards.erc7683;
  const oif = integration.standards.oif;
  const sourceFill = events.events.SourceFillV6;
  const chainEvidence = Object.fromEntries(Object.entries(integration.networks)
    .map(([slug, network]) => {
      return [String(network.chainId), {
        network: slug,
        deploymentTransactionHash: network.verification.onchainIdentity.transactionHash,
        deploymentBlockNumber: network.verification.onchainIdentity.blockNumber,
        explorer: network.verification.explorer.url,
        sourcify: network.verification.sourcify.url,
        sourcifyMatchId: network.verification.sourcify.reference,
      }];
    }));
  const chains = [8453, 56, 999];
  const indexedFields = SOURCE_FILL_PARAMETERS.filter((field) => field.indexed)
    .map((field, index) => ({ name: field.name, type: field.type, topicPosition: index + 1 }));
  const fingerprint = {
    schema: "NEXA_MAINNET_V6_ONCHAIN_DISCOVERY_FINGERPRINT_V1",
    protocol: "Nexa V6",
    status: "ACTIVE",
    deploymentVersion: 6,
    releaseId: integration.releaseId,
    discoveryURI: PUBLIC_ENDPOINTS.manifest,
    onchainDiscoveryURI: PUBLIC_ENDPOINTS.onchainDiscovery,
    feedURI: PUBLIC_ENDPOINTS.solverFeed,
    publicIntegrationRepo: REPOSITORY,
    chains,
    sameAddressAcrossChains: true,
    facade: getAddress(facade.address),
    facadeRuntimeCodeHash: facade.runtimeCodeHash,
    registry: getAddress(registry.address),
    registryRuntimeCodeHash: registry.runtimeCodeHash,
    router: getAddress(router.address),
    routerRuntimeCodeHash: router.runtimeCodeHash,
    selectors: selectorsFor(FACADE_SELECTOR_SIGNATURES),
    selectorSignatures: FACADE_SELECTOR_SIGNATURES,
    events: {
      SourceFillV6: {
        contract: sourceFill.contract,
        address: getAddress(router.address),
        sameAddressAcrossChains: true,
        chains,
        signature: sourceFill.signature,
        topic0: sourceFill.topic0,
        indexed: sourceFill.indexed,
        fields: SOURCE_FILL_PARAMETERS.map((field) => field.name),
        indexedFields,
        indexedTopicPositions: Object.fromEntries(
          indexedFields.map((field) => [field.name, field.topicPosition]),
        ),
        nonIndexed: SOURCE_FILL_PARAMETERS.filter((field) => !field.indexed)
          .map((field) => field.name),
        discoveryMapping: {
          router: getAddress(router.address),
          facade: getAddress(facade.address),
          discoveryURI: PUBLIC_ENDPOINTS.manifest,
        },
      },
    },
    erc7683: {
      resolver: getAddress(erc7683.moduleAddress),
      sameAddressAcrossChains: true,
      chains,
      runtimeCodeHash: erc7683.runtimeCodeHash,
      router: getAddress(router.address),
      standardId: erc7683.standardId,
      selectors: selectorsFor(ERC7683_SELECTOR_SIGNATURES),
      selectorSignatures: ERC7683_SELECTOR_SIGNATURES,
      erc165: {
        supported: true,
        erc165InterfaceId: "0x01ffc9a7",
        nexaStandardModuleV6InterfaceId: STANDARD_MODULE_INTERFACE_ID,
        resolverDetection: "standardId()+resolve(bytes)",
      },
      discoveryMapping: {
        resolver: getAddress(erc7683.moduleAddress),
        router: getAddress(router.address),
        facade: getAddress(facade.address),
        discoveryURI: PUBLIC_ENDPOINTS.manifest,
      },
    },
    oif: {
      module: getAddress(oif.moduleAddress),
      sameAddressAcrossChains: true,
      chains,
      runtimeCodeHash: oif.runtimeCodeHash,
      router: getAddress(router.address),
      standardId: oif.standardId,
      compatibilityLevel: id("DISCOVERY_DESCRIPTION_ONLY"),
      compatibilityLevelName: "DISCOVERY_DESCRIPTION_ONLY",
      executable: false,
      selectors: selectorsFor(OIF_SELECTOR_SIGNATURES),
      selectorSignatures: OIF_SELECTOR_SIGNATURES,
      erc165: {
        supported: true,
        erc165InterfaceId: "0x01ffc9a7",
        nexaStandardModuleV6InterfaceId: STANDARD_MODULE_INTERFACE_ID,
      },
    },
    deployment: {
      method: "CREATE2",
      factory: getAddress(ownership.deterministicFactory),
      salt: id("NEXA_PUBLIC_SOLVER_DISCOVERY_V6"),
      initCodeHash: facadeEvidence.initCodeHash,
      expectedFacadeAddress: getAddress(facade.address),
      supportedChainIds: chains,
      sameAddressAcrossChains: true,
      compiler: facadeEvidence.compiler,
      standardJsonInputHash: inputEvidence.standardJsonInputHash,
      blocks: Object.fromEntries(Object.entries(chainEvidence)
        .map(([chainId, evidence]) => [chainId, evidence.deploymentBlockNumber])),
      transactions: Object.fromEntries(Object.entries(chainEvidence)
        .map(([chainId, evidence]) => [chainId, evidence.deploymentTransactionHash])),
    },
    chainEvidence,
    sourcify: {
      exactMatchOnEveryChain: true,
      allChainsLookup: `https://sourcify.dev/server/v2/contract/all-chains/${getAddress(facade.address)}`,
      contractLookupTemplate: "https://sourcify.dev/server/v2/contract/{chainId}/{address}?fields=abi,compilation,deployment",
      verifiedContractsListTemplate: "https://sourcify.dev/server/v2/contracts/{chainId}?limit=200&sort=desc",
      signatureLookup: "https://api.4byte.sourcify.dev/signature-database/v1/lookup",
      sourceFillV6Signature: {
        status: "REGISTERED",
        lookup: `https://api.4byte.sourcify.dev/signature-database/v1/lookup?event=${sourceFill.topic0}`,
        signature: sourceFill.signature,
        topic0: sourceFill.topic0,
        hasVerifiedContractAssociation: false,
        registrationMethod: "DIRECT_SIGNATURE_IMPORT",
      },
    },
    discoveryPaths: [
      "facade.discoveryURI -> well-known manifest -> signed Feed -> routes",
      "SourceFillV6.topic0 -> Router -> Facade -> discoveryURI -> signed Feed",
      "ERC-7683 standardId -> Resolver.router -> Facade -> discoveryURI -> signed Feed",
      "Sourcify chain enumeration -> Facade ABI -> discoveryURI -> signed Feed",
      "Facade found on one chain -> same-address probe on chains 8453/56/999",
    ],
  };
  return { ...fingerprint, scannerHints: buildScannerHints(fingerprint) };
}

export const serializeOnchainDiscovery = (value) => JSON.stringify(value, null, 2) + "\n";

export async function generateOnchainDiscovery(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "public/.well-known/nexa-onchain-discovery.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serializeOnchainDiscovery(await buildOnchainDiscovery(repositoryRoot)), "utf8");
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateOnchainDiscovery());
}
