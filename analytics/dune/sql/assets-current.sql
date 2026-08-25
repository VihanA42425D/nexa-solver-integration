WITH registrations AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, asset_key ORDER BY block_number DESC, event_index DESC) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'AssetRegisteredV6'
), statuses AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, asset_key ORDER BY block_number DESC, event_index DESC) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'AssetStatusChangedV6'
)
SELECT r.chain_id, r.chain_name, r.asset_key, r.network_id, r.asset_id,
  r.local_address, r.has_local_binding, r.metadata_hash,
  s.previous_status, s.status, s.generation,
  s.block_time AS status_block_time, s.block_number AS status_block_number,
  s.tx_hash AS status_tx_hash, s.event_index AS status_event_index
FROM registrations r LEFT JOIN statuses s ON s.chain_id = r.chain_id AND s.asset_key = r.asset_key AND s.rn = 1
WHERE r.rn = 1 ORDER BY r.chain_id, r.asset_key
