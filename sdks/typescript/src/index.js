import {
  Interface,
  ZeroAddress,
  getAddress,
  keccak256,
  recoverAddress,
  toUtf8Bytes,
} from "ethers";

export const FEED_DOMAIN = "NEXA_MAINNET_V6_SIGNED_FEED_V1";
export const PERMIT_REQUEST_DOMAIN = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1";
export const DEFAULT_BASE_URL = "https://solver.vsnexa.com";
export const DEFAULT_DISCOVERY_URI =
  "https://solver.vsnexa.com/.well-known/nexa-solver.json";
export const DEFAULT_RESOLVER = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522";

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const SIGNATURE = /^0x[0-9a-fA-F]{130}$/;
const IDEMPOTENCY = /^[a-zA-Z0-9._:-]{8,128}$/;
const PERMIT_TUPLE = "tuple(bytes32 releaseId,bytes32 fillId,bytes32 routeId,bytes32 quoteId,bytes32 policyHash,bytes32 permitNonce,bytes32 sourceNetworkId,bytes32 sourceAssetId,bytes32 destinationNetworkId,bytes32 destinationAssetId,bytes32 sourceVaultAccountId,bytes32 destinationVaultAccountId,bytes32 payerAccountId,bytes32 recipientAccountId,uint64 dataVersion,bytes32 executionGeneration,uint64 validAfter,uint64 validUntil,uint32 sourceFinalityBlocks,uint32 settlementWindowSeconds,uint256 sourceChainId,uint256 destinationChainId,address sourceAsset,address destinationAsset,address sourceVault,address destinationVault,address sourceRouter,address payer,address recipient,uint128 amountInRaw,uint128 amountOutRaw)";
const ROUTER = new Interface([
  `function fillDirect(${PERMIT_TUPLE} permit,bytes signature) payable returns (bytes32 fillId)`,
  `function previewFillDirect(${PERMIT_TUPLE} permit,bytes signature) view returns (bool valid,bytes32 reason)`,
]);
const RESOLVER = new Interface([
  "function resolveExecution(bytes payload) view returns (tuple(bytes32 routeId,bytes32 quoteId,address target,uint256 value,bytes callData) result)",
]);

export class NexaSdkError extends Error {
  constructor(code, details = {}, serverCode) {
    super(code);
    this.name = "NexaSdkError";
    this.code = code;
    this.details = details;
    if (serverCode) this.serverCode = serverCode;
  }
}

export function canonicalJson(value) {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new NexaSdkError("NEXA_SDK_FEED_INVALID");
  return encoded;
}

export function computeFeedHash(payload) {
  return keccak256(toUtf8Bytes(`${FEED_DOMAIN}\n${canonicalJson(payload)}`));
}

function address(value) {
  try { return getAddress(value); } catch { return null; }
}

export function verifyFeed(feed, options = {}) {
  const payload = feed?.signedPayload ?? feed?.payload ?? feed;
  if (!payload || payload.schema !== FEED_DOMAIN || !Array.isArray(payload.routes)) {
    throw new NexaSdkError("NEXA_SDK_FEED_INVALID");
  }
  const computedHash = computeFeedHash(payload).toLowerCase();
  const expectedHash = String(feed?.feedHash ?? "").toLowerCase();
  let recoveredSigner = null;
  try { recoveredSigner = getAddress(recoverAddress(computedHash, feed.feedSignature)); } catch {}
  const declaredSigner = address(feed?.feedSigner);
  const expectedSigner = address(options.expectedSigner ?? feed?.feedSigner);
  const now = Number(options.nowSeconds ?? Math.floor(Date.now() / 1000));
  const expired = Number(payload.validUntil) <= now;
  const valid = computedHash === expectedHash
    && recoveredSigner != null
    && declaredSigner != null
    && expectedSigner != null
    && recoveredSigner === declaredSigner
    && declaredSigner === expectedSigner
    && Number(payload.generatedAt) <= now
    && !expired;
  const result = Object.freeze({
    valid, computedHash, expectedHash, recoveredSigner,
    declaredSigner, expectedSigner, expired,
  });
  if (options.required && !valid) {
    const code = computedHash !== expectedHash
      ? "NEXA_SDK_FEED_HASH_MISMATCH"
      : (expired ? "NEXA_SDK_FEED_EXPIRED" : "NEXA_SDK_FEED_SIGNER_MISMATCH");
    throw new NexaSdkError(code, result);
  }
  return result;
}

