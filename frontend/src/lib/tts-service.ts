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
  voice: string;
  text: string;
  blob?: Blob;
  promise: Promise<Blob>;
  controller: AbortController;
};

type PrefetchJob = {
  voice: string;
  text: string;
  promise: Promise<Blob>;
  resolve: (blob: Blob) => void;
  reject: (reason: unknown) => void;
};

const preparedClips = new Map<string, PreparedClip>();
const prefetchQueue: PrefetchJob[] = [];
/** Questions that wait until the one being read has finished loading. */
const parked: PrefetchJob[] = [];
let prefetchRunning = false;
let liveActive = 0;

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

function createJob(voice: string, text: string): PrefetchJob {
  let resolve!: (blob: Blob) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});
  return { voice, text, promise, resolve, reject };
}

/** One synthesis at a time. A ready or in-flight clip is reused, so playback never starts a second request. */
function enqueueClip(voice: string, text: string, front: boolean): Promise<Blob> {
  const key = clipKey(voice, text);
  const existing = preparedClips.get(key);
  if (existing) return existing.promise;

  const queuedIndex = prefetchQueue.findIndex((job) => clipKey(job.voice, job.text) === key);
  if (queuedIndex >= 0) {
    const [job] = prefetchQueue.splice(queuedIndex, 1);
    if (front) prefetchQueue.unshift(job);
    else prefetchQueue.push(job);
    return job.promise;
  }
  const parkedIndex = parked.findIndex((job) => clipKey(job.voice, job.text) === key);
  if (parkedIndex >= 0) {
    const [job] = parked.splice(parkedIndex, 1);
    if (front) prefetchQueue.unshift(job);
    else prefetchQueue.push(job);
    void runPrefetch();
    return job.promise;
  }

  const job = createJob(voice, text);
  if (front) prefetchQueue.unshift(job);
  else prefetchQueue.push(job);
  void runPrefetch();
  return job.promise;
}

let speakTail: Promise<void> = Promise.resolve();

/** Only one /speak may run. A second request makes the server cut the first utterance short. */
function enqueueSpeak<T>(task: () => Promise<T>): Promise<T> {
  const run = speakTail.then(task, task);
  speakTail = run.then(() => undefined, () => undefined);
  return run;
}

