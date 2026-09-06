FROM nvidia/cuda:12.8.0-cudnn-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TORCH_CUDA_ARCH_LIST="12.0;12.1;12.2;12.3;12.4;12.5;12.6;12.8"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev ffmpeg libsndfile1 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY voice_engine/requirements.txt ./voice_engine/requirements.txt

# Install a CUDA 12.8 PyTorch build that supports RTX 50-series Blackwell GPUs (sm_120).
RUN python3 -m pip install --upgrade pip setuptools wheel && \
    python3 -m pip install --index-url https://download.pytorch.org/whl/cu128 \
    torch==2.10.0+cu128 torchaudio==2.10.0+cu128

RUN python3 -m pip install --no-cache-dir -r voice_engine/requirements.txt

COPY voice_engine ./voice_engine
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 CMD curl -fsS http://127.0.0.1:8765/health || exit 1
CMD ["python3", "-m", "uvicorn", "voice_engine.service.main:app", "--host", "0.0.0.0", "--port", "8765", "--workers", "1"]
