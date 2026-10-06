"use client"; // Đánh dấu Component này chạy ở phía Client (cho Next.js App Router)

import React, { useState, useEffect, useRef } from 'react'

// ============================================================================
// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU (TYPES)
// ============================================================================

/** Thông tin Ngân hàng câu hỏi */
export type Bank = {
  id: string
  name: string
  rubric: string                // Tên Rubric chấm điểm
  criteria: number              // Số lượng tiêu chí chấm
  scale: string                 // Thang điểm (ví dụ: 0-10)
  bloom: [number, number, number, number] | number[] // Phân bổ thang Bloom [Nhớ, Hiểu, Vận dụng, Phân tích]
  status: 'approved' | 'pending' | string             // Trạng thái phê duyệt
  updated: string
}

/** Thông tin Chủ đề / Chương học */
export type Topic = {
  id: string
  name: string
  banks: Bank[]                 // Danh sách ngân hàng câu hỏi thuộc topic này
}

/** Thông tin Môn học */
export type Subject = {
  id: string
  code: string                  // Mã môn (ví dụ: PRN231)
  name: string                  // Tên môn
  assigned: boolean             // Giảng viên đã được phân công dạy môn này chưa
  topics: Topic[]               // Danh sách chủ đề thuộc môn học
}

/** Thông tin Giảng viên */
export type Lecturer = {
  name: string
  id: string
  dept?: string
  initials?: string
}

/** Mức độ Bloom và màu sắc hiển thị trên thanh biểu đồ */
export type BloomLevel = {
  k: string                    // Tên mức độ (Remember, Understand, ...)
  c: string                    // Mã màu Hex
}

/** Mục trên thanh điều hướng (nếu cần) */
export type NavigationItem = {
  label: string
  icon: string
  group?: string
  active?: boolean
}

/** Cấu hình phiên thi AI hoàn chỉnh (dữ liệu trả ra khi bấm Start hoặc Finish) */
export type SessionConfig = {
  subject: Subject
  topic: Topic
  bank: Bank
  minutes: number              // Thời gian tối đa cho 1 câu trả lời
  followUps: number            // Số câu hỏi phụ tối đa
  stt: 'vi' | 'en'             // Ngôn ngữ nhận dạng giọng nói (Speech-to-Text)
  tts: 'vi' | 'en'             // Ngôn ngữ AI phát âm (Text-to-Speech)
}

/** Props truyền từ Component cha vào TeacherTests */
export interface TeacherTestsProps {
  subjects?: Subject[]
  lecturer?: Lecturer
  navItems?: NavigationItem[]
  bloomLevels?: BloomLevel[]
  onStartSession?: (config: SessionConfig) => void  // Callback gọi khi bấm nút Start
  onFinishSetup?: (config: SessionConfig) => void   // Callback gọi khi hoàn tất thiết lập
}

// ============================================================================
// 2. GIÁ TRỊ MẶC ĐỊNH VÀ DỮ LIỆU DỰ PHÒNG (FALLBACKS)
// ============================================================================

/** Cấu hình màu sắc hiển thị mặc định cho thang đo Bloom */
const DEFAULT_BLOOM: BloomLevel[] = [
  { k: 'Remember', c: '#e8b84a' },   // Nhớ (Vàng)
  { k: 'Understand', c: '#8fb996' }, // Hiểu (Xanh lá nhạt)
  { k: 'Apply', c: '#3f8f7a' },      // Vận dụng (Xanh lá đậm)
  { k: 'Analyze', c: '#d8452a' },    // Phân tích (Đỏ)
]

/** Dữ liệu rỗng dự phòng (Tránh crash màn hình khi API chưa trả về dữ liệu) */
const EMPTY_SUBJECT: Subject = {
  id: '__no-subject__',
  code: '—',
  name: 'No subjects available',
  assigned: false,
  topics: [
    {
      id: '__no-topic__',
      name: 'No topics available',
      banks: [
        {
          id: '__no-bank__',
          name: 'No question bank available',
          rubric: '',
          criteria: 0,
          scale: '—',
          bloom: [0, 0, 0, 0],
          status: 'pending',
          updated: '—',
        },
      ],
    },
  ],
}

/** Các bước trong quy trình thiết lập (Wizard Steps) */
const STEPS = [
  { title: 'Input data', group: 'Group 1' },
  { title: 'Interview rules', group: 'Group 3' },
  { title: 'AI & access', group: 'Group 7' },
]

