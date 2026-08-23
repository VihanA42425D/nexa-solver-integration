mod generated;
pub mod pb;

use ethabi::{ethereum_types::U256, ParamType, Token};
use generated::*;
use pb::nexa_v6_event::Event as EventKind;
use pb::*;
use std::collections::HashMap;
use substreams::errors::Error;
use substreams::store::{StoreNew, StoreSet, StoreSetProto};
use substreams_ethereum::pb::eth::v2::Block;

substreams_ethereum::init!();

#[derive(Clone, Debug, PartialEq)]
pub struct DecoderConfig {
    pub chain_id: u64,
    pub registry: Vec<u8>,
    pub router: Vec<u8>,
    pub standard_module_registry: Vec<u8>,
    pub erc7683_standard_id: Vec<u8>,
    pub oif_standard_id: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RawLog {
    pub address: Vec<u8>,
    pub topics: Vec<Vec<u8>>,
    pub data: Vec<u8>,
    pub provenance: Provenance,
}

fn decode_hex(value: &str, bytes: usize, field: &str) -> Result<Vec<u8>, String> {
    let raw = value.strip_prefix("0x").unwrap_or(value);
    let decoded = hex::decode(raw).map_err(|error| format!("invalid {field}: {error}"))?;
    if decoded.len() != bytes {
        return Err(format!(
            "invalid {field} length: expected {bytes}, got {}",
            decoded.len()
        ));
    }
    Ok(decoded)
}

impl DecoderConfig {
    pub fn parse(value: &str) -> Result<Self, String> {
        let params: HashMap<&str, &str> = value
            .split('&')
            .map(|pair| {
                pair.split_once('=')
                    .ok_or_else(|| format!("invalid parameter: {pair}"))
            })
            .collect::<Result<_, _>>()?;
        let required = |name: &str| {
            params
                .get(name)
                .copied()
                .ok_or_else(|| format!("missing parameter: {name}"))
        };
        Ok(Self {
            chain_id: required("chain_id")?
                .parse::<u64>()
                .map_err(|error| format!("invalid chain_id: {error}"))?,
            registry: decode_hex(required("registry")?, 20, "registry")?,
            router: decode_hex(required("router")?, 20, "router")?,
            standard_module_registry: decode_hex(
                required("standard_module_registry")?,
                20,
                "standard_module_registry",
            )?,
            erc7683_standard_id: decode_hex(
                required("erc7683_standard_id")?,
                32,
                "erc7683_standard_id",
            )?,
            oif_standard_id: decode_hex(required("oif_standard_id")?, 32, "oif_standard_id")?,
        })
    }
}

fn topic<'a>(log: &'a RawLog, index: usize) -> Result<&'a [u8], String> {
    let value = log
        .topics
        .get(index)
        .ok_or_else(|| format!("missing topic {index}"))?;
    if value.len() != 32 {
        return Err(format!("invalid topic {index} length"));
    }
    Ok(value)
}

fn topic_bytes(log: &RawLog, index: usize) -> Result<Vec<u8>, String> {
    Ok(topic(log, index)?.to_vec())
}

fn topic_address(log: &RawLog, index: usize) -> Result<Vec<u8>, String> {
    Ok(topic(log, index)?[12..].to_vec())
}

fn decode_data(types: &[ParamType], data: &[u8]) -> Result<Vec<Token>, String> {
    ethabi::decode(types, data).map_err(|error| format!("event data decode failed: {error}"))
}

fn fixed_bytes(token: &Token, field: &str) -> Result<Vec<u8>, String> {
    token
        .clone()
        .into_fixed_bytes()
        .ok_or_else(|| format!("invalid bytes field: {field}"))
}

fn token_address(token: &Token, field: &str) -> Result<Vec<u8>, String> {
    token
        .clone()
        .into_address()
        .map(|value| value.as_bytes().to_vec())
        .ok_or_else(|| format!("invalid address field: {field}"))
}

fn token_bool(token: &Token, field: &str) -> Result<bool, String> {
    token
        .clone()
        .into_bool()
        .ok_or_else(|| format!("invalid bool field: {field}"))
}

fn token_uint(token: &Token, field: &str) -> Result<U256, String> {
    token
        .clone()
        .into_uint()
        .ok_or_else(|| format!("invalid uint field: {field}"))
}

