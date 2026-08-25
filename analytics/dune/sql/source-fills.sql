SELECT chain_id, chain_name, fill_id, route_id, quote_id, payer, recipient,
  source_asset, destination_asset, destination_chain_id, amount_in_raw, amount_out_raw,
  source_finality_blocks, settlement_deadline, permit_nonce, execution_generation,
  block_time, block_number, tx_hash, event_index, event_id
FROM dune.nexav6.result_nexa_v6_events_canonical
WHERE event_name = 'SourceFillV6'
ORDER BY block_number DESC, event_index DESC
