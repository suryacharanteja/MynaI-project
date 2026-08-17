import { useOverlayStore } from '../../stores/overlay-store'
import { parseStreamingAnswer } from '@shared/answer-parser'
import type { CreateSessionForm } from '@shared/session-types'

const FLUSH_INTERVAL_MS = 100

interface InFlightRequest {
  accumulated: string
  flushTimer: ReturnType<typeof setTimeout> | null
  resolve: (result: { error?: string }) => void
}

const inFlight = new Map<string, InFlightRequest>()

function flush(cardId: string): void {
  const req = inFlight.get(cardId)
  if (!req) return
  req.flushTimer = null
  const parsed = parseStreamingAnswer(req.accumulated)
  useOverlayStore.getState().updateCard(cardId, {
    answer: parsed.answer,
    keySteps: parsed.keySteps,
    code: parsed.code ?? undefined,
    explanation: parsed.explanation || undefined,
    timeComplexity: parsed.timeComplexity ?? undefined,
    spaceComplexity: parsed.spaceComplexity ?? undefined
  })
}

function scheduleFlush(cardId: string): void {
  const req = inFlight.get(cardId)
  if (!req || req.flushTimer) return
  req.flushTimer = setTimeout(() => flush(cardId), FLUSH_INTERVAL_MS)
}

// Registered once at module scope, not per-question — ipcRenderer listeners
// would otherwise accumulate with every call to askAiAndAddCard. Each event
// is routed to the right in-flight request by cardId, so an auto-answer
// card and a manual Ask AI card streaming at the same time can't cross-talk.
window.mynai.onAiChunk(({ cardId, delta }) => {
  const req = inFlight.get(cardId)
  if (!req) return
  req.accumulated += delta
  scheduleFlush(cardId)
})

window.mynai.onAiDone(({ cardId }) => {
  const req = inFlight.get(cardId)
  if (!req) return
  if (req.flushTimer) clearTimeout(req.flushTimer)
  flush(cardId)
  useOverlayStore.getState().updateCard(cardId, { status: 'done' })
  inFlight.delete(cardId)
  req.resolve({})
})

window.mynai.onAiError(({ cardId, error, partial }) => {
  const req = inFlight.get(cardId)
  if (!req) return
  if (req.flushTimer) clearTimeout(req.flushTimer)
  const { updateCard, cards } = useOverlayStore.getState()
  if (partial) {
    const current = cards.find((c) => c.id === cardId)
    updateCard(cardId, { answer: `${current?.answer ?? ''}\n\n⚠️ ${error}`, status: 'error' })
  } else {
    updateCard(cardId, { answer: `⚠️ ${error}`, status: 'error' })
  }
  inFlight.delete(cardId)
  req.resolve({ error })
})

/**
 * Shared by the manual Ask AI bar and the auto-answer detector so both paths
 * produce identical cards — reads/writes the overlay store directly (not a hook)
 * so it can be called from outside React components too.
 */
export async function askAiAndAddCard(question: string, form: CreateSessionForm): Promise<{ error?: string }> {
  const { addCard } = useOverlayStore.getState()
  const cardId = `card-${Date.now()}`

  addCard({
    id: cardId,
    question,
    answer: '',
    status: 'streaming',
    createdAt: Date.now()
  })

  return new Promise((resolve) => {
    inFlight.set(cardId, { accumulated: '', flushTimer: null, resolve })

    window.mynai
      .askAiStart({
        cardId,
        question,
        provider: form.provider,
        model: form.model,
        company: form.company || undefined,
        jobDescription: form.jobDescription || undefined,
        extraContext: form.extraContext || undefined
      })
      .then((result) => {
        if (result.error) {
          inFlight.delete(cardId)
          useOverlayStore.getState().updateCard(cardId, { answer: `⚠️ ${result.error}`, status: 'error' })
          resolve({ error: result.error })
        }
        // else: the actual answer arrives via onAiChunk/onAiDone/onAiError above.
      })
      .catch((err) => {
        inFlight.delete(cardId)
        const message = err instanceof Error ? err.message : 'Ask AI failed.'
        useOverlayStore.getState().updateCard(cardId, { answer: `⚠️ ${message}`, status: 'error' })
        resolve({ error: message })
      })
  })
}