fn token_u64(token: &Token, field: &str) -> Result<u64, String> {
    let value = token_uint(token, field)?;
    if value > U256::from(u64::MAX) {
        return Err(format!("uint64 overflow: {field}"));
    }
    Ok(value.as_u64())
}

fn token_u32(token: &Token, field: &str) -> Result<u32, String> {
    let value = token_uint(token, field)?;
    if value > U256::from(u32::MAX) {
        return Err(format!("uint32 overflow: {field}"));
    }
    Ok(value.as_u32())
}

fn topic_matches(log: &RawLog, expected: &[u8; 32]) -> bool {
    log.topics
        .first()
        .map(|value| value.as_slice() == expected)
        .unwrap_or(false)
}

fn standard_kind(config: &DecoderConfig, standard_id: &[u8]) -> String {
    if standard_id == config.erc7683_standard_id {
        "ERC_7683_EXECUTABLE".into()
    } else if standard_id == config.oif_standard_id {
        "OIF_DISCOVERY_DESCRIPTION_ONLY".into()
    } else {
        "UNKNOWN".into()
    }
}

pub fn decode_log(config: &DecoderConfig, log: &RawLog) -> Result<Option<NexaV6Event>, String> {
    let event = if log.address == config.registry {
        if topic_matches(log, &NETWORK_REGISTERED_V6_TOPIC) {
            let values = decode_data(
                &[ParamType::FixedBytes(32), ParamType::FixedBytes(32)],
                &log.data,
            )?;
            EventKind::NetworkRegistered(NetworkRegistered {
                network_id: topic_bytes(log, 1)?,
                vm_type: topic_bytes(log, 2)?,
                network_reference: fixed_bytes(&values[0], "network_reference")?,
                metadata_hash: fixed_bytes(&values[1], "metadata_hash")?,
            })
        } else if topic_matches(log, &NETWORK_STATUS_CHANGED_V6_TOPIC) {
            let values = decode_data(
                &[ParamType::Uint(8), ParamType::Uint(8), ParamType::Uint(64)],
                &log.data,
            )?;
            EventKind::NetworkStatusChanged(NetworkStatusChanged {
                network_id: topic_bytes(log, 1)?,
                previous_status: token_u32(&values[0], "previous_status")?,
                status: token_u32(&values[1], "status")?,
                generation: token_u64(&values[2], "generation")?,
            })
        } else if topic_matches(log, &ASSET_REGISTERED_V6_TOPIC) {
            let values = decode_data(
                &[
                    ParamType::Address,
                    ParamType::Bool,
                    ParamType::FixedBytes(32),
                ],
                &log.data,
            )?;
            EventKind::AssetRegistered(AssetRegistered {
                asset_key: topic_bytes(log, 1)?,
                network_id: topic_bytes(log, 2)?,
                asset_id: topic_bytes(log, 3)?,
                local_address: token_address(&values[0], "local_address")?,
                has_local_binding: token_bool(&values[1], "has_local_binding")?,
                metadata_hash: fixed_bytes(&values[2], "metadata_hash")?,
            })
        } else if topic_matches(log, &ASSET_STATUS_CHANGED_V6_TOPIC) {
            let values = decode_data(
                &[ParamType::Uint(8), ParamType::Uint(8), ParamType::Uint(64)],
                &log.data,
            )?;
            EventKind::AssetStatusChanged(AssetStatusChanged {
                asset_key: topic_bytes(log, 1)?,
                previous_status: token_u32(&values[0], "previous_status")?,
                status: token_u32(&values[1], "status")?,
                generation: token_u64(&values[2], "generation")?,
            })
        } else if topic_matches(log, &ROUTE_REGISTERED_V6_TOPIC) {
            let values = decode_data(
                &[ParamType::FixedBytes(32), ParamType::FixedBytes(32)],
                &log.data,
            )?;
            EventKind::RouteRegistered(RouteRegistered {
                route_id: topic_bytes(log, 1)?,
                source_network_id: topic_bytes(log, 2)?,
                destination_network_id: topic_bytes(log, 3)?,
                source_asset_id: fixed_bytes(&values[0], "source_asset_id")?,
                destination_asset_id: fixed_bytes(&values[1], "destination_asset_id")?,
            })
        } else if topic_matches(log, &ROUTE_STATUS_CHANGED_V6_TOPIC) {
            let values = decode_data(
                &[ParamType::Uint(8), ParamType::Uint(8), ParamType::Uint(64)],
                &log.data,
            )?;
            EventKind::RouteStatusChanged(RouteStatusChanged {
                route_id: topic_bytes(log, 1)?,
                actor: topic_address(log, 2)?,
                previous_status: token_u32(&values[0], "previous_status")?,
                status: token_u32(&values[1], "status")?,
                generation: token_u64(&values[2], "generation")?,
            })
        } else {
            return Ok(None);
        }
    } else if log.address == config.router {
        if topic_matches(log, &SOURCE_INTAKE_CONFIGURED_TOPIC) {
            let values = decode_data(&[ParamType::Bool], &log.data)?;
            EventKind::SourceIntakeChanged(SourceIntakeChanged {
                enabled: token_bool(&values[0], "enabled")?,
                actor: topic_address(log, 1)?,
            })
        } else if topic_matches(log, &SOURCE_FILL_V6_TOPIC) {
            let values = decode_data(
                &[
                    ParamType::Address,
                    ParamType::Address,
                    ParamType::Address,
                    ParamType::Address,
                    ParamType::Uint(256),
                    ParamType::Uint(128),
                    ParamType::Uint(128),
                    ParamType::Uint(32),
                    ParamType::Uint(64),
                    ParamType::FixedBytes(32),
                    ParamType::FixedBytes(32),
                ],
                &log.data,
            )?;
            EventKind::SourceFill(SourceFill {
                fill_id: topic_bytes(log, 1)?,
                route_id: topic_bytes(log, 2)?,
                quote_id: topic_bytes(log, 3)?,
                payer: token_address(&values[0], "payer")?,
                recipient: token_address(&values[1], "recipient")?,
                source_asset: token_address(&values[2], "source_asset")?,
                destination_asset: token_address(&values[3], "destination_asset")?,
                destination_chain_id: token_uint(&values[4], "destination_chain_id")?.to_string(),
                amount_in_raw: token_uint(&values[5], "amount_in_raw")?.to_string(),
                amount_out_raw: token_uint(&values[6], "amount_out_raw")?.to_string(),
                source_finality_blocks: token_u32(&values[7], "source_finality_blocks")?,
                settlement_deadline: token_u64(&values[8], "settlement_deadline")?,
                permit_nonce: fixed_bytes(&values[9], "permit_nonce")?,
                execution_generation: fixed_bytes(&values[10], "execution_generation")?,
            })
        } else {
            return Ok(None);
        }
    } else if log.address == config.standard_module_registry {
        if !topic_matches(log, &STANDARD_MODULE_CONFIGURED_V6_TOPIC) {
            return Ok(None);
        }
        let standard_id = topic_bytes(log, 1)?;
        let module = topic_address(log, 3)?;
        EventKind::StandardModuleChanged(StandardModuleChanged {
            standard_kind: standard_kind(config, &standard_id),
            standard_id,
            previous_module: topic_address(log, 2)?,
            enabled: module.iter().any(|byte| *byte != 0),
            module,
        })
    } else {
        return Ok(None);
    };
    Ok(Some(NexaV6Event {
        provenance: Some(log.provenance.clone()),
        event: Some(event),
    }))
}

