import type { Timestamp } from 'firebase/firestore'

export interface PlaylistDoc {
  playlistId: string
  ownerId: string
  title: string
  trackIds: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  /**
   * Set only on a playlist auto-created/maintained per artist (see
   * playlistService.ensureArtistPlaylist) — the normalized artist grouping key
   * (src/utils/artist.ts), used to find the right playlist again regardless of
   * later manual renames. Absent on a playlist the user created themselves.
   */
  autoArtistKey?: string
}
