import type { Timestamp } from 'firebase/firestore'

/**
 * A shared, personal-library-scoped cache of YouTube track metadata, keyed by
 * its own `youtubeVideoId` (used as the Firestore document ID) so the same
 * video can never be duplicated into two separate track docs — adding an
 * already-known video just reuses this doc. No audio is ever stored here,
 * only metadata; actual playback always streams from YouTube using
 * `youtubeVideoId`.
 */
export interface TrackDoc {
  trackId: string
  title: string
  artist: string
  youtubeVideoId: string
  youtubeUrl: string
  thumbnail: string | null
  /** Best-effort — from the YouTube Data API at search time, or the player once it loads. Never authoritative. */
  durationSeconds: number | null
  source: 'youtube'
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  /** Set true when the player reports the video is gone/private/restricted, rather than silently deleting it. */
  unavailable?: boolean
}