#[substreams::handlers::map]
pub fn map_nexa_v6_events(params: String, block: Block) -> Result<NexaV6Events, Error> {
    let config = DecoderConfig::parse(&params).map_err(Error::msg)?;
    let timestamp = block.timestamp_seconds();
    let mut events = Vec::new();
    for view in block.logs() {
        let raw = RawLog {
            address: view.log.address.clone(),
            topics: view.log.topics.clone(),
            data: view.log.data.clone(),
            provenance: Provenance {
                chain_id: config.chain_id,
                block_number: block.number,
                block_timestamp: timestamp,
                transaction_hash: view.receipt.transaction.hash.clone(),
                log_index: view.log.block_index,
                contract_address: view.log.address.clone(),
                ordinal: view.log.ordinal,
            },
        };
        if let Some(event) = decode_log(&config, &raw).map_err(Error::msg)? {
            events.push(event);
        }
    }
    Ok(NexaV6Events { events })
}

fn key(chain_id: u64, value: &[u8], suffix: &str) -> String {
    format!("{}:0x{}:{}", chain_id, hex::encode(value), suffix)
}

#[substreams::handlers::store]
pub fn store_networks(events: NexaV6Events, store: StoreSetProto<NetworkState>) {
    for event in events.events {
        let provenance = event.provenance.unwrap_or_default();
        match event.event {
            Some(EventKind::NetworkRegistered(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.network_id, "identity"),
                &NetworkState {
                    provenance: Some(provenance),
                    network_id: value.network_id,
                    vm_type: value.vm_type,
                    network_reference: value.network_reference,
                    metadata_hash: value.metadata_hash,
                    status: 1,
                    generation: 1,
                },
            ),
            Some(EventKind::NetworkStatusChanged(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.network_id, "status"),
                &NetworkState {
                    provenance: Some(provenance),
                    network_id: value.network_id,
                    status: value.status,
                    generation: value.generation,
                    ..Default::default()
                },
            ),
            _ => {}
        }
    }
}

