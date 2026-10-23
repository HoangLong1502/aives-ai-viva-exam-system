"use client";

export const ZEROTTS_DEFAULT_URL =
  process.env.NEXT_PUBLIC_ZEROTTS_URL || "http://localhost:8000";

export const ZEROTTS_VOICES = [
  { id: "maichi", label: "Mai Chi (Nữ - Truyền cảm, khuyến nghị)", gender: "female" },
  { id: "giahuy", label: "Gia Huy (Nam - Trầm ấm)", gender: "male" },
  { id: "baotrang", label: "Bảo Trang (Nữ)", gender: "female" },
  { id: "kimoanh", label: "Kim Oanh (Nữ)", gender: "female" },
  { id: "hamy", label: "Hà My (Nữ)", gender: "female" },
  { id: "huuduc", label: "Hữu Đức (Nam)", gender: "male" },
  { id: "quangminh", label: "Quang Minh (Nam)", gender: "male" },
  { id: "tiendat", label: "Tiến Đạt (Nam)", gender: "male" },
] as const;

/**
 * English reading voices.
 * ZeroTTS ships Vietnamese speaker latents that also speak English (cross-lingual);
 * see https://huggingface.co/danhcao/ZeroTTS — browser voices are offline fallbacks.
 */
export const ENGLISH_VOICES = [
  ...ZEROTTS_VOICES.map((voice) => ({
    id: voice.id,
    label: `${voice.label} · English (ZeroTTS)`,
    engine: "zerotts" as const,
    lang: "en-US" as const,
    prefer: [] as string[],
  })),
  {
    id: "google-en-us",
    label: "Google US English (browser fallback)",
    engine: "browser" as const,
    lang: "en-US" as const,
    prefer: ["google us english", "google english", "en-us"],
  },
  {
    id: "google-en-gb",
    label: "Google UK English (browser fallback)",
    engine: "browser" as const,
    lang: "en-GB" as const,
    prefer: ["google uk english", "google english", "en-gb"],
  },
  {
    id: "microsoft-en-us",
    label: "Microsoft US English (browser fallback)",
    engine: "browser" as const,
    lang: "en-US" as const,
    prefer: ["microsoft", "zira", "david", "aria", "guy"],
  },
  {
    id: "browser-en-us",
    label: "Browser default (en-US)",
    engine: "browser" as const,
    lang: "en-US" as const,
    prefer: [] as string[],
  },
] as const;

export type EnglishVoiceId = (typeof ENGLISH_VOICES)[number]["id"];
export type ZeroTtsVoiceId = (typeof ZEROTTS_VOICES)[number]["id"];
export type SpeechLang = "vi-VN" | "en-US";

const VIETNAMESE_CHARS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const ENGLISH_VOICE_IDS = new Set(ENGLISH_VOICES.map((voice) => voice.id));
const ZERO_VOICE_IDS = new Set(ZEROTTS_VOICES.map((voice) => voice.id));
const BROWSER_ENGLISH_VOICE_IDS = new Set<string>(
  ENGLISH_VOICES.filter((voice) => voice.engine === "browser").map((voice) => voice.id),
);

/** Detect whether exam text should be spoken in Vietnamese or English. */
export function detectSpeechLang(text: string): SpeechLang {
  const sample = text.trim();
  if (!sample) return "vi-VN";

  if (VIETNAMESE_CHARS.test(sample)) {
    return "vi-VN";
  }

  const letters = sample.replace(/[^A-Za-zÀ-ỹ]/g, "");
  if (letters.length === 0) return "vi-VN";

  // Latin-only prompts without Vietnamese diacritics → English exam voice
  const asciiLetters = sample.replace(/[^A-Za-z]/g, "").length;
  if (asciiLetters / letters.length >= 0.85) {
    return "en-US";
  }

  return "vi-VN";
}

export function isEnglishVoice(id: string | null | undefined): boolean {
  return !!id && ENGLISH_VOICE_IDS.has(id as EnglishVoiceId);
}

export function isBrowserEnglishVoice(id: string | null | undefined): boolean {
  return !!id && BROWSER_ENGLISH_VOICE_IDS.has(id);
}

export function isZeroTtsVoice(id: string | null | undefined): boolean {
  return !!id && ZERO_VOICE_IDS.has(id as ZeroTtsVoiceId);
}

export function normalizeViVoice(id: string | null | undefined): string {
  return isZeroTtsVoice(id) ? (id as string) : "maichi";
}

export function normalizeEnVoice(id: string | null | undefined): string {
  return isEnglishVoice(id) ? (id as string) : "maichi";
}

export function voiceLabel(id: string | null | undefined): string {
  const english = ENGLISH_VOICES.find((voice) => voice.id === id);
  if (english) return english.label;
  const zero = ZEROTTS_VOICES.find((voice) => voice.id === id);
  if (zero) return zero.label;
  return id?.trim() || "maichi";
}

/** Pick the voice id to pass into playTTS for this utterance. */
export function voiceForSpeech(
  lang: SpeechLang,
  viVoice = "maichi",
  enVoice = "maichi",
): string {
  return lang === "en-US" ? normalizeEnVoice(enVoice) : normalizeViVoice(viVoice);
}

