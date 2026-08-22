export type TranscriptSource = 'mic' | 'system'

export interface TranscriptMessage {
  id: string
  source: TranscriptSource
  text: string
  isFinal: boolean
  timestamp: number
}

export interface FollowUpEntry {
  instruction: string
  answer: string
  keySteps?: string[]
  code?: { language: string; content: string }
  explanation?: string
  timeComplexity?: string
  spaceComplexity?: string
  /** Present when this follow-up attached a screenshot — shown as a
   *  thumbnail so the candidate can confirm what was actually captured. */
  imageDataUrl?: string
  createdAt: number
}

export interface AnswerCard {
  id: string
  question: string
  understanding?: string
  answer: string
  keySteps?: string[]
  code?: { language: string; content: string }
  explanation?: string
  timeComplexity?: string
  spaceComplexity?: string
  /** Additional targeted asks appended after the primary answer (e.g. "+ Code",
   *  "explain more") — kept separate from the primary fields above so a
   *  follow-up never silently overwrites the original answer. */
  followUps?: FollowUpEntry[]
  /** A follow-up currently streaming in — shown live below the primary
   *  content, then moved into followUps (or promoted into the primary code
   *  field) once done. Distinct from `status`, which tracks the primary
   *  answer only, so a follow-up in flight never flips the card back to a
   *  "streaming" primary-answer state. */
  pendingFollowUp?: Omit<FollowUpEntry, 'createdAt'>
  status: 'streaming' | 'done' | 'error'
  createdAt: number
}
