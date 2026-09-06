# SOPHENIC Native Voice Engine

A local-first, full-duplex voice runtime. One persistent WebSocket carries PCM microphone frames, partial/final transcripts, streamed neural speech, emotional delivery metadata, and immediate output cancellation.

## Run locally (NVIDIA)

```powershell
.\START-SOPHENIC-VOICE.ps1
```

Or copy `voice_engine/.env.example` to `voice_engine/.env`, then run:

```bash
docker compose -f voice_engine/docker-compose.yml up -d --build
```

The service binds to `127.0.0.1:8765`. Electron retains the service key; renderer code never receives it. Audio and transcripts are not logged.

## API

- `GET /health` and `GET /ready`
- `GET /v2/languages`
- `POST /v2/speech` for the settings preview
- `GET /debug/status` for GPU, model readiness and memory diagnostics
- `WS /v2/realtime` for continuous microphone, realtime STT, neural TTS and barge-in

Set `SOPHENIC_VOICE_MOCK_MODE=true` to exercise UI, streaming, silence prompting and interruption without loading GPU models.

HTTP authentication uses the `X-Sophenic-Voice-Key` header and the `SOPHENIC_VOICE_SERVICE_KEY` value from `voice_engine/.env`. Loopback requests from `127.0.0.1` and `::1` are allowed when `SOPHENIC_VOICE_ALLOW_UNAUTHENTICATED_LOOPBACK=true`.
