import { z } from 'zod/v4'

export const LLM_PROVIDERS = ['gemini', 'openai', 'opencode-go', 'opencode-zen', 'deepseek'] as const
export const SESSION_TYPES = ['interview', 'regular-call'] as const
export const TONE_OPTIONS = ['conversational', 'formal', 'concise'] as const
export const LENGTH_OPTIONS = ['short', 'medium', 'long'] as const
export const SENIORITY_OPTIONS = ['junior', 'mid', 'senior'] as const
export const STT_SOURCES = ['mic', 'system'] as const

const answerPreferencesSchema = z.object({
  tone: z.enum(TONE_OPTIONS).catch('conversational'),
  length: z.enum(LENGTH_OPTIONS).catch('medium'),
  seniority: z.enum(SENIORITY_OPTIONS).catch('senior'),
  codeLanguage: z.string().catch('Python')
})

export const createSessionFormSchema = z
  .object({
    sessionType: z.enum(SESSION_TYPES),
    company: z.string().max(200),
    jobDescription: z.string().max(2000),
    profileId: z.string().nullable(),
    extraContext: z.string().max(1000),
    documentIds: z.array(z.string()),
    provider: z.enum(LLM_PROVIDERS),
    model: z.string().min(1, 'Model is required'),
    outputLanguage: z.string().min(1, 'Language is required'),
    answerPreferences: answerPreferencesSchema,
    autoAnswer: z.boolean(),
    saveTranscript: z.boolean()
  })
  .refine(
    (data) => data.sessionType !== 'interview' || data.company.trim().length > 0,
    { message: 'Company is required for interview sessions', path: ['company'] }
  )

export const appSettingsSchema = z.object({
  geminiApiKey: z.string().nullable().catch(null),
  assemblyAiApiKey: z.string().nullable().catch(null),
  openaiApiKey: z.string().nullable().catch(null),
  openCodeGoApiKey: z.string().nullable().catch(null),
  openCodeZenApiKey: z.string().nullable().catch(null),
  deepseekApiKey: z.string().nullable().catch(null)
})

export const sessionMetadataSchema = z.object({
  id: z.string().min(1),
  form: createSessionFormSchema,
  createdAt: z.string(),
  updatedAt: z.string()
})

const priorAnswerSchema = z.object({
  answer: z.string(),
  keySteps: z.array(z.string()).optional(),
  code: z.object({ language: z.string(), content: z.string() }).optional(),
  explanation: z.string().optional(),
  timeComplexity: z.string().optional(),
  spaceComplexity: z.string().optional()
})

export const askAiRequestSchema = z.object({
  cardId: z.string().min(1),
  question: z.string().min(1, 'Question cannot be empty'),
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().min(1),
  company: z.string().optional(),
  jobDescription: z.string().optional(),
  extraContext: z.string().optional(),
  answerPreferences: answerPreferencesSchema.optional(),
  followUpInstruction: z.string().min(1).optional(),
  priorAnswer: priorAnswerSchema.optional(),
  imageDataUrls: z.array(z.string().startsWith('data:image/')).optional(),
  sessionType: z.enum(SESSION_TYPES).optional()
})

export const answerResultSchema = z.object({
  answer: z.string().catch(''),
  keySteps: z.array(z.string()).catch([]),
  code: z
    .object({
      language: z.string(),
      content: z.string()
    })
    .nullable()
    .catch(null),
  explanation: z.string().catch(''),
  timeComplexity: z.string().nullable().catch(null),
  spaceComplexity: z.string().nullable().catch(null)
})

export const sttSourceSchema = z.enum(STT_SOURCES)
