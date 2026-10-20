"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  MicIcon,
  SparklesIcon,
  TriangleAlertIcon,
  Volume2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSTT } from "@/lib/stt-service";
import {
  checkZeroTTSStatus,
  detectSpeechLang,
  normalizeEnVoice,
  normalizeViVoice,
  playTTS,
  stopTTS,
  voiceForSpeech,
  voiceLabel,
  type SpeechLang,
} from "@/lib/tts-service";

type Session = {
  id: string;
  title: string;
  format: string;
  subjectName: string;
  teacherName: string;
  entered: boolean;
  score: number | null;
};

type Question = {
  id: string;
  prompt: string;
  bloom: string;
  criteria: string;
  maxScore: number;
};

type NextAction = "NEXT" | "FOLLOW_UP" | "ASK_CONTINUE";

type EvaluationItem = {
  turnId: string;
  questionId: string;
  score: number;
  isSufficient: boolean;
  feedback: string;
  followUpQuestion?: string | null;
  /** "AI", or "RULE_BASED" when the AI grader was unavailable and the score is provisional. */
  evaluator: "AI" | "RULE_BASED";
  fallbackReason?: string | null;
  criteria?: CriterionScore[];
  nextAction?: NextAction;
};

type Phase = "countdown" | "speaking" | "listening" | "evaluating" | "choose" | "done";

type Bubble = {
  id: string;
  role: "examiner" | "student";
  text: string;
};

const COUNTDOWN_START = 5;

type SubmitResult = {
  score: number;
  answeredQuestions: number;
  totalQuestions: number;
};

type CriterionScore = {
  name: string;
  points: number;
  maxPoints: number;
  comment: string;
};

function bubble(role: Bubble["role"], text: string, key: string): Bubble {
  return { id: key, role, text: text.trim() };
}

function resolveAction(result: EvaluationItem): NextAction {
  if (
    result.nextAction === "NEXT" ||
    result.nextAction === "FOLLOW_UP" ||
    result.nextAction === "ASK_CONTINUE"
  ) {
    return result.nextAction;
  }
  if (result.score >= 100) return "NEXT";
  if (result.followUpQuestion) return "FOLLOW_UP";
  return "ASK_CONTINUE";
}

function interpretChoice(raw: string): "continue" | "next" | null {
  const text = raw.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const wantsNext =
    /(câu tiếp|câu mới|qua câu|chuyển câu|câu khác|next question|move on|\bskip\b|\bnext\b)/.test(text);
  const wantsContinue = /(trả lời tiếp|tiếp tục|câu này|nói tiếp|keep going|\bcontinue\b)/.test(text);
  if (wantsNext && !wantsContinue) return "next";
  if (wantsContinue && !wantsNext) return "continue";
  if (/^(qua|next|skip|không|no)$/.test(text)) return "next";
  if (/^(tiếp|có|yes|ok|okay)$/.test(text)) return "continue";
  return null;
}

function speakLine(text: string, viVoice: string, enVoice: string) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const lang = detectSpeechLang(text);
    void playTTS(text, {
      voice: voiceForSpeech(lang, viVoice, enVoice),
      lang,
      onEnd: finish,
      onError: finish,
    });
  });
}

