import { useEffect, useRef, useState } from 'react'
import { createAudioCapture } from '../audio/capture'
import { useOverlayStore } from '../../stores/overlay-store'
import { useSessionStore } from '../../stores/session-store'
import { isLikelyQuestion, isDuplicateQuestion } from './question-detector'
import { askAiAndAddCard } from './ask-ai'

const AUTO_ANSWER_COOLDOWN_MS = 8000
const QUESTION_DETECTED_PULSE_MS = 2500
const RECENT_QUESTIONS_LIMIT = 10

/**
 * Owns the real mic/system-audio capture + AssemblyAI transcription lifecycle for
 * the overlay. Starts system-audio listening automatically (matching the reference
 * app's default), mic capture is opt-in via toggleMic to avoid surprising the user.
 * Also runs tier-1 auto-answer detection on finalized system-audio utterances.
 */
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

  useEffect(() => {
    const capture = captureRef.current
    const unsubStatus = window.mynai.onSttStatus((e) => setSttStatus(e.source, e.status))
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

      // Tier 1 auto-answer: only ever runs on the "them" (system) channel.
      if (e.source !== 'system') return
      if (!isLikelyQuestion(e.text)) return

      setQuestionDetected(true)
      setTimeout(() => setQuestionDetected(false), QUESTION_DETECTED_PULSE_MS)

      const { autoAnswerOn } = useOverlayStore.getState()
      if (!autoAnswerOn) return

      const now = Date.now()
      if (now - lastAutoAnswerAtRef.current < AUTO_ANSWER_COOLDOWN_MS) return
      if (isDuplicateQuestion(e.text, recentQuestionsRef.current)) return

      lastAutoAnswerAtRef.current = now
      recentQuestionsRef.current = [...recentQuestionsRef.current, e.text].slice(-RECENT_QUESTIONS_LIMIT)

      const { form } = useSessionStore.getState()
      askAiAndAddCard(e.text, form)
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
