import { useEffect, useState } from 'react'
import {
  MessageCircle,
  Star,
  ListChecks,
  Code2,
  Lightbulb,
  Clock,
  Database,
  Copy,
  Check,
  Plus,
  Mic,
  Repeat,
  Square,
  Camera,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import type { AnswerCard, FollowUpEntry } from '@shared/transcript-types'
import type { ShortcutId } from '@shared/ipc-contract'
import { MarkdownLite } from './MarkdownLite'
import { useSessionStore } from '../../stores/session-store'
import { useOverlayStore } from '../../stores/overlay-store'
import { reAskCard, askFollowUp } from './ask-ai'

/**
 * No free-text box here on purpose: typing a sentence into a floating window
 * mid-interview is a visible behavioral tell even though the overlay's
 * content itself is hidden from screen capture. These canned asks cover the
 * realistic set of things someone wants appended, each reachable via a
 * single click OR a silent global shortcut that needs no mouse movement away
 * from the shared coding editor at all. Anything open-ended goes through
 * voice instead (the Speak chip below) rather than typing.
 */
const FOLLOW_UP_CHIPS: { label: string; instruction: string; shortcutId: ShortcutId; hint: string }[] = [
  { label: '+ Code', instruction: 'Add the code for this.', shortcutId: 'follow-up-code', hint: 'Alt+Shift+C' },
  {
    label: '+ More detail',
    instruction: 'Give more detail on this answer.',
    shortcutId: 'follow-up-detail',
    hint: 'Alt+Shift+D'
  },
  {
    label: '+ Complexity',
    instruction: 'Add the time and space complexity for this.',
    shortcutId: 'follow-up-complexity',
    hint: 'Alt+Shift+X'
  }
]

interface AnswerBody {
  answer: string
  keySteps?: string[]
  code?: { language: string; content: string }
  explanation?: string
  timeComplexity?: string
  spaceComplexity?: string
}

export function AnswerCardView({ card }: { card: AnswerCard }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(false)
  const [questionDraft, setQuestionDraft] = useState(card.question)
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const voiceFollowUpCardId = useOverlayStore((s) => s.voiceFollowUpCardId)
  const setVoiceFollowUpCardId = useOverlayStore((s) => s.setVoiceFollowUpCardId)
  const reCaptureCardId = useOverlayStore((s) => s.reCaptureCardId)
  const setReCaptureCardId = useOverlayStore((s) => s.setReCaptureCardId)
  const micStatus = useOverlayStore((s) => s.sttStatus.mic)
  const systemStatus = useOverlayStore((s) => s.sttStatus.system)

  const busy = card.status === 'streaming' || followUpBusy
  const voiceArmedForThisCard = voiceFollowUpCardId === card.id
  const reCaptureArmedForThisCard = reCaptureCardId === card.id
  const micReady = micStatus === 'listening'
  const systemReady = systemStatus === 'listening'

  async function sendFollowUp(instruction: string): Promise<void> {
    if (!instruction.trim() || busy) return
    setFollowUpBusy(true)
    await askFollowUp(card.id, instruction.trim(), useSessionStore.getState().form)
    setFollowUpBusy(false)
  }

  function toggleVoiceFollowUp(): void {
    if (busy) return
    setVoiceFollowUpCardId(voiceArmedForThisCard ? null : card.id)
  }

  function toggleReCapture(): void {
    if (busy) return
    setReCaptureCardId(reCaptureArmedForThisCard ? null : card.id)
  }

  async function handleScreenshot(): Promise<void> {
    if (busy) return
    setFollowUpBusy(true)
    try {
      const result = await window.mynai.screenshotCapture()
      if (result.error || !result.dataUrl) {
        toast.error(result.error ?? 'Screenshot capture failed.')
        return
      }
      await askFollowUp(
        card.id,
        'Use the attached screenshot — it may show code, a diagram, or on-screen context — to inform or extend this answer.',
        useSessionStore.getState().form,
        result.dataUrl
      )
    } finally {
      setFollowUpBusy(false)
    }
  }

  // Global shortcuts fire from the main process regardless of window focus —
  // the whole point is triggering a follow-up without touching the mouse or
  // switching focus away from the shared coding editor. AnswerCardStack only
  // ever mounts the currently-active card, so this naturally scopes shortcut
  // handling to whichever card is in view.
  useEffect(() => {
    return window.mynai.onShortcutTriggered(({ id }) => {
      const chip = FOLLOW_UP_CHIPS.find((c) => c.shortcutId === id)
      if (chip) {
        sendFollowUp(chip.instruction)
      } else if (id === 'follow-up-voice') {
        toggleVoiceFollowUp()
      } else if (id === 'reask-relisten') {
        toggleReCapture()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, card.status, followUpBusy, voiceFollowUpCardId, reCaptureCardId, micStatus, systemStatus])

  async function handleCopy(): Promise<void> {
    const parts = [card.answer]
    if (card.keySteps?.length) {
      parts.push('\nKey Steps:\n' + card.keySteps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    }
    if (card.code) {
      parts.push(`\n\`\`\`${card.code.language}\n${card.code.content}\n\`\`\``)
    }
    if (card.explanation) {
      parts.push('\n' + card.explanation)
    }
    try {
      await navigator.clipboard.writeText(parts.join('\n'))
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  function handleReAsk(): void {
    const corrected = questionDraft.trim()
    if (!corrected || busy) return
    setEditingQuestion(false)
    reAskCard(card.id, corrected, useSessionStore.getState().form)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <Section icon={<MessageCircle size={14} />} label="Question">
          {editingQuestion ? (
            <div className="space-y-1.5">
              <textarea
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-white/15 bg-black/30 p-1.5 text-sm text-neutral-200 outline-none focus:border-white/30"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleReAsk}
                  disabled={busy || !questionDraft.trim()}
                  className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white transition hover:bg-white/25 disabled:opacity-40"
                >
                  Re-ask
                </button>
                <button
                  onClick={() => {
                    setQuestionDraft(card.question)
                    setEditingQuestion(false)
                  }}
                  className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-neutral-300">{card.question}</p>
              <div className="flex items-center gap-2">
                {/* Primary correction path: no typing. Arms system-audio
                    capture of the interviewer repeating the question — the
                    natural "can you repeat that?" is already normal
                    interview behavior, unlike typing into an unknown window. */}
                <button
                  onClick={toggleReCapture}
                  disabled={busy || (!systemReady && !reCaptureArmedForThisCard)}
                  title={
                    reCaptureArmedForThisCard
                      ? 'Listening — press again once the interviewer finishes repeating it'
                      : systemReady
                        ? 'Question captured wrong? Ask the interviewer to repeat it, press this, then press it again when they finish (Alt+Shift+R)'
                        : 'Waiting for system audio to connect'
                  }
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition disabled:opacity-40 ${
                    reCaptureArmedForThisCard
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/15 hover:text-neutral-200'
                  }`}
                >
                  {reCaptureArmedForThisCard ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                      Listening… Stop &amp; Reask
                      <Square size={9} />
                    </>
                  ) : (
                    <>
                      <Repeat size={10} />
                      Re-listen
                      <span className="text-neutral-600">Alt+Shift+R</span>
                    </>
                  )}
                </button>
                {/* Fallback for when the interviewer can't be asked to repeat
                    (e.g. they've moved on) — typed correction, kept but demoted. */}
                <button
                  onClick={() => {
                    setQuestionDraft(card.question)
                    setEditingQuestion(true)
                  }}
                  title="Fallback: type the correct question yourself"
                  className="text-[10px] text-neutral-600 underline decoration-dotted transition hover:text-neutral-400"
                >
                  Edit manually
                </button>
              </div>
            </div>
          )}
        </Section>
        <button
          onClick={handleCopy}
          className="ml-2 shrink-0 rounded-md p-1.5 text-neutral-500 transition hover:bg-white/10 hover:text-neutral-300"
          title="Copy answer"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>

      <AnswerBodyView body={card} />

      {card.status === 'streaming' && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
          Streaming...
        </div>
      )}

      {card.followUps?.map((entry, i) => <FollowUpBlock key={i} entry={entry} />)}

      {card.pendingFollowUp && <PendingFollowUpBlock pending={card.pendingFollowUp} busy={followUpBusy} />}

      {card.status !== 'streaming' && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
          {FOLLOW_UP_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendFollowUp(chip.instruction)}
              disabled={busy}
              title={chip.hint}
              className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-neutral-300 transition hover:bg-white/15 disabled:opacity-40"
            >
              <Plus size={11} />
              {chip.label}
              <span className="text-[10px] text-neutral-600">{chip.hint}</span>
            </button>
          ))}
          <button
            onClick={handleScreenshot}
            disabled={busy}
            title="Capture the screen and attach it as context for this question — useful when the interviewer shared a coding question visually (shared editor, pasted chat, a second portal)"
            className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-neutral-300 transition hover:bg-white/15 disabled:opacity-40"
          >
            <Camera size={11} />
            Screenshot
          </button>
          <button
            onClick={toggleVoiceFollowUp}
            disabled={busy || (!micReady && !voiceArmedForThisCard)}
            title={
              voiceArmedForThisCard
                ? 'Listening — click to cancel'
                : micReady
                  ? 'Speak a follow-up (Alt+Shift+V)'
                  : 'Turn on mic first to use voice follow-up'
            }
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition disabled:opacity-40 ${
              voiceArmedForThisCard
                ? 'bg-red-500/20 text-red-300'
                : 'bg-white/5 text-neutral-300 hover:bg-white/15'
            }`}
          >
            {voiceArmedForThisCard ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Listening…
                <X size={11} />
              </>
            ) : (
              <>
                <Mic size={11} />
                Speak
                <span className="text-[10px] text-neutral-600">Alt+Shift+V</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function AnswerBodyView({ body }: { body: AnswerBody }): React.JSX.Element {
  return (
    <>
      <Section icon={<Star size={14} />} label="Answer">
        <MarkdownLite text={body.answer} />
      </Section>

      {body.keySteps && body.keySteps.length > 0 && (
        <Section icon={<ListChecks size={14} />} label="Key Steps">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-200">
            {body.keySteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>
      )}

      {body.code && (
        <Section icon={<Code2 size={14} />} label="Code">
          <pre className="overflow-x-auto rounded-lg bg-black/60 p-3 font-mono text-xs leading-relaxed text-emerald-200">
            <code>{body.code.content}</code>
          </pre>
        </Section>
      )}

      {body.explanation && (
        <Section icon={<Lightbulb size={14} />} label="Explanation">
          <MarkdownLite text={body.explanation} />
        </Section>
      )}

      {(body.timeComplexity || body.spaceComplexity) && (
        <div className="flex gap-4 text-xs text-neutral-400">
          {body.timeComplexity && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> Time: {body.timeComplexity}
            </span>
          )}
          {body.spaceComplexity && (
            <span className="flex items-center gap-1">
              <Database size={12} /> Space: {body.spaceComplexity}
            </span>
          )}
        </div>
      )}
    </>
  )
}

function FollowUpBlock({ entry }: { entry: FollowUpEntry }): React.JSX.Element {
  const isError = entry.answer.startsWith('⚠️')
  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-medium text-neutral-400">↳ {entry.instruction}</p>
      {entry.imageDataUrl && (
        <img
          src={entry.imageDataUrl}
          alt="Attached screenshot"
          className="max-h-24 w-auto rounded border border-white/10 object-contain"
        />
      )}
      {isError ? (
        <p className="text-xs text-red-400">{entry.answer}</p>
      ) : (
        <AnswerBodyView body={entry} />
      )}
    </div>
  )
}

function PendingFollowUpBlock({
  pending,
  busy
}: {
  pending: Omit<FollowUpEntry, 'createdAt'>
  busy: boolean
}): React.JSX.Element {
  const isError = pending.answer.startsWith('⚠️')
  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-medium text-neutral-400">↳ {pending.instruction}</p>
      {pending.imageDataUrl && (
        <img
          src={pending.imageDataUrl}
          alt="Attached screenshot"
          className="max-h-24 w-auto rounded border border-white/10 object-contain"
        />
      )}
      {isError ? (
        <p className="text-xs text-red-400">{pending.answer}</p>
      ) : (
        <>
          <AnswerBodyView body={pending} />
          {busy && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
              Adding...
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({
  icon,
  label,
  children
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}