function normalizeBytes32(value) {
  const result = String(value ?? "").toLowerCase();
  if (!BYTES32.test(result)) throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
  return result;
}

function canonicalLocator(value) {
  if (value == null || (typeof value !== "string"
      && (typeof value !== "object" || Array.isArray(value)))) {
    throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
  }
  return typeof value === "string" ? { native: value } : value;
}

function normalizePermitRequest(input = {}) {
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();
  const standard = String(input.standard ?? "DIRECT").toUpperCase();
  let amount;
  try { amount = BigInt(input.requestedAmountInRaw); } catch {
    throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
  }
  if (!IDEMPOTENCY.test(idempotencyKey) || amount <= 0n || amount >= (1n << 128n)
      || !/^[A-Z0-9][A-Z0-9._:-]{0,63}$/.test(standard)) {
    throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
  }
  const payer = input.payer == null ? null : address(input.payer);
  const recipient = input.recipient == null ? null : address(input.recipient);
  const payerAccountId = input.payerAccountId == null
    ? null : normalizeBytes32(input.payerAccountId);
  const recipientAccountId = input.recipientAccountId == null
    ? null : normalizeBytes32(input.recipientAccountId);
  const payerLocator = payer ? null : canonicalLocator(input.payerLocator);
  const recipientLocator = recipient ? null : canonicalLocator(input.recipientLocator);
  if ((!payer && !payerAccountId) || (!recipient && !recipientAccountId)) {
    throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
  }
  return {
    quoteId: normalizeBytes32(input.quoteId),
    requestedAmountInRaw: amount.toString(),
    standard, payer, recipient, payerAccountId, recipientAccountId,
    payerLocator, recipientLocator, idempotencyKey,
  };
}

export function requestPermitMessage(input) {
  const request = normalizePermitRequest(input);
  return [
    PERMIT_REQUEST_DOMAIN,
    `quoteId=${request.quoteId}`,
    `requestedAmountInRaw=${request.requestedAmountInRaw}`,
    `standard=${request.standard}`,
    request.payer
      ? `payer=${request.payer.toLowerCase()}`
      : `payerAccountId=${request.payerAccountId}\npayerLocator=${canonicalJson(request.payerLocator)}`,
    request.recipient
      ? `recipient=${request.recipient.toLowerCase()}`
      : `recipientAccountId=${request.recipientAccountId}\nrecipientLocator=${canonicalJson(request.recipientLocator)}`,
    `idempotencyKey=${request.idempotencyKey}`,
  ].join("\n");
}

function permitParts(envelope) {
  const row = envelope?.permit?.permit ? envelope.permit : envelope;
  if (!row?.permit || !SIGNATURE.test(String(row.permitSignature ?? ""))) {
    throw new NexaSdkError("NEXA_SDK_ABI_ERROR");
  }
  return { row, permit: row.permit, signature: row.permitSignature };
}

