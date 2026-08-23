import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, id } from "ethers";
import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPOSITORY = "https://github.com/VihanA42425D/nexa-solver-integration";
const readJson = async (repositoryRoot, file) => JSON.parse(
  await readFile(resolve(repositoryRoot, file), "utf8"),
);

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
  return {
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
    selectors: {
      discoveryURI: id("discoveryURI()").slice(0, 10),
      isLive: id("isLive()").slice(0, 10),
      systemState: id("systemState()").slice(0, 10),
      routeCount: id("routeCount()").slice(0, 10),
      routeAt: id("routeAt(uint256)").slice(0, 10),
      route: id("route(bytes32)").slice(0, 10),
    },
    selectorSignatures: {
      discoveryURI: "discoveryURI()",
      isLive: "isLive()",
      systemState: "systemState()",
      routeCount: "routeCount()",
      routeAt: "routeAt(uint256)",
      route: "route(bytes32)",
    },
    events: {
      SourceFillV6: {
        contract: sourceFill.contract,
        address: getAddress(router.address),
        sameAddressAcrossChains: true,
        chains,
        signature: sourceFill.signature,
        topic0: sourceFill.topic0,
        indexed: sourceFill.indexed,
        fields: [
          "fillId", "routeId", "quoteId", "payer", "recipient", "sourceAsset",
          "destinationAsset", "destinationChainId", "amountInRaw", "amountOutRaw",
          "sourceFinalityBlocks", "settlementDeadline", "permitNonce", "executionGeneration",
        ],
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
      runtimeCodeHash: erc7683.runtimeCodeHash,
      router: getAddress(router.address),
      standardId: erc7683.standardId,
      selectors: {
        standardId: id("standardId()").slice(0, 10),
        supportsInterface: id("supportsInterface(bytes4)").slice(0, 10),
        resolve: id("resolve(bytes)").slice(0, 10),
        resolveExecution: id("resolveExecution(bytes)").slice(0, 10),
        router: id("router()").slice(0, 10),
      },
      erc165: {
        supported: true,
        erc165InterfaceId: "0x01ffc9a7",
        nexaStandardModuleV6InterfaceId: "0x8d60d6f9",
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
      runtimeCodeHash: oif.runtimeCodeHash,
      standardId: oif.standardId,
    },
    deployment: {
      method: "CREATE2",
      factory: getAddress(ownership.deterministicFactory),
      salt: id("NEXA_PUBLIC_SOLVER_DISCOVERY_V6"),
      initCodeHash: facadeEvidence.initCodeHash,
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
