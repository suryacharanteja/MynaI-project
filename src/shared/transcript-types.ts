export type TranscriptSource = 'mic' | 'system'

export interface TranscriptMessage {
  id: string
  source: TranscriptSource
  text: string
  isFinal: boolean
  timestamp: number
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
  status: 'streaming' | 'done' | 'error'
  createdAt: number
}
