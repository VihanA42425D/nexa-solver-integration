#![allow(non_snake_case)]

use alloy_primitives::{keccak256, Address, Bytes, B256, U256};
use alloy_sol_types::{sol, SolCall};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;

pub const FEED_DOMAIN: &str = "NEXA_MAINNET_V6_SIGNED_FEED_V1";
pub const PERMIT_REQUEST_DOMAIN: &str = "NEXA_MAINNET_V6_EXECUTION_PERMIT_REQUEST_V1";
pub const DEFAULT_DISCOVERY_URI: &str = "https://solver.vsnexa.com/.well-known/nexa-solver.json";
pub const DEFAULT_RESOLVER: &str = "0x534A0f500A7270b9b19d2AFa18DE24DCE93eb522";

sol! {
    struct ExecutionPermitV6 {
        bytes32 releaseId; bytes32 fillId; bytes32 routeId; bytes32 quoteId;
        bytes32 policyHash; bytes32 permitNonce; bytes32 sourceNetworkId;
        bytes32 sourceAssetId; bytes32 destinationNetworkId; bytes32 destinationAssetId;
        bytes32 sourceVaultAccountId; bytes32 destinationVaultAccountId;
        bytes32 payerAccountId; bytes32 recipientAccountId; uint64 dataVersion;
        bytes32 executionGeneration; uint64 validAfter; uint64 validUntil;
        uint32 sourceFinalityBlocks; uint32 settlementWindowSeconds;
        uint256 sourceChainId; uint256 destinationChainId; address sourceAsset;
        address destinationAsset; address sourceVault; address destinationVault;
        address sourceRouter; address payer; address recipient;
        uint128 amountInRaw; uint128 amountOutRaw;
    }
    struct ResolvedExecutionV6 {
        bytes32 routeId; bytes32 quoteId; address target; uint256 value; bytes callData;
    }
    function fillDirect(ExecutionPermitV6 permit, bytes signature)
        external payable returns (bytes32 fillId);
    function previewFillDirect(ExecutionPermitV6 permit, bytes signature)
        external view returns (bool valid, bytes32 reason);
    function resolveExecution(bytes payload)
        external view returns (ResolvedExecutionV6 result);
}

#[derive(Debug, Error)]
#[error("{code}")]
pub struct NexaSdkError {
    pub code: String,
    pub details: Value,
}
impl NexaSdkError {
    fn new(code: &str) -> Self {
        Self {
            code: code.into(),
            details: json!({}),
        }
    }
    fn with(code: &str, details: Value) -> Self {
        Self {
            code: code.into(),
            details,
        }
    }
}

