import asyncio
import unittest

from voice_engine.interruption_handler.cancellation import OutputCancellationRegistry


class InterruptionTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancel_one_and_all_outputs(self):
        registry = OutputCancellationRegistry()
        first = await registry.begin("first")
        second = await registry.begin("second")
        self.assertTrue(await registry.cancel("first"))
        self.assertTrue(first.is_set())
        self.assertFalse(second.is_set())
        self.assertTrue(await registry.cancel())
        self.assertTrue(second.is_set())
        await asyncio.gather(registry.finish("first"), registry.finish("second"))


if __name__ == "__main__":
    unittest.main()
