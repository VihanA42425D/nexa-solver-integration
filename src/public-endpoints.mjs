export const PUBLIC_BASE_URL = "https://solver.vsnexa.com";

export const PUBLIC_PATHS = Object.freeze({
  manifest: "/.well-known/nexa-solver.json",
  solverDiscovery: "/api/v6/solver-discovery",
  solverFeed: "/api/v6/solver-feed",
  solverFeedEvents: "/api/v6/solver-feed/events",
  routeDetailTemplate: "/api/v6/routes/{routeId}",
  permitRequestMessage: "/api/v6/execution-permits/request-message",
  executionPermits: "/api/v6/execution-permits",
  permitStatusTemplate: "/api/v6/execution-permits/{fillId}",
});

export const PUBLIC_ENDPOINTS = Object.freeze({
  manifest: PUBLIC_BASE_URL + PUBLIC_PATHS.manifest,
  solverDiscovery: PUBLIC_BASE_URL + PUBLIC_PATHS.solverDiscovery,
  solverFeed: PUBLIC_BASE_URL + PUBLIC_PATHS.solverFeed,
  solverFeedEvents: PUBLIC_BASE_URL + PUBLIC_PATHS.solverFeedEvents,
  routeDetailTemplate: PUBLIC_BASE_URL + PUBLIC_PATHS.routeDetailTemplate,
  permitRequestMessage: PUBLIC_BASE_URL + PUBLIC_PATHS.permitRequestMessage,
  executionPermits: PUBLIC_BASE_URL + PUBLIC_PATHS.executionPermits,
  permitStatusTemplate: PUBLIC_BASE_URL + PUBLIC_PATHS.permitStatusTemplate,
});

const exactDynamicPaths = new Set([
  PUBLIC_PATHS.solverDiscovery,
  PUBLIC_PATHS.solverFeed,
  PUBLIC_PATHS.solverFeedEvents,
  PUBLIC_PATHS.permitRequestMessage,
  PUBLIC_PATHS.executionPermits,
]);

const bytes32Path = "0x[0-9a-fA-F]{64}";
const routeDetailPattern = new RegExp(`^/api/v6/routes/${bytes32Path}$`);
const permitStatusPattern = new RegExp(`^/api/v6/execution-permits/${bytes32Path}$`);

export function isDynamicApiPath(pathname) {
  return exactDynamicPaths.has(pathname)
    || routeDetailPattern.test(pathname)
    || permitStatusPattern.test(pathname);
}

export function allowedMethodsForPath(pathname) {
  if (pathname === PUBLIC_PATHS.manifest) return new Set(["GET", "HEAD"]);
  if (!isDynamicApiPath(pathname)) return new Set();
  if (pathname === PUBLIC_PATHS.permitRequestMessage || pathname === PUBLIC_PATHS.executionPermits) {
    return new Set(["POST", "OPTIONS"]);
  }
  return new Set(["GET", "OPTIONS"]);
}
