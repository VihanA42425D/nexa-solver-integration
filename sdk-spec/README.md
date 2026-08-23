# Nexa V6 SDK Contract

`nexa-v6-sdk-contract.json` is the frozen, language-neutral behavioral contract for every Nexa V6 SDK. Version `1.0.0` is immutable after the `sdk-v1.0.0` tag.

All implementations expose the same ten operations:

- `discover`
- `getRoutes`
- `getRoute`
- `verifyFeed`
- `requestPermitMessage`
- `requestPermit`
- `resolveExecution`
- `previewExecution`
- `buildExecutionTx`
- `getFillStatus`

`test-vectors.json` is the cross-language byte-level conformance authority. A package is publishable only when it reproduces every canonical JSON string, hash, recovered signer, Permit message, EIP-191 request signature and ABI calldata vector exactly.

## Signature boundary

Feed and Permit-request signatures deliberately use different schemes:

- Feed: raw recoverable secp256k1 ECDSA over `keccak256(UTF8(FEED_DOMAIN + "\n" + canonicalJson(signedPayload)))`. There is no EIP-191 message prefix.
- Permit request: EIP-191 `personal_sign` over the exact UTF-8 deterministic Permit message.

The recovered signer and signatures are public test material. The generator
derives its deterministic test key from an explicit never-fund label; the
private key is not published in the vector file and the signer must never be
funded.
