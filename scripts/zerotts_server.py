#!/usr/bin/env python3
"""
ZeroTTS Local Service for AIVES Viva Exam System.
Run:
    pip install zerotts fastapi uvicorn
    python scripts/zerotts_server.py
"""

import io
import sys

import numpy as np
import soundfile as sf

try:
    from fastapi import FastAPI, Query, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response
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

def get_tts():
    global tts_model
    if tts_model is None:
        try:
            from zerotts import ZeroTTS
            print("[ZeroTTS] Đang tải model zeroweight-ai/ZeroTTS (lần đầu sẽ tải weights)...")
            tts_model = ZeroTTS.from_pretrained("zeroweight-ai/ZeroTTS")
            print("[ZeroTTS] Khởi tạo thành công! Sẵn sàng phục vụ.")
        except Exception as e:
            print(f"[ZeroTTS] Lỗi tải model: {e}")
            raise HTTPException(status_code=500, detail=f"Lỗi khởi động ZeroTTS: {e}")
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

@app.get("/speak")
def speak(
    text: str = Query(..., min_length=1, description="Đoạn văn bản câu hỏi cần đọc"),
    voice: str = Query("maichi", description="ID giọng đọc (ví dụ: maichi, giahuy)")
):
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text không được để trống")

    model = get_tts()
    try:
        audio = model.synthesize(clean_text, voice=voice)
        buf = io.BytesIO()
        # save_audio() infers the format from a file extension, which a BytesIO lacks.
        sf.write(buf, np.asarray(audio).squeeze(), model.sample_rate, subtype="PCM_16", format="WAV")
        buf.seek(0)
        return Response(content=buf.read(), media_type="audio/wav")
    except Exception as e:
        print(f"[ZeroTTS] Lỗi khi synthesize: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi tạo âm thanh: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("  AIVES ZeroTTS Microservice đang khởi chạy tại http://localhost:8000")
    print("  Endpoints: /speak?voice=maichi&text=...  |  /voices  |  /health")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
