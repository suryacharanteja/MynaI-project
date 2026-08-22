import type { AnswerPreferences, SessionType } from '../../../shared/session-types'

export type LlmProvider = 'gemini' | 'openai' | 'opencode-go' | 'opencode-zen' | 'deepseek'

export interface PriorAnswerSummary {
  answer: string
  keySteps?: string[]
  code?: { language: string; content: string }
  explanation?: string
  timeComplexity?: string
  spaceComplexity?: string
}

export interface AskParams {
  apiKey: string
  model: string
  question: string
  company?: string
  jobDescription?: string
  extraContext?: string
  answerPreferences?: AnswerPreferences
  /** Present only for a follow-up ask — the current best-known answer to
   *  `question`, given as context so the model knows what a short follow-up
   *  instruction like "add code for this" refers to. */
  priorAnswer?: PriorAnswerSummary
  /** Present only for a follow-up ask — the new/additional thing being asked
   *  about the same question. When set, buildPrompt returns a follow-up
   *  prompt instead of a fresh-question prompt. */
  followUpInstruction?: string
  /** Screenshot(s) attached as extra visual context — data URLs
   *  ("data:image/png;base64,..."). The images themselves are attached to
   *  the provider request separately (see gemini.ts/openai-compatible.ts);
   *  this field only controls whether/how the TEXT prompt references them. */
  imageDataUrls?: string[]
  /** Steers the prompt's framing — e.g. a Coding Challenge session gets a
   *  problem-solving framing instead of an interview-candidate framing. */
  sessionType?: SessionType
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
  if (params.priorAnswer && params.followUpInstruction) {
    return buildFollowUpPrompt(params.priorAnswer, params.followUpInstruction, params)
  }

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
    codingChallengeOpeningLine(params.sessionType),
    contextLines.length > 0 ? contextLines.join('\n') : null,
    prefLines.length > 0 ? prefLines.join(' ') : null,
    `Question: ${params.question}`,
    RESPONSE_FORMAT_INSTRUCTIONS
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * 'regular-call' is the Coding Challenge session type's underlying literal
 * (kept unchanged from its original "Regular Call" name to avoid breaking
 * saveTranscript.safeParse for sessions already on disk under the old
 * label — only the UI-facing label/icon changed, see CreateSessionScreen.tsx).
 */
function codingChallengeOpeningLine(sessionType: SessionType | undefined): string {
  return sessionType === 'regular-call'
    ? 'You are solving a coding/algorithm challenge (LeetCode/HackerRank-style). Give a correct, runnable solution and always include its time and space complexity.'
    : 'You are answering as the candidate, in first person, in an interview or meeting.'
}

function buildFollowUpPrompt(prior: PriorAnswerSummary, instruction: string, params: AskParams): string {
  const priorSummaryLines = [
    `Answer: ${prior.answer}`,
    prior.keySteps?.length ? `Key steps: ${prior.keySteps.join('; ')}` : null,
    prior.code ? `Code (${prior.code.language}):\n${prior.code.content}` : null,
    prior.explanation ? `Explanation: ${prior.explanation}` : null,
    prior.timeComplexity ? `Time complexity: ${prior.timeComplexity}` : null,
    prior.spaceComplexity ? `Space complexity: ${prior.spaceComplexity}` : null
  ].filter(Boolean)

  return [
    `${codingChallengeOpeningLine(params.sessionType)} You already gave an answer to this question, and the candidate now wants to add something to it.`,
    `Original question: ${params.question}`,
    `Your existing answer so far:\n${priorSummaryLines.join('\n')}`,
    `Additional request: ${instruction}`,
    params.imageDataUrls && params.imageDataUrls.length > 0
      ? params.imageDataUrls.length === 1
        ? 'A screenshot is attached — it may show code, a diagram, or other on-screen context relevant to this question. Use it.'
        : `${params.imageDataUrls.length} screenshots are attached (e.g. successive scrolled captures of the same content) — they may show code, a diagram, or other on-screen context relevant to this question. Use them together.`
      : null,
    "Respond with ONLY the new or updated sections needed to satisfy the additional request — do not repeat the full original answer.",
    RESPONSE_FORMAT_INSTRUCTIONS
  ]
    .filter(Boolean)
    .join('\n\n')
}
