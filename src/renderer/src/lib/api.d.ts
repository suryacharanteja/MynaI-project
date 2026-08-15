import type { MynaiApi } from '@shared/ipc-contract'

declare global {
  interface Window {
    mynai: MynaiApi
  }
}

export {}
