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
  'do you',
  'did you',
  'have you',
  'are you',
  'is there',
  'tell me',
  'walk me through',
  'describe',
  'explain',
  'give me',
  'show me'
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
  'create',
  'define',
  'compare',
  'list',
  'name'
]

const MIN_WORDS_FOR_QUESTION = 3
const MIN_WORDS_FOR_LONG_UTTERANCE = 6

export function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length

  // A "?" anywhere in the text is a strong signal — but require at least 3 words
  // to avoid false positives on fragments like "?" or "huh?"
  if (trimmed.includes('?') && wordCount >= MIN_WORDS_FOR_QUESTION) return true

  const lower = trimmed.toLowerCase()
  if (INTERROGATIVE_STARTERS.some((starter) => lower.startsWith(starter))) return true
  if (IMPERATIVE_TASK_VERBS.some((verb) => lower.startsWith(verb))) return true

  if (wordCount >= MIN_WORDS_FOR_LONG_UTTERANCE && /\b(what|how|why|explain|describe|difference|between|compare)\b/.test(lower)) {
    return true
  }

  return false
}

// Devanagari, CJK, Hiragana/Katakana, Hangul, Arabic, Cyrillic. AssemblyAI's
// real-time streaming model is English-only — when fed a low-quality or
// silent audio segment, it can hallucinate plausible-looking text in one of
// these scripts rather than failing cleanly (a known failure mode of
// transformer ASR under poor SNR). Left unfiltered, that garbage was landing
// in the transcript and feeding the auto-answer question buffer, corrupting
// both the display and whatever got sent to the LLM.
const NON_LATIN_SCRIPT = /[ऀ-ॿ一-鿿぀-ヿ가-힯؀-ۿЀ-ӿ]/g

export function isLikelyGarbledTranscript(text: string): boolean {
  const letters = text.match(/[\p{L}]/gu)
  if (!letters || letters.length < 4) return false
  const nonLatinCount = (text.match(NON_LATIN_SCRIPT) ?? []).length
  return nonLatinCount / letters.length > 0.3
}

function normalizeForDedupe(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
}

export function isDuplicateQuestion(candidate: string, recent: string[]): boolean {
  const normalizedCandidate = normalizeForDedupe(candidate)
  return recent.some((q) => {
    const normalizedRecent = normalizeForDedupe(q)
    if (normalizedCandidate === normalizedRecent) return true
    const shorter = Math.min(normalizedCandidate.length, normalizedRecent.length)
    const longer = Math.max(normalizedCandidate.length, normalizedRecent.length)
    return shorter > 20 && longer > 0 && shorter / longer > 0.8 && normalizedRecent.includes(normalizedCandidate.slice(0, shorter))
  })
}
