import { useEffect, useRef, useState } from 'react'
import { createAudioCapture } from '../audio/capture'
import { useOverlayStore } from '../../stores/overlay-store'

/**
 * Owns the real mic/system-audio capture + AssemblyAI transcription lifecycle for
 * the overlay. Starts system-audio listening automatically (matching the reference
 * app's default), mic capture is opt-in via toggleMic to avoid surprising the user.
 */
export function useLiveTranscription() {
  const addTranscriptMessage = useOverlayStore((s) => s.addTranscriptMessage)
  const setPartialText = useOverlayStore((s) => s.setPartialText)
  const setSttStatus = useOverlayStore((s) => s.setSttStatus)
  const [error, setError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(false)
  const captureRef = useRef(createAudioCapture())

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
  }, [addTranscriptMessage, setPartialText, setSttStatus])

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
