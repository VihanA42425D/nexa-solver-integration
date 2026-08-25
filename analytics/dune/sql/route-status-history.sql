SELECT chain_id, chain_name, route_id, previous_status, status, generation, actor,
  block_time, block_number, tx_hash, event_index, event_id
FROM dune.nexav6.result_nexa_v6_events_canonical
WHERE event_name = 'RouteStatusChangedV6'
ORDER BY block_number DESC, event_index DESC
