const INTERROGATIVE_STARTERS = [
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'which',
  'can you',
  'could you',
  'would you',
  'tell me',
  'walk me through',
  'describe',
  'explain'
]

const IMPERATIVE_TASK_VERBS = [
  'write',
  'implement',
  'design',
  'build',
  'solve',
  'optimise',
  'optimize',
  'debug',
  'code',
  'create'
]

const MIN_WORDS_FOR_LONG_UTTERANCE = 8

/**
 * Tier 1 (build plan 6a) — free, instant heuristics run only on the "them" (system)
 * channel against a finalized utterance. Deliberately loose: false positives cost a
 * wasted LLM call, false negatives cost the user having to hit Ask AI manually —
 * Tier 2 (a nano-model classifier reassembling fragmented transcripts) is not built
 * yet, so this is the whole detector for now.
 */
export function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false

  if (trimmed.endsWith('?')) return true

  const lower = trimmed.toLowerCase()
  if (INTERROGATIVE_STARTERS.some((starter) => lower.startsWith(starter))) return true
  if (IMPERATIVE_TASK_VERBS.some((verb) => lower.startsWith(verb))) return true

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount >= MIN_WORDS_FOR_LONG_UTTERANCE && /\b(what|how|why|explain|describe)\b/.test(lower)) {
    return true
  }

  return false
}

function normalizeForDedupe(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
}

/** Tier 3 (build plan 6a) simplified — exact/near-exact match against recently
 * answered questions, since we don't have embeddings wired up for cosine similarity. */
export function isDuplicateQuestion(candidate: string, recent: string[]): boolean {
  const normalizedCandidate = normalizeForDedupe(candidate)
  return recent.some((q) => {
    const normalizedRecent = normalizeForDedupe(q)
    if (normalizedCandidate === normalizedRecent) return true
    const shorter = Math.min(normalizedCandidate.length, normalizedRecent.length)
    const longer = Math.max(normalizedCandidate.length, normalizedRecent.length)
    return shorter > 12 && longer > 0 && shorter / longer > 0.85 && normalizedRecent.includes(normalizedCandidate.slice(0, shorter))
  })
}
