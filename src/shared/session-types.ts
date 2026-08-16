export type SessionType = 'interview' | 'regular-call'
export type LlmProvider = 'gemini' | 'openai' | 'opencode-go' | 'opencode-zen'

export interface AnswerPreferences {
  tone: 'conversational' | 'formal' | 'concise'
  length: 'short' | 'medium' | 'long'
  seniority: 'junior' | 'mid' | 'senior'
  codeLanguage: string
}

export interface CreateSessionForm {
  sessionType: SessionType
  company: string
  jobDescription: string
  profileId: string | null
  extraContext: string
  documentIds: string[]
  provider: LlmProvider
  model: string
  outputLanguage: string
  answerPreferences: AnswerPreferences
  autoAnswer: boolean
  saveTranscript: boolean
}

export const defaultCreateSessionForm: CreateSessionForm = {
  sessionType: 'interview',
  company: '',
  jobDescription: '',
  profileId: null,
  extraContext: '',
  documentIds: [],
  provider: 'gemini',
  model: 'gemini-flash-latest',
  outputLanguage: 'English',
  answerPreferences: {
    tone: 'conversational',
    length: 'medium',
    seniority: 'senior',
    codeLanguage: 'Python'
  },
  autoAnswer: true,
  saveTranscript: true
}
