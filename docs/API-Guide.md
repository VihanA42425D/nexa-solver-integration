# Public API Guide

Complete reference for all Nexa V6 Solver public endpoints.

## Base URL

All endpoints are served from: `https://solver.vsnexa.com`

## Static Discovery Documents

These stable documents are suitable for crawlers, indexers, and LLM context.

### 1. Solver Metadata
```
GET /.well-known/nexa-solver.json
```
Returns canonical solver metadata, contact, and basic integration info.

### 2. On-Chain Fingerprint
```
GET /.well-known/nexa-onchain-discovery.json
```
Passive fingerprint containing:
- Facade selector and CREATE2 evidence
- Registry/Router identities
- ERC-7683 Resolver address
- Sourcify v2 lookups
- Chain deployment evidence (8453, 56, 999)

**No on-chain transaction required to read.**

### 3. Standards Manifest
```
GET /.well-known/nexa-standards.json
```
Stable HTTP projection of canonical ERC-7683 and OIF metadata.

### 4. OpenAPI Document
```
GET /openapi.json
```
Full OpenAPI 3.1 specification covering all endpoints below.

---

## Dynamic Endpoints

### Discovery

#### Get Solver Discovery
```
GET /api/v6/solver-discovery
```
Returns current solver configuration, available networks, and capabilities.

**Response**: Discovery record with network IDs, capabilities, and metadata.

---

### Signed Feed

#### Get Current Feed
```
GET /api/v6/solver-feed
```
Returns the current **signed** solver Feed containing active routes.

**Authentication**: Verify every Feed with the published signer before selecting a route.

**Signature Fields**:
- `feedHash` - Digest of `signedPayload`
- `feedSigner` - Signer public key
- `feedSignature` - Cryptographic signature

**Important:** `signedPayload` is the authoritative object. Top-level `routes` and `openRoutes` are convenience filters; never replace the signature preimage.

`routeDetailTemplate` is Feed-level navigation metadata for the next read-only step. After selecting a verified route, resolve it with `routeDetailTemplate.replace("{routeId}", route.routeId)`. It is not part of `signedPayload` and carries no cryptographic authority.

#### Stream Feed Events (Server-Sent Events)
```
GET /api/v6/solver-feed/events
```
Real-time Feed updates via SSE stream.

**Event Types**:
- `feed` - New/updated Feed
- `publication-closed` - Feed is closing
- `error` - Stream error

**Event IDs**: Use Feed `dataVersion` values as Last-Event-ID. Missing/invalid ID returns current confirmed Feed. Duplicate-suppression only suppresses the initial duplicate event (if ID == current dataVersion).

---

### Routes

#### Get Route Details
```
GET /api/v6/routes/{routeId}
```
Returns exact canonical active Feed route for the given `routeId`.

**Parameters**:
- `routeId` - Route identifier from current Feed

**Returns**: Complete route detail with operational metrics (non-authoritative, for reference only).

---

### Execution Permits

#### Request Permit Message
```
POST /api/v6/execution-permits/request-message
```
Initiates signing flow. Returns the message to be signed by the wallet/bot.

**Request Body**: Route selection and user intent details.

**Response**: Message to sign + nonce for permit submission.

#### Submit Execution Permit
```
POST /api/v6/execution-permits
```
Submits wallet-signed Permit for execution.

**Request Body**: Signed message, signature, and route details.

**Response**: Permit receipt with fillId for monitoring.

#### Get Fill Status
```
GET /api/v6/execution-permits/{fillId}
```
Check execution status and outcome.

**Parameters**:
- `fillId` - Fill identifier from Permit submission

**Returns**: Fill status, transaction hash (if settled), and confirmation details.

---

## Feed Verification

All Feeds must be verified before use.

### Required Fields

| Field | Purpose |
| --- | --- |
| `signedPayload` | Authoritative route and metadata object |
| `feedHash` | Cryptographic digest of signedPayload |
| `feedSigner` | Published signer public key |
| `feedSignature` | ECDSA signature over feedHash |

### Verification Steps

1. Extract `signedPayload`, `feedHash`, `feedSigner`, `feedSignature`
2. Hash `signedPayload` and verify it matches `feedHash`
3. Verify `feedSignature` was produced by `feedSigner` over `feedHash`
4. If verification passes, use `signedPayload.routes` for Route selection

See [src/feed-verification.mjs](../src/feed-verification.mjs) for reference implementation.

---

## Rate Limits & Policies

- No rate limiting documented for public tier
- Static documents (`.well-known/*`) are cached globally
- SSE streams remain open and do not require polling
- No replay storage; SSE streams publish to active subscribers only

---

## Error Handling

All errors return consistent JSON:

```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

Common codes:
- `INVALID_ROUTE` - Route not found or expired
- `INVALID_PERMIT` - Permit verification failed
- `FEED_VERIFICATION_FAILED` - Signature did not verify
- `NOT_FOUND` - Resource not found

---

## Example: Complete Flow

```bash
# 1. Get discovery info
curl https://solver.vsnexa.com/api/v6/solver-discovery

# 2. Fetch current Feed
curl https://solver.vsnexa.com/api/v6/solver-feed

# 3. Verify Feed signature (implementation-specific)
# ... verify feedHash, feedSigner, feedSignature ...

# 4. Select a route from signedPayload.routes
ROUTE_ID="<selected-route-id>"

# 5. Request permit message
curl -X POST https://solver.vsnexa.com/api/v6/execution-permits/request-message \
  -H "Content-Type: application/json" \
  -d '{"routeId":"'"$ROUTE_ID"'"}'

# 6. Sign message with wallet (off-chain)
# ... wallet signs message ...

# 7. Submit permit
curl -X POST https://solver.vsnexa.com/api/v6/execution-permits \
  -H "Content-Type: application/json" \
  -d '{"signedMessage":"...", "signature":"...", "routeId":"'"$ROUTE_ID"'"}'

# Response contains fillId
FILL_ID="<fill-id-from-response>"

# 8. Monitor status
curl https://solver.vsnexa.com/api/v6/execution-permits/$FILL_ID
```

---

## Documentation

Full formal specification: [OpenAPI 3.1](openapi/openapi.json)

Implementation reference: See [sdks/](../sdks/) for language-specific examples.
