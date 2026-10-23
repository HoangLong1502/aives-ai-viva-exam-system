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
let speakAbort: AbortController | null = null;
let browserSpeakToken = 0;
let audioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
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

type PreparedClip = {
  status: "loading" | "ready";
  blob?: Blob;
  promise: Promise<Blob>;
  controller: AbortController;
};

const preparedClips = new Map<string, PreparedClip>();
const prefetchQueue: { voice: string; text: string }[] = [];
let prefetchRunning = false;
let prefetchGeneration = 0;
let synthesisBusy = 0;
let prefetchHold = 0;

function clipKey(voice: string, text: string) {
  return `${voice}\n${text.trim()}`;
}

function speakUrl(voice: string, text: string) {
  return `${ZEROTTS_DEFAULT_URL}/speak?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
}

function wavBlob(chunks: Uint8Array[]): Blob {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const wav = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (wav.byteLength >= 44) {
    const view = new DataView(wav.buffer);
    const dataSize = wav.byteLength - 44;
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(40, dataSize, true);
  }
  return new Blob([wav], { type: "audio/wav" });
}

function rememberClip(voice: string, text: string, blob: Blob) {
  const key = clipKey(voice, text);
  preparedClips.set(key, {
    status: "ready",
    blob,
    promise: Promise.resolve(blob),
    controller: new AbortController(),
  });
}

function beginSynthesis() {
  synthesisBusy += 1;
}

function endSynthesis() {
  synthesisBusy = Math.max(0, synthesisBusy - 1);
  if (synthesisBusy === 0) void runPrefetch();
}

async function downloadClip(voice: string, text: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(speakUrl(voice, text), { signal });
  if (!response.ok) throw new Error(`ZeroTTS ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return wavBlob([bytes]);
}

function abortLoadingPrefetch() {
  for (const clip of preparedClips.values()) {
    if (clip.status === "loading") clip.controller.abort();
  }
}

/** Free the speech server while the examiner's reply is being written. */
export function holdExamPrefetch() {
  prefetchHold += 1;
  abortLoadingPrefetch();
}

export function releaseExamPrefetch() {
  prefetchHold = Math.max(0, prefetchHold - 1);
  if (prefetchHold === 0) void runPrefetch();
}

async function runPrefetch() {
  if (prefetchRunning || synthesisBusy > 0 || prefetchHold > 0) return;
  prefetchRunning = true;
  try {
    while (prefetchQueue.length > 0 && synthesisBusy === 0 && prefetchHold === 0) {
      const next = prefetchQueue.shift();
      if (!next) break;
      const key = clipKey(next.voice, next.text);
      if (preparedClips.has(key)) continue;
      const controller = new AbortController();
      const generation = prefetchGeneration;
      const promise = downloadClip(next.voice, next.text, controller.signal);
      const clip: PreparedClip = { status: "loading", promise, controller };
      preparedClips.set(key, clip);
      try {
        clip.blob = await promise;
        clip.status = "ready";
      } catch {
        if (preparedClips.get(key)?.controller === controller) preparedClips.delete(key);
        if (controller.signal.aborted && generation === prefetchGeneration) prefetchQueue.unshift(next);
      }
    }
  } finally {
    prefetchRunning = false;
    if (prefetchQueue.length > 0 && synthesisBusy === 0 && prefetchHold === 0) void runPrefetch();
  }
}

/** Prepare each question's reading in the background, one complete clip per prompt.
 *  Lines are in priority order: a later call moves a not-yet-started prompt forward. */
export function prefetchExamLines(lines: { text: string; voice: string }[]) {
  const incoming: { voice: string; text: string }[] = [];
  const incomingKeys = new Set<string>();
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || !isZeroTtsVoice(line.voice)) continue;
    const key = clipKey(line.voice, text);
    if (preparedClips.has(key) || incomingKeys.has(key)) continue;
    incomingKeys.add(key);
    incoming.push({ voice: line.voice, text });
  }
  const rest = prefetchQueue.filter((item) => !incomingKeys.has(clipKey(item.voice, item.text)));
  prefetchQueue.length = 0;
  prefetchQueue.push(...incoming, ...rest);
  void runPrefetch();
}

/** Stop background preparation when the student leaves the exam. Ready clips stay cached. */
export function cancelExamPrefetch() {
  prefetchGeneration += 1;
  prefetchQueue.length = 0;
  for (const [key, clip] of preparedClips) {
    if (clip.status !== "loading") continue;
    clip.controller.abort();
    preparedClips.delete(key);
  }
}

function stopActiveSource(): void {
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      // Already finished.
    }
    activeSource = null;
  }
}

