import json
import re
import time
from typing import Any, Dict, Optional

import requests
from eth_abi import decode, encode
from eth_keys import keys
from eth_utils import keccak, to_checksum_address

FEED_DOMAIN = "NEXA_MAINNET_V6_SIGNED_FEED_V1"
PERMIT_REQUEST_DOMAIN = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1"
DEFAULT_BASE_URL = "https://solver.vsnexa.com"
DEFAULT_DISCOVERY_URI = DEFAULT_BASE_URL + "/.well-known/nexa-solver.json"
DEFAULT_RESOLVER = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

BYTES32 = re.compile(r"^0x[0-9a-fA-F]{64}$")
SIGNATURE = re.compile(r"^0x[0-9a-fA-F]{130}$")
IDEMPOTENCY = re.compile(r"^[a-zA-Z0-9._:-]{8,128}$")
PERMIT_FIELDS = [
    "releaseId", "fillId", "routeId", "quoteId", "policyHash", "permitNonce",
    "sourceNetworkId", "sourceAssetId", "destinationNetworkId", "destinationAssetId",
    "sourceVaultAccountId", "destinationVaultAccountId", "payerAccountId",
    "recipientAccountId", "dataVersion", "executionGeneration", "validAfter",
    "validUntil", "sourceFinalityBlocks", "settlementWindowSeconds", "sourceChainId",
    "destinationChainId", "sourceAsset", "destinationAsset", "sourceVault",
    "destinationVault", "sourceRouter", "payer", "recipient", "amountInRaw",
    "amountOutRaw",
]
PERMIT_TYPES = [
    "bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32",
    "bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32",
    "bytes32", "bytes32", "uint64", "bytes32", "uint64", "uint64",
    "uint32", "uint32", "uint256", "uint256", "address", "address", "address",
    "address", "address", "address", "address", "uint128", "uint128",
]
PERMIT_TUPLE = "(" + ",".join(PERMIT_TYPES) + ")"
RESOLVED_TUPLE = "(bytes32,bytes32,address,uint256,bytes)"


class NexaSdkError(Exception):
    def __init__(self, code: str, details: Any = None, serverCode: Optional[str] = None):
        super().__init__(code)
        self.code = code
        self.details = details or {}
        self.serverCode = serverCode


def canonicalJson(value: Any) -> str:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    )


def computeFeedHash(payload: Dict[str, Any]) -> str:
    preimage = f"{FEED_DOMAIN}\n{canonicalJson(payload)}".encode("utf-8")
    return "0x" + keccak(preimage).hex()


def _address(value: Any) -> Optional[str]:
    try:
        return to_checksum_address(str(value))
    except Exception:
        return None


def _recover_digest(digest: str, signature: str) -> Optional[str]:
    try:
        raw = bytearray.fromhex(signature[2:])
        if raw[64] >= 27:
            raw[64] -= 27
        public_key = keys.Signature(bytes(raw)).recover_public_key_from_msg_hash(
            bytes.fromhex(digest[2:])
        )
        return public_key.to_checksum_address()
    except Exception:
        return None


