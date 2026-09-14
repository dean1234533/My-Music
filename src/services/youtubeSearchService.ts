import { callable } from '@/lib/callable'

export interface YoutubeSearchResult {
  youtubeVideoId: string
  title: string
  channelTitle: string
  thumbnail: string | null
  durationSeconds: number | null
  /** From the YouTube API's own liveBroadcastContent field — only ever true when YouTube itself reports the video as a live broadcast, never a guess. */
  isLive: boolean
}

const searchYoutubeCallable = callable<{ query: string }, { results: YoutubeSearchResult[] }>('searchYoutube')
const importYoutubePlaylistCallable = callable<{ playlistUrl: string }, { playlistTitle: string; results: YoutubeSearchResult[] }>('importYoutubePlaylist')

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { results: YoutubeSearchResult[]; expiresAt: number }>()

/**
 * The only path in this app that calls the YouTube Data API — through the
 * `searchYoutube` Cloud Function, which holds the API key server-side and
 * rate-limits per user. Repeated searches for the same query within
 * CACHE_TTL_MS are served from this in-memory cache instead of hitting the
 * function again — call this only on search submit/debounce settle, never
 * on every keystroke.
 */
export async function searchYoutube(rawQuery: string): Promise<YoutubeSearchResult[]> {
  const query = rawQuery.trim()
  if (!query) return []

  const cached = cache.get(query)
  if (cached && cached.expiresAt > Date.now()) return cached.results

  const { results } = await searchYoutubeCallable({ query })
  cache.set(query, { results, expiresAt: Date.now() + CACHE_TTL_MS })
  return results
}

/**
 * Imports every track from a YouTube playlist — the practical way to add a
 * whole album at once, since the public YouTube Data API has no separate
 * "album" search. Returns metadata only, for review before adding anything;
 * never auto-saves to a library/playlist itself.
 */
export async function importYoutubePlaylist(playlistUrl: string): Promise<{ playlistTitle: string; results: YoutubeSearchResult[] }> {
  return importYoutubePlaylistCallable({ playlistUrl: playlistUrl.trim() })
}
