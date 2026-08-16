import { Contract, JsonRpcProvider } from "ethers";
import { loadPublicSurface } from "../src/load-public-surface.mjs";

const rpcByNetwork = {
  base: process.env.NEXA_BASE_RPC_URL ?? "https://mainnet.base.org",
  bsc: process.env.NEXA_BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org",
  hyperevm: process.env.NEXA_HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
};

function equalHex(actual, expected, label) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

for (const [networkName, rpcUrl] of Object.entries(rpcByNetwork)) {
  const surface = await loadPublicSurface(networkName);
  const provider = new JsonRpcProvider(rpcUrl, surface.network.chainId, { staticNetwork: true });
  try {
    const observed = await provider.getNetwork();
    if (observed.chainId !== BigInt(surface.network.chainId)) {
      throw new Error(`${networkName}: RPC chain mismatch`);
    }
    for (const [name, address] of Object.entries(surface.network.contracts)) {
      if (await provider.getCode(address) === "0x") throw new Error(`${networkName}: no code at ${name}`);
    }

    const contracts = surface.network.contracts;
    const registry = new Contract(contracts.registry, surface.abis.registry, provider);
    const coordinator = new Contract(contracts.reservationCoordinator, surface.abis.coordinator, provider);
    const resolver = new Contract(
      contracts.currentErc7683Resolver,
      surface.abis.currentResolver,
      provider,
    );
    const laneFactory = new Contract(
      contracts.solverLaneFactory,
      surface.abis.solverLaneFactory,
      provider,
    );
    const oif = new Contract(contracts.oifAdapter, surface.abis.oif, provider);

    equalHex(await registry.RELEASE_ID(), surface.manifest.releases.core.id, `${networkName}: registry release`);
    equalHex(await coordinator.releaseId(), surface.manifest.releases.core.id, `${networkName}: coordinator release`);
    equalHex(
      await resolver.releaseId(),
      surface.manifest.releases.currentErc7683Resolver.id,
      `${networkName}: current resolver release`,
    );
    equalHex(
      await laneFactory.RELEASE_ID(),
      surface.manifest.releases.parallelSolverLanes.id,
      `${networkName}: lane factory release`,
    );
    equalHex(await resolver.delegate(), contracts.resolverHubDelegate, `${networkName}: resolver delegate`);
    equalHex(await resolver.laneFactory(), contracts.solverLaneFactory, `${networkName}: resolver lane factory`);
    equalHex(
      await resolver.STANDARD_ID(),
      surface.standards.standards.currentErc7683.id,
      `${networkName}: resolver standard`,
    );
    equalHex(
      await laneFactory.STANDARD_ID(),
      surface.standards.standards.parallelSolverLanes.id,
      `${networkName}: lane standard`,
    );
    equalHex(
      await oif.STANDARD_ID(),
      surface.standards.standards.oifMandateOutput.id,
      `${networkName}: OIF standard`,
    );
    for (const standard of Object.values(surface.standards.standards)) {
      equalHex(
        await coordinator.resolverForStandard(standard.id),
        contracts[standard.contract],
        `${networkName}: ${standard.name}`,
      );
    }
    console.log(`${networkName}: public solver surface verified on-chain`);
  } finally {
    provider.destroy();
  }
}
