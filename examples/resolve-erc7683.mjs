import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const payload = String(process.env.NEXA_ERC7683_PAYLOAD ?? "").trim();
if (!/^0x[0-9a-fA-F]+$/.test(payload)) {
  throw new Error("Set NEXA_ERC7683_PAYLOAD to abi.encode(ExecutionPermitV6, signature)");
}
const networkName = process.env.NEXA_NETWORK ?? "base";
const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};
if (!rpcByNetwork[networkName]) throw new Error("Unsupported NEXA_NETWORK");

const surface = await loadPublicSurface(networkName);
const definition = surface.abi.contracts.NexaERC7683ModuleV6;
const provider = new JsonRpcProvider(rpcByNetwork[networkName], surface.network.chainId, {
  staticNetwork: true,
});
try {
  const resolver = new Contract(definition.address, definition.abi, provider);
  // Explicit eth_call: no signer, transaction, gas payment or state change.
  const order = await resolver.resolve.staticCall(payload);
  if (order.steps.length !== 1) {
    throw new Error("NEXA_ERC7683_RESOLUTION_MUST_CONTAIN_EXACTLY_ONE_CALL");
  }
  console.log(JSON.stringify({
    module: definition.address,
    standardId: definition.standardId,
    transport: "eth_call",
    transactionCount: 0,
    sourceExecution: {
      callCount: 1,
      target: surface.integration.contracts.NexaMainnetRouterV6.address,
      function: "fillDirect",
      sourceTransactionCount: 1,
    },
    steps: [...order.steps],
    variables: [...order.variables],
    payments: [...order.payments],
    assumptions: order.assumptions.map(({ name, data }) => ({ name, data })),
  }, null, 2));
} finally {
  provider.destroy();
}
