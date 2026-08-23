import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const payload = String(process.env.NEXA_OIF_PAYLOAD ?? "").trim();
if (!/^0x[0-9a-fA-F]+$/.test(payload)) {
  throw new Error("Set NEXA_OIF_PAYLOAD to abi.encode(ExecutionPermitV6, signature)");
}
const networkName = process.env.NEXA_NETWORK ?? "base";
const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};
if (!rpcByNetwork[networkName]) throw new Error("Unsupported NEXA_NETWORK");

const surface = await loadPublicSurface(networkName);
const definition = surface.abi.contracts.NexaOIFModuleV6;
const provider = new JsonRpcProvider(rpcByNetwork[networkName], surface.network.chainId, {
  staticNetwork: true,
});
try {
  const module = new Contract(definition.address, definition.abi, provider);
  // OIF is description-only. This is an explicit eth_call and never resolves
  // an executable transaction.
  const mandate = await module.describeMandate.staticCall(payload);
  console.log(JSON.stringify({
    module: definition.address,
    standardId: definition.standardId,
    transport: "eth_call",
    transactionCount: 0,
    compatibilityLevel: "DISCOVERY_DESCRIPTION_ONLY",
    executable: false,
    resolveExecution: {
      supported: false,
      revertsWith: "OIFExecutionUnsupported()",
    },
    mandate: {
      oracle: mandate.oracle,
      settler: mandate.settler,
      chainId: mandate.chainId.toString(),
      token: mandate.token,
      amount: mandate.amount.toString(),
      recipient: mandate.recipient,
      callbackData: mandate.callbackData,
      context: mandate.context,
    },
  }, null, 2));
} finally {
  provider.destroy();
}