#[substreams::handlers::store]
pub fn store_assets(events: NexaV6Events, store: StoreSetProto<AssetState>) {
    for event in events.events {
        let provenance = event.provenance.unwrap_or_default();
        match event.event {
            Some(EventKind::AssetRegistered(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.asset_key, "identity"),
                &AssetState {
                    provenance: Some(provenance),
                    asset_key: value.asset_key,
                    network_id: value.network_id,
                    asset_id: value.asset_id,
                    local_address: value.local_address,
                    has_local_binding: value.has_local_binding,
                    metadata_hash: value.metadata_hash,
                    status: 1,
                    generation: 1,
                },
            ),
            Some(EventKind::AssetStatusChanged(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.asset_key, "status"),
                &AssetState {
                    provenance: Some(provenance),
                    asset_key: value.asset_key,
                    status: value.status,
                    generation: value.generation,
                    ..Default::default()
                },
            ),
            _ => {}
        }
    }
}

#[substreams::handlers::store]
pub fn store_routes(events: NexaV6Events, store: StoreSetProto<RouteState>) {
    for event in events.events {
        let provenance = event.provenance.unwrap_or_default();
        match event.event {
            Some(EventKind::RouteRegistered(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.route_id, "identity"),
                &RouteState {
                    provenance: Some(provenance),
                    route_id: value.route_id,
                    source_network_id: value.source_network_id,
                    source_asset_id: value.source_asset_id,
                    destination_network_id: value.destination_network_id,
                    destination_asset_id: value.destination_asset_id,
                    status: 1,
                    generation: 1,
                },
            ),
            Some(EventKind::RouteStatusChanged(value)) => store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.route_id, "status"),
                &RouteState {
                    provenance: Some(provenance),
                    route_id: value.route_id,
                    status: value.status,
                    generation: value.generation,
                    ..Default::default()
                },
            ),
            _ => {}
        }
    }
}

#[substreams::handlers::store]
pub fn store_router_state(events: NexaV6Events, store: StoreSetProto<RouterState>) {
    for event in events.events {
        let provenance = event.provenance.unwrap_or_default();
        if let Some(EventKind::SourceIntakeChanged(value)) = event.event {
            store.set(
                provenance.ordinal,
                key(provenance.chain_id, &provenance.contract_address, "intake"),
                &RouterState {
                    provenance: Some(provenance.clone()),
                    router: provenance.contract_address,
                    source_intake_enabled: value.enabled,
                    actor: value.actor,
                },
            );
        }
    }
}

