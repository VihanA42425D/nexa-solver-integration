# nexa-v6-sdk

Canonical Rust implementation of the frozen Nexa V6 SDK contract.

```rust
use nexa_v6_sdk::NexaV6Client;

let client = NexaV6Client::default();
let routes = client.getRoutes(None)?;
```

The crate validates signed Feeds before returning routes and never owns wallet keys.
