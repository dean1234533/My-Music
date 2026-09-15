import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canonicalYoutubeUrl,
  extractYoutubePlaylistId,
  extractYoutubeVideoId,
  isValidYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from '../src/utils/youtube.ts'
import { formatCount, formatDuration } from '../src/utils/format.ts'
import { artistGroupKey, extractArtistFromTitle, pickArtistLabel, resolvedArtistName, stripArtistNoise } from '../src/utils/artist.ts'

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

// ---------------------------------------------------------------------------
// extractYoutubePlaylistId — the "add a whole album" entry point. Playlist
// IDs have no fixed length/prefix, unlike video IDs, so acceptance is
// deliberately looser; real confirmation happens server-side against the
// YouTube Data API in functions/src/youtubeSearch.ts's importYoutubePlaylist.
// ---------------------------------------------------------------------------

const VALID_PLAYLIST_ID = 'OLAK5uy_lZE1_examplePlaylist12'

test('extractYoutubePlaylistId accepts playlist URLs, watch-with-list URLs, and a bare pasted ID', () => {
  const urls = [
    `https://www.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
    `https://youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
    `https://music.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
    `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${VALID_PLAYLIST_ID}`,
    `https://www.youtube.com/watch?list=${VALID_PLAYLIST_ID}&v=dQw4w9WgXcQ`,
    VALID_PLAYLIST_ID,
    `  ${VALID_PLAYLIST_ID}  `,
  ]
  for (const input of urls) {
    assert.equal(extractYoutubePlaylistId(input), VALID_PLAYLIST_ID, `failed for ${input}`)
  }
})

