import { getAddress, keccak256, recoverAddress, toUtf8Bytes } from "ethers";

export const FEED_DOMAIN = "NEXA_MAINNET_V6_SIGNED_FEED_V1";

export function canonical(value) {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeFeedHash(payload) {
  return keccak256(toUtf8Bytes(`${FEED_DOMAIN}\n${canonical(payload)}`));
}

export function verifyV6RouteFeed(feed, options = {}) {
  const payload = feed?.signedPayload ?? feed?.payload ?? feed;
  if (!payload || payload.schema !== FEED_DOMAIN || !Array.isArray(payload.routes)) {
    throw new Error("V6_FEED_SIGNED_PAYLOAD_INVALID");
  }
  const computedHash = computeFeedHash(payload).toLowerCase();
  const expectedHash = String(feed?.feedHash ?? "").toLowerCase();
  let recoveredSigner = null;
  try { recoveredSigner = getAddress(recoverAddress(computedHash, feed.feedSignature)); } catch {}
  let declaredSigner = null;
  try { declaredSigner = getAddress(feed?.feedSigner); } catch {}
  let expectedSigner = declaredSigner;
  if (options.expectedSigner != null) {
    try { expectedSigner = getAddress(options.expectedSigner); } catch { expectedSigner = null; }
  }
  const now = Number(options.nowSeconds ?? Math.floor(Date.now() / 1000));
  const valid = computedHash === expectedHash
    && recoveredSigner != null
    && declaredSigner != null
    && expectedSigner != null
    && recoveredSigner === declaredSigner
    && declaredSigner === expectedSigner
    && Number(payload.generatedAt) <= now
    && Number(payload.validUntil) > now;
  const result = Object.freeze({
    valid,
    computedHash,
    expectedHash,
    recoveredSigner,
    declaredSigner,
    expectedSigner,
    expired: Number(payload.validUntil) <= now,
  });
  if (options.required === true && !valid) {
    const error = new Error("V6_FEED_SIGNATURE_OR_VALIDITY_INVALID");
    error.details = result;
    throw error;
  }
  return result;
}
