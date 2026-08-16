import { useEffect, useRef, useState } from 'react'
import { createAudioCapture } from '../audio/capture'
import { useOverlayStore } from '../../stores/overlay-store'
import { useSessionStore } from '../../stores/session-store'
import { isLikelyQuestion, isDuplicateQuestion } from './question-detector'
import { askAiAndAddCard } from './ask-ai'

const AUTO_ANSWER_COOLDOWN_MS = 3000
const QUESTION_DETECTED_PULSE_MS = 2500
const RECENT_QUESTIONS_LIMIT = 20
const RECENT_TURNS_WINDOW = 5
const RECENT_TURNS_MAX_AGE_MS = 15000

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
  const recentTurnsRef = useRef<RecentTurn[]>([])

  useEffect(() => {
    const capture = captureRef.current
    const unsubStatus = window.mynai.onSttStatus((e) => {
      setSttStatus(e.source, e.status)
      if (e.status === 'listening') setError(null)
    })
    const unsubPartial = window.mynai.onSttPartial((e) => setPartialText(e.source, e.text))
    const unsubFinal = window.mynai.onSttFinal((e) => {
      setPartialText(e.source, '')
      addTranscriptMessage({
        id: `${e.source}-${Date.now()}`,
        source: e.source,
        text: e.text,
        isFinal: true,
        timestamp: Date.now()
      })

      console.log('[auto-answer] stt:final', { source: e.source, text: e.text.slice(0, 80) })

      // Question detection only runs on the "system" stream (the call's shared/output
      // audio — the interviewer and other participants). The "mic" stream is the user's
      // own voice; feeding your own answers back into the question detector is what was
      // causing your own responses to trigger auto-answer. This mirrors ParakeetAI's
      // dual-stream model: share stream = other party, mic = you.
      if (e.source !== 'system') return

      const now = Date.now()

      // Accumulate recent turns so question detection sees a sliding window of
      // recent speech, not just the current fragment. This handles the case where
      // AssemblyAI splits "What are the best practices for protecting data?" across
      // multiple turn boundaries — the individual fragments might not look like
      // questions, but the combined recent text does.
      recentTurnsRef.current = [
        ...recentTurnsRef.current.filter((t) => now - t.timestamp < RECENT_TURNS_MAX_AGE_MS),
        { text: e.text, timestamp: now }
      ].slice(-RECENT_TURNS_WINDOW)

      const combinedRecentText = recentTurnsRef.current.map((t) => t.text).join(' ')

      const individualMatch = isLikelyQuestion(e.text)
      const combinedMatch = !individualMatch && isLikelyQuestion(combinedRecentText)

      console.log('[auto-answer] question check', { individualMatch, combinedMatch, text: e.text.slice(0, 60), combined: combinedRecentText.slice(0, 80) })

      if (!individualMatch && !combinedMatch) return

      const questionText = individualMatch ? e.text : combinedRecentText

      setQuestionDetected(true)
      setTimeout(() => setQuestionDetected(false), QUESTION_DETECTED_PULSE_MS)

      const { autoAnswerOn } = useOverlayStore.getState()
      if (!autoAnswerOn) {
        console.log('[auto-answer] skipped — autoAnswerOn is OFF')
        return
      }

      if (now - lastAutoAnswerAtRef.current < AUTO_ANSWER_COOLDOWN_MS) {
        console.log('[auto-answer] skipped — cooldown active')
        return
      }
      if (isDuplicateQuestion(questionText, recentQuestionsRef.current)) {
        console.log('[auto-answer] skipped — duplicate question')
        return
      }

      console.log('[auto-answer] TRIGGERING askAiAndAddCard:', questionText.slice(0, 80))
      lastAutoAnswerAtRef.current = now
      recentQuestionsRef.current = [...recentQuestionsRef.current, questionText].slice(-RECENT_QUESTIONS_LIMIT)
      // Clear the recent turns buffer after triggering so the same accumulated
      // text doesn't re-trigger on the next turn
      recentTurnsRef.current = []

      const { form } = useSessionStore.getState()
      askAiAndAddCard(questionText, form)
    })
    const unsubError = window.mynai.onSttError((e) => setError(e.error))

    capture.startSystem().catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
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
