export const PUBLIC_BASE_URL = "https://solver.vsnexa.com";

export const PUBLIC_PATHS = Object.freeze({
  manifest: "/.well-known/nexa-solver.json",
  solverDiscovery: "/api/v5/solver-discovery",
  solverFeed: "/api/v5/solver-feed",
  solverFeedEvents: "/api/v5/solver-feed/events",
  solverFeedStatus: "/api/v5/solver-feed/status",
});

export const PUBLIC_ENDPOINTS = Object.freeze(Object.fromEntries(
  Object.entries(PUBLIC_PATHS).map(([name, path]) => [
    name,
    new URL(path, PUBLIC_BASE_URL).href,
  ]),
));

export const DYNAMIC_API_PATHS = Object.freeze([
  PUBLIC_PATHS.solverDiscovery,
  PUBLIC_PATHS.solverFeed,
  PUBLIC_PATHS.solverFeedEvents,
  PUBLIC_PATHS.solverFeedStatus,
]);