async function downloadClip(voice: string, text: string, signal: AbortSignal): Promise<Blob> {
  return enqueueSpeak(async () => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch(speakUrl(voice, text), { signal });
    if (!response.ok) throw new Error(`ZeroTTS ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    assertAudible(bytes, text);
    return wavBlob([bytes]);
  });
}

function releaseParked() {
  if (parked.length === 0) return;
  prefetchQueue.push(...parked.splice(0, parked.length));
}

function holdServer(): () => void {
  liveActive += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    liveActive = Math.max(0, liveActive - 1);
    if (liveActive === 0) {
      queueMicrotask(() => {
        if (liveActive === 0) void runPrefetch();
      });
    }
  };
}

function forgetQueued(voice: string, text: string) {
  const key = clipKey(voice, text);
  for (const queue of [prefetchQueue, parked]) {
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (clipKey(queue[i].voice, queue[i].text) !== key) continue;
      const [job] = queue.splice(i, 1);
      job.reject(new DOMException("Played live", "AbortError"));
    }
  }
}

function wavSeconds(bytes: Uint8Array): number {
  if (bytes.byteLength < 44) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = view.getUint32(24, true);
  if (!rate) return 0;
  return (bytes.byteLength - 44) / 2 / rate;
}

/** A preempted /speak still ends as HTTP 200 with a short fragment of a long question. */
function assertAudible(bytes: Uint8Array, text: string) {
  if (bytes.byteLength <= 44) throw new Error("ZeroTTS returned no audio");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = wavSeconds(bytes);
  const minimum = words >= 12 ? words * 0.22 : words >= 6 ? 0.45 : 0;
  if (seconds < minimum) throw new Error("ZeroTTS returned a cut-off recording");
}

function displaceInFlight(): PrefetchJob | null {
  for (const [key, clip] of preparedClips) {
    if (clip.status !== "loading") continue;
    const job = createJob(clip.voice, clip.text);
    clip.controller.abort();
    preparedClips.delete(key);
    return job;
  }
  return null;
}

async function runPrefetch() {
  if (prefetchRunning || liveActive > 0) return;
  prefetchRunning = true;
  try {
    while (prefetchQueue.length > 0 && liveActive === 0) {
      const job = prefetchQueue.shift();
      if (!job) break;
      const key = clipKey(job.voice, job.text);
      const already = preparedClips.get(key);
      if (already) {
        already.promise.then(job.resolve, job.reject);
        continue;
      }
      const controller = new AbortController();
      const clip: PreparedClip = {
        status: "loading",
        voice: job.voice,
        text: job.text,
        promise: job.promise,
        controller,
      };
      preparedClips.set(key, clip);
      try {
        const blob = await downloadClip(job.voice, job.text, controller.signal);
        clip.blob = blob;
        clip.status = "ready";
        job.resolve(blob);
        releaseParked();
      } catch (error) {
        if (preparedClips.get(key)?.controller === controller) preparedClips.delete(key);
        job.reject(error);
      }
    }
  } finally {
    prefetchRunning = false;
    if (liveActive === 0 && prefetchQueue.length > 0) void runPrefetch();
  }
}

function findJob(voice: string, text: string): PrefetchJob | null {
  const key = clipKey(voice, text);
  return (
    prefetchQueue.find((job) => clipKey(job.voice, job.text) === key) ??
    parked.find((job) => clipKey(job.voice, job.text) === key) ??
    null
  );
}

/** Load the current question first. Later questions stay parked until that file is ready. */
export function prefetchExamLines(lines: { text: string; voice: string }[]) {
  const jobs: PrefetchJob[] = [];
  const seen = new Set<string>();
  let currentLoading = false;
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || !isZeroTtsVoice(line.voice)) continue;
    const key = clipKey(line.voice, text);
    if (seen.has(key)) continue;
    seen.add(key);
    const clip = preparedClips.get(key);
    if (clip?.status === "ready") continue;
    if (clip?.status === "loading") {
      if (jobs.length === 0) currentLoading = true;
      continue;
    }
    jobs.push(findJob(line.voice, text) ?? createJob(line.voice, text));
  }
  prefetchQueue.length = 0;
  parked.length = 0;
  if (currentLoading) {
    parked.push(...jobs);
    return;
  }
  if (jobs.length === 0) return;
  prefetchQueue.push(jobs[0]);
  parked.push(...jobs.slice(1));
  void runPrefetch();
}

/** Stop background preparation when the student leaves the exam. Ready clips stay cached. */
export function cancelExamPrefetch() {
  const pending = prefetchQueue.splice(0, prefetchQueue.length);
  pending.push(...parked.splice(0, parked.length));
  for (const job of pending) job.reject(new DOMException("Aborted", "AbortError"));
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
  /** Start speaking as the first audio arrives. Exam questions wait for one whole recording. */
  immediate?: boolean;
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
    immediate = false,
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

  const cached = preparedClips.get(clipKey(zeroVoice, cleanText));
  let heard = false;
  try {
    if (cached?.status === "ready" && cached.blob) {
      onEngineUsed?.("ZeroTTS");
      await playCompleteWav(new Uint8Array(await cached.blob.arrayBuffer()), controller.signal, {
        onStart: () => {
          heard = true;
          onStart?.();
        },
        onEnd,
      });
      return () => stopTTS();
    }
    if (!immediate) {
      const release = holdServer();
      try {
        let blob: Blob;
        try {
          if (cached?.status === "ready" && cached.blob) blob = cached.blob;
          else if (cached?.status === "loading") blob = await cached.promise;
          else blob = await takeExamClip(zeroVoice, cleanText, controller.signal);
        } catch {
          if (controller.signal.aborted) return () => {};
          preparedClips.delete(clipKey(zeroVoice, cleanText));
          blob = await takeExamClip(zeroVoice, cleanText, controller.signal);
        }
        if (controller.signal.aborted) return () => {};
        release();
        onEngineUsed?.("ZeroTTS");
        await playCompleteWav(new Uint8Array(await blob.arrayBuffer()), controller.signal, {
          onStart: () => {
            heard = true;
            onStart?.();
          },
          onEnd,
        });
        return () => stopTTS();
      } finally {
        release();
      }
    }
    if (cached?.status === "loading") {
      const blob = await cached.promise;
      if (controller.signal.aborted) return () => {};
      onEngineUsed?.("ZeroTTS");
      await playCompleteWav(new Uint8Array(await blob.arrayBuffer()), controller.signal, {
        onStart: () => {
          heard = true;
          onStart?.();
        },
        onEnd,
      });
      return () => stopTTS();
    }
    onEngineUsed?.("ZeroTTS");
    await speakImmediate(zeroVoice, cleanText, controller.signal, {
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
  }
}

/** Download the question on its own while the server is held, so a background question cannot cancel it. */
async function takeExamClip(voice: string, text: string, signal: AbortSignal): Promise<Blob> {
  const key = clipKey(voice, text);
  const existing = preparedClips.get(key);
  if (existing?.status === "ready" && existing.blob) return existing.blob;
  if (existing?.status === "loading") return existing.promise;

  const displaced = displaceInFlight();
  if (displaced && clipKey(displaced.voice, displaced.text) !== key) parked.unshift(displaced);
  forgetQueued(voice, text);

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", abort, { once: true });
  const promise = downloadClip(voice, text, controller.signal);
  const clip: PreparedClip = {
    status: "loading",
    voice,
    text,
    promise,
    controller,
  };
  preparedClips.set(key, clip);
  try {
    const blob = await promise;
    if (preparedClips.get(key)?.controller === controller) {
      clip.blob = blob;
      clip.status = "ready";
      clip.promise = Promise.resolve(blob);
    }
    return blob;
  } catch (error) {
    if (preparedClips.get(key)?.controller === controller) preparedClips.delete(key);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

/** Break a reply into short sentences so each one can be loaded whole, then spoken smoothly. */
function replyPieces(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const rough = cleaned.split(/(?<=[.!?…。])\s+|\n+/);
  const pieces: string[] = [];
  for (const part of rough) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    if (words.length <= 14) {
      pieces.push(words.join(" "));
      continue;
    }
    let buf: string[] = [];
    for (const word of words) {
      buf.push(word);
      const atBreak = /[,;:]$/.test(word) && buf.length >= 8;
      if (atBreak || buf.length >= 14) {
        pieces.push(buf.join(" "));
        buf = [];
      }
    }
    if (buf.length > 0) pieces.push(buf.join(" "));
  }
  const merged: string[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    const count = piece.split(/\s+/).length;
    if (prev && count < 3 && prev.split(/\s+/).length + count <= 14) {
      merged[merged.length - 1] = `${prev} ${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged;
}

async function downloadSentence(voice: string, text: string, signal: AbortSignal): Promise<Blob> {
  const key = clipKey(voice, text);
  const existing = preparedClips.get(key);
  if (existing?.status === "ready" && existing.blob) return existing.blob;
  if (existing?.status === "loading") return existing.promise;
  const blob = await enqueueSpeak(async () => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch(speakUrl(voice, text), { signal });
    if (!response.ok) throw new Error(`ZeroTTS ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    assertAudible(bytes, text);
    return wavBlob([bytes]);
  });
  preparedClips.set(key, {
    status: "ready",
    voice,
    text,
    blob,
    promise: Promise.resolve(blob),
    controller: new AbortController(),
  });
  return blob;
}

/** Load one short sentence completely, play it in one piece, and prepare the next sentence while it plays. */
async function speakImmediate(
  voice: string,
  text: string,
  signal: AbortSignal,
  hooks: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const pieces = replyPieces(text);
  if (pieces.length === 0) return;
  const release = holdServer();
  forgetQueued(voice, text);
  const displaced = displaceInFlight();
  if (displaced) prefetchQueue.unshift(displaced);
  let played = false;
  let ended = false;
  const finish = () => {
    if (ended || signal.aborted) return;
    ended = true;
    hooks.onEnd?.();
  };
  try {
    let upcoming: Promise<Blob> | null = downloadSentence(voice, pieces[0], signal);
    for (let i = 0; i < pieces.length; i += 1) {
      let blob: Blob | null = null;
      try {
        blob = await upcoming;
      } catch {
        if (signal.aborted) return;
        blob = null;
      }
      if (!blob && !signal.aborted) {
        try {
          blob = await downloadSentence(voice, pieces[i], signal);
        } catch {
          if (signal.aborted) return;
          blob = null;
        }
      }
      if (signal.aborted) return;
      const next = pieces[i + 1];
      upcoming = next ? downloadSentence(voice, next, signal) : null;
      if (!blob) continue;
      const last = i === pieces.length - 1;
      await playCompleteWav(new Uint8Array(await blob.arrayBuffer()), signal, {
        onStart: played ? undefined : hooks.onStart,
        onEnd: last ? finish : undefined,
      });
      played = true;
      if (signal.aborted) return;
    }
    if (!played) throw new Error("ZeroTTS returned no audio");
    finish();
  } finally {
    release();
  }
}

function audioCtx(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Call from the click that opens the exam so the first question is allowed to play. */
export function primeTTS(): void {
  const ctx = audioCtx();
  void ctx.resume().catch(() => {});
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
