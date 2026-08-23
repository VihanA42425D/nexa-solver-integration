import { Contract, JsonRpcProvider, id, keccak256 } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};

const retry = async (operation, attempts = 5) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
  throw lastError;
};

const surface = await loadPublicSurface(null, { requireActive: true });
const registryDefinition = surface.integration.contracts.NexaMainnetRegistryV6;
const routerDefinition = surface.integration.contracts.NexaMainnetRouterV6;
const facadeDefinition = surface.integration.contracts.NexaSolverDiscoveryV6;
const fingerprint = surface.onchainDiscovery;
if (!registryDefinition || !routerDefinition || !facadeDefinition) {
  throw new Error("V6 public Facade/Registry/Router surface missing");
}
if (fingerprint.facade !== facadeDefinition.address
    || fingerprint.facadeRuntimeCodeHash !== facadeDefinition.runtimeCodeHash
    || fingerprint.registry !== registryDefinition.address
    || fingerprint.registryRuntimeCodeHash !== registryDefinition.runtimeCodeHash
    || fingerprint.router !== routerDefinition.address
    || fingerprint.routerRuntimeCodeHash !== routerDefinition.runtimeCodeHash
    || fingerprint.discoveryURI !== surface.integration.discovery.endpoints.manifest
    || fingerprint.sameAddressAcrossChains !== true
    || fingerprint.events.SourceFillV6.topic0 !== id(
      fingerprint.events.SourceFillV6.signature,
    )) {
  throw new Error("Passive onchain fingerprint does not match the public surface");
}

const expectedHashes = new Map();
const expectedModuleHashes = new Map();
const report = {
  releaseId: surface.integration.releaseId,
  deploymentVersion: surface.integration.deploymentVersion,
  networks: {},
};

