#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, getAddress, keccak256 } from "ethers";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packagePath = resolve(root, "onboarding/nexa-v6-solver-operator.json");
const onboarding = JSON.parse(await readFile(packagePath, "utf8"));
const rpcByChain = {
  8453: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
  56: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.bnbchain.org",
  999: process.env.HYPEREVM_MAINNET_RPC_URL || "https://rpc.hyperliquid.xyz/evm",
};
const facadeAbi = [
  "function discoveryURI() pure returns (string)",
  "function registry() view returns (address)",
  "function router() view returns (address)",
  "function isLive() view returns (bool)",
  "function routeCount() view returns (uint256)",
];
const sleep = (milliseconds) => new Promise((accept) => setTimeout(accept, milliseconds));
const retry = async (operation, attempts = 5) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await sleep(500 * (2 ** attempt));
    }
  }
  throw lastError;
};

for (const chain of onboarding.chains) {
  const provider = new JsonRpcProvider(rpcByChain[chain.chainId], chain.chainId, { staticNetwork: true });
  const code = await retry(() => provider.getCode(onboarding.discoveryFacade.address));
  if (code === "0x" || keccak256(code) !== onboarding.discoveryFacade.runtimeCodeHash) {
    throw new Error(`Facade runtime mismatch on chain ${chain.chainId}`);
  }
  const facade = new Contract(onboarding.discoveryFacade.address, facadeAbi, provider);
  const uri = await retry(() => facade.discoveryURI());
  const registry = await retry(() => facade.registry());
  const router = await retry(() => facade.router());
  const live = await retry(() => facade.isLive());
  const routeCount = await retry(() => facade.routeCount());
  if (uri !== onboarding.endpoints.discovery
      || getAddress(registry) !== getAddress(onboarding.contracts.registry.address)
      || getAddress(router) !== getAddress(onboarding.contracts.router.address)
      || live !== true
      || routeCount <= 0n) {
    throw new Error(`Facade binding mismatch on chain ${chain.chainId}`);
  }
  console.log(JSON.stringify({
    chainId: chain.chainId,
    facade: onboarding.discoveryFacade.address,
    live,
    routeCount: routeCount.toString(),
  }));
}

console.log("Nexa V6 zero-touch operator package verified");
