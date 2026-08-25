WITH registrations AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'RouteRegisteredV6'
), statuses AS (
  SELECT *, row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'RouteStatusChangedV6'
)
SELECT r.chain_id, r.chain_name, r.route_id, r.source_network_id, r.destination_network_id,
  r.source_asset_id, r.destination_asset_id, s.previous_status, s.status, s.generation,
  s.actor AS status_actor, s.block_time AS status_block_time,
  s.block_number AS status_block_number, s.tx_hash AS status_tx_hash,
  s.event_index AS status_event_index
FROM registrations r LEFT JOIN statuses s ON s.chain_id = r.chain_id AND s.route_id = r.route_id AND s.rn = 1
WHERE r.rn = 1 ORDER BY r.chain_id, r.route_id
