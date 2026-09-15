import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { canonicalYoutubeUrl } from '@/utils/youtube'
import type { TrackDoc } from '@/types/track'

function trackRef(youtubeVideoId: string) {
  return doc(db, 'tracks', youtubeVideoId)
}

/**
 * Session-lifetime cache of already-fetched track docs, keyed by video ID.
 * Track metadata is effectively immutable once saved (title/artist/thumbnail
 * never change after creation — only `unavailable` ever flips, and this
 * cache is kept in sync with that one exception below), so multiple pages
 * asking for the same track within a session share one Firestore read
 * instead of each re-fetching it. Cleared implicitly on page reload.
 */
const trackCache = new Map<string, TrackDoc>()

export interface SaveTrackInput {
  youtubeVideoId: string
  title: string
  artist: string
  thumbnail: string | null
  durationSeconds: number | null
}

/**
 * Saves a track to the shared metadata cache, keyed by its own YouTube video
 * ID — the doc ID itself is the dedupe key, so adding an already-known video
 * (from search, or from someone else's library) always reuses the same doc
 * rather than creating a duplicate. Safe to call every time a track is added
 * to a library/playlist/favourites; it never re-hits the YouTube API.
 */
export async function saveTrack(input: SaveTrackInput): Promise<TrackDoc> {
  const cached = trackCache.get(input.youtubeVideoId)
  if (cached) return cached

  const ref = trackRef(input.youtubeVideoId)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    const track = existing.data() as TrackDoc
    trackCache.set(track.trackId, track)
    return track
  }

  const track: TrackDoc = {
    trackId: input.youtubeVideoId,
    title: input.title,
    artist: input.artist,
    youtubeVideoId: input.youtubeVideoId,
    youtubeUrl: canonicalYoutubeUrl(input.youtubeVideoId),
    thumbnail: input.thumbnail,
    durationSeconds: input.durationSeconds,
    source: 'youtube',
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  }
  await setDoc(ref, track)
  return track
}

export async function getTrack(trackId: string): Promise<TrackDoc | null> {
  const cached = trackCache.get(trackId)
  if (cached) return cached
  const snap = await getDoc(trackRef(trackId))
  if (!snap.exists()) return null
  const track = snap.data() as TrackDoc
  trackCache.set(trackId, track)
  return track
}

export async function getTracks(trackIds: string[]): Promise<Map<string, TrackDoc>> {
  const entries = await Promise.all(
    trackIds.map(async (id) => {
      const track = await getTrack(id)
      return track ? ([id, track] as const) : null
    }),
  )
  return new Map(entries.filter((e): e is readonly [string, TrackDoc] => e !== null))
}

/** Marks a track unavailable (deleted/private/region-blocked on YouTube) rather than deleting it, so it stays visible with a "no longer available" state until the user chooses to remove or replace it. */
export async function markTrackUnavailable(trackId: string): Promise<void> {
  await updateDoc(trackRef(trackId), { unavailable: true, updatedAt: serverTimestamp() })
  const cached = trackCache.get(trackId)
  if (cached) trackCache.set(trackId, { ...cached, unavailable: true })
}

/**
 * Renames a track's display title — a personal correction to a messy YouTube
 * title (e.g. stripping "(Official Video) [4K Remaster]"), not a rename of
 * the video itself. `tracks/{trackId}` is a shared cache keyed by video ID,
 * so this is visible everywhere that video appears (every playlist, the
 * library, search results already saved) — deliberately global rather than
 * per-playlist, since a cleaned-up title is just as welcome everywhere else
 * the track shows up.
 */
export async function renameTrack(trackId: string, title: string): Promise<void> {
  await updateDoc(trackRef(trackId), { title, updatedAt: serverTimestamp() })
  const cached = trackCache.get(trackId)
  if (cached) trackCache.set(trackId, { ...cached, title })
}
