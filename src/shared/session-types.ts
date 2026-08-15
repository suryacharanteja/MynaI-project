export type SessionType = 'interview' | 'regular-call'

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
  model: 'gemini-2.5-flash-lite',
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
