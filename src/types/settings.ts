import type { Timestamp } from 'firebase/firestore'

export type RepeatMode = 'off' | 'queue' | 'track'

/** Doc ID is always the user's uid. */
export interface SettingsDoc {
  uid: string
  autoplayNext: boolean
  defaultVolume: number
  shuffleByDefault: boolean
  updatedAt: Timestamp | null
}

export const DEFAULT_SETTINGS: Omit<SettingsDoc, 'uid' | 'updatedAt'> = {
  autoplayNext: true,
  defaultVolume: 80,
  shuffleByDefault: false,
}