pub fn canonicalJson(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(v) => v.to_string(),
        Value::Number(v) => v.to_string(),
        Value::String(v) => serde_json::to_string(v).unwrap(),
        Value::Array(v) => format!(
            "[{}]",
            v.iter().map(canonicalJson).collect::<Vec<_>>().join(",")
        ),
        Value::Object(v) => {
            let mut keys = v.keys().collect::<Vec<_>>();
            keys.sort();
            format!(
                "{{{}}}",
                keys.into_iter()
                    .map(|k| format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap(),
                        canonicalJson(&v[k])
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
    }
}
pub fn computeFeedHash(payload: &Value) -> String {
    format!(
        "{:#x}",
        keccak256(format!("{}\n{}", FEED_DOMAIN, canonicalJson(payload)))
    )
}
fn checksum(v: &str) -> Option<String> {
    Address::from_str(v).ok().map(|a| a.to_checksum(None))
}
fn recover_digest(digest: &str, signature: &str) -> Option<String> {
    let digest = alloy_primitives::hex::decode(digest.trim_start_matches("0x")).ok()?;
    let raw = alloy_primitives::hex::decode(signature.trim_start_matches("0x")).ok()?;
    if digest.len() != 32 || raw.len() != 65 {
        return None;
    }
    let recovery = if raw[64] >= 27 { raw[64] - 27 } else { raw[64] };
    let signature = Signature::from_slice(&raw[..64]).ok()?;
    let key = VerifyingKey::recover_from_prehash(
        &digest,
        &signature,
        RecoveryId::try_from(recovery).ok()?,
    )
    .ok()?;
    let encoded = key.to_sec1_point(false);
    let hash = keccak256(&encoded.as_bytes()[1..]);
    Some(Address::from_slice(&hash[12..]).to_checksum(None))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedVerification {
    pub valid: bool,
    pub computed_hash: String,
    pub expected_hash: String,
    pub recovered_signer: Option<String>,
    pub declared_signer: Option<String>,
    pub expected_signer: Option<String>,
    pub expired: bool,
}
pub fn verifyFeed(
    feed: &Value,
    expected: Option<&str>,
    now: Option<u64>,
) -> Result<FeedVerification, NexaSdkError> {
    let payload = feed
        .get("signedPayload")
        .or_else(|| feed.get("payload"))
        .unwrap_or(feed);
    if payload["schema"] != FEED_DOMAIN || !payload["routes"].is_array() {
        return Err(NexaSdkError::new("NEXA_SDK_FEED_INVALID"));
    }
    let computed = computeFeedHash(payload).to_lowercase();
    let expected_hash = feed["feedHash"].as_str().unwrap_or("").to_lowercase();
    let recovered = recover_digest(&computed, feed["feedSignature"].as_str().unwrap_or(""));
    let declared = feed["feedSigner"].as_str().and_then(checksum);
    let expected_signer = expected
        .or_else(|| feed["feedSigner"].as_str())
        .and_then(checksum);
    let now = now.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    let expired = payload["validUntil"].as_u64().unwrap_or(0) <= now;
    let valid = computed == expected_hash
        && recovered.is_some()
        && recovered == declared
        && declared == expected_signer
        && payload["generatedAt"].as_u64().unwrap_or(0) <= now
        && !expired;
    Ok(FeedVerification {
        valid,
        computed_hash: computed,
        expected_hash,
        recovered_signer: recovered,
        declared_signer: declared,
        expected_signer,
        expired,
    })
}

fn bytes32(v: &str) -> Result<String, NexaSdkError> {
    B256::from_str(v)
        .map(|x| format!("{:#x}", x))
        .map_err(|_| NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"))
}
fn normalized_request(input: &Value) -> Result<Value, NexaSdkError> {
    let amount = input["requestedAmountInRaw"]
        .as_str()
        .and_then(|v| v.parse::<u128>().ok())
        .filter(|v| *v > 0)
        .ok_or_else(|| NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"))?;
    let key = input["idempotencyKey"].as_str().unwrap_or("").trim();
    if !(8..=128).contains(&key.len())
        || !key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._:-".contains(c))
    {
        return Err(NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"));
    }
    let payer = input["payer"]
        .as_str()
        .and_then(checksum)
        .ok_or_else(|| NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"))?;
    let recipient = input["recipient"]
        .as_str()
        .and_then(checksum)
        .ok_or_else(|| NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"))?;
    Ok(
        json!({"quoteId":bytes32(input["quoteId"].as_str().unwrap_or(""))?,
        "requestedAmountInRaw":amount.to_string(),
        "standard":input["standard"].as_str().unwrap_or("DIRECT").to_uppercase(),
        "payer":payer,"recipient":recipient,"payerAccountId":Value::Null,
        "recipientAccountId":Value::Null,"payerLocator":Value::Null,
        "recipientLocator":Value::Null,"idempotencyKey":key}),
    )
}
pub fn requestPermitMessage(input: &Value) -> Result<String, NexaSdkError> {
    let r = normalized_request(input)?;
    Ok([
        PERMIT_REQUEST_DOMAIN.to_string(),
        format!("quoteId={}", r["quoteId"].as_str().unwrap()),
        format!(
            "requestedAmountInRaw={}",
            r["requestedAmountInRaw"].as_str().unwrap()
        ),
        format!("standard={}", r["standard"].as_str().unwrap()),
        format!("payer={}", r["payer"].as_str().unwrap().to_lowercase()),
        format!(
            "recipient={}",
            r["recipient"].as_str().unwrap().to_lowercase()
        ),
        format!("idempotencyKey={}", r["idempotencyKey"].as_str().unwrap()),
    ]
    .join("\n"))
}

fn b(v: &Value, n: &str) -> Result<B256, NexaSdkError> {
    B256::from_str(v[n].as_str().unwrap_or("")).map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))
}
fn a(v: &Value, n: &str) -> Result<Address, NexaSdkError> {
    Address::from_str(v[n].as_str().unwrap_or(""))
        .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))
}
fn u64v(v: &Value, n: &str) -> Result<u64, NexaSdkError> {
    v[n].as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| v[n].as_u64())
        .ok_or_else(|| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))
}
fn u128v(v: &Value, n: &str) -> Result<u128, NexaSdkError> {
    v[n].as_str()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))
}
fn u256v(v: &Value, n: &str) -> Result<U256, NexaSdkError> {
    U256::from_str(v[n].as_str().unwrap_or("")).map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))
}
fn permit(v: &Value) -> Result<ExecutionPermitV6, NexaSdkError> {
    Ok(ExecutionPermitV6 {
        releaseId: b(v, "releaseId")?,
        fillId: b(v, "fillId")?,
        routeId: b(v, "routeId")?,
        quoteId: b(v, "quoteId")?,
        policyHash: b(v, "policyHash")?,
        permitNonce: b(v, "permitNonce")?,
        sourceNetworkId: b(v, "sourceNetworkId")?,
        sourceAssetId: b(v, "sourceAssetId")?,
        destinationNetworkId: b(v, "destinationNetworkId")?,
        destinationAssetId: b(v, "destinationAssetId")?,
        sourceVaultAccountId: b(v, "sourceVaultAccountId")?,
        destinationVaultAccountId: b(v, "destinationVaultAccountId")?,
        payerAccountId: b(v, "payerAccountId")?,
        recipientAccountId: b(v, "recipientAccountId")?,
        dataVersion: u64v(v, "dataVersion")?,
        executionGeneration: b(v, "executionGeneration")?,
        validAfter: u64v(v, "validAfter")?,
        validUntil: u64v(v, "validUntil")?,
        sourceFinalityBlocks: u64v(v, "sourceFinalityBlocks")? as u32,
        settlementWindowSeconds: u64v(v, "settlementWindowSeconds")? as u32,
        sourceChainId: u256v(v, "sourceChainId")?,
        destinationChainId: u256v(v, "destinationChainId")?,
        sourceAsset: a(v, "sourceAsset")?,
        destinationAsset: a(v, "destinationAsset")?,
        sourceVault: a(v, "sourceVault")?,
        destinationVault: a(v, "destinationVault")?,
        sourceRouter: a(v, "sourceRouter")?,
        payer: a(v, "payer")?,
        recipient: a(v, "recipient")?,
        amountInRaw: u128v(v, "amountInRaw")?,
        amountOutRaw: u128v(v, "amountOutRaw")?,
    })
}

