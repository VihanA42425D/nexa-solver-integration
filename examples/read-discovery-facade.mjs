import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const networkName = process.env.NEXA_NETWORK ?? "base";
const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};
if (!rpcByNetwork[networkName]) throw new Error("Unsupported NEXA_NETWORK");

const surface = await loadPublicSurface(networkName);
const definition = surface.abi.contracts.NexaSolverDiscoveryV6;
const provider = new JsonRpcProvider(rpcByNetwork[networkName], surface.network.chainId, {
  staticNetwork: true,
});
try {
  const facade = new Contract(definition.address, definition.abi, provider);
  const [state, discoveryURI] = await Promise.all([
    facade.systemState(),
    facade.discoveryURI(),
  ]);
  console.log(JSON.stringify({
    network: networkName,
    facadeAddress: definition.address,
    discoveryURI,
    systemState: {
      chainId: state.currentChainId.toString(),
      releaseId: state.release,
      registry: state.publicRegistry,
      router: state.publicRouter,
      routeCount: state.discoverableRouteCount.toString(),
      live: state.live,
    },
  }, null, 2));
} finally {
  provider.destroy();
}
