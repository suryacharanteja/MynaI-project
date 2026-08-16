import type { AskParams, AnswerResult, LlmProvider } from './types'
import { askGemini } from './gemini'
import { askOpenAi, askOpenCodeGo, askOpenCodeZen } from './openai-compatible'

export function askLlm(provider: LlmProvider, params: AskParams): Promise<AnswerResult> {
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
