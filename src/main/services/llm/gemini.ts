import { GoogleGenerativeAI } from '@google/generative-ai'
import { type AskParams, type AnswerResult, buildPrompt, parseAnswerJson } from './types'

export async function askGemini(params: AskParams): Promise<AnswerResult> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const generativeModel = genAI.getGenerativeModel({ model: params.model })

  const result = await generativeModel.generateContent(buildPrompt(params))
  const text = result.response.text()

  return parseAnswerJson(params.question, text)
}
