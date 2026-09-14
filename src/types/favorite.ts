import type { Timestamp } from 'firebase/firestore'

/** Doc ID is always `${uid}_${trackId}` so favouriting the same track twice is a no-op overwrite, not a duplicate. */
export interface FavoriteDoc {
  uid: string
  trackId: string
  createdAt: Timestamp | null
}
