WITH ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY chain_id, standard_id ORDER BY block_number DESC, event_index DESC
  ) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'StandardModuleConfiguredV6'
)
SELECT chain_id, chain_name, standard_id, previous_module, module,
  block_time, block_number, tx_hash, event_index, event_id
FROM ranked WHERE rn = 1 ORDER BY chain_id, standard_id