export function stopTTS(): void {
  browserSpeakToken += 1;
  speakAbort?.abort();
  speakAbort = null;
  stopActiveSource();
  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
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
  const controller = new AbortController();
  speakAbort = controller;
  const ctx = audioCtx();
  void ctx.resume().catch(() => {});

  const cleanText = text.trim();
  if (!cleanText) return () => {};

  const lang = langOption ?? detectSpeechLang(cleanText);
  const useBrowserEnglish = lang === "en-US" && isBrowserEnglishVoice(voice);

  if (useBrowserEnglish) {
    onEngineUsed?.("Browser-Google");
    playBrowserTTS(cleanText, "en-US", voice, onStart, onEnd, onError);
    return () => stopTTS();
  }

  const zeroVoice = isZeroTtsVoice(voice) ? voice : "maichi";
  const browserFallbackLang = lang === "en-US" ? "en-US" : "vi-VN";
  const browserFallbackVoice = lang === "en-US" ? "google-en-us" : null;
  let handedOff = false;
  const failOver = () => {
    if (handedOff || controller.signal.aborted) return;
    handedOff = true;
    onEngineUsed?.("Browser-Google");
    playBrowserTTS(cleanText, browserFallbackLang, browserFallbackVoice, onStart, onEnd, onError);
  };

  if (controller.signal.aborted) return () => {};

  const clipId = clipKey(zeroVoice, cleanText);
  const prepared = preparedClips.get(clipId);
  if (prepared) {
    try {
      const blob = prepared.blob ?? (await prepared.promise);
      if (controller.signal.aborted) return () => {};
      onEngineUsed?.("ZeroTTS");
      await playCompleteWav(new Uint8Array(await blob.arrayBuffer()), controller.signal, { onStart, onEnd });
      return () => stopTTS();
    } catch {
      if (controller.signal.aborted) return () => {};
      preparedClips.delete(clipId);
    }
  }

  let heard = false;
  let synthesisClosed = false;
  const closeSynthesis = () => {
    if (synthesisClosed) return;
    synthesisClosed = true;
    endSynthesis();
  };
  beginSynthesis();
  try {
    const blob = await downloadClip(zeroVoice, cleanText, controller.signal);
    closeSynthesis();
    if (controller.signal.aborted) return () => {};
    rememberClip(zeroVoice, cleanText, blob);
    onEngineUsed?.("ZeroTTS");
    await playCompleteWav(new Uint8Array(await blob.arrayBuffer()), controller.signal, {
      onStart: () => {
        heard = true;
        onStart?.();
      },
      onEnd,
    });
    return () => stopTTS();
  } catch {
    if (controller.signal.aborted) return () => {};
    if (!heard) failOver();
    else onError?.();
    return () => stopTTS();
  } finally {
    closeSynthesis();
  }
}

function audioCtx(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Play one saved recording at its original speed. */
async function playCompleteWav(
  wav: Uint8Array,
  signal: AbortSignal,
  hooks: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const ctx = audioCtx();
  try {
    await ctx.resume();
  } catch {
    // Fall through to an <audio> element when the context cannot start.
  }
  if (ctx.state !== "running") {
    await playBufferedWav([wav], signal, hooks);
    return;
  }
  const copy = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  const decoded = await ctx.decodeAudioData(copy as ArrayBuffer);
  if (signal.aborted) return;
  await new Promise<void>((resolve, reject) => {
    const source = ctx.createBufferSource();
    activeSource = source;
    source.buffer = decoded;
    source.connect(ctx.destination);
    const finish = () => {
      if (activeSource === source) activeSource = null;
      resolve();
    };
    source.onended = () => {
      finish();
      if (!signal.aborted) hooks.onEnd?.();
    };
    signal.addEventListener("abort", () => {
      try {
        source.stop();
      } catch {
        // Already finished.
      }
      finish();
    }, { once: true });
    try {
      source.start();
      hooks.onStart?.();
    } catch (error) {
      finish();
      reject(error);
    }
  });
}

function playBufferedWav(
  chunks: Uint8Array[],
  signal: AbortSignal,
  hooks: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const wav = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (wav.byteLength >= 44) {
    const view = new DataView(wav.buffer);
    const dataSize = wav.byteLength - 44;
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(40, dataSize, true);
  }
  const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  const audio = new Audio(url);
  currentAudio = audio;
  return new Promise((resolve, reject) => {
    const release = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    audio.onplay = () => hooks.onStart?.();
    audio.onended = () => {
      release();
      hooks.onEnd?.();
      resolve();
    };
    audio.onerror = () => {
      release();
      reject(new Error("wav playback failed"));
    };
    signal.addEventListener("abort", () => {
      audio.pause();
      release();
      resolve();
    }, { once: true });
    void audio.play().catch((error: unknown) => {
      release();
      reject(error);
    });
  });
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

  const token = ++browserSpeakToken;
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

  // cancel() and speak() in the same turn is silent in Chrome and Edge.
  window.setTimeout(() => {
    if (token !== browserSpeakToken) return;
    window.speechSynthesis.speak(utterance);
  }, 60);
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
