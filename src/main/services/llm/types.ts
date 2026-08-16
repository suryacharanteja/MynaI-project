import type { AnswerPreferences } from '../../../shared/session-types'
import { answerResultSchema } from '../../../shared/schemas'

export type LlmProvider = 'gemini' | 'openai' | 'opencode-go' | 'opencode-zen'

export interface AskParams {
  apiKey: string
  model: string
  question: string
  company?: string
  jobDescription?: string
  extraContext?: string
  answerPreferences?: AnswerPreferences
}

export interface AnswerResult {
  question: string
  answer: string
  keySteps: string[]
  code: { language: string; content: string } | null
  explanation: string
  timeComplexity: string | null
  spaceComplexity: string | null
}

export const RESPONSE_SCHEMA_INSTRUCTIONS = `Respond ONLY with a single JSON object, no markdown fences, matching exactly this shape:
{
  "answer": string,            // the main answer, 1-4 sentences, plain prose
  "keySteps": string[],        // short bullet steps; [] if not applicable
  "code": { "language": string, "content": string } | null,  // only if code is the natural output
  "explanation": string,       // 1-2 sentences of extra context/reasoning; "" if not needed
  "timeComplexity": string | null,
  "spaceComplexity": string | null
}`

export function buildPrompt(params: AskParams): string {
  const contextLines = [
    params.company ? `Company: ${params.company}` : null,
    params.jobDescription ? `Job description: ${params.jobDescription}` : null,
    params.extraContext ? `Extra context: ${params.extraContext}` : null
  ].filter(Boolean)

  const prefLines: string[] = []
  if (params.answerPreferences) {
    const p = params.answerPreferences
    prefLines.push(`Response tone: ${p.tone}.`)
    prefLines.push(`Response length: ${p.length}.`)
    prefLines.push(`Target seniority level: ${p.seniority}.`)
    if (p.codeLanguage) {
      prefLines.push(`Preferred code language: ${p.codeLanguage}.`)
    }
  }

  return [
    'You are answering as the candidate, in first person, in an interview or meeting.',
    contextLines.length > 0 ? contextLines.join('\n') : null,
    prefLines.length > 0 ? prefLines.join(' ') : null,
    `Question: ${params.question}`,
    RESPONSE_SCHEMA_INSTRUCTIONS
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text
}

export function parseAnswerJson(question: string, text: string): AnswerResult {
  let raw: unknown
  try {
    raw = JSON.parse(extractJson(text))
  } catch {
    return {
      question,
      answer: text,
      keySteps: [],
      code: null,
      explanation: '',
      timeComplexity: null,
      spaceComplexity: null
    }
  }

  const parsed = answerResultSchema.safeParse(raw)
  const data = parsed.success ? parsed.data : answerResultSchema.parse({})

  return { question, ...data }
}
