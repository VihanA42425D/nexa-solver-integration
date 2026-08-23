import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOnchainDiscovery } from "./generate-onchain-discovery.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function buildStandardsManifest(repositoryRoot = root) {
  const fingerprint = await buildOnchainDiscovery(repositoryRoot);
  const payloadEncoding = {
    mediaType: "application/vnd.nexa.execution-permit-v6+abi",
    solidity: "abi.encode(ExecutionPermit,bytes)",
    tuple: ["NexaMainnetV6Types.ExecutionPermit permit", "bytes permitSignature"],
    source: "ExecutionPermitResponse.permit.permit + ExecutionPermitResponse.permit.permitSignature",
  };
  const erc165 = (standard) => ({
    supported: standard.erc165.supported,
    interfaceIds: [
      standard.erc165.erc165InterfaceId,
      standard.erc165.nexaStandardModuleV6InterfaceId,
    ],
  });
  return {
    schema: "NEXA_MAINNET_V6_STANDARDS_MANIFEST_V1",
    protocol: fingerprint.protocol,
    status: fingerprint.status,
    deploymentVersion: fingerprint.deploymentVersion,
    releaseId: fingerprint.releaseId,
    supportedChainIds: fingerprint.chains,
    sameAddressAcrossChains: fingerprint.sameAddressAcrossChains,
    router: {
      address: fingerprint.router,
      expectedRuntimeCodeHash: fingerprint.routerRuntimeCodeHash,
      sourceExecutionFunction: "fillDirect",
      sourceTransactionCount: 1,
    },
    payloadEncoding,
    standards: {
      erc7683: {
        name: "ERC-7683",
        standardId: fingerprint.erc7683.standardId,
        compatibilityLevel: "EXECUTABLE_RESOLVER",
        executable: true,
        moduleAddress: fingerprint.erc7683.resolver,
        expectedRuntimeCodeHash: fingerprint.erc7683.runtimeCodeHash,
        supportedChainIds: fingerprint.erc7683.chains,
        sameAddressAcrossChains: fingerprint.erc7683.sameAddressAcrossChains,
        router: fingerprint.erc7683.router,
        selectors: fingerprint.erc7683.selectors,
        selectorSignatures: fingerprint.erc7683.selectorSignatures,
        erc165: erc165(fingerprint.erc7683),
        payloadEncoding,
        discoveryMethod: "standardId()+supportsInterface(bytes4)+router()",
        resolutionTransport: "OFFCHAIN_ETH_CALL",
        resolve: {
          signature: fingerprint.erc7683.selectorSignatures.resolve,
          selector: fingerprint.erc7683.selectors.resolve,
          stateMutability: "view",
          ethCallOnly: true,
          transactionCount: 0,
          stepCount: 1,
          stepType: "Call",
          target: fingerprint.router,
          function: "fillDirect",
          sourceExecutionCallCount: 1,
        },
        resolveExecution: {
          supported: true,
          signature: fingerprint.erc7683.selectorSignatures.resolveExecution,
          selector: fingerprint.erc7683.selectors.resolveExecution,
          stateMutability: "view",
          ethCallOnly: true,
          transactionCount: 0,
          outputFields: ["routeId", "quoteId", "target", "value", "callData"],
          target: fingerprint.router,
          function: "fillDirect",
          sourceTransactionCount: 1,
        },
      },
      oif: {
        name: "OIF",
        standardId: fingerprint.oif.standardId,
        compatibilityLevel: fingerprint.oif.compatibilityLevelName,
        compatibilityLevelId: fingerprint.oif.compatibilityLevel,
        executable: fingerprint.oif.executable,
        moduleAddress: fingerprint.oif.module,
        expectedRuntimeCodeHash: fingerprint.oif.runtimeCodeHash,
        supportedChainIds: fingerprint.oif.chains,
        sameAddressAcrossChains: fingerprint.oif.sameAddressAcrossChains,
        router: fingerprint.oif.router,
        selectors: fingerprint.oif.selectors,
        selectorSignatures: fingerprint.oif.selectorSignatures,
        erc165: erc165(fingerprint.oif),
        payloadEncoding,
        discoveryMethod: "standardId()+supportsInterface(bytes4)+router()+compatibilityLevel()",
        resolutionTransport: "OFFCHAIN_ETH_CALL_DESCRIPTION_ONLY",
        describeMandate: {
          supported: true,
          signature: fingerprint.oif.selectorSignatures.describeMandate,
          selector: fingerprint.oif.selectors.describeMandate,
          stateMutability: "pure",
          ethCallOnly: true,
          transactionCount: 0,
          outputFields: [
            "oracle", "settler", "chainId", "token", "amount", "recipient", "callbackData", "context",
          ],
        },
        resolveExecution: {
          supported: false,
          signature: fingerprint.oif.selectorSignatures.resolveExecution,
          selector: fingerprint.oif.selectors.resolveExecution,
          stateMutability: "pure",
          executable: false,
          revertsWith: "OIFExecutionUnsupported()",
          transactionCount: 0,
        },
      },
    },
    executionInvariant: {
      botSourceTransactions: 1,
      nexaDestinationTransactions: 1,
      totalTransactions: 2,
    },
  };
}

export const serializeStandardsManifest = (value) => JSON.stringify(value, null, 2) + "\n";

export async function generateStandardsManifest(repositoryRoot = root) {
  const value = await buildStandardsManifest(repositoryRoot);
  const outputs = [
    resolve(repositoryRoot, "standards/nexa-standards.json"),
    resolve(repositoryRoot, "public/.well-known/nexa-standards.json"),
  ];
  for (const output of outputs) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, serializeStandardsManifest(value), "utf8");
  }
  return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + (await generateStandardsManifest()).join(", "));
}
