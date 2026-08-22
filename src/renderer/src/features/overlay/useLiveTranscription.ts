import { useEffect, useRef, useState } from 'react'
import { createAudioCapture } from '../audio/capture'
import type { AudioSource } from '../audio/source-state'
import { useOverlayStore } from '../../stores/overlay-store'
import { useSessionStore } from '../../stores/session-store'
import { isLikelyQuestion, isDuplicateQuestion, isLikelyGarbledTranscript } from './question-detector'
import { askAiAndAddCard, askFollowUp, reAskCard } from './ask-ai'

const AUTO_ANSWER_COOLDOWN_MS = 1200
const QUESTION_DETECTED_PULSE_MS = 2500
const RECENT_QUESTIONS_LIMIT = 20
/**
 * How long to wait after the interviewer stops talking before treating the
 * accumulated speech as a complete, answerable question. Firing on every
 * single AssemblyAI "final turn" the instant it looked question-shaped broke
 * coding prompts: interviewers describe them across several turns ("Write a
 * Python program" / pause / "that takes a list and returns the second
 * largest value"), and the old code answered the first clause before the
 * rest arrived. Waiting for a pause this long lets multi-turn prompts fully
 * accumulate, while staying short enough that a single-sentence theoretical
 * question still fires promptly the moment the interviewer stops talking.
 */
const SILENCE_DEBOUNCE_MS = 1800
/**
 * Used instead of SILENCE_DEBOUNCE_MS when the buffer doesn't yet end with
 * "?" — e.g. "So, uh, describe an AI project you led that failed." is
 * already a complete, dispatchable question on its own (matches
 * isLikelyQuestion), but interviewers routinely follow it with a related
 * second sentence half a beat later: "What went wrong and how did you
 * pivot?" A period-ending clause is a much weaker "I'm done talking" signal
 * than a question mark, so give it more room before committing — this is
 * what stops that from firing as two separate auto-answer cards.
 */
const SILENCE_DEBOUNCE_NO_QUESTION_MARK_MS = 4000
/** Safety valve: if the interviewer talks continuously with no pause longer
 *  than the debounce, don't wait forever — force an evaluation once the
 *  buffer has been accumulating this long. */
const MAX_BUFFER_MS = 45000
/** Voice follow-up: same silence-debounce idea as the auto-answer buffer
 *  above, but scoped to the user's own mic and much shorter — a follow-up
 *  instruction is a short, deliberate aside, not a multi-clause prompt. */
const VOICE_FOLLOWUP_SILENCE_MS = 1800
/** If nothing is said at all within this long after arming, auto-cancel
 *  rather than leaving voice follow-up armed indefinitely. */
const VOICE_FOLLOWUP_ARM_TIMEOUT_MS = 10000
/**
 * Re-listen is explicitly toggled on/off by the user (not silence-debounced
 * like the auto-answer pipeline or voice follow-up) — it's a rare,
 * deliberate, high-stakes recovery action, exactly the case where a guessed
 * pause is the wrong tool and explicit "I'm done" control is the right one.
 * Silence-based timing was cutting genuine questions off mid-sentence. This
 * is just a safety ceiling so it can't stay armed forever if the toggle-off
 * is forgotten — it force-finalizes with whatever was captured, it doesn't
 * silently discard.
 */
const RECAPTURE_MAX_ARM_MS = 90000
/**
 * "Connected" (sttStatus === 'listening') only means the WebSocket handshake
 * succeeded — it says nothing about whether the audio track underneath is
 * actually carrying sound. On Windows the old capture mechanism frequently
 * produced a track that "worked" with zero real audio data, and the UI had
 * no way to tell the difference: it just sat on "Listening…" forever. RMS
 * level below this floor counts as silence, not signal.
 */
const SIGNAL_NOISE_FLOOR = 0.01
const SYSTEM_SILENCE_CHECK_INTERVAL_MS = 5000
/** How long system audio can be connected with zero real signal before it's
 *  treated as dead — one auto-retry happens at this point, then a second
 *  miss surfaces a persistent, actionable error instead of staying silent. */
const SYSTEM_SILENCE_THRESHOLD_MS = 20000

interface RecentTurn {
  text: string
  timestamp: number
}

