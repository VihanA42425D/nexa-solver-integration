SELECT event_id, chain_id, chain_name, contract_role, contract_address, event_name,
  block_time, block_number, tx_hash, event_index,
  coalesce(network_id, asset_key, route_id, standard_id, fill_id) AS primary_entity_id,
  status, generation, actor
FROM dune.nexav6.result_nexa_v6_events_canonical
ORDER BY block_time DESC, block_number DESC, event_index DESC
LIMIT 500
