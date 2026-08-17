import type { AnswerPreferences } from '../../../shared/session-types'

export type LlmProvider = 'gemini' | 'openai' | 'opencode-go' | 'opencode-zen' | 'deepseek'

export interface AskParams {
  apiKey: string
  model: string
  question: string
  company?: string
  jobDescription?: string
  extraContext?: string
  answerPreferences?: AnswerPreferences
}

/**
 * Sentinel markers instead of a JSON object. A JSON blob can't be validly
 * parsed — or rendered — until the whole thing has arrived; that was the
 * actual cause of answers appearing "all at once" after a 3-4s wait, not
 * network speed. Plain-text markers let each section render the instant its
 * marker streams past, well before the response finishes. Bracketed
 * sentinels (not markdown `##` headers) avoid false-positive collisions with
 * content the model might generate, e.g. a code comment reading "# Key Steps".
 */
export const RESPONSE_FORMAT_INSTRUCTIONS = `Format your response using these exact section markers, each alone on its own line. Do not use markdown headers (#) or fenced code blocks (\`\`\`) anywhere — use only the markers below. Only <<<ANSWER>>> is required; omit any other section entirely if it doesn't apply.

<<<ANSWER>>>
The main answer, 1-4 sentences, plain prose, first person as the candidate.

<<<KEY_STEPS>>>
- short bullet step
- short bullet step
(omit this section if not applicable)

<<<CODE:language>>>
code only, no fences
(omit this section if code isn't the natural output)

<<<EXPLANATION>>>
1-2 sentences of extra context or reasoning
(omit this section if not needed)

<<<COMPLEXITY>>>
Time: O(...)
Space: O(...)
(omit this section if not applicable)`

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
    RESPONSE_FORMAT_INSTRUCTIONS
  ]
    .filter(Boolean)
    .join('\n\n')
}
