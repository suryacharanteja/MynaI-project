import { useOverlayStore } from '../../stores/overlay-store'
import { parseStreamingAnswer } from '@shared/answer-parser'
import type { CreateSessionForm } from '@shared/session-types'
import type { PriorAnswerPayload } from '@shared/ipc-contract'

const FLUSH_INTERVAL_MS = 100

type RequestMode = 'ask' | 'regenerate' | 'follow-up'

interface InFlightRequest {
  mode: RequestMode
  instruction?: string
  imageDataUrl?: string
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

  if (req.mode === 'follow-up') {
    useOverlayStore.getState().updateCard(cardId, {
      pendingFollowUp: {
        instruction: req.instruction ?? '',
        answer: parsed.answer,
        keySteps: parsed.keySteps,
        code: parsed.code ?? undefined,
        explanation: parsed.explanation || undefined,
        timeComplexity: parsed.timeComplexity ?? undefined,
        spaceComplexity: parsed.spaceComplexity ?? undefined,
        imageDataUrl: req.imageDataUrl
      }
    })
    return
  }

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

/**
 * A follow-up's finished pendingFollowUp either promotes into the card's
 * primary `code` field (the common "oh I forgot to ask for code" case — if
 * the card doesn't have code yet, this IS the code, not an addendum) or gets
 * appended to the followUps log (anything else, or a second code follow-up
 * when code already exists — replacing existing code silently would be
 * surprising/lossy).
 */
function finalizeFollowUp(cardId: string): void {
  const { cards, updateCard } = useOverlayStore.getState()
  const card = cards.find((c) => c.id === cardId)
  const pending = card?.pendingFollowUp
  if (!card || !pending) return

  if (pending.code && !card.code) {
    updateCard(cardId, {
      code: pending.code,
      explanation: card.explanation || pending.explanation,
      pendingFollowUp: undefined
    })
    return
  }

  const entry = { ...pending, createdAt: Date.now() }
  updateCard(cardId, {
    followUps: [...(card.followUps ?? []), entry],
    pendingFollowUp: undefined
  })
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
  if (req.mode === 'follow-up') {
    finalizeFollowUp(cardId)
  } else {
    useOverlayStore.getState().updateCard(cardId, { status: 'done' })
  }
  inFlight.delete(cardId)
  req.resolve({})
})

window.mynai.onAiError(({ cardId, error, partial }) => {
  const req = inFlight.get(cardId)
  if (!req) return
  if (req.flushTimer) clearTimeout(req.flushTimer)
  const { updateCard, cards } = useOverlayStore.getState()

  if (req.mode === 'follow-up') {
    // Never touch the card's primary content on a follow-up failure — the
    // user's existing answer stays exactly as it was; only the follow-up
    // attempt itself failed. Surface the error via a toast-free inline note
    // dropped into pendingFollowUp so AnswerCardView can show it, then clear it.
    updateCard(cardId, {
      pendingFollowUp: { instruction: req.instruction ?? '', answer: `⚠️ ${error}`, imageDataUrl: req.imageDataUrl }
    })
    inFlight.delete(cardId)
    req.resolve({ error })
    return
  }

  if (partial) {
    const current = cards.find((c) => c.id === cardId)
    updateCard(cardId, { answer: `${current?.answer ?? ''}\n\n⚠️ ${error}`, status: 'error' })
  } else {
    updateCard(cardId, { answer: `⚠️ ${error}`, status: 'error' })
  }
  inFlight.delete(cardId)
  req.resolve({ error })
})

function baseRequestFields(form: CreateSessionForm) {
  return {
    provider: form.provider,
    model: form.model,
    company: form.company || undefined,
    jobDescription: form.jobDescription || undefined,
    extraContext: form.extraContext || undefined
  }
}

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
    inFlight.set(cardId, { mode: 'ask', accumulated: '', flushTimer: null, resolve })

    window.mynai
      .askAiStart({ cardId, question, ...baseRequestFields(form) })
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

/**
 * The captured question was wrong — regenerate this exact card in place
 * (same id, same position in the stack) with the corrected question text,
 * fully replacing whatever answer it had before.
 */
export async function reAskCard(
  cardId: string,
  correctedQuestion: string,
  form: CreateSessionForm
): Promise<{ error?: string }> {
  const { updateCard } = useOverlayStore.getState()
  updateCard(cardId, {
    question: correctedQuestion,
    answer: '',
    keySteps: undefined,
    code: undefined,
    explanation: undefined,
    timeComplexity: undefined,
    spaceComplexity: undefined,
    status: 'streaming'
  })

  return new Promise((resolve) => {
    inFlight.set(cardId, { mode: 'regenerate', accumulated: '', flushTimer: null, resolve })

    window.mynai
      .askAiStart({ cardId, question: correctedQuestion, ...baseRequestFields(form) })
      .then((result) => {
        if (result.error) {
          inFlight.delete(cardId)
          updateCard(cardId, { answer: `⚠️ ${result.error}`, status: 'error' })
          resolve({ error: result.error })
        }
      })
      .catch((err) => {
        inFlight.delete(cardId)
        const message = err instanceof Error ? err.message : 'Ask AI failed.'
        updateCard(cardId, { answer: `⚠️ ${message}`, status: 'error' })
        resolve({ error: message })
      })
  })
}

/**
 * The captured question was right, the answer just needs more — e.g. "+
 * Code". Sends the original question plus the current best-known answer as
 * context so a short instruction like "add code for this" has a "this" to
 * refer to; the result appends (see finalizeFollowUp) rather than replacing.
 */
export async function askFollowUp(
  cardId: string,
  instruction: string,
  form: CreateSessionForm,
  imageDataUrl?: string
): Promise<{ error?: string }> {
  const { cards, updateCard } = useOverlayStore.getState()
  const card = cards.find((c) => c.id === cardId)
  if (!card) return { error: 'Card not found.' }

  const priorAnswer: PriorAnswerPayload = {
    answer: card.answer,
    keySteps: card.keySteps,
    code: card.code,
    explanation: card.explanation,
    timeComplexity: card.timeComplexity,
    spaceComplexity: card.spaceComplexity
  }

  updateCard(cardId, { pendingFollowUp: { instruction, answer: '', imageDataUrl } })

  return new Promise((resolve) => {
    inFlight.set(cardId, { mode: 'follow-up', instruction, imageDataUrl, accumulated: '', flushTimer: null, resolve })

    window.mynai
      .askAiStart({
        cardId,
        question: card.question,
        ...baseRequestFields(form),
        followUpInstruction: instruction,
        priorAnswer,
        imageDataUrl
      })
      .then((result) => {
        if (result.error) {
          inFlight.delete(cardId)
          updateCard(cardId, { pendingFollowUp: { instruction, answer: `⚠️ ${result.error}`, imageDataUrl } })
          resolve({ error: result.error })
        }
      })
      .catch((err) => {
        inFlight.delete(cardId)
        const message = err instanceof Error ? err.message : 'Follow-up failed.'
        updateCard(cardId, { pendingFollowUp: { instruction, answer: `⚠️ ${message}`, imageDataUrl } })
        resolve({ error: message })
      })
  })
}
