from __future__ import annotations

import asyncio
import base64
from collections.abc import Iterator
from contextlib import asynccontextmanager
import json
import logging
import os
import time

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError

from ..audio_stream import AdaptiveVoiceActivityDetector, pcm16_bytes, pcm16_samples, resample, wav_bytes
from ..config import get_settings
from ..emotion_engine import ConversationEmotionEngine
from ..interruption_handler import OutputCancellationRegistry
from ..languages import LANGUAGES, normalize_language
from ..speech_to_text import StreamingWhisper
from ..text_to_speech import SynthesisRequest, VoiceProviderRegistry

settings = get_settings()
stt = StreamingWhisper()
tts = VoiceProviderRegistry.create()
provider = VoiceProviderRegistry.descriptor()
emotions = ConversationEmotionEngine()
gpu_slots = asyncio.Semaphore(max(1, settings.max_concurrency))
logger = logging.getLogger("sophenic.voice.native")
logging.basicConfig(level=os.getenv("SOPHENIC_VOICE_LOG_LEVEL", "INFO"), format="%(message)s")


def _log(event: str, **fields: object) -> None:
    # Audio and transcript content are intentionally never logged.
    logger.info(json.dumps({"event": event, "at": time.time(), **fields}, ensure_ascii=False, default=str))


def _authorized(key: str | None, host: str = "") -> bool:
    if settings.allow_unauthenticated_loopback and host in {"127.0.0.1", "::1", "localhost", "testclient"}:
        return True
    return bool(settings.service_key) and bool(key) and key == settings.service_key


def _next_chunk(iterator: Iterator[np.ndarray]) -> np.ndarray | None:
    try:
        return next(iterator)
    except StopIteration:
        return None


class SpeechBody(BaseModel):
    text: str = Field(min_length=1, max_length=12_000)
    language: str = "auto"
    voice_id: str = "sophenic-native"
    speed: float = Field(default=1.0, ge=0.68, le=1.35)
    expressiveness: float = Field(default=0.72, ge=0.0, le=1.0)
    natural: bool = True
    context: str = Field(default="", max_length=4_000)
    session_id: str = Field(default="default", max_length=128)
    request_id: str = Field(default="", max_length=128)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.bootstrap_error = None
    app.state.model_bootstrap_task = asyncio.create_task(_bootstrap_models())
    _log("startup.background_loading_started", provider=provider.id, stt=settings.stt_model, tts=settings.tts_model)
    try:
        yield
    finally:
        task = getattr(app.state, "model_bootstrap_task", None)
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                _log("startup.background_loading_cancelled")
        _log("shutdown", provider=provider.id)


async def _bootstrap_models() -> None:
    _log("engine.startup.begin", provider=provider.id, stt=settings.stt_model, tts=settings.tts_model)
    try:
        # Keep peak host/GPU memory bounded: VoxCPM2 and Whisper both allocate
        # large native buffers while loading and should not initialize together.
        await asyncio.to_thread(tts.load)
        await asyncio.to_thread(stt.load)
        _log(
            "engine.ready",
            provider=provider.id,
            stt=settings.stt_model,
            tts=settings.tts_model,
            ready=stt.ready and tts.ready,
            languages=len(LANGUAGES),
        )
    except Exception as error:
        app.state.bootstrap_error = str(error)
        logger.exception("engine.startup.failed")
        _log("engine.startup.failed", provider=provider.id, stt=settings.stt_model, tts=settings.tts_model)


app = FastAPI(
    title="SOPHENIC Native Realtime Voice Engine",
    version="2.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, object]:
    bootstrap_task = getattr(app.state, "model_bootstrap_task", None)
    loading = bool(bootstrap_task is not None and not bootstrap_task.done())
    bootstrap_error = getattr(app.state, "bootstrap_error", None)
    return {
        "ok": True,
        "ready": stt.ready and tts.ready,
        "loading": loading,
        "error": bootstrap_error,
        "local": True,
        "realtime": True,
        "full_duplex": True,
        "provider": provider.name,
        "provider_id": provider.id,
        "stt_model": settings.stt_model,
        "tts_model": settings.tts_model,
        "sample_rate": tts.sample_rate,
        "languages": len(LANGUAGES),
        "language_codes": list(LANGUAGES),
        "mock": settings.mock_mode,
    }


@app.get("/ready")
async def ready() -> dict[str, object]:
    if not stt.ready or not tts.ready:
        detail = getattr(app.state, "bootstrap_error", None) or "Local models are still loading"
        raise HTTPException(status_code=503, detail=detail)
    return {"ok": True, "provider": provider.id, "stt": settings.stt_model}


@app.get("/debug/status")
async def debug_status() -> dict[str, object]:
    import torch

    cuda_available = bool(torch.cuda.is_available())
    return {
        "gpu": torch.cuda.get_device_name(0) if cuda_available else None,
        "cuda_version": torch.version.cuda,
        "tts_loaded": tts.ready,
        "stt_loaded": stt.ready,
        "ready": stt.ready and tts.ready,
        "loading": bool(
            getattr(app.state, "model_bootstrap_task", None)
            and not app.state.model_bootstrap_task.done()
        ),
        "model_name": settings.tts_model,
        "memory_used": torch.cuda.memory_allocated(0) if cuda_available else 0,
        "error": getattr(app.state, "bootstrap_error", None),
    }


@app.get("/v2/languages")
async def languages(request: Request, x_sophenic_voice_key: str | None = Header(default=None)) -> dict[str, object]:
    host = request.client.host if request.client else ""
    if not _authorized(x_sophenic_voice_key, host):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "auto": {"name": "Automatic", "locale": "auto"},
        **{code: {"name": item.name, "locale": item.locale} for code, item in LANGUAGES.items()},
    }


