export type LlmProvider = 'gemini' | 'openai' | 'opencode-go' | 'opencode-zen'

export interface AskParams {
  apiKey: string
  model: string
  question: string
  company?: string
  jobDescription?: string
  extraContext?: string
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

  return [
    'You are answering as the candidate, in first person, in an interview or meeting.',
    contextLines.length > 0 ? contextLines.join('\n') : null,
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
  const parsed = JSON.parse(extractJson(text))
  return {
    question,
    answer: String(parsed.answer ?? ''),
    keySteps: Array.isArray(parsed.keySteps) ? parsed.keySteps.map(String) : [],
    code: parsed.code && typeof parsed.code === 'object' ? parsed.code : null,
    explanation: String(parsed.explanation ?? ''),
    timeComplexity: parsed.timeComplexity ?? null,
    spaceComplexity: parsed.spaceComplexity ?? null
  }
}
