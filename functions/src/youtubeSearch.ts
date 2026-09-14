import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { enforceRateLimit } from './rateLimit.js'
import { extractYoutubePlaylistId, isValidYoutubeVideoId } from './youtube.js'

const youtubeApiKey = defineSecret('YOUTUBE_API_KEY')

const MAX_RESULTS = 15
const SEARCH_RATE_LIMIT = 30
const SEARCH_RATE_WINDOW_SEC = 60
const IMPORT_RATE_LIMIT = 10
const IMPORT_RATE_WINDOW_SEC = 60
/** Caps a single import's quota/latency cost — comfortably covers virtually every real album/EP. */
const MAX_PLAYLIST_ITEMS = 100

interface YoutubeSearchItem {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
    /** 'live' | 'upcoming' | 'none' — real API metadata, not a guess, so it's safe to label as LIVE only when this says so. */
    liveBroadcastContent?: string
  }
}

interface YoutubeVideoItem {
  id?: string
  contentDetails?: { duration?: string }
}

/** Parses an ISO-8601 duration (e.g. "PT3M45S") into whole seconds. */
function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return null
  const [, h, m, s] = match
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0)
}

/** Looks up durations for up to 50 video IDs per call (the API's own per-request cap), batching as needed. */
async function fetchVideoDurations(videoIds: string[], apiKey: string): Promise<Map<string, number | null>> {
  const durationByVideoId = new Map<string, number | null>()
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videosUrl.searchParams.set('part', 'contentDetails')
    videosUrl.searchParams.set('id', batch.join(','))
    videosUrl.searchParams.set('key', apiKey)
    try {
      const videosRes = await fetch(videosUrl.toString())
      if (videosRes.ok) {
        const videosJson: { items?: YoutubeVideoItem[] } = await videosRes.json()
        for (const v of videosJson.items ?? []) durationByVideoId.set(v.id ?? '', parseIsoDuration(v.contentDetails?.duration))
      }
    } catch {
      // Duration is a nice-to-have — fall through with nulls for this batch rather than failing.
    }
  }
  return durationByVideoId
}

/**
 * The only place this app ever calls the YouTube Data API. Search is the
 * single operation that consumes quota — once a result is selected and
 * saved to the `tracks` collection with its videoId, all future playback
 * and library/playlist loads use that stored data and never search again.
 * The API key lives only here (a Cloud Functions secret), never in the
 * client bundle.
 */