/** Danh sách ngôn ngữ hỗ trợ */
const LANGS = [
  { v: 'vi' as const, label: 'Vietnamese', sub: 'vi-VN' },
  { v: 'en' as const, label: 'English', sub: 'en-US' },
]

// ============================================================================
// 3. SUB-COMPONENTS GIAO DIỆN PHỤ TRỢ (HELPER COMPONENTS)
// ============================================================================

/** Khung phân chia từng Section trong trang */
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6 pb-10">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="font-mono text-3xl font-bold text-primary sm:text-4xl">{n}</span>
        <div>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

/** Tiêu đề nhỏ cho ô nhập liệu */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  )
}

/** Thanh Biểu đồ tỷ lệ Bloom (Bloom Distribution Bar) */
function BloomBar({ bloom, bloomLevels = DEFAULT_BLOOM, height = 8 }: { bloom: number[]; bloomLevels?: BloomLevel[]; height?: number }) {
  const safeBloom = bloom || []
  const total = safeBloom.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-muted" style={{ height }}>
      {safeBloom.map((v, i) => (
        <div
          key={i}
          style={{ width: `${(v / total) * 100}%`, background: bloomLevels[i]?.c || '#94a3b8' }}
          title={`${bloomLevels[i]?.k || 'Level ' + (i + 1)}: ${v}`}
        />
      ))}
    </div>
  )
}

/** Ô nhập số tự điều chỉnh và validate gián tiếp thông qua 'draft' state */
function NumberInput({ value, onChange, min, max, unit, label }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string; label: string }) {
  const [draft, setDraft] = useState(String(value))

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={label}
        onChange={(e) => {
          const nextDraft = e.target.value
          if (!/^\d*$/.test(nextDraft)) return // Chỉ cho phép nhập ký tự số
          setDraft(nextDraft)

          if (nextDraft !== '') {
            const nextValue = Number(nextDraft)
            if (nextValue >= min && nextValue <= max) onChange(nextValue)
          }
        }}
        onBlur={() => {
          // Chuẩn hóa giá trị khi người dùng click ra ngoài input (onBlur)
          const parsed = Number(draft)
          const nextValue = Number.isFinite(parsed) && draft !== ''
            ? Math.min(max, Math.max(min, parsed))
            : min
          setDraft(String(nextValue))
          onChange(nextValue)
        }}
        className="w-16 appearance-none bg-transparent text-center font-mono text-2xl font-medium tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  )
}

