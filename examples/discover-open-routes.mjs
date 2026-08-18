import { PUBLIC_ENDPOINTS } from "../src/public-endpoints.mjs";
import { verifyV6RouteFeed } from "../src/feed-verification.mjs";

const baseUrl = process.env.NEXA_SOLVER_BASE_URL ?? "https://solver.vsnexa.com";
const sourceChainId = process.env.NEXA_SOURCE_CHAIN_ID ?? null;
const sourceNetworkId = process.env.NEXA_SOURCE_NETWORK_ID ?? null;

async function readJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.error ?? response.statusText}`);
  return body;
}

const discoveryUrl = new URL(PUBLIC_ENDPOINTS.manifest);
discoveryUrl.host = new URL(baseUrl).host;
discoveryUrl.protocol = new URL(baseUrl).protocol;
const discovery = await readJson(discoveryUrl);
if (discovery.deploymentStatus !== "ACTIVE" || !discovery.feedSigner) {
  throw new Error("NEXA_V6_PUBLIC_SURFACE_NOT_ACTIVATED");
}

const feedUrl = new URL("/api/v6/solver-feed", baseUrl);
if (sourceChainId) feedUrl.searchParams.set("sourceChainId", sourceChainId);
if (sourceNetworkId) feedUrl.searchParams.set("sourceNetworkId", sourceNetworkId);
const { feed } = await readJson(feedUrl);
verifyV6RouteFeed(feed, { expectedSigner: discovery.feedSigner, required: true });

const discoverable = (feed.routes ?? []).filter((route) => route.discoveryStatus === "DISCOVERABLE");
const executable = discoverable.filter((route) => (
  route.executionStatus === "OPEN" && route.permitAvailable === true
));

console.log(JSON.stringify({
  dataVersion: feed.dataVersion,
  generatedAt: feed.generatedAt,
  validUntil: feed.validUntil,
  discoverableRouteCount: discoverable.length,
  executableRouteCount: executable.length,
  routes: executable.map((route) => ({
    routeId: route.routeId,
    quoteId: route.quoteId,
    sourceNetworkId: route.sourceNetworkId,
    sourceAssetId: route.sourceAssetId,
    destinationNetworkId: route.destinationNetworkId,
    destinationAssetId: route.destinationAssetId,
    minimumFillInRaw: route.minimumFillInRaw,
    maxAvailableInRaw: route.maxAvailableInRaw,
    pricingMode: route.pricingMode,
    validUntil: route.validUntil,
  })),
}, null, 2));
