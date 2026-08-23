# nexa-v6-sdk

Canonical Python implementation of the frozen Nexa V6 SDK contract.

```python
from nexa_v6_sdk import NexaV6Client

client = NexaV6Client()
routes = client.getRoutes({"sourceChainId": 8453})
```

Feed verification is mandatory inside `getRoutes`. Signing remains in the caller wallet or KMS.

