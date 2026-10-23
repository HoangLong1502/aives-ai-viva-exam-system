"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

export type UseSTTOptions = {
  lang?: "vi-VN" | "en-US";
  continuous?: boolean;
  onFinalResult?: (transcript: string) => void;
};

type SpeechAlternative = { transcript: string };

type SpeechResult = SpeechAlternative[] & { isFinal?: boolean };

type SpeechResultList = ArrayLike<SpeechResult>;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: { error: string }) => void) | null;
  onresult:
    | ((
        this: SpeechRecognitionInstance,
        ev: { results: SpeechResultList }
      ) => void)
    | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function joinSpeech(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function useSTT(options: UseSTTOptions = {}) {
  const { lang = "vi-VN", continuous = true, onFinalResult } = options;
  const { t } = useLocale();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported] = useState(() => getSpeechRecognition() !== null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  const wantListenRef = useRef(false);
  const baseRef = useRef("");
  const liveRef = useRef("");
  const langRef = useRef(lang);
  const continuousRef = useRef(continuous);
  const restartTimerRef = useRef<number | null>(null);
  const openRecognitionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    langRef.current = lang;
    continuousRef.current = continuous;
  }, [lang, continuous]);

  const openRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || !wantListenRef.current) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = langRef.current;
      recognition.continuous = continuousRef.current;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let sessionFinal = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const piece = result?.[0]?.transcript ?? "";
          if (result?.isFinal) sessionFinal += piece;
          else interim += piece;
        }
        const combined = joinSpeech(baseRef.current, sessionFinal, interim);
        liveRef.current = combined;
        setTranscript(combined);
        if (sessionFinal.trim()) {
          onFinalResultRef.current?.(combined);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          wantListenRef.current = false;
          setIsListening(false);
          setError(tRef.current("student.tests.micBlocked"));
          return;
        }
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("SpeechRecognition error:", event.error);
        }
      };

      recognition.onend = () => {
        baseRef.current = liveRef.current.trim();
        if (!wantListenRef.current) {
          setIsListening(false);
          return;
        }
        if (restartTimerRef.current != null) {
          window.clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (wantListenRef.current) openRecognitionRef.current?.();
        }, 250);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.error("Lỗi khi mở microphone:", err);
      wantListenRef.current = false;
      setIsListening(false);
      setError(tRef.current("student.tests.micFailed"));
    }
  }, []);

  useEffect(() => {
    openRecognitionRef.current = openRecognition;
  }, [openRecognition]);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError(tRef.current("student.tests.sttUnsupported"));
      return;
    }
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    wantListenRef.current = true;
    baseRef.current = "";
    liveRef.current = "";
    setTranscript("");
    setError(null);
    openRecognition();
  }, [openRecognition]);

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.abort();
      } catch {
        // Ignored
      }
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    baseRef.current = "";
    liveRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      if (restartTimerRef.current != null) {
        window.clearTimeout(restartTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // Ignored
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}
