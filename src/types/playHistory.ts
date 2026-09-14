import type { Timestamp } from 'firebase/firestore'

/** One play event. Capped client-side to the most recent HISTORY_LIMIT entries per user (see historyService.ts). */
export interface PlayHistoryDoc {
  historyId: string
  uid: string
  trackId: string
  playedAt: Timestamp | null
}
