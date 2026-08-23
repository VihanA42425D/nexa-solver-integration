#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import {
  Interface,
  Wallet,
  getAddress,
  keccak256,
  toUtf8Bytes,
  verifyMessage,
} from "ethers";
import { canonical, computeFeedHash } from "../src/feed-verification.mjs";

const FEED_DOMAIN = "NEXA_MAINNET_V6_SIGNED_FEED_V1";
const PERMIT_DOMAIN = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1";
const RELEASE_ID = "0xcc0dc051739f2dafaebd2eb5663937850dcc3e7951e38f437e00fcd9fa6c8ff6";
const ZERO = "0x0000000000000000000000000000000000000000";

const publicTestKey = keccak256(toUtf8Bytes(
  "NEXA V6 SDK PUBLIC TEST VECTOR KEY - NEVER FUND",
));
const wallet = new Wallet(publicTestKey);

const route = {
  routeId: "0x" + "10".repeat(32),
  quoteId: "0x" + "20".repeat(32),
  sourceChainId: 8453,
  destinationChainId: 56,
  sourceNetworkId: "0x" + "30".repeat(32),
  sourceAssetId: "0x" + "40".repeat(32),
  destinationNetworkId: "0x" + "50".repeat(32),
  destinationAssetId: "0x" + "60".repeat(32),
  minimumFillInRaw: "1000000",
  maxAvailableInRaw: "9000000",
  executionStatus: "OPEN",
  permitAvailable: true,
  validUntil: 2000000300,
};
const signedPayload = {
  schema: FEED_DOMAIN,
  releaseId: RELEASE_ID,
  dataVersion: "7",
  generatedAt: 2000000000,
  validUntil: 2000000300,
  routes: [route],
};
const canonicalPayload = canonical(signedPayload);
const feedPreimage = `${FEED_DOMAIN}\n${canonicalPayload}`;
const feedHash = computeFeedHash(signedPayload);
const feedSignature = wallet.signingKey.sign(feedHash).serialized;

const permitRequest = {
  quoteId: "0x" + "20".repeat(32),
  requestedAmountInRaw: "2500000",
  standard: "ERC-7683",
  payer: wallet.address,
  recipient: getAddress("0x2222222222222222222222222222222222222222"),
  idempotencyKey: "sdk-vector-0001",
};
const permitMessage = [
  PERMIT_DOMAIN,
  `quoteId=${permitRequest.quoteId.toLowerCase()}`,
  `requestedAmountInRaw=${permitRequest.requestedAmountInRaw}`,
  `standard=${permitRequest.standard.toUpperCase()}`,
  `payer=${permitRequest.payer.toLowerCase()}`,
  `recipient=${permitRequest.recipient.toLowerCase()}`,
  `idempotencyKey=${permitRequest.idempotencyKey}`,
].join("\n");
const permitRequestSignature = await wallet.signMessage(permitMessage);

