import json
import pathlib
import unittest

from nexa_v6_sdk import (
    NexaV6Client,
    canonicalJson,
    computeFeedHash,
    requestPermitMessage,
    verifyFeed,
)

VECTORS = json.loads(
    (pathlib.Path(__file__).parents[3] / "sdk-spec" / "test-vectors.json").read_text(
        encoding="utf-8"
    )
)


class ConformanceTest(unittest.TestCase):
    def test_canonical_feed(self):
        self.assertEqual(
            canonicalJson(VECTORS["canonicalJson"]["input"]),
            VECTORS["canonicalJson"]["expected"],
        )
        self.assertEqual(
            computeFeedHash(VECTORS["feed"]["signedPayload"]),
            VECTORS["feed"]["feedHash"],
        )
        result = verifyFeed({
            "signedPayload": VECTORS["feed"]["signedPayload"],
            "feedHash": VECTORS["feed"]["feedHash"],
            "feedSigner": VECTORS["feed"]["feedSigner"],
            "feedSignature": VECTORS["feed"]["feedSignature"],
        }, {
            "expectedSigner": VECTORS["feed"]["feedSigner"],
            "nowSeconds": VECTORS["feed"]["nowSeconds"],
            "required": True,
        })
        self.assertTrue(result["valid"])
        self.assertEqual(result["recoveredSigner"], VECTORS["feed"]["feedSigner"])

    def test_permit_and_calldata(self):
        self.assertEqual(
            requestPermitMessage(VECTORS["permitRequest"]["request"]),
            VECTORS["permitRequest"]["expectedMessage"],
        )
        tx = NexaV6Client().buildExecutionTx({
            "permit": VECTORS["abi"]["permit"],
            "permitSignature": VECTORS["abi"]["permitSignature"],
            "execution": {"target": VECTORS["abi"]["executionTarget"]},
        })
        self.assertEqual(tx["data"], VECTORS["abi"]["fillDirectCallData"])
        self.assertEqual(tx["value"], VECTORS["abi"]["expectedTransactionValue"])

    def test_operations(self):
        client = NexaV6Client()
        for name in [
            "discover", "getRoutes", "getRoute", "verifyFeed",
            "requestPermitMessage", "requestPermit", "resolveExecution",
            "previewExecution", "buildExecutionTx", "getFillStatus",
        ]:
            self.assertTrue(callable(getattr(client, name)), name)


if __name__ == "__main__":
    unittest.main()
