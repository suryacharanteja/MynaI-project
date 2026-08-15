import { create } from 'zustand'
import type { AnswerCard, TranscriptMessage } from '@shared/transcript-types'

interface OverlayStore {
  transcript: TranscriptMessage[]
  partialText: { mic: string; system: string }
  sttStatus: { mic: string; system: string }
  cards: AnswerCard[]
  activeCardIndex: number
  autoAnswerOn: boolean
  questionDetected: boolean
  micLevel: number

  addTranscriptMessage: (message: TranscriptMessage) => void
  setPartialText: (source: 'mic' | 'system', text: string) => void
  setSttStatus: (source: 'mic' | 'system', status: string) => void
  addCard: (card: AnswerCard) => void
  updateCard: (id: string, patch: Partial<AnswerCard>) => void
  setActiveCardIndex: (index: number) => void
  nextCard: () => void
  prevCard: () => void
  setAutoAnswerOn: (on: boolean) => void
  setQuestionDetected: (detected: boolean) => void
  setMicLevel: (level: number) => void
}

export const useOverlayStore = create<OverlayStore>((set, get) => ({
  transcript: [],
  partialText: { mic: '', system: '' },
  sttStatus: { mic: 'off', system: 'off' },
  cards: [],
  activeCardIndex: 0,
  autoAnswerOn: true,
  questionDetected: false,
  micLevel: 0,

  addTranscriptMessage: (message) =>
    set((state) => ({ transcript: [...state.transcript.slice(-49), message] })),

  setPartialText: (source, text) =>
    set((state) => ({ partialText: { ...state.partialText, [source]: text } })),

  setSttStatus: (source, status) => set((state) => ({ sttStatus: { ...state.sttStatus, [source]: status } })),

  addCard: (card) =>
    set((state) => ({
      cards: [...state.cards, card],
      activeCardIndex: state.cards.length
    })),

  updateCard: (id, patch) =>
    set((state) => ({
      cards: state.cards.map((card) => (card.id === id ? { ...card, ...patch } : card))
    })),

  setActiveCardIndex: (index) =>
    set((state) => ({
      activeCardIndex: Math.max(0, Math.min(index, state.cards.length - 1))
    })),

  nextCard: () => {
    const { activeCardIndex, cards } = get()
    if (activeCardIndex < cards.length - 1) {
      set({ activeCardIndex: activeCardIndex + 1 })
    }
  },

  prevCard: () => {
    const { activeCardIndex } = get()
    if (activeCardIndex > 0) {
      set({ activeCardIndex: activeCardIndex - 1 })
    }
  },

  setAutoAnswerOn: (autoAnswerOn) => set({ autoAnswerOn }),
  setQuestionDetected: (questionDetected) => set({ questionDetected }),
  setMicLevel: (micLevel) => set({ micLevel })
}))
