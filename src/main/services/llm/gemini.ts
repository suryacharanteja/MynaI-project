import { GoogleGenerativeAI } from '@google/generative-ai'
import { type AskParams, buildPrompt } from './types'

export async function askGemini(params: AskParams, onChunk: (text: string) => void): Promise<void> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const generativeModel = genAI.getGenerativeModel({ model: params.model })

  const result = await generativeModel.generateContentStream(buildPrompt(params))
  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) onChunk(text)
  }
}