def verifyFeed(feed: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    options = options or {}
    payload = feed.get("signedPayload") or feed.get("payload") or feed
    if not isinstance(payload, dict) or payload.get("schema") != FEED_DOMAIN \
            or not isinstance(payload.get("routes"), list):
        raise NexaSdkError("NEXA_SDK_FEED_INVALID")
    computed = computeFeedHash(payload).lower()
    expected_hash = str(feed.get("feedHash", "")).lower()
    recovered = _recover_digest(computed, str(feed.get("feedSignature", "")))
    declared = _address(feed.get("feedSigner"))
    expected_signer = _address(options.get("expectedSigner") or feed.get("feedSigner"))
    now = int(options.get("nowSeconds", time.time()))
    expired = int(payload.get("validUntil", 0)) <= now
    valid = (
        computed == expected_hash
        and recovered is not None and declared is not None and expected_signer is not None
        and recovered == declared == expected_signer
        and int(payload.get("generatedAt", 0)) <= now
        and not expired
    )
    result = {
        "valid": valid, "computedHash": computed, "expectedHash": expected_hash,
        "recoveredSigner": recovered, "declaredSigner": declared,
        "expectedSigner": expected_signer, "expired": expired,
    }
    if options.get("required") and not valid:
        code = (
            "NEXA_SDK_FEED_HASH_MISMATCH" if computed != expected_hash
            else "NEXA_SDK_FEED_EXPIRED" if expired
            else "NEXA_SDK_FEED_SIGNER_MISMATCH"
        )
        raise NexaSdkError(code, result)
    return result


def _bytes32(value: Any) -> str:
    result = str(value or "").lower()
    if not BYTES32.fullmatch(result):
        raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID")
    return result


def _locator(value: Any) -> Dict[str, Any]:
    if isinstance(value, str):
        return {"native": value}
    if isinstance(value, dict):
        return value
    raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID")


def _permit_request(value: Dict[str, Any]) -> Dict[str, Any]:
    key = str(value.get("idempotencyKey", "")).strip()
    standard = str(value.get("standard", "DIRECT")).upper()
    try:
        amount = int(value.get("requestedAmountInRaw"))
    except Exception as error:
        raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID") from error
    if not IDEMPOTENCY.fullmatch(key) or amount <= 0 or amount >= 2**128 \
            or not re.fullmatch(r"[A-Z0-9][A-Z0-9._:-]{0,63}", standard):
        raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID")
    payer = _address(value.get("payer")) if value.get("payer") is not None else None
    recipient = _address(value.get("recipient")) if value.get("recipient") is not None else None
    payer_id = _bytes32(value["payerAccountId"]) if value.get("payerAccountId") else None
    recipient_id = _bytes32(value["recipientAccountId"]) if value.get("recipientAccountId") else None
    if (not payer and not payer_id) or (not recipient and not recipient_id):
        raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID")
    return {
        "quoteId": _bytes32(value.get("quoteId")),
        "requestedAmountInRaw": str(amount),
        "standard": standard,
        "payer": payer,
        "recipient": recipient,
        "payerAccountId": payer_id,
        "recipientAccountId": recipient_id,
        "payerLocator": None if payer else _locator(value.get("payerLocator")),
        "recipientLocator": None if recipient else _locator(value.get("recipientLocator")),
        "idempotencyKey": key,
    }


def requestPermitMessage(value: Dict[str, Any]) -> str:
    request = _permit_request(value)
    payer = (
        f"payer={request['payer'].lower()}" if request["payer"]
        else f"payerAccountId={request['payerAccountId']}\n"
             f"payerLocator={canonicalJson(request['payerLocator'])}"
    )
    recipient = (
        f"recipient={request['recipient'].lower()}" if request["recipient"]
        else f"recipientAccountId={request['recipientAccountId']}\n"
             f"recipientLocator={canonicalJson(request['recipientLocator'])}"
    )
    return "\n".join([
        PERMIT_REQUEST_DOMAIN,
        f"quoteId={request['quoteId']}",
        f"requestedAmountInRaw={request['requestedAmountInRaw']}",
        f"standard={request['standard']}",
        payer, recipient,
        f"idempotencyKey={request['idempotencyKey']}",
    ])


def _selector(signature: str) -> bytes:
    return keccak(text=signature)[:4]


def _permit_values(permit: Dict[str, Any]) -> list:
    values = []
    for name, abi_type in zip(PERMIT_FIELDS, PERMIT_TYPES):
        value = permit[name]
        if abi_type == "bytes32":
            value = bytes.fromhex(str(value)[2:])
        elif abi_type.startswith("uint"):
            value = int(value)
        values.append(value)
    return values


def _permit_parts(envelope: Dict[str, Any]):
    row = envelope.get("permit") if isinstance(envelope.get("permit"), dict) \
        and isinstance(envelope["permit"].get("permit"), dict) else envelope
    permit = row.get("permit")
    signature = str(row.get("permitSignature", ""))
    if not isinstance(permit, dict) or not SIGNATURE.fullmatch(signature):
        raise NexaSdkError("NEXA_SDK_ABI_ERROR")
    return row, permit, bytes.fromhex(signature[2:])


class NexaV6Client:
    def __init__(self, baseUrl: str = DEFAULT_BASE_URL,
                 discoveryUri: str = DEFAULT_DISCOVERY_URI,
                 expectedFeedSigner: Optional[str] = None,
                 session: Optional[requests.Session] = None):
        self.baseUrl = baseUrl
        self.discoveryUri = discoveryUri
        self.expectedFeedSigner = expectedFeedSigner
        self.session = session or requests.Session()

    def _json(self, method: str, url: str, **kwargs):
        response = self.session.request(method, url, timeout=30, **kwargs)
        try:
            body = response.json()
        except Exception:
            body = None
        if not response.ok:
            raise NexaSdkError(
                "NEXA_SDK_HTTP_ERROR",
                {"status": response.status_code, "url": url, "body": body},
                body.get("error") if isinstance(body, dict) else None,
            )
        return body

    def discover(self):
        discovery = self._json("GET", self.discoveryUri)
        if discovery.get("schema") != "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2" \
                or discovery.get("deploymentVersion") != 6 \
                or discovery.get("deploymentStatus") != "ACTIVE" \
                or not BYTES32.fullmatch(str(discovery.get("releaseId", ""))) \
                or not _address(discovery.get("feedSigner")) \
                or not discovery.get("endpoints", {}).get("solverFeed"):
            raise NexaSdkError("NEXA_SDK_DISCOVERY_INVALID")
        return discovery

    def getRoutes(self, query: Optional[Dict[str, Any]] = None):
        query = query or {}
        discovery = self.discover()
        params = {}
        if query.get("sourceChainId") is not None:
            params["sourceChainId"] = str(query["sourceChainId"])
        if query.get("sourceNetworkId") is not None:
            params["sourceNetworkId"] = _bytes32(query["sourceNetworkId"])
        body = self._json("GET", discovery["endpoints"]["solverFeed"], params=params)
        feed = body.get("feed", body)
        verification = verifyFeed(feed, {
            "expectedSigner": self.expectedFeedSigner or discovery["feedSigner"],
            "required": True,
        })
        return {
            "feed": feed,
            "routes": feed.get("routes") or feed.get("signedPayload", {}).get("routes", []),
            "verification": verification,
        }

    def getRoute(self, routeId: str):
        discovery = self.discover()
        url = discovery["endpoints"]["routeDetailTemplate"].replace(
            "{routeId}", _bytes32(routeId)
        )
        body = self._json("GET", url)
        return body.get("route", body)

    def verifyFeed(self, feed, options=None):
        return verifyFeed(feed, options)

    def requestPermitMessage(self, request):
        return requestPermitMessage(request)

    def requestPermit(self, request, requestSignature):
        if not SIGNATURE.fullmatch(str(requestSignature or "")):
            raise NexaSdkError("NEXA_SDK_PERMIT_REQUEST_INVALID")
        discovery = self.discover()
        normalized = _permit_request(request)
        return self._json(
            "POST", discovery["endpoints"]["executionPermits"],
            headers={"Idempotency-Key": normalized["idempotencyKey"]},
            json={**normalized, "requestSignature": requestSignature},
        )

    def _rpc(self, rpcUrl, data):
        body = self._json("POST", rpcUrl, json={
            "jsonrpc": "2.0", "id": 1, "method": "eth_call",
            "params": [data, "latest"],
        })
        if body.get("error") or not isinstance(body.get("result"), str):
            raise NexaSdkError("NEXA_SDK_RPC_ERROR", body.get("error", body))
        return body["result"]

    def resolveExecution(self, rpcUrl, payload):
        call = _selector("resolveExecution(bytes)") + encode(
            ["bytes"], [bytes.fromhex(payload[2:])]
        )
        raw = self._rpc(rpcUrl, {"to": DEFAULT_RESOLVER, "data": "0x" + call.hex()})
        try:
            result = decode([RESOLVED_TUPLE], bytes.fromhex(raw[2:]))[0]
            return {
                "resolver": DEFAULT_RESOLVER,
                "routeId": "0x" + result[0].hex(),
                "quoteId": "0x" + result[1].hex(),
                "target": to_checksum_address(result[2]),
                "value": str(result[3]),
                "callData": "0x" + result[4].hex(),
                "rawReturnData": raw,
            }
        except Exception as error:
            raise NexaSdkError("NEXA_SDK_ABI_ERROR", {"cause": str(error)}) from error

    def buildExecutionTx(self, envelope):
        row, permit, signature = _permit_parts(envelope)
        encoded = encode([PERMIT_TUPLE, "bytes"], [_permit_values(permit), signature])
        call = _selector(f"fillDirect({PERMIT_TUPLE},bytes)") + encoded
        return {
            "chainId": int(permit["sourceChainId"]),
            "from": to_checksum_address(permit["payer"]),
            "to": to_checksum_address(row.get("execution", {}).get(
                "target", permit["sourceRouter"]
            )),
            "data": "0x" + call.hex(),
            "value": str(permit["amountInRaw"]) if
                to_checksum_address(permit["sourceAsset"]) == ZERO_ADDRESS else "0",
        }

    def previewExecution(self, rpcUrl, envelope):
        _, permit, signature = _permit_parts(envelope)
        encoded = encode([PERMIT_TUPLE, "bytes"], [_permit_values(permit), signature])
        call = _selector(f"previewFillDirect({PERMIT_TUPLE},bytes)") + encoded
        raw = self._rpc(rpcUrl, {
            "to": permit["sourceRouter"], "from": permit["payer"],
            "data": "0x" + call.hex(),
        })
        try:
            valid, reason = decode(["bool", "bytes32"], bytes.fromhex(raw[2:]))
            return {"valid": valid, "reason": "0x" + reason.hex(), "rawReturnData": raw}
        except Exception as error:
            raise NexaSdkError("NEXA_SDK_ABI_ERROR", {"cause": str(error)}) from error

    def getFillStatus(self, fillId):
        discovery = self.discover()
        url = discovery["endpoints"]["permitStatusTemplate"].replace(
            "{fillId}", _bytes32(fillId)
        )
        body = self._json("GET", url)
        return body.get("permit", body)
