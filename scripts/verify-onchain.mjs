import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};

const surface = await loadPublicSurface(null, { requireActive: true });

for (const [networkName, rpcUrl] of Object.entries(rpcByNetwork)) {
  const network = surface.integration.networks[networkName];
  if (!network) throw new Error(`V6 bundle missing network ${networkName}`);
  const provider = new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const observed = await provider.getNetwork();
    if (observed.chainId !== BigInt(network.chainId)) throw new Error(`${networkName}: RPC chain mismatch`);
    for (const [name, publicContract] of Object.entries(surface.integration.contracts)) {
      if (await provider.getCode(publicContract.address) === "0x") {
        throw new Error(`${networkName}: no code at ${name}`);
      }
      const iface = new Contract(publicContract.address, publicContract.abi, provider);
      if (iface.interface.hasFunction("releaseId")) {
        const releaseId = await iface.releaseId();
        if (String(releaseId).toLowerCase() !== String(surface.integration.releaseId).toLowerCase()) {
          throw new Error(`${networkName}: release mismatch at ${name}`);
        }
      }
    }
    console.log(`${networkName}: V6 public solver contracts verified on-chain`);
  } finally {
    provider.destroy();
  }
}
