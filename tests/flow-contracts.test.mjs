import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canonicalYoutubeUrl,
  extractYoutubeVideoId,
  isValidYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from '../src/utils/youtube.ts'
import { formatCount, formatDuration } from '../src/utils/format.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// YouTube URL/ID handling (src/utils/youtube.ts) — this is the app's whole
// trust boundary for what counts as a playable track, so it's covered
// thoroughly. Every accepted URL shape must yield the same validated ID, and
// every rejected input must yield null rather than a best-effort guess.
// ---------------------------------------------------------------------------

const VALID_ID = 'dQw4w9WgXcQ'

test('extractYoutubeVideoId accepts every supported URL shape and extracts the same video ID', () => {
  const urls = [
    `https://www.youtube.com/watch?v=${VALID_ID}`,
    `https://youtube.com/watch?v=${VALID_ID}`,
    `https://m.youtube.com/watch?v=${VALID_ID}`,
    `http://www.youtube.com/watch?v=${VALID_ID}`,
    `https://www.youtube.com/watch?feature=share&v=${VALID_ID}`,
    `https://www.youtube.com/watch?v=${VALID_ID}&t=30s`,
    `https://youtu.be/${VALID_ID}`,
    `https://youtu.be/${VALID_ID}?t=10`,
    `https://www.youtube.com/embed/${VALID_ID}`,
    `https://www.youtube-nocookie.com/embed/${VALID_ID}`,
    `https://www.youtube.com/embed/${VALID_ID}?rel=0`,
    `https://www.youtube.com/shorts/${VALID_ID}`,
    `https://m.youtube.com/shorts/${VALID_ID}`,
    `https://www.youtube.com/live/${VALID_ID}`,
  ]
  for (const url of urls) {
    assert.equal(extractYoutubeVideoId(url), VALID_ID, `failed for ${url}`)
  }
})

test('extractYoutubeVideoId trims surrounding whitespace', () => {
  assert.equal(extractYoutubeVideoId(`  https://youtu.be/${VALID_ID}  `), VALID_ID)
})

test('extractYoutubeVideoId rejects unsupported/invalid input rather than guessing', () => {
  const invalid = [
    '',
    '   ',
    'not a url at all',
    'https://vimeo.com/12345678',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=way-too-long-an-id',
    'https://www.youtube.com/channel/UC1234567890',
    'https://www.youtube.com/results?search_query=test',
    `javascript:alert(1)//${VALID_ID}`,
    `https://www.youtube.com.evil.com/watch?v=${VALID_ID}`,
  ]
  for (const input of invalid) {
    assert.equal(extractYoutubeVideoId(input), null, `should reject ${input}`)
  }
})

test('isValidYoutubeVideoId enforces exactly 11 URL-safe characters', () => {
  assert.equal(isValidYoutubeVideoId(VALID_ID), true)
  assert.equal(isValidYoutubeVideoId('abcDEF123_-'), true)
  assert.equal(isValidYoutubeVideoId(''), false)
  assert.equal(isValidYoutubeVideoId('short'), false)
  assert.equal(isValidYoutubeVideoId('waytoolongtobeavalidid'), false)
  assert.equal(isValidYoutubeVideoId('has spaces!'), false)
  assert.equal(isValidYoutubeVideoId('abcDEF123_$'), false)
})

test('canonicalYoutubeUrl always rebuilds a plain watch URL from the validated ID, never trusting an original pasted URL', () => {
  assert.equal(canonicalYoutubeUrl(VALID_ID), `https://www.youtube.com/watch?v=${VALID_ID}`)
})

test('youtubeEmbedUrl uses the privacy-enhanced domain and never sets autoplay by default', () => {
  const url = youtubeEmbedUrl(VALID_ID)
  assert.match(url, /^https:\/\/www\.youtube-nocookie\.com\/embed\//)
  assert.match(url, new RegExp(VALID_ID))
  assert.doesNotMatch(url, /autoplay/)
  assert.match(url, /rel=0/)
  assert.match(url, /modestbranding=1/)
})

test('youtubeEmbedUrl merges in extra params without dropping the defaults', () => {
  const url = youtubeEmbedUrl(VALID_ID, { start: 30 })
  const params = new URL(url).searchParams
  assert.equal(params.get('start'), '30')
  assert.equal(params.get('rel'), '0')
  assert.equal(params.get('modestbranding'), '1')
})

test('youtubeEmbedUrl lets an explicit param override a default', () => {
  const url = youtubeEmbedUrl(VALID_ID, { rel: '1' })
  assert.equal(new URL(url).searchParams.get('rel'), '1')
})

test('youtubeThumbnailUrl points at the stable hqdefault thumbnail for the given video', () => {
  assert.equal(youtubeThumbnailUrl(VALID_ID), `https://i.ytimg.com/vi/${VALID_ID}/hqdefault.jpg`)
})

// ---------------------------------------------------------------------------
// Generic formatting helpers (src/utils/format.ts) that survive the
// marketplace-to-personal-app rewrite unchanged and are still used for
// track duration / count display.
// ---------------------------------------------------------------------------

test('formatDuration renders seconds as m:ss, zero-padding seconds under 10', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(5), '0:05')
  assert.equal(formatDuration(65), '1:05')
  assert.equal(formatDuration(3661), '61:01')
})

