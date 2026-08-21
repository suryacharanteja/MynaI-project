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

// Filler words interviewers say before actually getting to the point ("So,
// uh, write a function that...", "Now let's move to a coding question, write
// a function that..."). Stripped from the head of each clause before
// checking for a signal word, so a transitional preamble doesn't push the
// real task verb out of startsWith() range.
const FILLER_LEADS = ['so', 'now', 'okay', 'ok', 'alright', 'well', 'um', 'umm', 'uh', 'uhh', 'right', 'also', 'and']

function splitIntoClauses(text: string): string[] {
  return text
    .split(/[.!?;]+|,/g)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

function stripFillerLead(clause: string): string {
  const words = clause.split(/\s+/)
  let start = 0
  while (start < words.length && FILLER_LEADS.includes(words[start].toLowerCase().replace(/[^a-z]/g, ''))) {
    start += 1
  }
  return words.slice(start).join(' ')
}

/**
 * Clause-based scan instead of a single startsWith() on the whole utterance.
 * Splitting on sentence punctuation/commas and stripping leading filler
 * words from each clause catches a signal word buried behind a transitional
 * preamble ("Now let's move to a coding question, write a function that
 * reverses a linked list" — the clause "write a function..." matches after
 * filler-stripping) without false-positiving on a signal word merely
 * appearing mid-clause as an ordinary verb/object ("I did not write anything
 * about that topic" has no clause boundary before "write", so it's correctly
 * not flagged — the check only ever looks at each clause's head, never its
 * middle).
 */
export function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length

  // A "?" anywhere in the text is a strong signal — but require at least 3 words
  // to avoid false positives on fragments like "?" or "huh?"
  if (trimmed.includes('?') && wordCount >= MIN_WORDS_FOR_QUESTION) return true

  // Same floor applies to the starter/verb clause matches below. Without it, a
  // lone fragment like "How" — the whole buffer, if the interviewer paused
  // right after starting a sentence — satisfied startsWith('how') instantly
  // and got dispatched as a "complete" question with nothing to actually
  // answer. The floor is checked against the WHOLE buffer (the unit that
  // actually gets dispatched), not the individual clause, so a real question
  // still matches immediately once enough of it has arrived.
  if (wordCount < MIN_WORDS_FOR_QUESTION) return false

  for (const clause of splitIntoClauses(trimmed)) {
    const head = stripFillerLead(clause).toLowerCase()
    if (!head) continue
    if (INTERROGATIVE_STARTERS.some((starter) => head.startsWith(starter))) return true
    if (IMPERATIVE_TASK_VERBS.some((verb) => head.startsWith(verb))) return true
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