export function StudentTests() {
  const { t } = useLocale();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  function load() {
    api<Session[]>("/api/student/exams", { auth: true })
      .then(setSessions)
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not load tests.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function enter(session: Session) {
    setLoadingQuestions(true);
    try {
      await api(`/api/student/exams/${session.id}/enter`, { method: "POST", auth: true });
      const next = await api<Question[]>(`/api/student/exams/${session.id}/questions`, {
        auth: true,
      });
      setActiveSession(session);
      setQuestions(next);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not enter that test.");
    } finally {
      setLoadingQuestions(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("student.tests.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{t("student.tests.title")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("student.tests.lead")}
        </p>
      </section>

      {activeSession ? (
        <VivaExamRoom
          session={activeSession}
          questions={questions}
          onClose={() => {
            stopTTS();
            setActiveSession(null);
            load();
          }}
          onComplete={() => {
            stopTTS();
            setActiveSession(null);
            load();
          }}
        />
      ) : (
        <ul className="space-y-4">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="font-serif text-2xl">{session.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-6">
                  <p className="text-sm text-muted-foreground">
                    {session.teacherName} · {session.subjectName} ·{" "}
                    {session.format === "ORAL"
                      ? t("student.tests.oral")
                      : t("student.tests.multipleChoice")}
                    {session.score != null ? ` · ${t("student.tests.score")} ${session.score}` : ""}
                  </p>
                  <Button
                    type="button"
                    disabled={loadingQuestions}
                    onClick={() => void enter(session)}
                  >
                    {session.entered ? t("student.tests.open") : t("student.tests.enter")}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VivaExamRoom({
  session,
  questions,
  onClose,
  onComplete,
}: {
  session: Session;
  questions: Question[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useLocale();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeVoice, setActiveVoice] = useState("maichi");
  const [activeEnVoice, setActiveEnVoice] = useState("maichi");
  const [voiceReady, setVoiceReady] = useState(false);
  const [isZeroTTSOnline, setIsZeroTTSOnline] = useState<boolean | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationItem>>({});
  const [submittingExam, setSubmittingExam] = useState(false);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>(() =>
    questions[0] ? [bubble("examiner", questions[0].prompt, `q-${questions[0].id}`)] : [],
  );
  const [trackedIndex, setTrackedIndex] = useState(currentIndex);

  const currentQuestion = questions[currentIndex];
  if (currentQuestion && trackedIndex !== currentIndex) {
    setTrackedIndex(currentIndex);
    setFollowUpPrompt(null);
    setBubbles([bubble("examiner", currentQuestion.prompt, `q-${currentQuestion.id}`)]);
    setCountdown(COUNTDOWN_START);
    setPhase("countdown");
  }
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : undefined;
  const speechLang: SpeechLang = detectSpeechLang(followUpPrompt || currentQuestion?.prompt || "");
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, error: sttError } =
    useSTT({ lang: speechLang });

  const runRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  const indexRef = useRef(currentIndex);
  const voiceRef = useRef(activeVoice);
  const enVoiceRef = useRef(activeEnVoice);
  const transcriptRef = useRef(transcript);
  const followUpRef = useRef<string | null>(followUpPrompt);
  const parentTurnRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const finishingRef = useRef(false);
  const mountedRef = useRef(true);
  const listenStartedRef = useRef(0);
  const countdownSpokenRef = useRef<number | null>(null);
  const bubbleSeq = useRef(0);
  const dialogueRef = useRef<HTMLDivElement>(null);
  const startListeningRef = useRef(startListening);
  const stopListeningRef = useRef(stopListening);
  const resetTranscriptRef = useRef(resetTranscript);
  const tRef = useRef(t);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
    resetTranscriptRef.current = resetTranscript;
  }, [startListening, stopListening, resetTranscript]);

  useEffect(() => {
    phaseRef.current = phase;
    indexRef.current = currentIndex;
    voiceRef.current = activeVoice;
    enVoiceRef.current = activeEnVoice;
    transcriptRef.current = transcript;
    followUpRef.current = followUpPrompt;
    tRef.current = t;
  }, [phase, currentIndex, activeVoice, activeEnVoice, transcript, followUpPrompt, t]);

  const setExamPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const pushBubble = useCallback((role: Bubble["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    bubbleSeq.current += 1;
    const id = `b-${bubbleSeq.current}`;
    setBubbles((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.text === clean) return prev;
      return [...prev, bubble(role, clean, id)];
    });
  }, []);

  const beginAfterSpeech = useCallback((run: number, after: "listen" | "choose") => {
    if (!mountedRef.current || run !== runRef.current) return;
    submittingRef.current = false;
    resetTranscriptRef.current();
    listenStartedRef.current = Date.now();
    setExamPhase(after === "listen" ? "listening" : "choose");
    startListeningRef.current();
  }, [setExamPhase]);

  const speakThenListen = useCallback((text: string, after: "listen" | "choose") => {
    const run = ++runRef.current;
    stopListeningRef.current();
    setExamPhase("speaking");
    const lang = detectSpeechLang(text);
    void playTTS(text, {
      voice: voiceForSpeech(lang, voiceRef.current, enVoiceRef.current),
      lang,
      onEnd: () => beginAfterSpeech(run, after),
      onError: () => beginAfterSpeech(run, after),
    });
  }, [beginAfterSpeech, setExamPhase]);

  const speakThenListenRef = useRef(speakThenListen);
  useEffect(() => {
    speakThenListenRef.current = speakThenListen;
  }, [speakThenListen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkZeroTTSStatus().then((online) => {
      if (!cancelled) setIsZeroTTSOnline(online);
    });
    api<{ ttsVoice?: string; ttsVoiceEn?: string }>("/api/student/speech", { auth: true })
      .then((settings) => {
        if (cancelled) return;
        setActiveVoice(normalizeViVoice(settings.ttsVoice));
        setActiveEnVoice(normalizeEnVoice(settings.ttsVoiceEn));
        setVoiceReady(true);
      })
      .catch(() => {
        if (!cancelled) setVoiceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "countdown" || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        next.getTracks().forEach((track) => track.stop());
      })
      .catch(() => {
        // Speech recognition will surface the permission error when listening starts.
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [phase, currentIndex]);

  useEffect(() => {
    runRef.current += 1;
    parentTurnRef.current = null;
    followUpRef.current = null;
    submittingRef.current = false;
    countdownSpokenRef.current = null;
    stopTTS();
    stopListening();
    resetTranscript();
    return () => {
      runRef.current += 1;
      stopTTS();
      stopListening();
    };
  }, [currentIndex, stopListening, resetTranscript]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown > 0) {
      const id = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
      return () => window.clearTimeout(id);
    }
    const question = questions[currentIndex];
    if (!question || countdownSpokenRef.current === currentIndex) return;
    countdownSpokenRef.current = currentIndex;
    speakThenListenRef.current(question.prompt, "listen");
  }, [phase, countdown, currentIndex, questions]);

  useEffect(() => {
    dialogueRef.current?.scrollTo({ top: dialogueRef.current.scrollHeight });
  }, [bubbles, transcript, phase]);

  const finishExam = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmittingExam(true);
    stopListeningRef.current();
    stopTTS();
    try {
      const result = await api<SubmitResult>(`/api/student/exams/${session.id}/submit`, {
        method: "POST",
        auth: true,
      });
      toast.success(
        tRef.current("student.tests.examFinishedWithScore", {
          score: String(result.score),
          answered: String(result.answeredQuestions),
          total: String(result.totalQuestions),
        }),
      );
      onComplete();
    } catch (err) {
      finishingRef.current = false;
      if (!mountedRef.current) return;
      toast.error(err instanceof ApiError ? err.message : "Lỗi khi nộp bài thi.");
      setExamPhase("done");
    } finally {
      setSubmittingExam(false);
    }
  }, [onComplete, session.id, setExamPhase]);

  const submitAnswer = useCallback(async (raw: string) => {
    if (submittingRef.current || phaseRef.current !== "listening") return;
    const question = questions[indexRef.current];
    if (!question) return;
    const answer = raw.trim();
    submittingRef.current = true;
    runRef.current += 1;
    stopListeningRef.current();
    stopTTS();
    setExamPhase("evaluating");

    const parent = parentTurnRef.current;
    const path = parent
      ? `/api/student/exams/${session.id}/turns/${parent}/answer`
      : `/api/student/exams/${session.id}/questions/${question.id}/answer`;

    try {
      const result = await api<EvaluationItem>(path, {
        method: "POST",
        auth: true,
        body: {
          answer,
          durationMs: Math.max(0, Date.now() - listenStartedRef.current),
          followUpQuestion: followUpRef.current,
        },
      });
      if (!mountedRef.current) return;
      parentTurnRef.current = result.turnId;
      setEvaluations((prev) => ({ ...prev, [question.id]: result }));
      if (result.evaluator === "RULE_BASED") {
        toast.warning(tRef.current("student.tests.ruleBasedToast"));
      }
      if (answer) pushBubble("student", answer);
      if (result.feedback) pushBubble("examiner", result.feedback);

      const action = resolveAction(result);
      if (action === "NEXT") {
        const last = indexRef.current >= questions.length - 1;
        const bridgeKey =
          result.score >= 100
            ? last
              ? "student.tests.perfectDone"
              : "student.tests.perfectMove"
            : last
              ? "student.tests.recordedDone"
              : "student.tests.recordedMove";
        const bridge = tRef.current(bridgeKey);
        pushBubble("examiner", bridge);
        setExamPhase("speaking");
        await speakLine(
          [result.feedback, bridge].filter(Boolean).join(" "),
          voiceRef.current,
          enVoiceRef.current,
        );
        if (!mountedRef.current) return;
        if (last) await finishExam();
        else setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
        return;
      }

      if (action === "FOLLOW_UP" && result.followUpQuestion) {
        followUpRef.current = result.followUpQuestion;
        setFollowUpPrompt(result.followUpQuestion);
        pushBubble("examiner", result.followUpQuestion);
        const spoken = [result.feedback, result.followUpQuestion].filter((part) => part && part.trim()).join(" ");
        speakThenListenRef.current(spoken, "listen");
        return;
      }

      const choice = tRef.current("student.tests.choosePrompt");
      pushBubble("examiner", choice);
      speakThenListenRef.current([result.feedback, choice].filter(Boolean).join(" "), "choose");
    } catch (err) {
      if (!mountedRef.current) return;
      toast.error(err instanceof ApiError ? err.message : "Không thể gửi câu trả lời.");
      listenStartedRef.current = Date.now();
      setExamPhase("listening");
      startListeningRef.current();
    } finally {
      submittingRef.current = false;
    }
  }, [finishExam, pushBubble, questions, session.id, setExamPhase]);

  const submitRef = useRef(submitAnswer);
  useEffect(() => {
    submitRef.current = submitAnswer;
  }, [submitAnswer]);

  const continueQuestion = useCallback(() => {
    if (phaseRef.current !== "choose") return;
    const question = questions[indexRef.current];
    if (!question) return;
    const prompt = followUpRef.current || question.prompt;
    pushBubble("examiner", prompt);
    speakThenListen(prompt, "listen");
  }, [pushBubble, questions, speakThenListen]);

  const skipQuestion = useCallback(() => {
    if (phaseRef.current === "evaluating" || phaseRef.current === "countdown") return;
    runRef.current += 1;
    submittingRef.current = false;
    stopListeningRef.current();
    stopTTS();
    resetTranscriptRef.current();
    if (indexRef.current >= questions.length - 1) {
      void finishExam();
      return;
    }
    setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
  }, [finishExam, questions.length]);

  const continueRef = useRef(continueQuestion);
  const skipRef = useRef(skipQuestion);
  useEffect(() => {
    continueRef.current = continueQuestion;
    skipRef.current = skipQuestion;
  }, [continueQuestion, skipQuestion]);

  useEffect(() => {
    if (phase !== "choose") return;
    if (transcript.trim().length < 2) return;
    const id = window.setTimeout(() => {
      if (phaseRef.current !== "choose") return;
      const choice = interpretChoice(transcriptRef.current);
      if (choice === "continue") continueRef.current();
      else if (choice === "next") skipRef.current();
      else toast.message(tRef.current("student.tests.chooseUnclear"));
    }, 1200);
    return () => window.clearTimeout(id);
  }, [phase, transcript]);

  function replay() {
    if (!currentQuestion || phase === "evaluating" || phase === "countdown") return;
    const text = followUpPrompt || currentQuestion.prompt;
    speakThenListen(text, phase === "choose" ? "choose" : "listen");
  }

  function leave() {
    mountedRef.current = false;
    runRef.current += 1;
    stopTTS();
    stopListening();
    onClose();
  }

  if (questions.length === 0 || !currentQuestion) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-muted-foreground">{t("student.tests.noQuestions")}</p>
          <Button variant="outline" onClick={leave}>
            Quay lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status =
    phase === "countdown"
      ? t("student.tests.countdown", { seconds: String(Math.max(countdown, 1)) })
      : phase === "speaking"
        ? t("student.tests.examinerSpeaking")
        : phase === "listening"
          ? t("student.tests.listening")
          : phase === "evaluating"
            ? t("student.tests.thinking")
            : phase === "choose"
              ? t("student.tests.choosePrompt")
              : t("student.tests.finishExam");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">{session.title}</h2>
          <p className="text-xs text-muted-foreground">
            {session.subjectName} · Giảng viên: {session.teacherName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`size-2 rounded-full ${
                speechLang === "en-US"
                  ? "bg-sky-500"
                  : isZeroTTSOnline
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-sky-500"
              }`}
            />
            <span className="font-medium text-muted-foreground">
              {speechLang === "en-US"
                ? t("student.tests.detectedLangEn")
                : t("student.tests.detectedLangVi")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("student.tests.voiceSelect")}{" "}
            <span className="font-medium text-foreground">
              {voiceLabel(speechLang === "en-US" ? activeEnVoice : activeVoice)}
              {!voiceReady ? "…" : ""}
            </span>
          </p>
          <Button variant="ghost" size="sm" onClick={leave}>
            Thoát ca thi
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={t("student.tests.questionLabel", {
        current: String(currentIndex + 1),
        total: String(questions.length),
      })}>
        {questions.map((question, index) => {
          const evaluated = evaluations[question.id];
          const current = index === currentIndex;
          return (
            <span
              key={question.id}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                current
                  ? "border-primary bg-primary/10 text-primary"
                  : evaluated
                    ? "border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              {evaluated ? <CheckCircle2Icon className="size-3.5 text-emerald-600" /> : null}
              {index + 1}
            </span>
          );
        })}
      </div>

      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {t("student.tests.questionLabel", {
                current: String(currentIndex + 1),
                total: String(questions.length),
              })}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Bloom: {currentQuestion.bloom}
            </span>
          </div>
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            {phase === "listening" && isListening ? (
              <MicIcon className="size-4 animate-pulse text-rose-500" />
            ) : phase === "evaluating" ? (
              <Loader2Icon className="size-4 animate-spin text-primary" />
            ) : phase === "speaking" ? (
              <Volume2Icon className="size-4 animate-pulse text-primary" />
            ) : null}
            <span className="text-sm font-medium">{status}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {phase === "countdown" && countdown > 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("student.tests.preparing")}
              </p>
              <p className="font-serif text-7xl tabular-nums text-primary">{countdown}</p>
            </div>
          ) : null}

          <div ref={dialogueRef} className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {bubbles.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.role === "student" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    item.role === "student"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {item.role === "student" ? t("student.tests.you") : t("student.tests.examiner")}
                  </p>
                  {item.text}
                </div>
              </div>
            ))}
          </div>

          {phase === "listening" || phase === "choose" ? (
            <div className="rounded-2xl border bg-muted/30 px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("student.tests.you")}
              </p>
              <p className="min-h-12 text-base leading-relaxed">
                {transcript.trim() ? (
                  transcript
                ) : (
                  <span className="text-muted-foreground">{t("student.tests.liveCaptionEmpty")}</span>
                )}
              </p>
              {phase === "listening" ? (
                <p className="mt-2 text-xs text-muted-foreground">{t("student.tests.speakDoneHint")}</p>
              ) : null}
            </div>
          ) : null}

          {sttError ? <p className="text-xs text-destructive">{sttError}</p> : null}
          {!isSupported ? (
            <p className="text-xs text-destructive">
              Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Google Chrome hoặc Microsoft Edge.
            </p>
          ) : null}

          {currentEvaluation?.evaluator === "RULE_BASED" ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t("student.tests.ruleBasedNotice")}
            </p>
          ) : null}

          {currentEvaluation ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5 text-primary" />
              {currentEvaluation.evaluator === "RULE_BASED"
                ? t("student.tests.provisionalScore", { score: String(currentEvaluation.score) })
                : t("student.tests.aiScore", { score: String(currentEvaluation.score) })}
            </p>
          ) : null}

          {phase === "choose" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={continueQuestion}>
                {t("student.tests.chooseContinue")}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={skipQuestion}>
                {t("student.tests.chooseNext")}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={phase === "evaluating" || phase === "countdown" || phase === "speaking"}
                onClick={replay}
              >
                <Volume2Icon className="size-4" />
                {t("student.tests.replay")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={phase === "evaluating" || phase === "countdown" || submittingExam}
                onClick={skipQuestion}
              >
                {t("student.tests.skipQuestion")}
              </Button>
            </div>
            {phase === "listening" ? (
              <Button
                type="button"
                disabled={!transcript.trim()}
                onClick={() => void submitAnswer(transcript)}
              >
                <MicIcon className="size-4" />
                {t("student.tests.speakDone")}
              </Button>
            ) : null}
            {phase === "done" ? (
              <Button type="button" disabled={submittingExam} onClick={() => void finishExam()}>
                {submittingExam ? t("student.tests.evaluating") : t("student.tests.finishExam")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
