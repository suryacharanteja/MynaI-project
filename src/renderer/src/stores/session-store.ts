import { create } from 'zustand'
import {
  type CreateSessionForm,
  type SessionType,
  type AnswerPreferences,
  defaultCreateSessionForm
} from '@shared/session-types'

interface SessionStore {
  form: CreateSessionForm
  setSessionType: (type: SessionType) => void
  setField: <K extends keyof CreateSessionForm>(key: K, value: CreateSessionForm[K]) => void
  setAnswerPreference: <K extends keyof AnswerPreferences>(key: K, value: AnswerPreferences[K]) => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  form: defaultCreateSessionForm,
  setSessionType: (sessionType) => set((state) => ({ form: { ...state.form, sessionType } })),
  setField: (key, value) => set((state) => ({ form: { ...state.form, [key]: value } })),
  setAnswerPreference: (key, value) =>
    set((state) => ({
      form: { ...state.form, answerPreferences: { ...state.form.answerPreferences, [key]: value } }
    })),
  reset: () => set({ form: defaultCreateSessionForm })
}))