export function useLiveTranscription() {
  const addTranscriptMessage = useOverlayStore((s) => s.addTranscriptMessage)
  const setPartialText = useOverlayStore((s) => s.setPartialText)
  const setSttStatus = useOverlayStore((s) => s.setSttStatus)
  const setQuestionDetected = useOverlayStore((s) => s.setQuestionDetected)
  const [error, setError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(false)
  const [systemAudioIssue, setSystemAudioIssue] = useState(false)
  const lastSystemSignalAtRef = useRef(0)
  const systemListeningSinceRef = useRef<number | null>(null)
  const systemAutoRetriedRef = useRef(false)
  const captureRef = useRef(
    createAudioCapture(
      // Surfaced to the DevTools console (not the user) — this is what lets
      // us actually see, from a real test, whether getDisplayMedia returned
      // a real audio track and whether it's carrying sound, instead of
      // guessing from the silence watchdog's conclusion alone.
      (level, code, message) => {
        const log = level === 'error' ? console.error : console.log
        log(`[audio] ${code}: ${message}`)
      },
      (source: AudioSource, level: number) => {
        if (source === 'system' && level > SIGNAL_NOISE_FLOOR) {
          lastSystemSignalAtRef.current = Date.now()
          systemAutoRetriedRef.current = false
          setSystemAudioIssue(false)
        }
      },
      (source: AudioSource) => {
        // Fast path: the underlying track died (see capture.ts). Back-date
        // the "listening since" clock so the watchdog's very next tick
        // (~5s) treats this exactly like the 40s-silence case it already
        // knows how to recover from, instead of duplicating that logic here.
        if (source === 'system') {
          systemListeningSinceRef.current = Date.now() - SYSTEM_SILENCE_THRESHOLD_MS - 1
          lastSystemSignalAtRef.current = 0
        }
      }
    )
  )
  const lastAutoAnswerAtRef = useRef(0)
  const recentQuestionsRef = useRef<string[]>([])
  const bufferRef = useRef<RecentTurn[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceFollowUpBufferRef = useRef<RecentTurn[]>([])
  const voiceFollowUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceFollowUpArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reCaptureBufferRef = useRef<RecentTurn[]>([])
  const reCaptureCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const capture = captureRef.current

    function clearSilenceTimer(): void {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
    }

    function evaluateBuffer(): void {
      clearSilenceTimer()
      const turns = bufferRef.current
      bufferRef.current = []
      if (turns.length === 0) return

      const combinedText = turns.map((t) => t.text).join(' ')
      if (!isLikelyQuestion(combinedText)) return

      setQuestionDetected(true)
      setTimeout(() => setQuestionDetected(false), QUESTION_DETECTED_PULSE_MS)

      const { autoAnswerOn } = useOverlayStore.getState()
      if (!autoAnswerOn) return

      const now = Date.now()
      if (now - lastAutoAnswerAtRef.current < AUTO_ANSWER_COOLDOWN_MS) return
      if (isDuplicateQuestion(combinedText, recentQuestionsRef.current)) return

      lastAutoAnswerAtRef.current = now
      recentQuestionsRef.current = [...recentQuestionsRef.current, combinedText].slice(-RECENT_QUESTIONS_LIMIT)

      const { form } = useSessionStore.getState()
      askAiAndAddCard(combinedText, form)
    }

    function clearVoiceFollowUpTimers(): void {
      if (voiceFollowUpTimerRef.current) {
        clearTimeout(voiceFollowUpTimerRef.current)
        voiceFollowUpTimerRef.current = null
      }
      if (voiceFollowUpArmTimerRef.current) {
        clearTimeout(voiceFollowUpArmTimerRef.current)
        voiceFollowUpArmTimerRef.current = null
      }
    }

    function finalizeVoiceFollowUp(): void {
      clearVoiceFollowUpTimers()
      const turns = voiceFollowUpBufferRef.current
      voiceFollowUpBufferRef.current = []
      const { voiceFollowUpCardId, setVoiceFollowUpCardId } = useOverlayStore.getState()
      setVoiceFollowUpCardId(null)
      if (!voiceFollowUpCardId || turns.length === 0) return

      const instruction = turns.map((t) => t.text).join(' ').trim()
      if (!instruction) return

      const { form } = useSessionStore.getState()
      askFollowUp(voiceFollowUpCardId, instruction, form)
    }

    // Watches for a card arming voice follow-up (AnswerCardView calling
    // setVoiceFollowUpCardId) and starts the "nothing was said at all"
    // safety timeout right at that moment — the mic-turn handler below only
    // knows about turns that actually arrive, so it can't detect silence on
    // its own if the user never speaks after arming.
    const unsubVoiceArm = useOverlayStore.subscribe((state, prev) => {
      if (state.voiceFollowUpCardId && state.voiceFollowUpCardId !== prev.voiceFollowUpCardId) {
        voiceFollowUpBufferRef.current = []
        if (voiceFollowUpArmTimerRef.current) clearTimeout(voiceFollowUpArmTimerRef.current)
        voiceFollowUpArmTimerRef.current = setTimeout(() => {
          if (
            useOverlayStore.getState().voiceFollowUpCardId === state.voiceFollowUpCardId &&
            voiceFollowUpBufferRef.current.length === 0
          ) {
            useOverlayStore.getState().setVoiceFollowUpCardId(null)
          }
        }, VOICE_FOLLOWUP_ARM_TIMEOUT_MS)
      } else if (!state.voiceFollowUpCardId && prev.voiceFollowUpCardId) {
        // Cancelled externally (e.g. the card's cancel button) — drop any
        // partial capture rather than finalizing it.
        clearVoiceFollowUpTimers()
        voiceFollowUpBufferRef.current = []
      }
    })

    // cardId passed explicitly rather than read from the store: this is
    // called from the arm-watcher's "just unarmed" branch below, where the
    // store's CURRENT reCaptureCardId is already null — prev.reCaptureCardId
    // is the only place that still has it.
    function finalizeReCapture(cardId: string): void {
      if (reCaptureCeilingTimerRef.current) {
        clearTimeout(reCaptureCeilingTimerRef.current)
        reCaptureCeilingTimerRef.current = null
      }
      const turns = reCaptureBufferRef.current
      reCaptureBufferRef.current = []
      if (turns.length === 0) return // toggled off with nothing said — harmless no-op

      const capturedQuestion = turns.map((t) => t.text).join(' ').trim()
      if (!capturedQuestion) return

      const { form } = useSessionStore.getState()
      reAskCard(cardId, capturedQuestion, form)
    }

    // Re-listen is a manual toggle now, not silence-debounced: arming starts
    // the ~90s safety ceiling (see RECAPTURE_MAX_ARM_MS); the ONLY place that
    // finalizes is this same subscriber's "just unarmed" branch, which fires
    // identically whether the user explicitly clicked "Stop & Reask" or the
    // ceiling cleared it — one code path, no risk of double-dispatch.
    const unsubReCaptureArm = useOverlayStore.subscribe((state, prev) => {
      if (state.reCaptureCardId && state.reCaptureCardId !== prev.reCaptureCardId) {
        reCaptureBufferRef.current = []
        const armedCardId = state.reCaptureCardId
        if (reCaptureCeilingTimerRef.current) clearTimeout(reCaptureCeilingTimerRef.current)
        reCaptureCeilingTimerRef.current = setTimeout(() => {
          if (useOverlayStore.getState().reCaptureCardId === armedCardId) {
            useOverlayStore.getState().setReCaptureCardId(null)
          }
        }, RECAPTURE_MAX_ARM_MS)
      } else if (!state.reCaptureCardId && prev.reCaptureCardId) {
        if (reCaptureCeilingTimerRef.current) {
          clearTimeout(reCaptureCeilingTimerRef.current)
          reCaptureCeilingTimerRef.current = null
        }
        finalizeReCapture(prev.reCaptureCardId)
      }
    })

    const unsubStatus = window.mynai.onSttStatus((e) => {
      setSttStatus(e.source, e.status)
      if (e.status === 'listening') {
        setError(null)
        if (e.source === 'system') systemListeningSinceRef.current = Date.now()
      } else if (e.source === 'system') {
        systemListeningSinceRef.current = null
      }
    })
    const unsubPartial = window.mynai.onSttPartial((e) => setPartialText(e.source, e.text))
    const unsubFinal = window.mynai.onSttFinal((e) => {
      setPartialText(e.source, '')

      // Drop apparent ASR hallucinations (see isLikelyGarbledTranscript) before
      // they reach the transcript display or the auto-answer buffer — showing
      // garbage in the transcript and feeding it to the LLM as a "question" is
      // worse than silently dropping one turn's worth of audio.
      if (isLikelyGarbledTranscript(e.text)) return

      const message = {
        id: `${e.source}-${Date.now()}`,
        source: e.source,
        text: e.text,
        isFinal: true,
        timestamp: Date.now()
      }
      addTranscriptMessage(message)

      // Mirror to disk when the user opted in — separate from the in-memory
      // store above, which is capped to the last 50 messages for the live
      // UI strip and would silently truncate a saved transcript if reused
      // as the source of truth here.
      const { sessionId, form } = useSessionStore.getState()
      if (form.saveTranscript && sessionId) {
        window.mynai.appendTranscriptEntry(sessionId, message)
      }

      // Voice follow-up: while a card has arming enabled (user pressed "Speak"
      // or its shortcut), redirect the candidate's own mic speech into that
      // card's follow-up instruction instead of treating it as ordinary
      // transcript. Scoped and bounded — only active between arming and the
      // silence-debounce finalize (or explicit cancel) below.
      if (e.source === 'mic' && useOverlayStore.getState().voiceFollowUpCardId) {
        voiceFollowUpBufferRef.current.push({ text: e.text, timestamp: Date.now() })
        if (voiceFollowUpTimerRef.current) clearTimeout(voiceFollowUpTimerRef.current)
        voiceFollowUpTimerRef.current = setTimeout(finalizeVoiceFollowUp, VOICE_FOLLOWUP_SILENCE_MS)
      }

      // Re-listen: while a card has Re-listen armed, redirect system-audio
      // turns (the interviewer's voice) into the re-capture buffer INSTEAD
      // of the normal auto-answer path below — the early return is load
      // bearing. Without it, the interviewer repeating the question on
      // request would also feed the normal detector and spawn an unrelated
      // duplicate card at the same time as the targeted card regenerates.
      if (e.source === 'system' && useOverlayStore.getState().reCaptureCardId) {
        // No per-turn timer here — accumulation just continues until the
        // user explicitly toggles off (or the safety ceiling above fires).
        reCaptureBufferRef.current.push({ text: e.text, timestamp: Date.now() })
        return
      }

      // Question detection only runs on the "system" stream (the call's shared/output
      // audio — the interviewer and other participants). The "mic" stream is the user's
      // own voice; feeding your own answers back into the question detector is what was
      // causing your own responses to trigger auto-answer. This mirrors ParakeetAI's
      // dual-stream model: share stream = other party, mic = you.
      if (e.source !== 'system') return

      const now = Date.now()
      bufferRef.current.push({ text: e.text, timestamp: now })

      const oldestAge = now - bufferRef.current[0].timestamp
      clearSilenceTimer()
      if (oldestAge >= MAX_BUFFER_MS) {
        evaluateBuffer()
      } else {
        const combinedSoFar = bufferRef.current.map((t) => t.text).join(' ').trim()
        const debounce = combinedSoFar.endsWith('?') ? SILENCE_DEBOUNCE_MS : SILENCE_DEBOUNCE_NO_QUESTION_MARK_MS
        silenceTimerRef.current = setTimeout(evaluateBuffer, debounce)
      }
    })
    const unsubError = window.mynai.onSttError((e) => setError(e.error))

    // Connected-but-silent watchdog: sttStatus only reflects the WebSocket
    // handshake, not whether the audio track carries real sound. If system
    // audio has been "listening" this long with zero signal above the noise
    // floor, try one automatic restart; a second miss means something is
    // genuinely wrong (sharing not enabled, wrong device, muted output) and
    // gets surfaced as a persistent, actionable error instead of silently
    // sitting on "Listening…" forever.
    const silenceWatchdog = setInterval(() => {
      if (systemListeningSinceRef.current === null) return
      const now = Date.now()
      const sinceListening = now - systemListeningSinceRef.current
      if (sinceListening < SYSTEM_SILENCE_THRESHOLD_MS) return
      const sinceSignal = lastSystemSignalAtRef.current === 0 ? sinceListening : now - lastSystemSignalAtRef.current
      if (sinceSignal < SYSTEM_SILENCE_THRESHOLD_MS) return

      if (!systemAutoRetriedRef.current) {
        systemAutoRetriedRef.current = true
        capture
          .stopSystem()
          .then(() => capture.startSystem())
          .catch((err) => {
            // If the retry itself fails, systemListeningSinceRef is now null
            // (set by the status handler when it left 'listening'), which
            // makes the watchdog interval a permanent no-op from here on —
            // so this is the ONLY chance to give the user a way back in.
            // Missing this is exactly what left the app "not taking
            // interviewer input" with no visible way to recover.
            setSystemAudioIssue(true)
            setError(err instanceof Error ? err.message : String(err))
          })
      } else {
        setSystemAudioIssue(true)
        setError(
          "System audio isn't producing any sound. Check that audio sharing is enabled for this call, then click Retry."
        )
      }
    }, SYSTEM_SILENCE_CHECK_INTERVAL_MS)

    capture.startSystem().catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
      clearSilenceTimer()
      clearVoiceFollowUpTimers()
      if (reCaptureCeilingTimerRef.current) clearTimeout(reCaptureCeilingTimerRef.current)
      clearInterval(silenceWatchdog)
      unsubVoiceArm()
      unsubReCaptureArm()
      unsubStatus()
      unsubPartial()
      unsubFinal()
      unsubError()
      capture.stopAll()
    }
  }, [addTranscriptMessage, setPartialText, setSttStatus, setQuestionDetected])

  async function toggleMic(): Promise<void> {
    const capture = captureRef.current
    try {
      if (micOn) {
        await capture.stopMic()
        setMicOn(false)
      } else {
        await capture.startMic()
        setMicOn(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function retrySystemAudio(): Promise<void> {
    systemAutoRetriedRef.current = false
    setSystemAudioIssue(false)
    setError(null)
    try {
      await captureRef.current.stopSystem()
      await captureRef.current.startSystem()
    } catch (err) {
      // Same failure mode as the auto-retry above: without restoring
      // systemAudioIssue here, a second failed manual click makes the Retry
      // button itself disappear, leaving no way to try again at all.
      setSystemAudioIssue(true)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return { error, micOn, toggleMic, systemAudioIssue, retrySystemAudio }
}
