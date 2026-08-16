import { type AskParams, type AnswerResult, buildPrompt, parseAnswerJson } from './types'

/**
 * Works for any OpenAI-compatible chat/completions endpoint — real OpenAI,
 * and OpenCode Go (https://opencode.ai/zen/go/v1/chat/completions), the curated
 * low-cost coding-model subscription under the opencode.ai/zen console — a distinct
 * base URL and API key from the general OpenCode Zen product.
 */
export async function askOpenAiCompatible(
  params: AskParams,
  options: { baseUrl: string; providerLabel: string }
): Promise<AnswerResult> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: 'user', content: buildPrompt(params) }],
      temperature: 0.4
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${options.providerLabel} error (${response.status}): ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new Error(`${options.providerLabel} returned an unexpected response shape.`)
  }

  return parseAnswerJson(params.question, text)
}

export function askOpenAi(params: AskParams): Promise<AnswerResult> {
  return askOpenAiCompatible(params, { baseUrl: 'https://api.openai.com/v1', providerLabel: 'OpenAI' })
}

export function askOpenCodeGo(params: AskParams): Promise<AnswerResult> {
  return askOpenAiCompatible(params, { baseUrl: 'https://opencode.ai/zen/go/v1', providerLabel: 'OpenCode Go' })
}

export function askOpenCodeZen(params: AskParams): Promise<AnswerResult> {
  return askOpenAiCompatible(params, { baseUrl: 'https://opencode.ai/zen/v1', providerLabel: 'OpenCode Zen' })
}
