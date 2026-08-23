use nexa_v6_sdk::{canonicalJson, computeFeedHash, requestPermitMessage, verifyFeed, NexaV6Client};
use serde_json::{json, Value};

fn vectors() -> Value {
    serde_json::from_str(include_str!("../../../sdk-spec/test-vectors.json")).unwrap()
}

#[test]
fn canonical_feed_matches_vectors() {
    let v = vectors();
    assert_eq!(
        canonicalJson(&v["canonicalJson"]["input"]),
        v["canonicalJson"]["expected"]
    );
    assert_eq!(
        computeFeedHash(&v["feed"]["signedPayload"]),
        v["feed"]["feedHash"]
    );
    let feed = json!({
        "signedPayload":v["feed"]["signedPayload"],
        "feedHash":v["feed"]["feedHash"],
        "feedSigner":v["feed"]["feedSigner"],
        "feedSignature":v["feed"]["feedSignature"]
    });
    let r = verifyFeed(
        &feed,
        v["feed"]["feedSigner"].as_str(),
        v["feed"]["nowSeconds"].as_u64(),
    )
    .unwrap();
    assert!(r.valid);
    assert_eq!(
        r.recovered_signer.as_deref(),
        v["feed"]["feedSigner"].as_str()
    );
}

#[test]
fn permit_and_calldata_match_vectors() {
    let v = vectors();
    assert_eq!(
        requestPermitMessage(&v["permitRequest"]["request"]).unwrap(),
        v["permitRequest"]["expectedMessage"]
    );
    let tx = NexaV6Client::default()
        .buildExecutionTx(&json!({
            "permit":v["abi"]["permit"],
            "permitSignature":v["abi"]["permitSignature"],
            "execution":{"target":v["abi"]["executionTarget"]}
        }))
        .unwrap();
    assert_eq!(tx["data"], v["abi"]["fillDirectCallData"]);
    assert_eq!(tx["value"], v["abi"]["expectedTransactionValue"]);
}

#[test]
fn frozen_operations_are_callable() {
    let c = NexaV6Client::default();
    let _ = c.verifyFeed(&json!({}), None, None).err();
    let _ = c.requestPermitMessage(&json!({})).err();
    let _ = NexaV6Client::discover;
    let _ = NexaV6Client::getRoutes;
    let _ = NexaV6Client::getRoute;
    let _ = NexaV6Client::requestPermit;
    let _ = NexaV6Client::resolveExecution;
    let _ = NexaV6Client::previewExecution;
    let _ = NexaV6Client::buildExecutionTx;
    let _ = NexaV6Client::getFillStatus;
}