test('extractYoutubePlaylistId rejects unsupported/invalid input rather than guessing', () => {
  const invalid = [
    '',
    '   ',
    'not a url at all',
    'too-short',
    `https://vimeo.com/12345678`,
    `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, // a plain video URL with no list= param
    `javascript:alert(1)//${VALID_PLAYLIST_ID}`,
    `https://www.youtube.com.evil.com/playlist?list=${VALID_PLAYLIST_ID}`,
  ]
  for (const input of invalid) {
    assert.equal(extractYoutubePlaylistId(input), null, `should reject ${input}`)
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
// updateSettings() writes with merge:true and only ever sends the field(s)
// actually changed, so a real settings doc can exist with only some fields
// ever set. getSettings() used to return that partial doc as-is, silently
// turning any never-written field (e.g. autoplayNext) into `undefined`
// instead of falling back to its default — the confirmed root cause of
// "it always plays one at a time and never auto skips" for any account
// that had only ever touched e.g. the volume setting. getSettings() must
// merge DEFAULT_SETTINGS underneath whatever the doc actually has.
// ---------------------------------------------------------------------------

test('settingsService.getSettings merges DEFAULT_SETTINGS under a partial settings doc so an unwritten field (e.g. autoplayNext) falls back to its default instead of becoming undefined', () => {
  const settingsService = read('src/services/settingsService.ts')
  assert.match(
    settingsService,
    /if \(snap\.exists\(\)\) return \{ uid, \.\.\.DEFAULT_SETTINGS, \.\.\.snap\.data\(\) \} as SettingsDoc/,
  )
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
  assert.match(libraryService, /export async function saveToLibrary\(uid: string, track: TrackDoc, options\?: \{ skipArtistPlaylist\?: boolean \}\)/)
  assert.match(libraryService, /export async function removeFromLibrary\(uid: string, trackId: string\)/)
  assert.match(libraryService, /export async function isInLibrary\(uid: string, trackId: string\)/)
  assert.match(libraryService, /where\('uid', '==', uid\)/)
})

// ---------------------------------------------------------------------------
// Every artist should always have an up-to-date playlist of everything by
// them in the library — saving a track by an artist for the first time
// creates that playlist, saving another by the same artist adds to it.
// Tracks the user doesn't want are removed manually via the normal playlist
// "remove" button, same as any other playlist — this service only ever adds.
//
// The first version of this queried for an existing playlist matching the
// artist key and created one if the query came back empty — a classic
// check-then-act race: saving several tracks by the same artist at once
// (e.g. "Add all to library") ran that check concurrently for all of them,
// so each one saw "no playlist yet" and created its own. Confirmed live:
// one real library ended up with 373 auto playlists for only 161 actual
// artists. The fix uses a deterministic per-artist document ID plus a
// transaction, so "does it exist" and "create/update it" are atomic against
// one fixed document no matter how many calls land at once.
// ---------------------------------------------------------------------------

test('ensureArtistPlaylist targets a deterministic per-user-per-artist document ID inside a transaction, so concurrent saves for the same artist can never race into duplicate playlists', () => {
  const libraryService = read('src/services/libraryService.ts')
  assert.match(libraryService, /await ensureArtistPlaylist\(uid, track\)/)

  const playlistService = read('src/services/playlistService.ts')
  assert.match(playlistService, /export async function ensureArtistPlaylist\(uid: string, track: TrackDoc\)/)
  // No query-then-create: the target document is derived directly from uid+key.
  assert.match(playlistService, /function artistPlaylistId\(uid: string, key: string\): string \{\s*return `artist_\$\{uid\}_\$\{key\}`/)
  assert.match(playlistService, /const ref = playlistRef\(artistPlaylistId\(uid, key\)\)/)
  assert.match(playlistService, /await runTransaction\(db, async \(tx\) => \{/)
  assert.match(playlistService, /const snap = await tx\.get\(ref\)/)
  // A brand-new artist playlist must record autoArtistKey.
  assert.match(playlistService, /autoArtistKey: key,/)
  // Adding a track already in the playlist must not duplicate it.
  assert.match(playlistService, /if \(!data\.trackIds\.includes\(track\.trackId\)\)/)
})

test('ensureArtistPlaylist self-heals a bad first-pick title once a plainer variant of the same artist is saved', () => {
  const playlistService = read('src/services/playlistService.ts')
  assert.match(
    playlistService,
    /if \(pickArtistLabel\(\[data\.title, candidateLabel\]\) === candidateLabel && candidateLabel !== data\.title\) \{/,
  )
})

// ---------------------------------------------------------------------------
// A whole playlist/paste-list import is already a deliberately curated group
// of tracks — user-requested: it should land together as that one import
// (via "Create playlist"), not get scattered across each track's own artist
// playlist the way an ad-hoc single "add to library" from search should.
// ---------------------------------------------------------------------------

test('importing a playlist or a pasted list of songs skips per-track artist-playlist linking when adding to the library, unlike an ad-hoc single "add to library" from search', () => {
  const searchPage = read('src/pages/app/SearchPage.tsx')
  const importMatches = searchPage.match(/saveToLibrary\(firebaseUser\.uid, t, \{ skipArtistPlaylist: true \}\)/g) ?? []
  assert.strictEqual(importMatches.length, 2, 'expected both handleImportAddAllToLibrary and handlePasteAddAllToLibrary to skip artist-playlist linking')
  // The single-track "Add to library" action (from a search result row) must still link normally.
  assert.match(searchPage, /await saveToLibrary\(firebaseUser\.uid, track\)\n/)
})

// ---------------------------------------------------------------------------
// "Add all to library" on an import used to only save tracks to the general
// library, with no playlist ever created for the batch — skipping artist-
// playlist linking (above) then left it with nowhere to show up as a group at
// all (user-reported: "some of the albums that i imported are not showing").
// It must now also create/populate a playlist for the whole import, same as
// the separate "Create playlist" button already does.
// ---------------------------------------------------------------------------

test('"Add all to library" on a playlist import or a pasted list also creates a playlist for the whole batch, not just saves to the library', () => {
  const searchPage = read('src/pages/app/SearchPage.tsx')
  const createPlaylistCalls = searchPage.match(/const playlistId = await createPlaylist\(firebaseUser\.uid, title\)/g) ?? []
  // One in handleImportAddAllToLibrary, one in handleImportCreatePlaylist, one in
  // handlePasteAddAllToLibrary, one in handlePasteCreatePlaylist.
  assert.strictEqual(createPlaylistCalls.length, 4)
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

// ---------------------------------------------------------------------------
// loadAndPlay used to destroy() and rebuild a brand-new YT.Player (and its
// iframe) for every track change. iOS Safari only allows a video inside an
// iframe to start playing without a fresh tap once that specific iframe has
// been "unlocked" by a real user gesture, so a freshly rebuilt iframe on
// every auto-advance meant playVideo() silently did nothing after a track
// ended — the queue would advance to the next track, but never actually
// play it (user-reported: "it skips now but does not auto play"). Once a
// player exists, loadAndPlay must reuse it via loadVideoById() instead of
// destroying and recreating it.
// ---------------------------------------------------------------------------

test('loadAndPlay reuses the existing player via loadVideoById once one exists, instead of destroying and recreating a new iframe for every track', () => {
  const playerContext = read('src/contexts/PlayerContext.tsx')
  assert.match(playerContext, /if \(playerRef\.current\) \{\s*playerRef\.current\.loadVideoById\(track\.youtubeVideoId\)/)
  // The one remaining `new YT.Player(...)` construction must only run when no player exists yet.
  const constructorCount = (playerContext.match(/new YT\.Player\(container/g) ?? []).length
  assert.strictEqual(constructorCount, 1)
})

// ---------------------------------------------------------------------------
// onError used to attribute a playback failure to currentTrackRef.current —
// reasonable when every track got its own freshly-constructed player, but
// this one long-lived player is reused across every track (see the test
// above), so by the time an error for some earlier load actually arrives,
// "current" may already be a different, perfectly fine track. Confirmed live:
// 12 of 13 tracks this had marked unavailable in the real database were still
// genuinely playable on YouTube (checked via YouTube's own oEmbed endpoint) —
// a real, currently-playing track was being permanently mislabeled broken
// every time some unrelated video's error landed while it happened to be
// current. onError must ask the player which video it actually failed on.
// ---------------------------------------------------------------------------

test('onError identifies the failed video from the player itself (getVideoData), not from currentTrackRef, and only shows the error banner when that matches the track currently on screen', () => {
  const playerContext = read('src/contexts/PlayerContext.tsx')
  assert.match(
    playerContext,
    /const failedVideoId = event\.target\.getVideoData\?\.\(\)\?\.video_id \|\| currentTrackRef\.current\?\.trackId/,
  )
  assert.match(playerContext, /if \(failedVideoId === currentTrackRef\.current\?\.trackId\) \{/)
  // markUnavailableLocally/markTrackUnavailable must run for whatever actually failed,
  // unconditionally — not gated behind "is this the track currently on screen".
  assert.doesNotMatch(
    playerContext,
    /if \(failedVideoId === currentTrackRef\.current\?\.trackId\) \{[\s\S]{0,80}markUnavailableLocally/,
  )
})

test('account deletion and data export both include savedTracks alongside the other owner-scoped collections', () => {
  const deleteAccount = read('functions/src/account/deleteAccount.ts')
  assert.match(deleteAccount, /db\.collection\('savedTracks'\)\.where\('uid', '==', uid\)/)

  const exportUserData = read('functions/src/account/exportUserData.ts')
  assert.match(exportUserData, /docsWhere\('savedTracks', 'uid', uid\)/)
})

// ---------------------------------------------------------------------------
// The Library "Artists" tab, and each artist's auto-maintained playlist, both
// group tracks by `track.artist`, which comes straight from the YouTube
// channel title. Confirmed against the live database: the same real artist
// routinely has several different channel-title strings — a plain upload
// channel, an auto-generated "Artist - Topic" channel, an "ArtistVEVO"
// channel — e.g. "Potter Payper", "Potter Payper - Topic", and
// "PotterPayperVEVO" all showed up as three separate artist groups instead
// of one. src/utils/artist.ts strips those two known, exact YouTube suffix
// conventions before grouping, shared by both features so they can never
// disagree on what counts as "the same artist".
// ---------------------------------------------------------------------------

test('stripArtistNoise/artistGroupKey merge "Artist", "Artist - Topic" and "ArtistVEVO" channel-title variants into one artist group', () => {
  assert.equal(stripArtistNoise('Potter Payper - Topic'), 'Potter Payper')
  assert.equal(stripArtistNoise('NasVEVO'), 'Nas')
  assert.equal(stripArtistNoise('Stormzy'), 'Stormzy')

  assert.equal(artistGroupKey('Potter Payper'), artistGroupKey('Potter Payper - Topic'))
  assert.equal(artistGroupKey('Potter Payper'), artistGroupKey('PotterPayperVEVO'))
  assert.equal(artistGroupKey('Nas - Topic'), artistGroupKey('NasVEVO'))
  assert.equal(artistGroupKey('MK'), artistGroupKey('MKVEVO'))
  // Genuinely different artists must not collapse into the same key.
  assert.notEqual(artistGroupKey('Stormzy'), artistGroupKey('Dappy'))
})

// ---------------------------------------------------------------------------
// stripArtistNoise/artistGroupKey only caught Topic/VEVO — real accounts kept
// splitting one artist across several playlists for other equally common
// channel-naming conventions, confirmed live: "Michael Jackson" vs
// "MichaelJackson80s" (decade tribute-channel suffix), "Ghetts" vs
// "GhettsOfficial" (Official-channel suffix), "BlackSherif" vs "Black Sherif
// Music" (Music-channel suffix), "Kiico" vs "KIICOTV" (TV-channel suffix),
// "Dr. Dre" vs "DrDre" / "T.I." vs "TI" (punctuation), "Krept & Konan" vs
// "KreptandKonan" (&), and "JayZ" vs "JAŸ-Z" (accented character).
// ---------------------------------------------------------------------------

test('artistGroupKey also merges decade/Official/Music/TV channel-suffix variants, punctuation differences, "&" vs "and", and accented characters', () => {
  assert.equal(artistGroupKey('Michael Jackson'), artistGroupKey('MichaelJackson80s'))
  assert.equal(artistGroupKey('Ghetts'), artistGroupKey('GhettsOfficial'))
  assert.equal(artistGroupKey('BlackSherif'), artistGroupKey('Black Sherif Music'))
  assert.equal(artistGroupKey('Kiico'), artistGroupKey('KIICOTV'))
  assert.equal(artistGroupKey('Layyah'), artistGroupKey("Layyah's TV"))
  assert.equal(artistGroupKey('Dr. Dre'), artistGroupKey('DrDre'))
  assert.equal(artistGroupKey('T.I.'), artistGroupKey('TI'))
  assert.equal(artistGroupKey('Krept & Konan'), artistGroupKey('KreptandKonan'))
  assert.equal(artistGroupKey('JayZ'), artistGroupKey('JAŸ-Z'))
  // Still must not over-merge two genuinely different real artists.
  assert.notEqual(artistGroupKey('Nas'), artistGroupKey('Nasty C'))
})

test('pickArtistLabel prefers whichever candidate looks like a plain artist name over a channel-decorated one, so a merged playlist never gets stuck with an ugly title', () => {
  assert.equal(pickArtistLabel(['GhettsOfficial', 'Ghetts']), 'Ghetts')
  assert.equal(pickArtistLabel(['Ghetts', 'GhettsOfficial']), 'Ghetts')
  assert.equal(pickArtistLabel(['MichaelJackson80s', 'Michael Jackson']), 'Michael Jackson')
  // No pure candidate at all: falls back to whichever has a space, else the longest.
  assert.equal(pickArtistLabel(['PotterPayperVEVO', 'PotterPayperOfficial']), 'PotterPayperOfficial')

  const libraryPage = read('src/pages/app/LibraryPage.tsx')
  assert.match(libraryPage, /label: pickArtistLabel\(labelCandidates\)/)
  assert.match(libraryPage, /const key = artistGroupKey\(resolvedName\)/)
})

// ---------------------------------------------------------------------------
// A track's uploading channel can be completely unrelated to who performs it —
// a reposter, a radio show, a curator channel — so no amount of channel-name
// cleanup can group it with that artist's own uploads. Confirmed live:
// "Lauryn Hill - ..." uploaded by channels named "nfltrackstarnydc" and
// "WeedHipHop" stayed split off from "Lauryn Hill - Topic" (the artist's own
// channel) since the channel names share no text with "Lauryn Hill" at all.
// resolvedArtistName prefers the artist credited in the video's own title
// ("Artist - Song") over the channel name whenever that pattern is present.
// ---------------------------------------------------------------------------

test('extractArtistFromTitle/resolvedArtistName prefer the artist credited in a video\'s own title over an unrelated uploading channel name', () => {
  assert.equal(extractArtistFromTitle('Lauryn Hill - Ex-Factor (Official Video)'), 'Lauryn Hill')
  assert.equal(extractArtistFromTitle('Doo Wop (That Thing)'), null)
  assert.equal(extractArtistFromTitle(''), null)
  // Confirmed live: a title where the matched "-" is actually inside a parenthetical
  // aside on the song title itself (no real artist prefix at all) used to extract
  // garbage like "Something Else Remix (Bonus Track" as the "artist" — rejected via
  // the unbalanced-parenthesis check instead of falling back to the channel name.
  assert.equal(extractArtistFromTitle('Something Else Remix (Bonus Track - Album Version (Explicit))'), null)

  assert.equal(
    resolvedArtistName({ artist: 'nfltrackstarnydc', title: 'Lauryn Hill - Ex-Factor (Official Video)' }),
    'Lauryn Hill',
  )
  assert.equal(resolvedArtistName({ artist: 'Lauryn Hill - Topic', title: 'Doo Wop (That Thing)' }), 'Lauryn Hill - Topic')

  // The two real upload paths for the same song now converge on one key.
  assert.equal(
    artistGroupKey(resolvedArtistName({ artist: 'nfltrackstarnydc', title: 'Lauryn Hill - Ex-Factor (Official Video)' })),
    artistGroupKey(resolvedArtistName({ artist: 'Lauryn Hill - Topic', title: 'Doo Wop (That Thing)' })),
  )

  const playlistService = read('src/services/playlistService.ts')
  assert.match(playlistService, /const resolvedName = resolvedArtistName\(track\)/)
  assert.match(playlistService, /const key = artistGroupKey\(resolvedName\)/)
})
