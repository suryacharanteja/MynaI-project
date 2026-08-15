import { useOverlayStore } from '../../stores/overlay-store'
import type { CreateSessionForm } from '@shared/session-types'

/**
 * Shared by the manual Ask AI bar and the auto-answer detector so both paths
 * produce identical cards — reads/writes the overlay store directly (not a hook)
 * so it can be called from outside React components too.
 */
export async function askAiAndAddCard(question: string, form: CreateSessionForm): Promise<{ error?: string }> {
  const { addCard, updateCard } = useOverlayStore.getState()
  const cardId = `card-${Date.now()}`

  addCard({
    id: cardId,
    question,
    answer: '',
    status: 'streaming',
    createdAt: Date.now()
  })

  try {
    const result = await window.mynai.askAi({
      question,
      provider: form.provider,
      model: form.model,
      company: form.company || undefined,
      jobDescription: form.jobDescription || undefined,
      extraContext: form.extraContext || undefined
    })

    if ('error' in result) {
      updateCard(cardId, { answer: `⚠️ ${result.error}`, status: 'error' })
      return { error: result.error }
    }

    updateCard(cardId, {
      answer: result.answer,
      keySteps: result.keySteps,
      code: result.code ?? undefined,
      explanation: result.explanation || undefined,
      timeComplexity: result.timeComplexity ?? undefined,
      spaceComplexity: result.spaceComplexity ?? undefined,
      status: 'done'
    })
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ask AI failed.'
    updateCard(cardId, { answer: `⚠️ ${message}`, status: 'error' })
    return { error: message }
  }
}
