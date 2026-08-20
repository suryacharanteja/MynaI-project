import { useEffect, useRef, useState } from 'react'
import { createAudioCapture } from '../audio/capture'
import { useOverlayStore } from '../../stores/overlay-store'
import { useSessionStore } from '../../stores/session-store'
import { isLikelyQuestion, isDuplicateQuestion, isLikelyGarbledTranscript } from './question-detector'
import { askAiAndAddCard } from './ask-ai'

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
const SILENCE_DEBOUNCE_NO_QUESTION_MARK_MS = 3200
/** Safety valve: if the interviewer talks continuously with no pause longer
 *  than the debounce, don't wait forever — force an evaluation once the
 *  buffer has been accumulating this long. */
const MAX_BUFFER_MS = 45000

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
  const captureRef = useRef(createAudioCapture())
  const lastAutoAnswerAtRef = useRef(0)
  const recentQuestionsRef = useRef<string[]>([])
  const bufferRef = useRef<RecentTurn[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    const unsubStatus = window.mynai.onSttStatus((e) => {
      setSttStatus(e.source, e.status)
      if (e.status === 'listening') setError(null)
    })
    const unsubPartial = window.mynai.onSttPartial((e) => setPartialText(e.source, e.text))
    const unsubFinal = window.mynai.onSttFinal((e) => {
      setPartialText(e.source, '')

      // Drop apparent ASR hallucinations (see isLikelyGarbledTranscript) before
      // they reach the transcript display or the auto-answer buffer — showing
      // garbage in the transcript and feeding it to the LLM as a "question" is
      // worse than silently dropping one turn's worth of audio.
      if (isLikelyGarbledTranscript(e.text)) return

      addTranscriptMessage({
        id: `${e.source}-${Date.now()}`,
        source: e.source,
        text: e.text,
        isFinal: true,
        timestamp: Date.now()
      })

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

    capture.startSystem().catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
      clearSilenceTimer()
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

  return { error, micOn, toggleMic }
}