export class NexaV6Client {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.discoveryUri = options.discoveryUri ?? DEFAULT_DISCOVERY_URI;
    this.expectedFeedSigner = options.expectedFeedSigner ?? null;
    this.fetch = options.fetch ?? globalThis.fetch;
    if (typeof this.fetch !== "function") throw new NexaSdkError("NEXA_SDK_HTTP_ERROR");
  }

  async json(url, init = {}) {
    const response = await this.fetch(url, {
      redirect: "manual",
      headers: { accept: "application/json", ...(init.headers ?? {}) },
      ...init,
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      throw new NexaSdkError(
        "NEXA_SDK_HTTP_ERROR",
        { status: response.status, url: String(url), body },
        body?.error,
      );
    }
    return body;
  }

  async discover() {
    const discovery = await this.json(this.discoveryUri);
    if (discovery?.schema !== "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2"
        || discovery.deploymentVersion !== 6
        || discovery.deploymentStatus !== "ACTIVE"
        || !BYTES32.test(String(discovery.releaseId))
        || !address(discovery.feedSigner)
        || !discovery.endpoints?.solverFeed) {
      throw new NexaSdkError("NEXA_SDK_DISCOVERY_INVALID");
    }
    return discovery;
  }

  async getRoutes(query = {}) {
    const discovery = await this.discover();
    const url = new URL(discovery.endpoints.solverFeed);
    if (query.sourceChainId != null) url.searchParams.set("sourceChainId", String(query.sourceChainId));
    if (query.sourceNetworkId != null) {
      url.searchParams.set("sourceNetworkId", normalizeBytes32(query.sourceNetworkId));
    }
    const body = await this.json(url);
    const feed = body?.feed ?? body;
    const verification = verifyFeed(feed, {
      expectedSigner: this.expectedFeedSigner ?? discovery.feedSigner,
      required: true,
    });
    return { feed, routes: feed.routes ?? feed.signedPayload?.routes ?? [], verification };
  }

  async getRoute(routeId) {
    const discovery = await this.discover();
    const url = discovery.endpoints.routeDetailTemplate.replace("{routeId}", normalizeBytes32(routeId));
    const body = await this.json(url);
    return body?.route ?? body;
  }

  verifyFeed(feed, options = {}) {
    return verifyFeed(feed, options);
  }

  requestPermitMessage(request) {
    return requestPermitMessage(request);
  }

  async requestPermit(input, requestSignature) {
    if (!SIGNATURE.test(String(requestSignature ?? ""))) {
      throw new NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID");
    }
    const discovery = await this.discover();
    const request = normalizePermitRequest(input);
    return this.json(discovery.endpoints.executionPermits, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": request.idempotencyKey,
      },
      body: JSON.stringify({ ...request, requestSignature }),
    });
  }

  async rpc(rpcUrl, method, params) {
    const body = await this.json(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (body?.error || typeof body?.result !== "string") {
      throw new NexaSdkError("NEXA_SDK_RPC_ERROR", body?.error ?? body);
    }
    return body.result;
  }

  async resolveExecution(rpcUrl, payload) {
    const data = RESOLVER.encodeFunctionData("resolveExecution", [payload]);
    const rawReturnData = await this.rpc(rpcUrl, "eth_call", [
      { to: DEFAULT_RESOLVER, data }, "latest",
    ]);
    try {
      const [result] = RESOLVER.decodeFunctionResult("resolveExecution", rawReturnData);
      return {
        resolver: DEFAULT_RESOLVER,
        routeId: result.routeId,
        quoteId: result.quoteId,
        target: result.target,
        value: result.value.toString(),
        callData: result.callData,
        rawReturnData,
      };
    } catch (error) {
      throw new NexaSdkError("NEXA_SDK_ABI_ERROR", { cause: String(error) });
    }
  }

  buildExecutionTx(envelope) {
    const { row, permit, signature } = permitParts(envelope);
    try {
      return {
        chainId: Number(permit.sourceChainId),
        from: getAddress(permit.payer),
        to: getAddress(row.execution?.target ?? permit.sourceRouter),
        data: ROUTER.encodeFunctionData("fillDirect", [permit, signature]),
        value: getAddress(permit.sourceAsset) === ZeroAddress
          ? String(permit.amountInRaw) : "0",
      };
    } catch (error) {
      throw new NexaSdkError("NEXA_SDK_ABI_ERROR", { cause: String(error) });
    }
  }

  async previewExecution(rpcUrl, envelope) {
    const { permit, signature } = permitParts(envelope);
    const data = ROUTER.encodeFunctionData("previewFillDirect", [permit, signature]);
    const rawReturnData = await this.rpc(rpcUrl, "eth_call", [
      { to: permit.sourceRouter, from: permit.payer, data }, "latest",
    ]);
    try {
      const [valid, reason] = ROUTER.decodeFunctionResult("previewFillDirect", rawReturnData);
      return { valid, reason, rawReturnData };
    } catch (error) {
      throw new NexaSdkError("NEXA_SDK_ABI_ERROR", { cause: String(error) });
    }
  }

  async getFillStatus(fillId) {
    const discovery = await this.discover();
    const url = discovery.endpoints.permitStatusTemplate.replace("{fillId}", normalizeBytes32(fillId));
    const body = await this.json(url);
    return body?.permit ?? body;
  }
}