@app.post("/v2/speech")
async def speech(request: Request, body: SpeechBody, x_sophenic_voice_key: str | None = Header(default=None)) -> Response:
    host = request.client.host if request.client else ""
    if not _authorized(x_sophenic_voice_key, host):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not stt.ready or not tts.ready:
        detail = getattr(app.state, "bootstrap_error", None) or "Local voice models are still loading"
        raise HTTPException(status_code=503, detail=detail)
    style = emotions.style(
        body.text,
        context=body.context,
        language=normalize_language(body.language),
        session_id=body.session_id,
        natural=body.natural,
        expressiveness=body.expressiveness,
        speed=body.speed,
    )
    request = SynthesisRequest(
        text=emotions.render_text(body.text, style),
        language=body.language,
        voice_id=body.voice_id,
        control=emotions.control_instruction(style),
    )
    async with gpu_slots:
        audio = await asyncio.to_thread(tts.synthesize, request)
    if audio.size == 0 or not np.isfinite(audio).all() or float(np.max(np.abs(audio))) < 1e-5:
        raise HTTPException(status_code=502, detail="TTS returned no audible audio")
    return Response(wav_bytes(audio, tts.sample_rate), media_type="audio/wav")


@app.websocket("/v2/realtime")
async def realtime(websocket: WebSocket) -> None:
    """One persistent, bidirectional session for microphone, STT, TTS and barge-in."""

    key = websocket.headers.get("x-sophenic-voice-key")
    host = websocket.client.host if websocket.client else ""
    if not _authorized(key, host):
        await websocket.close(code=4401)
        return
    await websocket.accept()

    send_lock = asyncio.Lock()
    cancellation = OutputCancellationRegistry()
    tasks: set[asyncio.Task[object]] = set()
    output_tasks: dict[str, asyncio.Task[object]] = {}
    partial_task: asyncio.Task[object] | None = None
    session_id = f"voice-{id(websocket)}"
    language = "auto"
    sample_rate = 48_000
    vad = AdaptiveVoiceActivityDetector(
        sample_rate=sample_rate,
        base_threshold=settings.base_energy_threshold,
        endpoint_silence_ms=settings.endpoint_silence_ms,
        minimum_speech_ms=settings.minimum_speech_ms,
        maximum_utterance_seconds=settings.maximum_utterance_seconds,
        partial_interval_seconds=settings.partial_interval_seconds,
        pre_roll_ms=settings.pre_roll_ms,
    )
    utterance_index = 0

    async def send(payload: dict[str, object]) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    def track(task: asyncio.Task[object]) -> asyncio.Task[object]:
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        return task

    async def transcribe_audio(audio: np.ndarray, *, partial: bool, turn: int) -> None:
        started = time.monotonic()
        normalized = resample(audio, sample_rate, 16_000)
        result = await asyncio.to_thread(
            stt.transcribe,
            normalized,
            language=None if language == "auto" else language,
            partial=partial,
        )
        if not result.text:
            return
        await send({
            "type": "transcript_partial" if partial else "transcript_final",
            "session_id": session_id,
            "utterance_id": turn,
            "text": result.text,
            "language": result.language,
            "language_probability": result.probability,
            "duration_seconds": result.duration_seconds,
        })
        if not partial:
            _log(
                "stt.final",
                session_id=session_id,
                utterance_id=turn,
                language=result.language,
                chars=len(result.text),
                latency_ms=round((time.monotonic() - started) * 1000),
            )

    async def synthesize_output(body: SpeechBody) -> None:
        request_id = body.request_id or f"output-{time.time_ns()}"
        cancel_event = await cancellation.begin(request_id)
        style = emotions.style(
            body.text,
            context=body.context,
            language=normalize_language(body.language),
            session_id=session_id,
            natural=body.natural,
            expressiveness=body.expressiveness,
            speed=body.speed,
        )
        request = SynthesisRequest(
            text=emotions.render_text(body.text, style),
            language=body.language,
            voice_id=body.voice_id,
            control=emotions.control_instruction(style),
        )
        started = time.monotonic()
        await send({
            "type": "output_started",
            "session_id": session_id,
            "request_id": request_id,
            "sample_rate": tts.sample_rate,
            "format": "pcm_s16le",
            "emotion": style.emotion,
            "style": style.to_dict(),
        })
        try:
            if style.pause_before_ms:
                try:
                    await asyncio.wait_for(cancel_event.wait(), style.pause_before_ms / 1000)
                except asyncio.TimeoutError:
                    pass
            if cancel_event.is_set():
                await send({"type": "output_cancelled", "request_id": request_id})
                return
            async with gpu_slots:
                iterator = tts.stream(request)
                sequence = 0
                while not cancel_event.is_set():
                    chunk = await asyncio.to_thread(_next_chunk, iterator)
                    if chunk is None:
                        break
                    raw = pcm16_bytes(chunk)
                    if not raw:
                        continue
                    await send({
                        "type": "output_audio",
                        "session_id": session_id,
                        "request_id": request_id,
                        "sequence": sequence,
                        "sample_rate": tts.sample_rate,
                        "format": "pcm_s16le",
                        "data": base64.b64encode(raw).decode("ascii"),
                    })
                    sequence += 1
            if cancel_event.is_set():
                await send({"type": "output_cancelled", "request_id": request_id})
                _log("tts.cancelled", session_id=session_id, request_id=request_id)
            else:
                await send({"type": "output_done", "session_id": session_id, "request_id": request_id})
                _log(
                    "tts.done",
                    session_id=session_id,
                    request_id=request_id,
                    emotion=style.emotion,
                    chars=len(body.text),
                    latency_ms=round((time.monotonic() - started) * 1000),
                )
        except Exception as error:
            await send({"type": "error", "scope": "output", "request_id": request_id, "message": str(error)})
        finally:
            await cancellation.finish(request_id)
            output_tasks.pop(request_id, None)

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            raw = message.get("bytes")
            if raw is not None:
                if len(raw) > 256 * 1024:
                    await send({"type": "error", "scope": "input", "message": "Audio frame too large"})
                    continue
                update = vad.feed(pcm16_samples(raw))
                if update.speech_started:
                    # Server-side safety net: even if the renderer is delayed,
                    # generated audio stops as soon as real speech is detected.
                    await cancellation.cancel()
                    await send({"type": "speech_started", "session_id": session_id, "level": update.level})
                if update.partial_due and (partial_task is None or partial_task.done()):
                    utterance_index += 1
                    partial_task = track(asyncio.create_task(transcribe_audio(vad.snapshot(), partial=True, turn=utterance_index)))
                if update.speech_ended and update.utterance is not None:
                    if partial_task and not partial_task.done():
                        partial_task.cancel()
                    utterance_index += 1
                    turn = utterance_index
                    await send({"type": "speech_ended", "session_id": session_id, "utterance_id": turn})
                    track(asyncio.create_task(transcribe_audio(update.utterance, partial=False, turn=turn)))
                continue

            text = message.get("text")
            if text is None:
                continue
            try:
                command = json.loads(text)
            except (TypeError, json.JSONDecodeError):
                await send({"type": "error", "scope": "protocol", "message": "Invalid JSON command"})
                continue
            command_type = str(command.get("type") or "")

            if command_type == "start":
                session_id = str(command.get("session_id") or session_id)[:128]
                language = normalize_language(str(command.get("language") or "auto"))
                sample_rate = max(8_000, min(96_000, int(command.get("sample_rate") or 48_000)))
                vad = AdaptiveVoiceActivityDetector(
                    sample_rate=sample_rate,
                    base_threshold=settings.base_energy_threshold,
                    endpoint_silence_ms=settings.endpoint_silence_ms,
                    minimum_speech_ms=settings.minimum_speech_ms,
                    maximum_utterance_seconds=settings.maximum_utterance_seconds,
                    partial_interval_seconds=settings.partial_interval_seconds,
                    pre_roll_ms=settings.pre_roll_ms,
                )
                await send({
                    "type": "ready",
                    "session_id": session_id,
                    "input_sample_rate": sample_rate,
                    "output_sample_rate": tts.sample_rate,
                    "languages": len(LANGUAGES),
                    "provider": provider.id,
                })
            elif command_type == "assistant_state":
                vad.set_assistant_speaking(bool(command.get("speaking")))
            elif command_type == "synthesize":
                try:
                    body = SpeechBody.model_validate({**command, "session_id": session_id})
                except ValidationError as error:
                    await send({"type": "error", "scope": "output", "message": str(error)})
                    continue
                request_id = body.request_id or f"output-{time.time_ns()}"
                body.request_id = request_id
                task = track(asyncio.create_task(synthesize_output(body)))
                output_tasks[request_id] = task
            elif command_type == "cancel_output":
                request_id = str(command.get("request_id") or "") or None
                await cancellation.cancel(request_id)
            elif command_type == "flush":
                utterance = vad.flush()
                if utterance is not None:
                    utterance_index += 1
                    track(asyncio.create_task(transcribe_audio(utterance, partial=False, turn=utterance_index)))
            elif command_type == "reset_input":
                vad.reset()
            elif command_type == "stop":
                break
            else:
                await send({"type": "error", "scope": "protocol", "message": f"Unknown command: {command_type}"})
    except WebSocketDisconnect:
        pass
    finally:
        await cancellation.cancel()
        for task in list(tasks):
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        _log("session.closed", session_id=session_id)