test('formatDuration falls back to 0:00 for negative or non-finite input', () => {
  assert.equal(formatDuration(-5), '0:00')
  assert.equal(formatDuration(NaN), '0:00')
  assert.equal(formatDuration(Infinity), '0:00')
})

test('formatCount abbreviates thousands and millions', () => {
  assert.equal(formatCount(0), '0')
  assert.equal(formatCount(999), '999')
  assert.equal(formatCount(1000), '1k')
  assert.equal(formatCount(1500), '1.5k')
  assert.equal(formatCount(1_000_000), '1.0m')
})

// ---------------------------------------------------------------------------
// trackService.ts's saveTrack dedupes by using the YouTube video ID as the
// Firestore document ID itself (doc(db, 'tracks', youtubeVideoId)) rather
// than a generated ID plus a query — so "does this video already exist"
// is a single getDoc by ID, and writing it again can never create a
// duplicate doc for the same video. That behaviour is exercised against a
// real Firestore connection (getDoc/setDoc), so it isn't re-tested here as
// a pure-logic unit test — firestore-rules.test.mjs instead locks in the
// server-side half of the same guarantee (create is only ever allowed when
// the doc ID equals youtubeVideoId, and youtubeVideoId is frozen after
// creation), which is what actually prevents a duplicate/mismatched doc
// even if a client bug ever tried to create one.
// ---------------------------------------------------------------------------

