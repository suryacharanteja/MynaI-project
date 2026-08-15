export type SttSource = 'mic' | 'system'
export type SttStatus = 'off' | 'connecting' | 'listening' | 'error'

export interface SttStatusEvent {
  source: SttSource
  status: SttStatus
}

export interface SttTranscriptEvent {
  source: SttSource
  text: string
}

export interface SttErrorEvent {
  source: SttSource
  error: string
}

export interface DesktopSource {
  id: string
  name: string
}
