#!/usr/bin/env python3
"""
ZeroTTS Local Service for AIVES Viva Exam System.
Run:
    pip install zerotts fastapi uvicorn
    python scripts/zerotts_server.py
"""

import struct
import sys
import threading
import time
from pathlib import Path

import numpy as np

# Windows defaults to cp1252. Voice metadata is UTF-8, and byte 0x81 in
# kimoanh/meta.json is illegal in that code page, so every Vietnamese line
# for that voice died inside Path.read_text().
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

_read_text = Path.read_text


def _read_text_utf8(self, encoding=None, errors=None, newline=None):
    return _read_text(self, encoding=encoding or "utf-8", errors=errors, newline=newline)


Path.read_text = _read_text_utf8

try:
    from fastapi import FastAPI, Query, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    import uvicorn
except ImportError:
    print("\n[ZeroTTS] Thư viện FastAPI chưa được cài đặt. Vui lòng chạy lệnh:")
    print("pip install zerotts fastapi uvicorn\n")
    sys.exit(1)

app = FastAPI(title="AIVES ZeroTTS Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tts_model = None
synthesis_lock = threading.Lock()
speak_token = 0
token_lock = threading.Lock()

def get_tts():
    global tts_model
    if tts_model is None:
        from zerotts import ZeroTTS
        try:
            print("[ZeroTTS] Đang mở model đã tải sẵn...")
            tts_model = ZeroTTS.from_pretrained("zeroweight-ai/ZeroTTS", local_files_only=True)
        except Exception as cached_error:
            print(f"[ZeroTTS] Chưa dùng được bản đã tải ({cached_error}). Đang tải từ Hugging Face...")
            try:
                tts_model = ZeroTTS.from_pretrained("zeroweight-ai/ZeroTTS")
            except Exception as download_error:
                print(f"[ZeroTTS] Lỗi tải model: {download_error}")
                raise
        print("[ZeroTTS] Khởi tạo thành công! Sẵn sàng phục vụ.")
    return tts_model

VOICES = [
    {"id": "maichi", "name": "Mai Chi (Nữ - Truyền cảm, khuyến nghị)", "gender": "female"},
    {"id": "giahuy", "name": "Gia Huy (Nam - Trầm ấm)", "gender": "male"},
    {"id": "baotrang", "name": "Bảo Trang (Nữ - Rõ ràng)", "gender": "female"},
    {"id": "kimoanh", "name": "Kim Oanh (Nữ)", "gender": "female"},
    {"id": "hamy", "name": "Hà My (Nữ)", "gender": "female"},
    {"id": "huuduc", "name": "Hữu Đức (Nam)", "gender": "male"},
    {"id": "quangminh", "name": "Quang Minh (Nam)", "gender": "male"},
    {"id": "tiendat", "name": "Tiến Đạt (Nam)", "gender": "male"},
]

@app.get("/health")
def health():
    return {"status": "ok", "service": "ZeroTTS", "voices_count": len(VOICES)}

@app.get("/voices")
def list_voices():
    return VOICES

def wav_header(sample_rate: int) -> bytes:
    """16-bit mono WAV header. Size is a placeholder so playback can start early."""
    data_size = 0x7FFFF000
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        sample_rate,
        sample_rate * 2,
        2,
        16,
        b"data",
        data_size,
    )


def next_speak_token() -> int:
    global speak_token
    with token_lock:
        speak_token += 1
        return speak_token


def iter_wav(text: str, voice: str, token: int):
    """Stream one script. A newer /speak request stops this one at the next chunk."""
    model = get_tts()
    with synthesis_lock:
        if token != speak_token:
            return
        yield wav_header(int(model.sample_rate))
        started = time.perf_counter()
        first = True
        try:
            for chunk in model.synthesize_stream(
                text,
                voice=voice,
                first_chunk_frames=8,
                max_chunk_frames=16,
            ):
                if token != speak_token:
                    print("[ZeroTTS] dừng câu cũ để đọc script mới")
                    return
                samples = np.clip(np.asarray(chunk, dtype=np.float32).reshape(-1), -1.0, 1.0)
                if samples.size == 0:
                    continue
                if first:
                    print(f"[ZeroTTS] first audio in {time.perf_counter() - started:.2f}s ({voice})")
                    first = False
                yield (samples * 32767.0).astype("<i2").tobytes()
        except Exception as error:
            print(f"[ZeroTTS] Lỗi khi synthesize: {error}")
            return
        print(f"[ZeroTTS] utterance done in {time.perf_counter() - started:.2f}s")


@app.get("/speak")
def speak(
    text: str = Query(..., min_length=1, description="Đoạn văn bản câu hỏi cần đọc"),
    voice: str = Query("maichi", description="ID giọng đọc (ví dụ: maichi, giahuy)")
):
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text không được để trống")
    token = next_speak_token()
    return StreamingResponse(
        iter_wav(clean_text, voice, token),
        media_type="audio/wav",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


def warm_model() -> None:
    print("[ZeroTTS] Đang tải model và làm nóng bộ giải mã...")
    model = get_tts()
    model.warmup()
    for _chunk in model.synthesize_stream("Xin chào.", voice="maichi", max_frames=8):
        pass
    print("[ZeroTTS] Sẵn sàng.")


if __name__ == "__main__":
    print("=" * 60)
    print("  AIVES ZeroTTS Microservice đang khởi chạy tại http://localhost:8000")
    print("  Endpoints: /speak?voice=maichi&text=...  |  /voices  |  /health")
    print("=" * 60)
    warm_model()
    uvicorn.run(app, host="0.0.0.0", port=8000)