for (const [networkName, rpcUrl] of Object.entries(rpcByNetwork)) {
  const network = surface.integration.networks[networkName];
  if (!network) throw new Error(`V6 bundle missing network ${networkName}`);
  if (network.networkId !== surface.networkIds.networks[networkName].networkId) {
    throw new Error(`${networkName}: network ID mismatch`);
  }
  const chainFingerprint = fingerprint.chainEvidence[String(network.chainId)];
  if (!chainFingerprint
      || chainFingerprint.network !== networkName
      || chainFingerprint.deploymentBlockNumber
        !== network.verification.onchainIdentity.blockNumber
      || chainFingerprint.deploymentTransactionHash
        !== network.verification.onchainIdentity.transactionHash) {
    throw new Error(`${networkName}: passive deployment evidence mismatch`);
  }
  const provider = new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const observed = await retry(() => provider.getNetwork());
    if (observed.chainId !== BigInt(network.chainId)) throw new Error(`${networkName}: RPC chain mismatch`);

    const contracts = {};
    for (const [name, publicContract] of Object.entries(surface.integration.contracts)) {
      const code = await retry(() => provider.getCode(publicContract.address));
      if (code === "0x") throw new Error(`${networkName}: no code at ${name}`);
      const runtimeCodeHash = keccak256(code);
      if (publicContract.runtimeCodeHash
          && String(publicContract.runtimeCodeHash).toLowerCase() !== runtimeCodeHash.toLowerCase()) {
        throw new Error(`${networkName}: pinned runtime hash mismatch at ${name}`);
      }
      const priorHash = expectedHashes.get(name);
      if (priorHash && priorHash !== runtimeCodeHash) {
        throw new Error(`${networkName}: cross-network runtime hash mismatch at ${name}`);
      }
      expectedHashes.set(name, runtimeCodeHash);

      const iface = new Contract(publicContract.address, publicContract.abi, provider);
      if (iface.interface.hasFunction("releaseId")) {
        const releaseId = await retry(() => iface.releaseId());
        if (String(releaseId).toLowerCase() !== String(surface.integration.releaseId).toLowerCase()) {
          throw new Error(`${networkName}: release mismatch at ${name}`);
        }
      }
      contracts[name] = { address: publicContract.address, runtimeCodeHash };
    }

    const registry = new Contract(registryDefinition.address, registryDefinition.abi, provider);
    const routeCount = BigInt(await retry(() => registry.routeCount()));
    if (routeCount <= 0n) throw new Error(`${networkName}: Registry has no discoverable route catalog`);

    const router = new Contract(routerDefinition.address, routerDefinition.abi, provider);
    if (await retry(() => router.sourceIntakeEnabled()) !== true) {
      throw new Error(`${networkName}: Router source intake is not active`);
    }
    if (!router.interface.hasFunction("registry")) {
      throw new Error("Public Router ABI must expose registry() for independent binding verification");
    }
    const boundRegistry = await retry(() => router.registry());
    if (String(boundRegistry).toLowerCase() !== String(registryDefinition.address).toLowerCase()) {
      throw new Error(`${networkName}: Router is not bound to the published Registry`);
    }

    const facade = new Contract(facadeDefinition.address, facadeDefinition.abi, provider);
    const facadeLive = await retry(() => facade.isLive());
    const facadeRegistry = await retry(() => facade.registry());
    const facadeRouter = await retry(() => facade.router());
    const discoveryURI = await retry(() => facade.discoveryURI());
    const systemState = await retry(() => facade.systemState());
    if (facadeLive !== true
        || String(facadeRegistry).toLowerCase() !== String(registryDefinition.address).toLowerCase()
        || String(facadeRouter).toLowerCase() !== String(routerDefinition.address).toLowerCase()
        || discoveryURI !== surface.integration.discovery.endpoints.manifest
        || BigInt(systemState.currentChainId) !== BigInt(network.chainId)
        || String(systemState.release).toLowerCase() !== String(surface.integration.releaseId).toLowerCase()
        || BigInt(systemState.discoverableRouteCount) !== routeCount
        || systemState.live !== true) {
      throw new Error(`${networkName}: Facade identity or immutable binding mismatch`);
    }

    const modules = {};
    for (const [standardName, standard] of Object.entries(surface.standards.standards)) {
      const code = await retry(() => provider.getCode(standard.moduleAddress));
      if (code === "0x") throw new Error(`${networkName}: no code at ${standardName} module`);
      const runtimeCodeHash = keccak256(code);
      if (standard.runtimeCodeHash
          && String(standard.runtimeCodeHash).toLowerCase() !== runtimeCodeHash.toLowerCase()) {
        throw new Error(`${networkName}: pinned runtime hash mismatch at ${standardName} module`);
      }
      const priorHash = expectedModuleHashes.get(standardName);
      if (priorHash && priorHash !== runtimeCodeHash) {
        throw new Error(`${networkName}: cross-network module runtime hash mismatch at ${standardName}`);
      }
      expectedModuleHashes.set(standardName, runtimeCodeHash);
      const module = new Contract(standard.moduleAddress, [
        "function standardId() view returns (bytes32)",
        "function router() view returns (address)",
        "function supportsInterface(bytes4 interfaceId) view returns (bool)",
      ], provider);
      const standardId = await retry(() => module.standardId());
      const moduleRouter = await retry(() => module.router());
      if (String(standardId).toLowerCase() !== String(standard.id).toLowerCase()) {
        throw new Error(`${networkName}: standard ID mismatch at ${standardName} module`);
      }
      if (String(moduleRouter).toLowerCase() !== String(routerDefinition.address).toLowerCase()) {
        throw new Error(`${networkName}: Router binding mismatch at ${standardName} module`);
      }
      let erc165 = null;
      if (standardName === "erc7683") {
        const [supportsErc165, supportsNexaModule] = await Promise.all([
          retry(() => module.supportsInterface(fingerprint.erc7683.erc165.erc165InterfaceId)),
          retry(() => module.supportsInterface(
            fingerprint.erc7683.erc165.nexaStandardModuleV6InterfaceId,
          )),
        ]);
        if (supportsErc165 !== true || supportsNexaModule !== true
            || standard.moduleAddress !== fingerprint.erc7683.resolver
            || standard.id !== fingerprint.erc7683.standardId) {
          throw new Error(`${networkName}: ERC-7683 passive fingerprint mismatch`);
        }
        erc165 = { supportsErc165, supportsNexaModule };
      }
      modules[standardName] = {
        address: standard.moduleAddress,
        runtimeCodeHash,
        router: moduleRouter,
        ...(erc165 ? { erc165 } : {}),
      };
    }

    report.networks[networkName] = {
      chainId: network.chainId,
      routeCount: routeCount.toString(),
      routerActive: true,
      routerRegistry: boundRegistry,
      facadeLive,
      facadeRegistry,
      facadeRouter,
      discoveryURI,
      contracts,
      modules,
    };
  } finally {
    provider.destroy();
  }
}

console.log(JSON.stringify(report, null, 2));
