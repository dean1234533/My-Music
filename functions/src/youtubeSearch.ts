import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { enforceRateLimit } from './rateLimit.js'
import { isValidYoutubeVideoId } from './youtube.js'

const youtubeApiKey = defineSecret('YOUTUBE_API_KEY')

const MAX_RESULTS = 15
const SEARCH_RATE_LIMIT = 30
const SEARCH_RATE_WINDOW_SEC = 60

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
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('part', 'contentDetails')
  videosUrl.searchParams.set('id', videoIds.join(','))
  videosUrl.searchParams.set('key', apiKey)

  let durationByVideoId = new Map<string, number | null>()
  try {
    const videosRes = await fetch(videosUrl.toString())
    if (videosRes.ok) {
      const videosJson: { items?: YoutubeVideoItem[] } = await videosRes.json()
      durationByVideoId = new Map((videosJson.items ?? []).map((v) => [v.id ?? '', parseIsoDuration(v.contentDetails?.duration)]))
    }
  } catch {
    // Duration is a nice-to-have — fall through with nulls rather than failing the whole search.
  }

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
