import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AbiCoder, Interface, id, keccak256, zeroPadValue } from "ethers";
import { buildStandardsManifest } from "./generate-standards-manifest.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PERMIT_TUPLE = "tuple(bytes32 releaseId,bytes32 fillId,bytes32 routeId,bytes32 quoteId,bytes32 policyHash,bytes32 permitNonce,bytes32 sourceNetworkId,bytes32 sourceAssetId,bytes32 destinationNetworkId,bytes32 destinationAssetId,bytes32 sourceVaultAccountId,bytes32 destinationVaultAccountId,bytes32 payerAccountId,bytes32 recipientAccountId,uint64 dataVersion,bytes32 executionGeneration,uint64 validAfter,uint64 validUntil,uint32 sourceFinalityBlocks,uint32 settlementWindowSeconds,uint256 sourceChainId,uint256 destinationChainId,address sourceAsset,address destinationAsset,address sourceVault,address destinationVault,address sourceRouter,address payer,address recipient,uint128 amountInRaw,uint128 amountOutRaw)";

const readJson = async (repositoryRoot, file) => JSON.parse(
  await readFile(resolve(repositoryRoot, file), "utf8"),
);

export async function buildStandardVectors(repositoryRoot = root) {
  const [sdk, standards] = await Promise.all([
    readJson(repositoryRoot, "sdk-spec/test-vectors.json"),
    buildStandardsManifest(repositoryRoot),
  ]);
  const coder = AbiCoder.defaultAbiCoder();
  const permit = sdk.abi.permit;
  const signature = sdk.abi.permitSignature;
  const payload = coder.encode([PERMIT_TUPLE, "bytes"], [permit, signature]);
  const erc7683 = new Interface([
    "function resolve(bytes payload) view returns (tuple(bytes[] steps,bytes[] variables,bytes[] payments,tuple(string name,bytes data)[] assumptions) order)",
    "function resolveExecution(bytes payload) view returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
  ]);
  const oif = new Interface([
    "function describeMandate(bytes payload) pure returns (tuple(bytes32 oracle,bytes32 settler,uint256 chainId,bytes32 token,uint256 amount,bytes32 recipient,bytes callbackData,bytes context) mandate)",
    "function resolveExecution(bytes payload) pure returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
  ]);
  const context = coder.encode(
    ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "uint64"],
    [
      permit.releaseId,
      permit.routeId,
      permit.quoteId,
      permit.fillId,
      permit.permitNonce,
      permit.executionGeneration,
      permit.validUntil,
    ],
  );
  return {
    schema: "NEXA_MAINNET_V6_STANDARD_TEST_VECTORS_V1",
    specVersion: "1.0.0",
    derivedFrom: {
      artifact: "sdk-spec/test-vectors.json",
      schema: sdk.schema,
      feedDataVersion: sdk.feed.signedPayload.dataVersion,
      permitFillId: permit.fillId,
    },
    payload: {
      encoding: standards.payloadEncoding.solidity,
      value: payload,
      keccak256: keccak256(payload),
      permit,
      permitSignature: signature,
    },
    erc7683: {
      standardId: standards.standards.erc7683.standardId,
      moduleAddress: standards.standards.erc7683.moduleAddress,
      transport: "eth_call",
      transactionCount: 0,
      resolve: {
        ethCall: {
          to: standards.standards.erc7683.moduleAddress,
          data: erc7683.encodeFunctionData("resolve", [payload]),
        },
        expected: {
          stepCount: 1,
          stepType: "Call",
          target: standards.router.address,
          function: "fillDirect",
          sourceExecutionCallCount: 1,
        },
      },
      resolveExecution: {
        ethCall: {
          to: standards.standards.erc7683.moduleAddress,
          data: erc7683.encodeFunctionData("resolveExecution", [payload]),
        },
        expected: {
          routeId: permit.routeId,
          quoteId: permit.quoteId,
          target: standards.router.address,
          value: sdk.abi.expectedTransactionValue,
          callData: sdk.abi.fillDirectCallData,
          outputFields: ["routeId", "quoteId", "target", "value", "callData"],
          sourceTransactionCount: 1,
        },
      },
    },
    oif: {
      standardId: standards.standards.oif.standardId,
      moduleAddress: standards.standards.oif.moduleAddress,
      compatibilityLevel: "DISCOVERY_DESCRIPTION_ONLY",
      executable: false,
      transport: "eth_call",
      transactionCount: 0,
      describeMandate: {
        ethCall: {
          to: standards.standards.oif.moduleAddress,
          data: oif.encodeFunctionData("describeMandate", [payload]),
        },
        expected: {
          oracle: "0x" + "00".repeat(32),
          settler: "0x" + "00".repeat(32),
          chainId: permit.destinationChainId,
          token: zeroPadValue(permit.destinationAsset, 32),
          amount: permit.amountOutRaw,
          recipient: zeroPadValue(permit.recipient, 32),
          callbackData: "0x",
          context,
        },
      },
      resolveExecution: {
        ethCall: {
          to: standards.standards.oif.moduleAddress,
          data: oif.encodeFunctionData("resolveExecution", [payload]),
        },
        expected: {
          supported: false,
          revertsWith: "OIFExecutionUnsupported()",
          revertSelector: id("OIFExecutionUnsupported()").slice(0, 10),
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

export async function generateStandardVectors(repositoryRoot = root) {
  const output = resolve(repositoryRoot, "standards/test-vectors.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(await buildStandardVectors(repositoryRoot), null, 2) + "\n",
    "utf8",
  );
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Generated " + await generateStandardVectors());
}