/** Component chọn 1 trong 2 tùy chọn dạng Button Tab (Segmented Control) */
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; sub: string }[] }) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const on = o.v === value
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={`rounded-md border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-ring ${
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:border-foreground/50 text-foreground'
            }`}
          >
            <span className="flex items-center justify-between text-sm font-semibold">
              {o.label}
              <span className={`size-3 rounded-full border ${on ? 'border-primary-foreground bg-primary-foreground' : 'border-muted-foreground'}`} />
            </span>
            <span className={`font-mono text-[11px] ${on ? 'opacity-80' : 'text-muted-foreground'}`}>{o.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

const selectCls =
  'w-full appearance-none rounded-md border border-border bg-card px-4 py-3 pr-10 text-[15px] font-medium transition text-foreground focus-visible:outline-2 focus-visible:outline-ring'

// ============================================================================
// 4. COMPONENT CHÍNH (TEACHER TESTS)
// ============================================================================

export default function TeacherTests({
  subjects = [],
  bloomLevels = DEFAULT_BLOOM,
  onStartSession,
  onFinishSetup,
}: TeacherTestsProps) {
  // Check xem có dữ liệu môn học từ API truyền vào hay không
  const hasSubjectData = subjects.length > 0
  const availableSubjects = hasSubjectData ? subjects : [EMPTY_SUBJECT]

  // --- STATES QUẢN LÝ CẤU HÌNH DỮ LIỆU CHỌN ---
  const [subjectId, setSubjectId] = useState<string>(availableSubjects[0]?.id || '')
  const [topicId, setTopicId] = useState<string>(availableSubjects[0]?.topics?.[0]?.id || '')
  const [bankId, setBankId] = useState<string>(availableSubjects[0]?.topics?.[0]?.banks?.[0]?.id || '')

  // --- STATES QUẢN LÝ QUY TẮC PHỎNG VẤN AI ---
  const [minutes, setMinutes] = useState(2)         // Thời gian trả lời (phút)
  const [followUps, setFollowUps] = useState(2)     // Số câu hỏi đào sâu
  const [stt, setStt] = useState<'vi' | 'en'>('vi')  // Ngôn ngữ nhận diện
  const [tts, setTts] = useState<'vi' | 'en'>('vi')  // Ngôn ngữ nói

  // --- STATES QUẢN LÝ TRẠNG THÁI LUỒNG GIAO DIỆN ---
  const [phase, setPhase] = useState<'idle' | 'launching' | 'live'>('idle') // Trạng thái kích hoạt session
  const [step, setStep] = useState(0)                // Bước hiện tại trong Wizard (0 -> 2)
  const [finished, setFinished] = useState(false)    // Đã bấm Finish chuyển sang trang Tổng quan chưa

  // Dùng Ref lưu Timer để dễ dàng clear, tránh bug Memory Leak hoặc Race Condition
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const clearExistingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // Cleanup Timer khi Component unmount
  useEffect(() => {
    return () => clearExistingTimer()
  }, [])

  // --- TRÍCH XUẤT DỮ LIỆU ĐƯỢC CHỌN TƯƠNG ỨNG ---
  const subject = availableSubjects.find((s) => s.id === subjectId) || availableSubjects[0]
  const topic = subject?.topics?.find((t) => t.id === topicId) || subject?.topics?.[0]
  const bank = topic?.banks?.find((b) => b.id === bankId) || topic?.banks?.[0]
  
  // Tổng số câu hỏi có trong bank
  const total = bank ? (bank.bloom ?? []).reduce((a, b) => a + b, 0) : 0

  // Điều kiện để cho phép Bắt đầu phỏng vấn: Đã gán giảng viên, Ngân hàng câu hỏi đã approved và có rubric
  const allowed = Boolean(hasSubjectData && subject?.assigned && bank?.status === 'approved' && bank.rubric)

  // --- HÀM XỬ LÝ HÀNH ĐỘNG (HANDLERS) ---
  
  /** Chuyển bước trong Wizard */
  function go(n: number) {
    if (n < 0 || n >= STEPS.length || n === step) return
    clearExistingTimer()
    setStep(n)
    setPhase('idle')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Hoàn tất cấu hình -> Chuyển sang màn hình Summary */
  function finish() {
    clearExistingTimer()
    setFinished(true)
    setPhase('idle')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (hasSubjectData && onFinishSetup && subject && topic && bank) {
      onFinishSetup({ subject, topic, bank, minutes, followUps, stt, tts })
    }
  }

  /** Chọn Môn học -> Tự động reset Topic & Bank liên quan về mục đầu tiên */
  function pickSubject(id: string) {
    const s = availableSubjects.find((x) => x.id === id)
    if (!s) return
    clearExistingTimer()
    setSubjectId(id)

    const firstTopic = s.topics?.[0]
    const firstBank = firstTopic?.banks?.[0]

    setTopicId(firstTopic?.id || '')
    setBankId(firstBank?.id || '')
    setPhase('idle')
  }

  /** Chọn Topic -> Tự động reset Bank liên quan về mục đầu tiên */
  function pickTopic(id: string) {
    if (!subject) return
    const t = subject.topics.find((x) => x.id === id)
    if (!t) return
    clearExistingTimer()
    setTopicId(id)

    const firstBank = t.banks?.[0]
    setBankId(firstBank?.id || '')
    setPhase('idle')
  }

  /** Giả lập Bắt đầu Session AI (chờ 1.2s rồi kích hoạt callback) */
  function start() {
    if (!hasSubjectData || !allowed || phase !== 'idle') return
    setPhase('launching')
    clearExistingTimer()
    timerRef.current = setTimeout(() => {
      setPhase('live')
      if (onStartSession && subject && topic && bank) {
        onStartSession({ subject, topic, bank, minutes, followUps, stt, tts })
      }
    }, 1200)
  }

  const maxDuration = total * minutes * (1 + followUps)
  const langName = (l: 'vi' | 'en') => (l === 'vi' ? 'Vietnamese' : 'English')

  // ============================================================================
  // 5. RENDER GIAO DIỆN (JSX)
  // ============================================================================
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        
        {/* ==================== TRƯỜNG HỢP 1: MÀN HÌNH TỔNG QUAN (SUMMARY) ==================== */}
        {finished ? (
          <div key="summary" className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg sm:p-8">
            
            {/* Nút quay lại chỉnh sửa */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => { clearExistingTimer(); setFinished(false); setPhase('idle') }}
                className="text-sm text-primary underline underline-offset-4 transition hover:opacity-80"
              >
                ← Back to setup
              </button>
            </div>

            {/* Thông số tổng quan (Số câu, Thời gian, Câu hỏi phụ) */}
            <div className="relative mt-8 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                [String(total), 'questions'],
                [`${minutes}`, 'min / answer'],
                [followUps ? `≤${followUps}` : '0', 'follow-ups'],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="font-mono text-5xl font-bold leading-none sm:text-6xl text-foreground">{v}</p>
                  <p className="mt-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{l}</p>
                </div>
              ))}
            </div>

            {/* Bảng chi tiết cấu hình đã chọn */}
            <dl className="relative mt-8 grid gap-x-8 border-t border-border sm:grid-cols-2">
              {[
                ['Subject', hasSubjectData && subject ? `${subject.code} · ${subject.name}` : 'Not selected'],
                ['Topic', hasSubjectData ? topic?.name || '—' : 'Not selected'],
                ['Question bank', hasSubjectData ? bank?.name || '—' : 'Not selected'],
                ['Rubric', hasSubjectData && bank ? `${bank.rubric || '—'} · ${bank.criteria} criteria` : 'Not selected'],
                ['STT / TTS', `${langName(stt)} / ${langName(tts)}`],
                ['Est. per candidate', total > 0 ? `~${maxDuration} min max` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-border py-4">
                  <dt className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{k}</dt>
                  <dd className="mt-1 text-[15px] leading-snug font-semibold text-foreground">{v}</dd>
                  {k === 'Est. per candidate' && total > 0 && (
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {total} questions × {minutes} min × {followUps + 1} responses max
                    </dd>
                  )}
                </div>
              ))}
            </dl>

            {/* Phân bổ Bloom trong Ngân hàng câu hỏi */}
            {hasSubjectData && bank && (
              <div className="relative mt-8">
                <p className="mb-3 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Bloom distribution</p>
                <BloomBar bloom={bank.bloom} bloomLevels={bloomLevels} height={12} />
                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                  {bloomLevels.map((b, i) => (
                    <span key={b.k} className="flex items-center gap-2 text-muted-foreground">
                      <i className="size-2.5 rounded-full" style={{ background: b.c }} />
                      {b.k}
                      <b className="ml-auto font-mono font-medium text-foreground">{bank.bloom?.[i] ?? 0}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Nút hành động Bắt đầu / Dừng Session phỏng vấn AI */}
            <div className="relative mt-10">
              {phase === 'live' ? (
                <button
                  type="button"
                  onClick={() => { clearExistingTimer(); setPhase('idle') }}
                  className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-destructive px-6 py-4 text-lg font-semibold text-destructive-foreground transition hover:opacity-90"
                >
                  <span className="text-sm">■</span> Stop
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allowed || phase === 'launching'}
                  onClick={start}
                  className="group mx-auto flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-center text-lg font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{phase === 'launching' ? 'Launching…' : 'Start'}</span>
                  <span className="text-2xl transition group-enabled:group-hover:translate-x-1">{phase === 'launching' ? '◌' : '→'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ==================== TRƯỜNG HỢP 2: MÀN HÌNH WIZARD THIẾT LẬP (STEPS) ==================== */
          <>
            {/* THANH THỦ CÔNG TIẾN TRÌNH CÁC BƯỚC (STEPS INDICATOR) */}
            <ol className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-3">
              {STEPS.map((s, i) => {
                const done = i < step
                const cur = i === step
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      disabled={i > step}
                      onClick={() => go(i)}
                      className="group block w-full text-left disabled:cursor-default"
                    >
                      <span className="block h-1 overflow-hidden rounded-full bg-muted">
                        <span className={`block h-full bg-primary transition-all duration-500 ${done || cur ? 'w-full' : 'w-0'}`} />
                      </span>
                      <span className="mt-3 flex items-center gap-2.5">
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors ${
                            done
                              ? 'bg-emerald-600 text-white'
                              : cur
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border text-muted-foreground'
                          }`}
                        >
                          {done ? '✓' : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-semibold ${cur ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {s.title}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            {/* NỘI DUNG TƯƠNG ỨNG VỚI TỪNG BƯỚC */}
            <div>
              {/* --- BƯỚC 1: CHỌN MÔN, TOPIC VÀ NGÂN HÀNG CÂU HỎI --- */}
              {step === 0 && subject && (
                <Section n="01" title="Select input data">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Chọn Môn Học */}
                    <div>
                      <Label>Subject</Label>
                      <div className="relative">
                        <select className={selectCls} value={subject?.id || ''} onChange={(e) => pickSubject(e.target.value)}>
                          {availableSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} · {s.name}{s.assigned ? '' : ' (not assigned)'}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
                      </div>
                    </div>

                    {/* Chọn Chủ đề / Topic */}
                    <div>
                      <Label>Topic</Label>
                      <div className="relative">
                        <select className={selectCls} value={topic?.id || ''} onChange={(e) => pickTopic(e.target.value)}>
                          {subject.topics?.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
                      </div>
                    </div>
                  </div>

                  {/* Danh sách Ngân hàng câu hỏi thuộc Topic đã chọn */}
                  {topic && (
                    <div className="mt-6">
                      <Label>Question bank & rubric</Label>
                      <div className="grid gap-3">
                        {topic.banks?.map((b) => {
                          const on = b.id === bank?.id
                          const n = (b.bloom ?? []).reduce((a, c) => a + c, 0)
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => { clearExistingTimer(); setBankId(b.id); setPhase('idle') }}
                              className={`rounded-md border p-5 text-left transition ${
                                on
                                  ? 'border-primary bg-card shadow-md'
                                  : 'border-border bg-card/60 hover:border-foreground/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-foreground">{b.name}</p>
                                  <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                                    {b.rubric} · {b.criteria} criteria · {b.scale}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] ${
                                    b.status === 'approved'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-amber-500/10 text-amber-600'
                                  }`}
                                >
                                  {b.status === 'approved' ? '● Approved' : '○ Pending'}
                                </span>
                              </div>
                              <div className="mt-4 flex items-center gap-4">
                                <div className="flex-1">
                                  <BloomBar bloom={b.bloom} bloomLevels={bloomLevels} />
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">{n} questions</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Chi tiết thang đo Bloom của Ngân hàng câu hỏi đang chọn */}
                      {bank && (
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                          {bloomLevels.map((b, i) => (
                            <span key={b.k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <i className="size-2.5 rounded-full" style={{ background: b.c }} />
                              {b.k} <b className="font-mono text-foreground">{bank.bloom?.[i] ?? 0}</b>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* --- BƯỚC 2: THIẾT LẬP QUY TẮC PHỎNG VẤN --- */}
              {step === 1 && (
                <Section n="02" title="Set interview rules">
                  <div className="grid gap-8 sm:grid-cols-2">
                    <div>
                      <Label>Answer time limit</Label>
                      <NumberInput value={minutes} onChange={setMinutes} min={1} max={120} unit="minutes" label="Answer time limit" />
                    </div>
                    <div>
                      <Label>Adaptive follow-up</Label>
                      <NumberInput value={followUps} onChange={setFollowUps} min={1} max={20} unit="per question" label="Adaptive follow-up" />
                    </div>
                  </div>
                </Section>
              )}

              {/* --- BƯỚC 3: CẤU HÌNH NGÔN NGỮ AI --- */}
              {step === 2 && (
                <Section n="03" title="AI configuration">
                  <div className="grid gap-8 sm:grid-cols-2">
                    <div>
                      <Label>STT language (Speech-to-Text)</Label>
                      <Seg value={stt} onChange={setStt} options={LANGS} />
                    </div>
                    <div>
                      <Label>TTS language (Text-to-Speech)</Label>
                      <Seg value={tts} onChange={setTts} options={LANGS} />
                    </div>
                  </div>
                </Section>
              )}
            </div>

            {/* FOOTER ĐIỀU HƯỚNG CÁC BƯỚC (Back / Next / Finish) */}
            <footer className="flex items-center justify-between gap-4 border-t border-border pt-6">
              <button
                type="button"
                onClick={() => go(step - 1)}
                disabled={step === 0}
                className="rounded-md border border-border px-6 py-3 text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                ← Back
              </button>
              <span className="font-mono text-xs text-muted-foreground">
                Step {step + 1} / {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => go(step + 1)}
                  className="group rounded-md bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Next <span className="inline-block transition group-hover:translate-x-1">→</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="group rounded-md bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Finish <span className="inline-block transition group-hover:translate-x-1">→</span>
                </button>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

export { TeacherTests }