WITH history AS (
  SELECT *,
    row_number() OVER (PARTITION BY chain_id ORDER BY block_number DESC, event_index DESC) AS rn,
    count(*) OVER (PARTITION BY chain_id) AS history_event_count,
    min(block_time) OVER (PARTITION BY chain_id) AS first_configured_at
  FROM dune.nexav6.result_nexa_v6_events_canonical WHERE event_name = 'SourceIntakeConfigured'
)
SELECT chain_id, chain_name, source_intake_enabled, actor,
  block_time AS latest_configured_at, first_configured_at, history_event_count,
  block_number, tx_hash, event_index, event_id
FROM history WHERE rn = 1 ORDER BY chain_id
