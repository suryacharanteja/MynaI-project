import type { AskParams, AnswerResult, LlmProvider } from './types'
import { askGemini } from './gemini'
import { askOpenAi, askOpenCodeGo, askOpenCodeZen } from './openai-compatible'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]
// Neither the Gemini SDK call nor the OpenAI-compatible fetch calls carry a
// timeout of their own. If the underlying request hangs — never resolving OR
// rejecting, which a stalled network or an overloaded model can do — the
// promise never settles and the answer card sits at "Streaming..." forever,
// with no error to retry on or surface. This bounds every attempt so a hang
// always eventually turns into a retryable/classifiable error instead.
const REQUEST_TIMEOUT_MS = 25000

class LlmTimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'LlmTimeoutError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmTimeoutError()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error instanceof LlmTimeoutError) return true
  const msg = error.message.toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timed out')
  )
}

function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Ask AI failed.'
  if (error instanceof LlmTimeoutError) {
    return 'The AI took too long to respond. Please try again.'
  }
  const msg = error.message.toLowerCase()
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') && msg.includes('key')) {
    return 'Invalid API key. Check your key in Settings.'
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return 'Rate limited. Please wait a moment and try again.'
  }
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('service unavailable')
  ) {
    return 'The AI service is temporarily overloaded. Please try again in a moment.'
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
      return await withTimeout(dispatch(provider, params), REQUEST_TIMEOUT_MS)
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