test('trackService.saveTrack keys the Firestore doc by the video ID itself, and playlistService/favoriteService/historyService/settingsService only ever touch the calling user\'s own uid — reflected in firestore.rules, not re-tested here against a live Firestore', () => {
  const trackService = read('src/services/trackService.ts')
  assert.match(trackService, /function trackRef\(youtubeVideoId: string\) \{\s*return doc\(db, 'tracks', youtubeVideoId\)/)
  assert.match(trackService, /if \(existing\.exists\(\)\) \{/)
  assert.match(trackService, /const trackCache = new Map<string, TrackDoc>\(\)/)

  const playlistService = read('src/services/playlistService.ts')
  assert.match(playlistService, /where\('ownerId', '==', ownerId\)/)

  const favoriteService = read('src/services/favoriteService.ts')
  assert.match(favoriteService, /doc\(db, 'favorites', `\$\{uid\}_\$\{trackId\}`\)/)

  const historyService = read('src/services/historyService.ts')
  assert.match(historyService, /where\('uid', '==', uid\)/)

  const settingsService = read('src/services/settingsService.ts')
  assert.match(settingsService, /function settingsRef\(uid: string\) \{\s*return doc\(db, 'settings', uid\)/)

  const libraryService = read('src/services/libraryService.ts')
  assert.match(libraryService, /function savedTrackRef\(uid: string, trackId: string\) \{\s*return doc\(db, 'savedTracks', `\$\{uid\}_\$\{trackId\}`\)/)
})

// ---------------------------------------------------------------------------
// A track saved to a user's independent library (savedTracks) is keyed by
// `${uid}_${trackId}`, the same pattern favorites already uses — so saving
// an already-saved YouTube video is a no-op overwrite of the same doc, never
// a duplicate library entry. See firestore-rules.test.mjs for the
// server-side half of this guarantee.
// ---------------------------------------------------------------------------

test('libraryService.saveToLibrary/removeFromLibrary/isInLibrary all key off the same owner-scoped doc ID as the rules expect', () => {
  const libraryService = read('src/services/libraryService.ts')
  assert.match(libraryService, /export async function saveToLibrary\(uid: string, trackId: string\)/)
  assert.match(libraryService, /export async function removeFromLibrary\(uid: string, trackId: string\)/)
  assert.match(libraryService, /export async function isInLibrary\(uid: string, trackId: string\)/)
  assert.match(libraryService, /where\('uid', '==', uid\)/)
})

// ---------------------------------------------------------------------------
// The search page never calls the YouTube-backed searchYoutube() service for
// a query already answered locally — libraryMatches is derived purely from
// the client-held savedTracks/tracks state (useMemo over local state), and
// runSearch (the only caller of searchYoutube) is wired to the debounced
// input/submit handlers only, never to the library-match computation.
// ---------------------------------------------------------------------------

test('SearchPage computes library matches without calling the YouTube search service', () => {
  const searchPage = read('src/pages/app/SearchPage.tsx')
  const start = searchPage.indexOf('const libraryMatches = useMemo')
  const end = searchPage.indexOf('}, [libraryTrackMap, term])') + '}, [libraryTrackMap, term])'.length
  const libraryMatchesBlock = searchPage.slice(start, end)
  assert.doesNotMatch(libraryMatchesBlock, /searchYoutube/)
  assert.match(libraryMatchesBlock, /libraryTrackMap/)
})

// ---------------------------------------------------------------------------
// Account deletion and data export must cover every user-owned collection,
// including the newer savedTracks (independent library) — added alongside
// favorites/playlists/playHistory/settings, not forgotten.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// recordPlay() must never download the caller's entire play-history
// collection just to decide whether trimming is needed — that was a real
// bug (the code called getDocs() unconditionally on every single play,
// despite a comment claiming otherwise). It should use a cheap server-side
// count aggregation instead, only falling back to a full read in the rare
// case trimming genuinely has to happen.
// ---------------------------------------------------------------------------

test('historyService.recordPlay checks history size via getCountFromServer, not an unconditional full getDocs read', () => {
  const historyService = read('src/services/historyService.ts')
  const start = historyService.indexOf('export async function recordPlay')
  const end = historyService.indexOf('\n}', start)
  const recordPlayBody = historyService.slice(start, end)
  assert.match(recordPlayBody, /getCountFromServer\(baseQuery\)/)
  // getDocs may still appear (the rare trim path), but only inside the size-gated branch, not unconditionally before it.
  const countCallIndex = recordPlayBody.indexOf('getCountFromServer')
  const getDocsIndex = recordPlayBody.indexOf('getDocs(')
  assert.ok(countCallIndex !== -1 && getDocsIndex > countCallIndex, 'getDocs must come after the count check, not before it')
})

// ---------------------------------------------------------------------------
// Player behaviour fixes from the Spotify-quality audit: Previous restarts
// the current track once meaningfully into it (or when there's nowhere
// earlier to go) rather than always jumping back a track; queue mutations
// (addToQueue/removeFromQueue/addPlaylistToQueue/playNext) apply the same
// structural change to both `queue` and `playOrder` instead of ever
// resetting playOrder back to queue's raw order, which used to silently
// discard shuffle on any queue edit.
// ---------------------------------------------------------------------------

test('previous() restarts the current track past a threshold instead of always stepping back, and playFromQueue exists for jumping to a queued track without resetting the queue', () => {
  const playerContext = read('src/contexts/PlayerContext.tsx')
  assert.match(playerContext, /PREVIOUS_RESTART_THRESHOLD_SEC = 3/)
  assert.match(playerContext, /progressSecRef\.current > PREVIOUS_RESTART_THRESHOLD_SEC \|\| !hasEarlierTrack/)
  assert.match(playerContext, /const playFromQueue = useCallback\(\(trackId: string\)/)
})

test('queue mutators (addToQueue/removeFromQueue/addPlaylistToQueue/playNext) update playOrder in lockstep with queue instead of resetting it, so shuffle survives queue edits', () => {
  const playerContext = read('src/contexts/PlayerContext.tsx')
  // Each of these must call setPlayOrder with a *function* derived from the same operation
  // applied to queue (not `setPlayOrder(queue)` / `setPlayOrder(next)` copied from the queue closure).
  assert.doesNotMatch(playerContext, /setQueue\(\(prev\) => \{[\s\S]{0,200}setPlayOrder\(next\)/)
  assert.match(playerContext, /setQueue\(insertAfterCurrent\)\s*\n\s*setPlayOrder\(insertAfterCurrent\)/)
  assert.match(playerContext, /setQueue\(append\)\s*\n\s*setPlayOrder\(append\)/)
  assert.match(playerContext, /setQueue\(remove\)\s*\n\s*setPlayOrder\(remove\)/)
})

test('account deletion and data export both include savedTracks alongside the other owner-scoped collections', () => {
  const deleteAccount = read('functions/src/account/deleteAccount.ts')
  assert.match(deleteAccount, /db\.collection\('savedTracks'\)\.where\('uid', '==', uid\)/)

  const exportUserData = read('functions/src/account/exportUserData.ts')
  assert.match(exportUserData, /docsWhere\('savedTracks', 'uid', uid\)/)
})
