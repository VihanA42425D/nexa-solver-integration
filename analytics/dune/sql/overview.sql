WITH current_route_status AS (
  SELECT chain_id, route_id, status,
    row_number() OVER (PARTITION BY chain_id, route_id ORDER BY block_number DESC, event_index DESC) AS rn
  FROM dune.nexav6.result_nexa_v6_events_canonical
  WHERE event_name = 'RouteStatusChangedV6'
), route_state_counts AS (
  SELECT chain_id, status, count(*) AS route_count
  FROM current_route_status WHERE rn = 1 GROUP BY 1, 2
), route_state_summary AS (
  SELECT chain_id,
    array_join(array_agg(concat(cast(status AS varchar), '=', cast(route_count AS varchar)) ORDER BY status), ', ') AS current_route_states
  FROM route_state_counts GROUP BY 1
)
SELECT e.chain_id, max(e.chain_name) AS chain_name,
  count(DISTINCT network_id) FILTER (WHERE event_name = 'NetworkRegisteredV6') AS registered_networks,
  count(DISTINCT asset_key) FILTER (WHERE event_name = 'AssetRegisteredV6') AS registered_assets,
  count(DISTINCT route_id) FILTER (WHERE event_name = 'RouteRegisteredV6') AS registered_routes,
  coalesce(max(s.current_route_states), '') AS current_route_states,
  count(DISTINCT standard_id) FILTER (WHERE event_name = 'StandardModuleConfiguredV6') AS configured_standard_modules,
  count(*) FILTER (WHERE event_name = 'SourceIntakeConfigured') AS source_intake_events,
  count(*) FILTER (WHERE event_name = 'SourceFillV6') AS source_fill_count,
  max(block_time) AS latest_indexed_nexa_event_time
FROM dune.nexav6.result_nexa_v6_events_canonical e LEFT JOIN route_state_summary s ON s.chain_id = e.chain_id
GROUP BY e.chain_id ORDER BY e.chain_id