export const searchYoutube = onCall({ secrets: [youtubeApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await enforceRateLimit(`searchYoutube_${request.auth.uid}`, SEARCH_RATE_LIMIT, SEARCH_RATE_WINDOW_SEC)

  const query = request.data?.query as string | undefined
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new HttpsError('invalid-argument', 'A search query is required.')
  }
  const trimmedQuery = query.trim().slice(0, 200)

  const apiKey = youtubeApiKey.value()
  if (!apiKey) throw new HttpsError('failed-precondition', 'Search is temporarily unavailable.')

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('videoCategoryId', '10') // Music
  searchUrl.searchParams.set('order', 'relevance')
  searchUrl.searchParams.set('maxResults', String(MAX_RESULTS))
  searchUrl.searchParams.set('q', trimmedQuery)
  searchUrl.searchParams.set('key', apiKey)

  let searchJson: { items?: YoutubeSearchItem[] }
  try {
    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`)
    searchJson = await searchRes.json()
  } catch {
    throw new HttpsError('unavailable', 'Search is temporarily unavailable.')
  }

  const items = (searchJson.items ?? []).filter((item): item is YoutubeSearchItem & { id: { videoId: string } } =>
    typeof item.id?.videoId === 'string' && isValidYoutubeVideoId(item.id.videoId),
  )
  if (items.length === 0) return { results: [] }

  const videoIds = items.map((item) => item.id.videoId)
  const durationByVideoId = await fetchVideoDurations(videoIds, apiKey)

  const results = items.map((item) => ({
    youtubeVideoId: item.id.videoId,
    title: item.snippet?.title ?? 'Untitled',
    channelTitle: item.snippet?.channelTitle ?? 'Unknown',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    durationSeconds: durationByVideoId.get(item.id.videoId) ?? null,
    isLive: item.snippet?.liveBroadcastContent === 'live',
  }))

  return { results }
})

interface YoutubePlaylistItem {
  contentDetails?: { videoId?: string }
  snippet?: {
    title?: string
    videoOwnerChannelTitle?: string
    channelTitle?: string
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
  }
}

interface YoutubePlaylistItemsPage {
  items?: YoutubePlaylistItem[]
  nextPageToken?: string
}

/**
 * Imports every track in a YouTube playlist (the practical way to add a
 * whole album at once — the public YouTube Data API has no separate "album"
 * search, but most official albums are uploaded as a playlist). Same
 * server-side-only API key, same rate limiting, same "review before
 * adding" flow as a normal search — this only returns metadata, it never
 * saves anything to a library/playlist itself.
 */
export const importYoutubePlaylist = onCall({ secrets: [youtubeApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await enforceRateLimit(`importYoutubePlaylist_${request.auth.uid}`, IMPORT_RATE_LIMIT, IMPORT_RATE_WINDOW_SEC)

  const rawInput = request.data?.playlistUrl as string | undefined
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new HttpsError('invalid-argument', 'A YouTube playlist link is required.')
  }
  const playlistId = extractYoutubePlaylistId(rawInput.trim().slice(0, 500))
  if (!playlistId) {
    throw new HttpsError('invalid-argument', "That doesn't look like a valid YouTube playlist link.")
  }

  const apiKey = youtubeApiKey.value()
  if (!apiKey) throw new HttpsError('failed-precondition', 'Import is temporarily unavailable.')

  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlists')
  playlistUrl.searchParams.set('part', 'snippet')
  playlistUrl.searchParams.set('id', playlistId)
  playlistUrl.searchParams.set('key', apiKey)

  let playlistTitle = 'Imported playlist'
  try {
    const playlistRes = await fetch(playlistUrl.toString())
    if (playlistRes.ok) {
      const playlistJson: { items?: { snippet?: { title?: string } }[] } = await playlistRes.json()
      playlistTitle = playlistJson.items?.[0]?.snippet?.title ?? playlistTitle
    }
  } catch {
    // Non-fatal — a missing/unreadable title still lets the import proceed with a generic name.
  }

  const items: YoutubePlaylistItem[] = []
  let pageToken: string | undefined
  do {
    const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    itemsUrl.searchParams.set('part', 'snippet,contentDetails')
    itemsUrl.searchParams.set('playlistId', playlistId)
    itemsUrl.searchParams.set('maxResults', '50')
    if (pageToken) itemsUrl.searchParams.set('pageToken', pageToken)
    itemsUrl.searchParams.set('key', apiKey)

    let page: YoutubePlaylistItemsPage
    try {
      const itemsRes = await fetch(itemsUrl.toString())
      if (!itemsRes.ok) throw new Error(`YouTube playlistItems failed: ${itemsRes.status}`)
      page = await itemsRes.json()
    } catch {
      if (items.length === 0) throw new HttpsError('not-found', "Couldn't find that playlist — check the link and that it's public.")
      break
    }
    items.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken && items.length < MAX_PLAYLIST_ITEMS)

  const truncated = items.slice(0, MAX_PLAYLIST_ITEMS).filter(
    (item): item is YoutubePlaylistItem & { contentDetails: { videoId: string } } =>
      typeof item.contentDetails?.videoId === 'string' && isValidYoutubeVideoId(item.contentDetails.videoId),
  )
  if (truncated.length === 0) return { playlistTitle, results: [] }

  const videoIds = truncated.map((item) => item.contentDetails.videoId)
  const durationByVideoId = await fetchVideoDurations(videoIds, apiKey)

  const results = truncated.map((item) => ({
    youtubeVideoId: item.contentDetails.videoId,
    title: item.snippet?.title ?? 'Untitled',
    channelTitle: item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? 'Unknown',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    durationSeconds: durationByVideoId.get(item.contentDetails.videoId) ?? null,
    isLive: false,
  }))

  return { playlistTitle, results }
})
