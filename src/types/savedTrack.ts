import type { Timestamp } from 'firebase/firestore'

/**
 * A user's independent library entry — separate from favourites/playlists,
 * so a track can live in "My Music" on its own without being liked or
 * added to any playlist. Doc ID is always `${uid}_${trackId}` (mirrors
 * favorites/{uid}_{trackId}), so saving the same track twice is a no-op
 * overwrite, not a duplicate.
 */
export interface SavedTrackDoc {
  uid: string
  trackId: string
  addedAt: Timestamp | null
}