const permit = {
  releaseId: RELEASE_ID,
  fillId: "0x" + "70".repeat(32),
  routeId: route.routeId,
  quoteId: route.quoteId,
  policyHash: "0x" + "80".repeat(32),
  permitNonce: "0x" + "90".repeat(32),
  sourceNetworkId: route.sourceNetworkId,
  sourceAssetId: route.sourceAssetId,
  destinationNetworkId: route.destinationNetworkId,
  destinationAssetId: route.destinationAssetId,
  sourceVaultAccountId: "0x" + "a0".repeat(32),
  destinationVaultAccountId: "0x" + "b0".repeat(32),
  payerAccountId: "0x" + "c0".repeat(32),
  recipientAccountId: "0x" + "d0".repeat(32),
  dataVersion: "7",
  executionGeneration: "0x" + "e0".repeat(32),
  validAfter: "2000000000",
  validUntil: "2000000030",
  sourceFinalityBlocks: 2,
  settlementWindowSeconds: 600,
  sourceChainId: "8453",
  destinationChainId: "56",
  sourceAsset: "0x1111111111111111111111111111111111111111",
  destinationAsset: "0x2222222222222222222222222222222222222222",
  sourceVault: "0x3333333333333333333333333333333333333333",
  destinationVault: "0x4444444444444444444444444444444444444444",
  sourceRouter: "0x9eA675a496b6a2D13B3091F6e6eB3f87183C3938",
  payer: wallet.address,
  recipient: "0x2222222222222222222222222222222222222222",
  amountInRaw: "2500000",
  amountOutRaw: "2490000",
};
const permitSignature = "0x" + "55".repeat(65);
const permitTuple = "tuple(bytes32 releaseId,bytes32 fillId,bytes32 routeId,bytes32 quoteId,bytes32 policyHash,bytes32 permitNonce,bytes32 sourceNetworkId,bytes32 sourceAssetId,bytes32 destinationNetworkId,bytes32 destinationAssetId,bytes32 sourceVaultAccountId,bytes32 destinationVaultAccountId,bytes32 payerAccountId,bytes32 recipientAccountId,uint64 dataVersion,bytes32 executionGeneration,uint64 validAfter,uint64 validUntil,uint32 sourceFinalityBlocks,uint32 settlementWindowSeconds,uint256 sourceChainId,uint256 destinationChainId,address sourceAsset,address destinationAsset,address sourceVault,address destinationVault,address sourceRouter,address payer,address recipient,uint128 amountInRaw,uint128 amountOutRaw)";
const routerInterface = new Interface([
  `function fillDirect(${permitTuple} permit,bytes signature) payable returns (bytes32 fillId)`,
  `function previewFillDirect(${permitTuple} permit,bytes signature) view returns (bool valid,bytes32 reason)`,
]);
const resolverInterface = new Interface([
  "function resolveExecution(bytes payload) view returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
]);
const resolverPayload = "0x1234abcd";

const vectors = {
  schema: "NEXA_V6_SDK_TEST_VECTORS_V1",
  specVersion: "1.0.0",
  warning: "All keys and signatures are public test material. Never fund the recovered signer.",
  canonicalJson: {
    input: { z: [3, { b: true, a: "Nexa" }], a: null, unicode: "Nexa-\u0634\u0628\u06a9\u0647" },
    expected: canonical({ z: [3, { b: true, a: "Nexa" }], a: null, unicode: "Nexa-\u0634\u0628\u06a9\u0647" }),
  },
  feed: {
    nowSeconds: 2000000001,
    signedPayload,
    canonicalPayload,
    preimageUtf8: feedPreimage,
    feedHash,
    feedSigner: wallet.address,
    feedSignature,
    expectedValid: true,
  },
  permitRequest: {
    request: permitRequest,
    expectedMessage: permitMessage,
    requestSignature: permitRequestSignature,
    recoveredSigner: verifyMessage(permitMessage, permitRequestSignature),
  },
  abi: {
    permit,
    permitSignature,
    executionTarget: permit.sourceRouter,
    expectedTransactionValue: permit.sourceAsset === ZERO ? permit.amountInRaw : "0",
    fillDirectCallData: routerInterface.encodeFunctionData("fillDirect", [permit, permitSignature]),
    previewFillDirectCallData: routerInterface.encodeFunctionData(
      "previewFillDirect",
      [permit, permitSignature],
    ),
    resolverPayload,
    resolveExecutionCallData: resolverInterface.encodeFunctionData(
      "resolveExecution",
      [resolverPayload],
    ),
  },
};

await writeFile(
  new URL("../sdk-spec/test-vectors.json", import.meta.url),
  JSON.stringify(vectors, null, 2) + "\n",
);
console.log(JSON.stringify({
  generated: "sdk-spec/test-vectors.json",
  feedHash,
  feedSigner: wallet.address,
}, null, 2));
