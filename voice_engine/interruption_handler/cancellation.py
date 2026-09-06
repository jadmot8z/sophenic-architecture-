from __future__ import annotations

import asyncio


class OutputCancellationRegistry:
    """Per-session cancellation tokens for immediate barge-in handling."""

    def __init__(self) -> None:
        self._events: dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def begin(self, request_id: str) -> asyncio.Event:
        async with self._lock:
            previous = self._events.get(request_id)
            if previous:
                previous.set()
            event = asyncio.Event()
            self._events[request_id] = event
            return event

    async def cancel(self, request_id: str | None = None) -> bool:
        async with self._lock:
            if request_id:
                event = self._events.get(request_id)
                if not event:
                    return False
                event.set()
                return True
            for event in self._events.values():
                event.set()
            return bool(self._events)

    async def finish(self, request_id: str) -> None:
        async with self._lock:
            self._events.pop(request_id, None)