#[substreams::handlers::store]
pub fn store_standard_modules(events: NexaV6Events, store: StoreSetProto<StandardModuleState>) {
    for event in events.events {
        let provenance = event.provenance.unwrap_or_default();
        if let Some(EventKind::StandardModuleChanged(value)) = event.event {
            store.set(
                provenance.ordinal,
                key(provenance.chain_id, &value.standard_id, "module"),
                &StandardModuleState {
                    provenance: Some(provenance),
                    standard_id: value.standard_id,
                    module: value.module,
                    enabled: value.enabled,
                    standard_kind: value.standard_kind,
                },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use serde_json::{json, Map, Value};

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureSet {
        fixtures: Vec<Fixture>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Fixture {
        fixture_id: String,
        event_name: String,
        address: String,
        topics: Vec<String>,
        data: String,
        provenance: FixtureProvenance,
        expected_normalized: Map<String, Value>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureProvenance {
        chain_id: String,
        block_number: String,
        block_timestamp: String,
        transaction_hash: String,
        log_index: u32,
    }

    fn hex_value(value: &[u8]) -> Value {
        json!(format!("0x{}", hex::encode(value)))
    }
    fn normalized(event: &NexaV6Event) -> Map<String, Value> {
        let mut output = Map::new();
        match event.event.as_ref().unwrap() {
            EventKind::NetworkRegistered(v) => {
                output.insert("networkId".into(), hex_value(&v.network_id));
                output.insert("vmType".into(), hex_value(&v.vm_type));
                output.insert("networkReference".into(), hex_value(&v.network_reference));
                output.insert("metadataHash".into(), hex_value(&v.metadata_hash));
            }
            EventKind::NetworkStatusChanged(v) => {
                output.insert("networkId".into(), hex_value(&v.network_id));
                output.insert(
                    "previousStatus".into(),
                    json!(v.previous_status.to_string()),
                );
                output.insert("status".into(), json!(v.status.to_string()));
                output.insert("generation".into(), json!(v.generation.to_string()));
            }
            EventKind::AssetRegistered(v) => {
                output.insert("assetKey".into(), hex_value(&v.asset_key));
                output.insert("networkId".into(), hex_value(&v.network_id));
                output.insert("assetId".into(), hex_value(&v.asset_id));
                output.insert("localAddress".into(), hex_value(&v.local_address));
                output.insert("hasLocalBinding".into(), json!(v.has_local_binding));
                output.insert("metadataHash".into(), hex_value(&v.metadata_hash));
            }
            EventKind::AssetStatusChanged(v) => {
                output.insert("assetKey".into(), hex_value(&v.asset_key));
                output.insert(
                    "previousStatus".into(),
                    json!(v.previous_status.to_string()),
                );
                output.insert("status".into(), json!(v.status.to_string()));
                output.insert("generation".into(), json!(v.generation.to_string()));
            }
            EventKind::RouteRegistered(v) => {
                output.insert("routeId".into(), hex_value(&v.route_id));
                output.insert("sourceNetworkId".into(), hex_value(&v.source_network_id));
                output.insert(
                    "destinationNetworkId".into(),
                    hex_value(&v.destination_network_id),
                );
                output.insert("sourceAssetId".into(), hex_value(&v.source_asset_id));
                output.insert(
                    "destinationAssetId".into(),
                    hex_value(&v.destination_asset_id),
                );
            }
            EventKind::RouteStatusChanged(v) => {
                output.insert("routeId".into(), hex_value(&v.route_id));
                output.insert(
                    "previousStatus".into(),
                    json!(v.previous_status.to_string()),
                );
                output.insert("status".into(), json!(v.status.to_string()));
                output.insert("actor".into(), hex_value(&v.actor));
                output.insert("generation".into(), json!(v.generation.to_string()));
            }
            EventKind::SourceIntakeChanged(v) => {
                output.insert("enabled".into(), json!(v.enabled));
                output.insert("actor".into(), hex_value(&v.actor));
            }
            EventKind::SourceFill(v) => {
                output.insert("fillId".into(), hex_value(&v.fill_id));
                output.insert("routeId".into(), hex_value(&v.route_id));
                output.insert("quoteId".into(), hex_value(&v.quote_id));
                output.insert("payer".into(), hex_value(&v.payer));
                output.insert("recipient".into(), hex_value(&v.recipient));
                output.insert("sourceAsset".into(), hex_value(&v.source_asset));
                output.insert("destinationAsset".into(), hex_value(&v.destination_asset));
                output.insert("destinationChainId".into(), json!(v.destination_chain_id));
                output.insert("amountInRaw".into(), json!(v.amount_in_raw));
                output.insert("amountOutRaw".into(), json!(v.amount_out_raw));
                output.insert(
                    "sourceFinalityBlocks".into(),
                    json!(v.source_finality_blocks.to_string()),
                );
                output.insert(
                    "settlementDeadline".into(),
                    json!(v.settlement_deadline.to_string()),
                );
                output.insert("permitNonce".into(), hex_value(&v.permit_nonce));
                output.insert(
                    "executionGeneration".into(),
                    hex_value(&v.execution_generation),
                );
            }
            EventKind::StandardModuleChanged(v) => {
                output.insert("standardId".into(), hex_value(&v.standard_id));
                output.insert("previousModule".into(), hex_value(&v.previous_module));
                output.insert("module".into(), hex_value(&v.module));
                output.insert("standardKind".into(), json!(v.standard_kind));
            }
        }
        output
    }

    fn raw(fixture: &Fixture) -> RawLog {
        RawLog {
            address: decode_hex(&fixture.address, 20, "fixture address").unwrap(),
            topics: fixture
                .topics
                .iter()
                .map(|value| decode_hex(value, 32, "fixture topic").unwrap())
                .collect(),
            data: decode_hex(
                &fixture.data,
                fixture.data.strip_prefix("0x").unwrap().len() / 2,
                "fixture data",
            )
            .unwrap(),
            provenance: Provenance {
                chain_id: fixture.provenance.chain_id.parse().unwrap(),
                block_number: fixture.provenance.block_number.parse().unwrap(),
                block_timestamp: fixture.provenance.block_timestamp.parse().unwrap(),
                transaction_hash: decode_hex(
                    &fixture.provenance.transaction_hash,
                    32,
                    "fixture tx",
                )
                .unwrap(),
                log_index: fixture.provenance.log_index,
                contract_address: decode_hex(&fixture.address, 20, "fixture address").unwrap(),
                ordinal: fixture.provenance.log_index as u64 + 1,
            },
        }
    }

    fn fixtures_and_config() -> (FixtureSet, DecoderConfig) {
        let fixtures: FixtureSet =
            serde_json::from_str(include_str!("../../fixtures/nexa-v6-events.json")).unwrap();
        let address_for = |name: &str| {
            fixtures
                .fixtures
                .iter()
                .find(|fixture| fixture.event_name == name)
                .unwrap()
                .address
                .as_str()
        };
        let standard_ids: Vec<String> = fixtures
            .fixtures
            .iter()
            .filter(|fixture| fixture.event_name == "StandardModuleConfiguredV6")
            .map(|fixture| {
                fixture.expected_normalized["standardId"]
                    .as_str()
                    .unwrap()
                    .to_owned()
            })
            .collect();
        let params = format!("chain_id=8453&registry={}&router={}&standard_module_registry={}&erc7683_standard_id={}&oif_standard_id={}",
            address_for("NetworkRegisteredV6"), address_for("SourceFillV6"), address_for("StandardModuleConfiguredV6"), standard_ids[0], standard_ids[1]);
        let config = DecoderConfig::parse(&params).unwrap();
        (fixtures, config)
    }

    #[test]
    fn canonical_fixture_set_decodes_once_to_the_shared_semantic_model() {
        let (fixtures, config) = fixtures_and_config();
        for fixture in fixtures.fixtures {
            let event = decode_log(&config, &raw(&fixture))
                .unwrap()
                .expect(&fixture.fixture_id);
            let provenance = event.provenance.as_ref().unwrap();
            assert_eq!(provenance.chain_id.to_string(), fixture.provenance.chain_id);
            assert_eq!(
                provenance.block_number.to_string(),
                fixture.provenance.block_number
            );
            assert_eq!(
                provenance.block_timestamp.to_string(),
                fixture.provenance.block_timestamp
            );
            assert_eq!(
                format!("0x{}", hex::encode(&provenance.transaction_hash)),
                fixture.provenance.transaction_hash
            );
            assert_eq!(provenance.log_index, fixture.provenance.log_index);
            assert_eq!(
                normalized(&event),
                fixture.expected_normalized,
                "{}",
                fixture.fixture_id
            );
        }
    }

    #[test]
    fn route_status_generation_and_source_fill_fields_are_lossless() {
        let (fixtures, config) = fixtures_and_config();
        let mut status = 0;
        let mut generation = 0;
        let mut saw_fill = false;
        for fixture in fixtures.fixtures {
            let event = decode_log(&config, &raw(&fixture)).unwrap().unwrap();
            match event.event.unwrap() {
                EventKind::RouteStatusChanged(value) => {
                    status = value.status;
                    generation = value.generation;
                }
                EventKind::SourceFill(value) => {
                    saw_fill = value.amount_in_raw == "1000000"
                        && value.amount_out_raw == "995000"
                        && value.destination_chain_id == "56"
                        && value.fill_id.len() == 32
                        && value.quote_id.len() == 32
                        && value.payer.len() == 20
                        && value.recipient.len() == 20;
                }
                _ => {}
            }
        }
        assert_eq!((status, generation), (2, 2));
        assert!(saw_fill);
    }
}