#[derive(Clone)]
pub struct NexaV6Client {
    pub discoveryUri: String,
    pub expectedFeedSigner: Option<String>,
    http: Client,
}
impl Default for NexaV6Client {
    fn default() -> Self {
        Self {
            discoveryUri: DEFAULT_DISCOVERY_URI.into(),
            expectedFeedSigner: None,
            http: Client::new(),
        }
    }
}
impl NexaV6Client {
    fn get(&self, url: &str) -> Result<Value, NexaSdkError> {
        self.http
            .get(url)
            .send()
            .and_then(|r| r.error_for_status())
            .and_then(|r| r.json())
            .map_err(|e| {
                NexaSdkError::with(
                    "NEXA_SDK_HTTP_ERROR",
                    json!({"cause":e.to_string(),"url":url}),
                )
            })
    }
    fn post(&self, url: &str, body: &Value, key: Option<&str>) -> Result<Value, NexaSdkError> {
        let mut r = self.http.post(url).json(body);
        if let Some(k) = key {
            r = r.header("Idempotency-Key", k);
        }
        r.send()
            .and_then(|r| r.error_for_status())
            .and_then(|r| r.json())
            .map_err(|e| NexaSdkError::with("NEXA_SDK_HTTP_ERROR", json!({"cause":e.to_string()})))
    }
    pub fn discover(&self) -> Result<Value, NexaSdkError> {
        let v = self.get(&self.discoveryUri)?;
        if v["schema"] != "NEXA_MAINNET_V6_SOLVER_DISCOVERY_V2"
            || v["deploymentVersion"] != 6
            || v["deploymentStatus"] != "ACTIVE"
        {
            return Err(NexaSdkError::new("NEXA_SDK_DISCOVERY_INVALID"));
        }
        Ok(v)
    }
    pub fn getRoutes(&self, query: Option<&Value>) -> Result<Value, NexaSdkError> {
        let d = self.discover()?;
        let mut url = reqwest::Url::parse(d["endpoints"]["solverFeed"].as_str().unwrap())
            .map_err(|_| NexaSdkError::new("NEXA_SDK_DISCOVERY_INVALID"))?;
        if let Some(q) = query {
            if let Some(c) = q.get("sourceChainId") {
                url.query_pairs_mut()
                    .append_pair("sourceChainId", &c.to_string());
            }
            if let Some(n) = q["sourceNetworkId"].as_str() {
                url.query_pairs_mut()
                    .append_pair("sourceNetworkId", &bytes32(n)?);
            }
        }
        let body = self.get(url.as_str())?;
        let feed = body.get("feed").unwrap_or(&body);
        let verification = verifyFeed(
            feed,
            self.expectedFeedSigner
                .as_deref()
                .or_else(|| d["feedSigner"].as_str()),
            None,
        )?;
        if !verification.valid {
            return Err(NexaSdkError::new("NEXA_SDK_FEED_SIGNER_MISMATCH"));
        }
        let routes = feed
            .get("routes")
            .or_else(|| feed.pointer("/signedPayload/routes"))
            .cloned()
            .unwrap_or_else(|| json!([]));
        Ok(json!({"feed":feed,"routes":routes,"verification":verification}))
    }
    pub fn getRoute(&self, route_id: &str) -> Result<Value, NexaSdkError> {
        let d = self.discover()?;
        let url = d["endpoints"]["routeDetailTemplate"]
            .as_str()
            .unwrap()
            .replace("{routeId}", &bytes32(route_id)?);
        let body = self.get(&url)?;
        Ok(body.get("route").cloned().unwrap_or(body))
    }
    pub fn verifyFeed(
        &self,
        feed: &Value,
        expected: Option<&str>,
        now: Option<u64>,
    ) -> Result<FeedVerification, NexaSdkError> {
        verifyFeed(feed, expected, now)
    }
    pub fn requestPermitMessage(&self, r: &Value) -> Result<String, NexaSdkError> {
        requestPermitMessage(r)
    }
    pub fn requestPermit(&self, r: &Value, sig: &str) -> Result<Value, NexaSdkError> {
        if alloy_primitives::hex::decode(sig.trim_start_matches("0x"))
            .map(|v| v.len() != 65)
            .unwrap_or(true)
        {
            return Err(NexaSdkError::new("NEXA_SDK_PERMIT_REQUEST_INVALID"));
        }
        let d = self.discover()?;
        let n = normalized_request(r)?;
        let mut body = n.as_object().unwrap().clone();
        body.insert("requestSignature".into(), Value::String(sig.into()));
        self.post(
            d["endpoints"]["executionPermits"].as_str().unwrap(),
            &Value::Object(body),
            n["idempotencyKey"].as_str(),
        )
    }
    fn rpc(&self, url: &str, call: Value) -> Result<String, NexaSdkError> {
        let body = self.post(
            url,
            &json!({"jsonrpc":"2.0","id":1,"method":"eth_call",
            "params":[call,"latest"]}),
            None,
        )?;
        body["result"]
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| NexaSdkError::with("NEXA_SDK_RPC_ERROR", body))
    }
    pub fn resolveExecution(&self, rpc: &str, payload: &str) -> Result<Value, NexaSdkError> {
        let payload = Bytes::from(
            alloy_primitives::hex::decode(payload.trim_start_matches("0x"))
                .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?,
        );
        let data = resolveExecutionCall { payload }.abi_encode();
        let raw = self.rpc(
            rpc,
            json!({"to":DEFAULT_RESOLVER,
            "data":format!("0x{}",alloy_primitives::hex::encode(data))}),
        )?;
        let bytes = alloy_primitives::hex::decode(raw.trim_start_matches("0x"))
            .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?;
        let decoded = resolveExecutionCall::abi_decode_returns(&bytes).map_err(|e| {
            NexaSdkError::with("NEXA_SDK_ABI_ERROR", json!({"cause":e.to_string()}))
        })?;
        let x = decoded;
        Ok(
            json!({"resolver":DEFAULT_RESOLVER,"routeId":format!("{:#x}",x.routeId),
            "quoteId":format!("{:#x}",x.quoteId),"target":x.target.to_checksum(None),
            "value":x.value.to_string(),"callData":format!("0x{}",alloy_primitives::hex::encode(x.callData)),
            "rawReturnData":raw}),
        )
    }
    pub fn buildExecutionTx(&self, envelope: &Value) -> Result<Value, NexaSdkError> {
        let row = if envelope.pointer("/permit/permit").is_some() {
            &envelope["permit"]
        } else {
            envelope
        };
        let p = &row["permit"];
        let signature = Bytes::from(
            alloy_primitives::hex::decode(
                row["permitSignature"]
                    .as_str()
                    .unwrap_or("")
                    .trim_start_matches("0x"),
            )
            .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?,
        );
        let data = fillDirectCall {
            permit: permit(p)?,
            signature,
        }
        .abi_encode();
        Ok(json!({"chainId":u64v(p,"sourceChainId")?,
            "from":a(p,"payer")?.to_checksum(None),
            "to":row.pointer("/execution/target").and_then(Value::as_str)
                .unwrap_or(p["sourceRouter"].as_str().unwrap()),
            "data":format!("0x{}",alloy_primitives::hex::encode(data)),
            "value":if a(p,"sourceAsset")?==Address::ZERO{p["amountInRaw"].clone()}else{json!("0")}}))
    }
    pub fn previewExecution(&self, rpc: &str, envelope: &Value) -> Result<Value, NexaSdkError> {
        let row = if envelope.pointer("/permit/permit").is_some() {
            &envelope["permit"]
        } else {
            envelope
        };
        let p = &row["permit"];
        let signature = Bytes::from(
            alloy_primitives::hex::decode(
                row["permitSignature"]
                    .as_str()
                    .unwrap_or("")
                    .trim_start_matches("0x"),
            )
            .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?,
        );
        let data = previewFillDirectCall {
            permit: permit(p)?,
            signature,
        }
        .abi_encode();
        let raw = self.rpc(
            rpc,
            json!({"to":p["sourceRouter"],"from":p["payer"],
            "data":format!("0x{}",alloy_primitives::hex::encode(data))}),
        )?;
        let bytes = alloy_primitives::hex::decode(raw.trim_start_matches("0x"))
            .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?;
        let d = previewFillDirectCall::abi_decode_returns(&bytes)
            .map_err(|_| NexaSdkError::new("NEXA_SDK_ABI_ERROR"))?;
        Ok(json!({"valid":d.valid,"reason":format!("{:#x}",d.reason),"rawReturnData":raw}))
    }
    pub fn getFillStatus(&self, fill_id: &str) -> Result<Value, NexaSdkError> {
        let d = self.discover()?;
        let url = d["endpoints"]["permitStatusTemplate"]
            .as_str()
            .unwrap()
            .replace("{fillId}", &bytes32(fill_id)?);
        let body = self.get(&url)?;
        Ok(body.get("permit").cloned().unwrap_or(body))
    }
}
