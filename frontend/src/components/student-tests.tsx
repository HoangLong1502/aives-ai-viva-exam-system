"use client";

import { PageHeader } from "@/components/admin/ui/dashboard-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  EraserIcon,
  MicIcon,
  SparklesIcon,
  TimerIcon,
  Volume2Icon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSTT } from "@/lib/stt-service";
import { formatBloom } from "@/lib/teacher/labels";
import {
  detectSpeechLang,
  normalizeEnVoice,
  normalizeViVoice,
  playTTS,
  stopTTS,
  voiceForSpeech,
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
  attemptStatus: "IN_PROGRESS" | "SUBMITTED" | null;
  durationMinutes: number | null;
  remainingSeconds: number | null;
  /** Seconds the student has for each answer; 0 means no limit. */
  answerTimeLimitSec: number;
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

type Phase = "countdown" | "speaking" | "ready" | "listening" | "evaluating" | "choose" | "done";

type TurnRecord = {
  questionId: string;
  turnNo: number;
  turnType: "MAIN" | "FOLLOW_UP";
  questionText: string;
  transcript: string;
  feedback: string;
};

type Bubble = {
  id: string;
  role: "examiner" | "student";
  text: string;
};

// The examiner starts reading the question immediately; no waiting countdown.
const COUNTDOWN_START = 0;

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

/** Rebuilds the conversation of every question from the turns stored on the server. */
function buildHistory(questions: Question[], turns: TurnRecord[]): Record<string, Bubble[]> {
  const history: Record<string, Bubble[]> = {};
  for (const question of questions) {
    const list = [bubble("examiner", question.prompt, `q-${question.id}`)];
    const own = turns.filter((turn) => turn.questionId === question.id).sort((a, b) => a.turnNo - b.turnNo);
    for (const turn of own) {
      if (turn.turnType === "FOLLOW_UP" && turn.questionText.trim()) {
        list.push(bubble("examiner", turn.questionText, `h-${turn.turnNo}-q`));
      }
      if (turn.transcript.trim()) list.push(bubble("student", turn.transcript, `h-${turn.turnNo}-a`));
      if (turn.feedback.trim()) list.push(bubble("examiner", turn.feedback, `h-${turn.turnNo}-f`));
    }
    history[question.id] = list;
  }
  return history;
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
    // Browser speech synthesis sometimes never fires onend (no voice installed, long utterance, background
    // tab). Without this the exam would wait on the examiner forever, so give up a little after the line
    // should have finished.
    const words = text.trim().split(/\s+/).length;
    const fallback = window.setTimeout(() => finish(), 4000 + words * 450);
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
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
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [turnHistory, setTurnHistory] = useState<TurnRecord[]>([]);
  const [startIndex, setStartIndex] = useState(0);

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
      const fresh = await api<Session[]>("/api/student/exams", { auth: true });
      // Resume where the student left off: questions they already answered are not asked again.
      const turns = await api<TurnRecord[]>(`/api/student/exams/${session.id}/turns`, { auth: true });
      const answered = new Set(turns.map((turn) => turn.questionId));
      const firstOpen = next.findIndex((question) => !answered.has(question.id));
      setAnsweredIds([...answered]);
      setTurnHistory(turns);
      setStartIndex(firstOpen === -1 ? Math.max(0, next.length - 1) : firstOpen);
      setActiveSession(fresh.find((item) => item.id === session.id) ?? session);
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
      {activeSession ? null : (
        <PageHeader
          eyebrow={t("student.tests.eyebrow")}
          title={t("student.tests.title")}
          description={t("student.tests.lead")}
        />
      )}

      {activeSession ? (
        <VivaExamRoom
          session={activeSession}
          questions={questions}
          answeredIds={answeredIds}
          turns={turnHistory}
          initialIndex={startIndex}
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
              <Card className="transition-shadow duration-150 hover:shadow-raised">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.06] text-primary">
                      <MicIcon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="font-serif text-xl leading-tight">{session.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {session.teacherName} · {session.subjectName} ·{" "}
                        {session.format === "ORAL"
                          ? t("student.tests.oral")
                          : t("student.tests.multipleChoice")}
                        {session.durationMinutes
                          ? ` · ${t("student.tests.minutesShort", { count: String(session.durationMinutes) })}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {session.attemptStatus === "SUBMITTED" ? (
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset dark:text-emerald-300">
                        {t("student.tests.submitted")}
                        {session.score != null ? ` · ${t("student.tests.score")} ${session.score}` : ""}
                      </span>
                      <Button variant="outline" nativeButton={false} render={<Link href="/student/scores" />}>
                        {t("student.tests.viewScore")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={loadingQuestions}
                      onClick={() => void enter(session)}
                    >
                      {session.attemptStatus === "IN_PROGRESS"
                        ? t("student.tests.resume")
                        : t("student.tests.enter")}
                    </Button>
                  )}
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
  answeredIds,
  turns,
  initialIndex,
  onClose,
  onComplete,
}: {
  session: Session;
  questions: Question[];
  answeredIds: string[];
  turns: TurnRecord[];
  initialIndex: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t, locale } = useLocale();
  const answerLimitSec = session.answerTimeLimitSec ?? 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [activeVoice, setActiveVoice] = useState("maichi");
  const [activeEnVoice, setActiveEnVoice] = useState("maichi");
  const [voiceReady, setVoiceReady] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationItem>>({});
  const [submittingExam, setSubmittingExam] = useState(false);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(null);
  const [bubbleMap, setBubbleMap] = useState<Record<string, Bubble[]>>(() => buildHistory(questions, turns));
  const [trackedIndex, setTrackedIndex] = useState(initialIndex);
  const [deadline] = useState<number | null>(() =>
    session.remainingSeconds != null
      ? Date.now() + session.remainingSeconds * 1000
      : session.durationMinutes != null
        ? Date.now() + session.durationMinutes * 60_000
        : null,
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    deadline == null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );
  // Per-answer clock: starts once the examiner has finished asking, survives a replay of the question.
  const [answerDeadline, setAnswerDeadline] = useState<number | null>(null);
  const [answerSecondsLeft, setAnswerSecondsLeft] = useState<number | null>(null);

  const currentQuestion = questions[currentIndex];
  if (currentQuestion && trackedIndex !== currentIndex) {
    setTrackedIndex(currentIndex);
    setFollowUpPrompt(null);
    setCountdown(COUNTDOWN_START);
    setPhase("countdown");
    setAnswerDeadline(null);
    setAnswerSecondsLeft(null);
  }
  const bubbles = currentQuestion
    ? (bubbleMap[currentQuestion.id] ?? [bubble("examiner", currentQuestion.prompt, `q-${currentQuestion.id}`)])
    : [];
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : undefined;
  const speechLang: SpeechLang = detectSpeechLang(followUpPrompt || currentQuestion?.prompt || "");
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, error: sttError } =
    useSTT({ lang: speechLang });

  const [typedAnswer, setTypedAnswer] = useState("");
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
  const answerStartedRef = useRef(0);
  const answerDeadlineRef = useRef<number | null>(null);
  const countdownSpokenRef = useRef<number | null>(null);
  const bubbleSeq = useRef(0);
  const questionsRef = useRef(questions);
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
    const question = questionsRef.current[indexRef.current];
    if (!question) return;
    setBubbleMap((all) => {
      const prev = all[question.id] ?? [bubble("examiner", question.prompt, `q-${question.id}`)];
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.text === clean) return all;
      return { ...all, [question.id]: [...prev, bubble(role, clean, id)] };
    });
  }, []);

  const startAnswerClock = useCallback(() => {
    if (answerStartedRef.current !== 0) return;
    const started = Date.now();
    answerStartedRef.current = started;
    if (answerLimitSec <= 0) return;
    answerDeadlineRef.current = started + answerLimitSec * 1000;
    setAnswerDeadline(answerDeadlineRef.current);
    setAnswerSecondsLeft(answerLimitSec);
  }, [answerLimitSec]);

  const stopAnswerClock = useCallback(() => {
    answerStartedRef.current = 0;
    answerDeadlineRef.current = null;
    setAnswerDeadline(null);
    setAnswerSecondsLeft(null);
  }, []);

  const beginAfterSpeech = useCallback((run: number, after: "listen" | "choose") => {
    if (!mountedRef.current || run !== runRef.current) return;
    submittingRef.current = false;
    resetTranscriptRef.current();
    listenStartedRef.current = Date.now();
    if (after === "listen") {
      startAnswerClock();
      // The student presses "Start speaking" when ready; the mic is not opened automatically.
      setExamPhase("ready");
      return;
    }
    setExamPhase("choose");
    startListeningRef.current();
  }, [setExamPhase, startAnswerClock]);

  const speakThenListen = useCallback((text: string, after: "listen" | "choose") => {
    const run = ++runRef.current;
    stopListeningRef.current();
    setExamPhase("speaking");
    const lang = detectSpeechLang(text);
    // Same guard as speakLine: carry on even if the speech engine never reports that it finished.
    let done = false;
    const begin = () => {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      beginAfterSpeech(run, after);
    };
    const fallback = window.setTimeout(begin, 4000 + text.trim().split(/\s+/).length * 450);
    void playTTS(text, {
      voice: voiceForSpeech(lang, voiceRef.current, enVoiceRef.current),
      lang,
      onEnd: begin,
      onError: begin,
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
    answerStartedRef.current = 0;
    answerDeadlineRef.current = null;
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
    if (phase !== "countdown" || !voiceReady) return;
    if (countdown > 0) {
      const id = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
      return () => window.clearTimeout(id);
    }
    const question = questions[currentIndex];
    if (!question || countdownSpokenRef.current === currentIndex) return;
    countdownSpokenRef.current = currentIndex;
    speakThenListenRef.current(question.prompt, "listen");
  }, [phase, countdown, currentIndex, questions, voiceReady]);

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
      toast.error(err instanceof ApiError ? err.message : tRef.current("student.tests.submitFailed"));
      setExamPhase("done");
    } finally {
      setSubmittingExam(false);
    }
  }, [onComplete, session.id, setExamPhase]);

  const submitAnswer = useCallback(async (raw: string, timeUp = false) => {
    if (submittingRef.current) return;
    // When the answer clock runs out the answer is sent as it stands, even mid-replay or before speaking.
    const allowed: Phase[] = timeUp ? ["listening", "ready", "speaking"] : ["listening"];
    if (!allowed.includes(phaseRef.current)) return;
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
          durationMs: Math.max(0, Date.now() - (answerStartedRef.current || listenStartedRef.current)),
          followUpQuestion: followUpRef.current,
        },
      });
      if (!mountedRef.current) return;
      stopAnswerClock();
      parentTurnRef.current = result.turnId;
      setEvaluations((prev) => ({ ...prev, [question.id]: result }));
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
        if (last) {
          // The exam only ends when the student submits it.
          pushBubble("examiner", tRef.current("student.tests.allDoneHint"));
          setExamPhase("done");
        } else setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
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
      if (err instanceof ApiError && err.status === 409 && /time is up for this question/i.test(err.message)) {
        stopAnswerClock();
        toast.warning(tRef.current("student.tests.questionTimeUp"));
        if (indexRef.current >= questions.length - 1) {
          setExamPhase("done");
        } else setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
        return;
      }
      if (!parent && err instanceof ApiError && err.status === 409 && /already been answered/i.test(err.message)) {
        stopAnswerClock();
        // Resuming after a reload: this question was already answered, so move on.
        if (indexRef.current >= questions.length - 1) {
          pushBubble("examiner", tRef.current("student.tests.allDoneHint"));
          setExamPhase("done");
        } else setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
        return;
      }
      toast.error(err instanceof ApiError ? err.message : tRef.current("student.tests.answerFailed"));
      listenStartedRef.current = Date.now();
      setExamPhase("listening");
      startListeningRef.current();
    } finally {
      submittingRef.current = false;
    }
  }, [pushBubble, questions, session.id, setExamPhase, stopAnswerClock]);

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
      // Skipping the last question never submits; the student reviews and submits explicitly.
      stopAnswerClock();
      setExamPhase("done");
      return;
    }
    setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
  }, [questions.length, setExamPhase, stopAnswerClock]);

  const goToQuestion = useCallback((index: number) => {
    if (phaseRef.current === "evaluating" || index === indexRef.current) return;
    runRef.current += 1;
    submittingRef.current = false;
    stopListeningRef.current();
    stopTTS();
    resetTranscriptRef.current();
    setCurrentIndex(index);
  }, []);

  const startAnswering = useCallback(() => {
    if (phaseRef.current !== "ready" && phaseRef.current !== "speaking") return;
    runRef.current += 1;
    stopTTS();
    submittingRef.current = false;
    resetTranscriptRef.current();
    listenStartedRef.current = Date.now();
    setExamPhase("listening");
    startListeningRef.current();
  }, [setExamPhase]);

  const clearAnswer = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    stopListeningRef.current();
    resetTranscriptRef.current();
    listenStartedRef.current = Date.now();
    startListeningRef.current();
    toast.message(tRef.current("student.tests.answerCleared"));
  }, []);

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

  const finishRef = useRef(finishExam);
  useEffect(() => {
    finishRef.current = finishExam;
  }, [finishExam]);

  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        runRef.current += 1;
        toast.warning(tRef.current("student.tests.timeUp"));
        void finishRef.current();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (answerDeadline == null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((answerDeadline - Date.now()) / 1000));
      setAnswerSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        toast.warning(tRef.current("student.tests.answerTimeUp"));
        void submitRef.current(transcriptRef.current, true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [answerDeadline]);

  function requestSubmit() {
    if (submittingExam) return;
    const unanswered = questions.filter(
      (question) => !evaluations[question.id] && !answeredIds.includes(question.id),
    ).length;
    const message =
      unanswered > 0
        ? t("student.tests.confirmSubmitUnanswered", { count: String(unanswered) })
        : t("student.tests.confirmSubmit");
    if (window.confirm(message)) void finishExam();
  }

  function replay() {
    if (!currentQuestion || phase === "evaluating" || phase === "countdown") return;
    const text = followUpPrompt || currentQuestion.prompt;
    speakThenListen(text, phase === "choose" ? "choose" : "listen");
  }

  function requestLeave() {
    if (window.confirm(t("student.tests.confirmLeave"))) leave();
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
            {t("student.tests.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status =
    phase === "countdown"
      ? t("student.tests.examinerSpeaking")
      : phase === "ready"
        ? t("student.tests.readyHint")
        : phase === "speaking"
        ? t("student.tests.examinerSpeaking")
        : phase === "listening"
          ? t("student.tests.listening")
          : phase === "evaluating"
            ? t("student.tests.thinking")
            : phase === "choose"
              ? t("student.tests.choosePrompt")
              : t("student.tests.allDoneHint");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-4 shadow-soft ring-1 ring-foreground/[0.07] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl leading-tight">{session.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{session.subjectName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondsLeft != null ? (
            <div
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums ring-1 ring-inset ${
                secondsLeft <= 60 ? "bg-rose-500/10 text-rose-600 ring-rose-500/40" : "bg-muted text-foreground ring-foreground/10"
              }`}
              role="timer"
              aria-label={t("student.tests.timeLeft")}
            >
              <TimerIcon className="size-4" aria-hidden />
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </div>
          ) : null}
          <Button size="sm" disabled={submittingExam || phase === "evaluating"} onClick={requestSubmit}>
            {submittingExam ? t("student.tests.evaluating") : t("student.tests.finishExam")}
          </Button>
          <Button variant="ghost" size="sm" onClick={requestLeave}>
            {t("student.tests.pauseExit")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={t("student.tests.questionLabel", {
        current: String(currentIndex + 1),
        total: String(questions.length),
      })}>
        {questions.map((question, index) => {
          const evaluated = evaluations[question.id] ?? (answeredIds.includes(question.id) ? true : undefined);
          const current = index === currentIndex;
          return (
            <button
              type="button"
              key={question.id}
              onClick={() => goToQuestion(index)}
              disabled={phase === "evaluating" || submittingExam}
              className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-60 ${
                current
                  ? "bg-primary text-primary-foreground ring-primary"
                  : evaluated
                    ? "bg-emerald-500/10 text-emerald-800 ring-emerald-600/25 dark:text-emerald-300"
                    : "bg-card text-muted-foreground ring-foreground/10 hover:ring-foreground/25"
              }`}
            >
              {evaluated && !current ? <CheckCircle2Icon className="size-3.5 text-emerald-600" /> : null}
              {index + 1}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {t("student.tests.questionLabel", {
                current: String(currentIndex + 1),
                total: String(questions.length),
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              · {formatBloom(currentQuestion.bloom, locale)}
            </span>
            {answerSecondsLeft != null ? (
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${
                  answerSecondsLeft <= 10 ? "bg-rose-500/10 text-rose-600 ring-rose-500/40" : "bg-muted ring-foreground/10"
                }`}
                role="timer"
                aria-label={t("student.tests.answerTimeLeft")}
              >
                <TimerIcon className="size-3.5" aria-hidden />
                {String(Math.floor(answerSecondsLeft / 60)).padStart(2, "0")}:
                {String(answerSecondsLeft % 60).padStart(2, "0")}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            {phase === "listening" && isListening ? (
              <MicIcon className="size-4 animate-pulse text-rose-500" />
            ) : phase === "evaluating" ? (
              <Loader2Icon className="size-4 animate-spin text-primary" />
            ) : phase === "speaking" ? (
              <Volume2Icon className="size-4 animate-pulse text-primary" />
            ) : null}
            <span className="text-sm text-muted-foreground">{status}</span>
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

          {process.env.NODE_ENV !== "production" && phase === "listening" ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = typedAnswer.trim();
                if (!text) return;
                setTypedAnswer("");
                stopListening();
                void submitAnswer(text);
              }}
            >
              <input
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                placeholder="Dev only: type an answer instead of speaking"
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" variant="outline" size="sm" disabled={!typedAnswer.trim()}>
                Send
              </Button>
            </form>
          ) : null}

          {sttError ? <p className="text-xs text-destructive">{sttError}</p> : null}
          {!isSupported ? (
            <p className="text-xs text-destructive">
              {t("student.tests.sttUnsupported")}
            </p>
          ) : null}

          {currentEvaluation ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5 text-primary" />
              {t("student.tests.answerScore", { score: String(currentEvaluation.score) })}
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
            {phase === "ready" || phase === "speaking" ? (
              <Button type="button" onClick={startAnswering}>
                <MicIcon className="size-4" />
                {t("student.tests.beginSpeaking")}
              </Button>
            ) : null}
            {phase === "listening" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!transcript.trim()}
                  onClick={clearAnswer}
                >
                  <EraserIcon className="size-4" />
                  {t("student.tests.clearAnswer")}
                </Button>
                <Button
                  type="button"
                  disabled={!transcript.trim()}
                  onClick={() => void submitAnswer(transcript)}
                >
                  <MicIcon className="size-4" />
                  {t("student.tests.speakDone")}
                </Button>
              </div>
            ) : null}
            {phase === "done" ? (
              <Button type="button" disabled={submittingExam} onClick={requestSubmit}>
                {submittingExam ? t("student.tests.evaluating") : t("student.tests.finishExam")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