let currentAudio: HTMLAudioElement | null = null;
let isZeroTTSAvailable: boolean | null = null;
let lastCheckTime = 0;

export async function checkZeroTTSStatus(baseUrl = ZEROTTS_DEFAULT_URL): Promise<boolean> {
  const now = Date.now();
  if (isZeroTTSAvailable !== null && now - lastCheckTime < 15000) {
    return isZeroTTSAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      method: "GET",
    });
    clearTimeout(timeout);
    isZeroTTSAvailable = res.ok;
  } catch {
    isZeroTTSAvailable = false;
  }
  lastCheckTime = now;
  return isZeroTTSAvailable;
}

export function stopTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export type PlayTTSOptions = {
  voice?: string;
  lang?: "vi-VN" | "en-US";
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err?: unknown) => void;
  onEngineUsed?: (engine: "ZeroTTS" | "Browser-Google") => void;
};

/**
 * Phát âm thanh văn bản theo ngôn ngữ đề:
 * - Tiếng Việt: ZeroTTS (local), fallback Google vi-VN
 * - Tiếng Anh: ZeroTTS cross-lingual với giọng đã chọn, fallback browser English
 *   (ZeroTTS docs: https://huggingface.co/danhcao/ZeroTTS)
 */
export async function playTTS(
  text: string,
  options: PlayTTSOptions = {}
): Promise<() => void> {
  const {
    voice = "maichi",
    lang: langOption,
    onStart,
    onEnd,
    onError,
    onEngineUsed,
  } = options;

  stopTTS();

  const cleanText = text.trim();
  if (!cleanText) return () => {};

  const lang = langOption ?? detectSpeechLang(cleanText);
  const useBrowserEnglish = lang === "en-US" && isBrowserEnglishVoice(voice);

  if (useBrowserEnglish) {
    onEngineUsed?.("Browser-Google");
    playBrowserTTS(cleanText, "en-US", voice, onStart, onEnd, onError);
    return () => stopTTS();
  }

  const zeroOnline = await checkZeroTTSStatus();
  const zeroVoice = isZeroTtsVoice(voice) ? voice : "maichi";
  const browserFallbackLang = lang === "en-US" ? "en-US" : "vi-VN";
  const browserFallbackVoice = lang === "en-US" ? "google-en-us" : null;

  if (zeroOnline) {
    try {
      const audioUrl = `${ZEROTTS_DEFAULT_URL}/speak?voice=${encodeURIComponent(
        zeroVoice
      )}&text=${encodeURIComponent(cleanText)}`;

      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onplay = () => {
        onStart?.();
        onEngineUsed?.("ZeroTTS");
      };

      audio.onended = () => {
        currentAudio = null;
        onEnd?.();
      };

      audio.onerror = () => {
        currentAudio = null;
        playBrowserTTS(cleanText, browserFallbackLang, browserFallbackVoice, onStart, onEnd, onError);
        onEngineUsed?.("Browser-Google");
      };

      await audio.play();
      return () => stopTTS();
    } catch {
      // Fallback
    }
  }

  onEngineUsed?.("Browser-Google");
  playBrowserTTS(cleanText, browserFallbackLang, browserFallbackVoice, onStart, onEnd, onError);
  return () => stopTTS();
}

function playBrowserTTS(
  text: string,
  lang: "vi-VN" | "en-US",
  preferredVoiceId: string | null,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err?: unknown) => void
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onError?.(new Error("Web Speech Synthesis không được hỗ trợ trên trình duyệt này"));
    return;
  }

  window.speechSynthesis.cancel();

  const english = ENGLISH_VOICES.find((voice) => voice.id === preferredVoiceId);
  const utteranceLang = english?.lang ?? lang;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = utteranceLang;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (english) {
      const picked = pickEnglishVoice(voices, english);
      if (picked) {
        utterance.voice = picked;
        utterance.lang = picked.lang || utteranceLang;
        return;
      }
    }
    const googleVoice = voices.find(
      (v) =>
        v.name.toLowerCase().includes("google") &&
        v.lang.toLowerCase().startsWith(utteranceLang.slice(0, 2))
    );
    const langVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(utteranceLang.slice(0, 2))
    );
    if (googleVoice) {
      utterance.voice = googleVoice;
    } else if (langVoice) {
      utterance.voice = langVoice;
    }
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    pickVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (e) => onError?.(e);

  window.speechSynthesis.speak(utterance);
}

function pickEnglishVoice(
  voices: SpeechSynthesisVoice[],
  preferred: (typeof ENGLISH_VOICES)[number],
): SpeechSynthesisVoice | undefined {
  const langPrefix = preferred.lang.slice(0, 2).toLowerCase();
  const langExact = preferred.lang.toLowerCase();
  const sameLang = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));

  for (const needle of preferred.prefer) {
    const hit = sameLang.find((voice) => {
      const name = voice.name.toLowerCase();
      const lang = voice.lang.toLowerCase();
      return name.includes(needle) || lang.includes(needle);
    });
    if (hit) return hit;
  }

  return (
    sameLang.find((voice) => voice.lang.toLowerCase() === langExact) ||
    sameLang.find((voice) => voice.name.toLowerCase().includes("google")) ||
    sameLang[0]
  );
}
