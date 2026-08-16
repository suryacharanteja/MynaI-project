import type { AskParams, AnswerResult, LlmProvider } from './types'
import { askGemini } from './gemini'
import { askOpenAi, askOpenCodeGo, askOpenCodeZen } from './openai-compatible'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  )
}

function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Ask AI failed.'
  const msg = error.message.toLowerCase()
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') && msg.includes('key')) {
    return 'Invalid API key. Check your key in Settings.'
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return 'Rate limited. Please wait a moment and try again.'
  }
  if (msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout')) {
    return 'Network error. Check your internet connection.'
  }
  return error.message.slice(0, 300)
}

function dispatch(provider: LlmProvider, params: AskParams): Promise<AnswerResult> {
  switch (provider) {
    case 'gemini':
      return askGemini(params)
    case 'openai':
      return askOpenAi(params)
    case 'opencode-go':
      return askOpenCodeGo(params)
    case 'opencode-zen':
      return askOpenCodeZen(params)
  }
}

export async function askLlm(provider: LlmProvider, params: AskParams): Promise<AnswerResult> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await dispatch(provider, params)
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }
      break
    }
  }
  throw new Error(classifyError(lastError))
}
