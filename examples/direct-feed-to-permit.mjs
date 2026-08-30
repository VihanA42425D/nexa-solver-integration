import { Wallet } from "ethers";
import { verifyV6RouteFeed } from "../src/feed-verification.mjs";

const baseUrl = process.env.NEXA_SOLVER_BASE_URL ?? "https://solver.vsnexa.com";
const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const readJson = async (path, init) => {
  const response = await fetch(new URL(path, baseUrl), init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.error ?? response.statusText}`);
  return body;
};

const wallet = new Wallet(required("NEXA_PRIVATE_KEY"));
const discovery = await readJson("/.well-known/nexa-solver.json");
const { feed } = await readJson("/api/v6/solver-feed");
verifyV6RouteFeed(feed, { expectedSigner: discovery.feedSigner, required: true });

const signedRoutes = new Map(feed.signedPayload.routes.map((route) => [
  `${route.routeId.toLowerCase()}:${route.quoteId.toLowerCase()}`,
  route,
]));
const ranked = (feed.actionableRoutes ?? []).map((item) => signedRoutes.get(
  `${item.routeId.toLowerCase()}:${item.quoteId.toLowerCase()}`,
)).filter(Boolean);
const selected = ranked[0] ?? feed.signedPayload.routes.find((route) => (
  route.executionStatus === "OPEN" && route.permitAvailable === true
));
if (!selected) throw new Error("No verified permit-eligible route is currently available");

const idempotencyKey = process.env.NEXA_IDEMPOTENCY_KEY ?? `solver-${Date.now()}`;
const request = {
  quoteId: selected.quoteId,
  requestedAmountInRaw: process.env.NEXA_REQUESTED_AMOUNT_IN_RAW
    ?? selected.minimumFillInRaw,
  standard: process.env.NEXA_STANDARD ?? "DIRECT",
  payer: wallet.address,
  recipient: process.env.NEXA_RECIPIENT ?? wallet.address,
  idempotencyKey,
};
const headers = {
  "content-type": "application/json",
  "idempotency-key": idempotencyKey,
  "x-nexa-sdk": "typescript/1.0.1",
};
const message = await readJson("/api/v6/execution-permits/request-message", {
  method: "POST", headers, body: JSON.stringify(request),
});
const requestSignature = await wallet.signMessage(message.message);
const permit = await readJson("/api/v6/execution-permits", {
  method: "POST", headers, body: JSON.stringify({ ...request, requestSignature }),
});

console.log(JSON.stringify({
  routeId: selected.routeId,
  quoteId: selected.quoteId,
  fillId: permit.permit?.fillId,
  state: permit.permit?.state,
  totalTransactionCount: permit.totalTransactionCount,
  next: "Resolve, preview, or build the source transaction, then track Fill status by fillId.",
}, null, 2));
