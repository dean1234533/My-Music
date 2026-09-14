import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp, ClipboardList, ListPlus, ListMusic, Plus, Search as SearchIcon, X } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { PlaylistPickerModal } from '@/components/music/PlaylistPickerModal'
import { TrackCard } from '@/components/music/TrackCard'
import { LoadingState, EmptyState, ErrorState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePlayer } from '@/contexts/PlayerContext'
import { searchYoutube, importYoutubePlaylist, type YoutubeSearchResult } from '@/services/youtubeSearchService'
import { getTracks, saveTrack } from '@/services/trackService'
import { saveToLibrary, subscribeLibrary } from '@/services/libraryService'
import { createPlaylist, reorderPlaylistTracks } from '@/services/playlistService'
import { formatDuration } from '@/utils/format'
import type { TrackDoc } from '@/types/track'
import type { SavedTrackDoc } from '@/types/savedTrack'

const RECENT_SEARCHES_KEY = 'myMusic.recentSearches'
const MAX_RECENT_SEARCHES = 10

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  try {
    const existing = loadRecentSearches().filter((q) => q.toLowerCase() !== query.toLowerCase())
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([query, ...existing].slice(0, MAX_RECENT_SEARCHES)))
  } catch {
    // localStorage unavailable — recent searches are a convenience, not critical.
  }
}

function resultToSaveInput(result: YoutubeSearchResult) {
  return {
    youtubeVideoId: result.youtubeVideoId,
    title: result.title,
    artist: result.channelTitle,
    thumbnail: result.thumbnail,
    durationSeconds: result.durationSeconds,
  }
}

function matchesQuery(track: TrackDoc, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)
}

/** Caps a single paste-list import's quota/latency cost — each line is its own search call. */
const MAX_BULK_LINES = 25

interface BulkLineResult {
  line: string
  status: 'pending' | 'searching' | 'found' | 'notfound' | 'error'
  result: YoutubeSearchResult | null
  included: boolean
}

export function SearchPage() {
  const { notify } = useToast()
  const { firebaseUser } = useAuth()
  const { playTrack } = usePlayer()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<YoutubeSearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [pickerTrack, setPickerTrack] = useState<TrackDoc | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [musicOnly, setMusicOnly] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kept locally so results can be marked "Already in your library" and so
  // matching library tracks can be shown instantly (no YouTube call) as the
  // user types — see matchesQuery() below.
  const [savedTracks, setSavedTracks] = useState<SavedTrackDoc[] | null>(null)
  const [libraryTrackMap, setLibraryTrackMap] = useState<Map<string, TrackDoc>>(new Map())

  // Whole-album/playlist import — see functions/src/youtubeSearch.ts's importYoutubePlaylist.
  const [importOpen, setImportOpen] = useState(false)
  const [playlistUrlInput, setPlaylistUrlInput] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importedTitle, setImportedTitle] = useState<string | null>(null)
  const [importedResults, setImportedResults] = useState<YoutubeSearchResult[] | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Paste-list import — migrate a playlist from elsewhere by pasting song names, one per line.
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteRunning, setPasteRunning] = useState(false)
  const [pasteLines, setPasteLines] = useState<BulkLineResult[] | null>(null)
  const [pastePlaylistName, setPastePlaylistName] = useState('')
  const [pasteActionBusy, setPasteActionBusy] = useState(false)

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeLibrary(firebaseUser.uid, setSavedTracks)
  }, [firebaseUser])

  useEffect(() => {
    const ids = (savedTracks ?? []).map((s) => s.trackId)
    if (ids.length === 0) {
      setLibraryTrackMap(new Map())
      return
    }
    void getTracks(ids).then(setLibraryTrackMap)
  }, [savedTracks])

  const savedTrackIds = useMemo(() => new Set((savedTracks ?? []).map((s) => s.trackId)), [savedTracks])

  // Instant, free, client-side — never touches the YouTube API. See spec: "search my
  // library first" to avoid an API call for a track the user has already saved.
  const libraryMatches = useMemo(() => {
    if (!term.trim()) return []
    return [...libraryTrackMap.values()].filter((t) => matchesQuery(t, term))
  }, [libraryTrackMap, term])

  async function runSearch(query: string, scopeMusicOnly = musicOnly) {
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const found = await searchYoutube(trimmed, scopeMusicOnly)
      setResults(found)
      saveRecentSearch(trimmed)
      setRecentSearches(loadRecentSearches())
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleScopeChange(nextMusicOnly: boolean) {
    setMusicOnly(nextMusicOnly)
    if (term.trim()) void runSearch(term, nextMusicOnly)
  }

  function handleChange(value: string) {
    setTerm(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults(null)
      return
    }
    debounceRef.current = setTimeout(() => void runSearch(value), 450)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    void runSearch(term)
  }

  async function handlePlay(result: YoutubeSearchResult) {
    setPendingAction(`play:${result.youtubeVideoId}`)
    try {
      const track = await saveTrack(resultToSaveInput(result))
      playTrack(track)
    } catch {
      notify('Could not play this track. Please try again.', 'error')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleAddToLibrary(result: YoutubeSearchResult) {
    if (!firebaseUser || savedTrackIds.has(result.youtubeVideoId)) return
    setPendingAction(`library:${result.youtubeVideoId}`)
    try {
      const track = await saveTrack(resultToSaveInput(result))
      await saveToLibrary(firebaseUser.uid, track.trackId)
      notify(`Added “${track.title}” to your library.`)
    } catch {
      notify('Could not add this track. Please try again.', 'error')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleAddToPlaylist(result: YoutubeSearchResult) {
    setPendingAction(`playlist:${result.youtubeVideoId}`)
    try {
      const track = await saveTrack(resultToSaveInput(result))
      setPickerTrack(track)
    } catch {
      notify('Could not add this track. Please try again.', 'error')
    } finally {
      setPendingAction(null)
    }
  }

  function clearRecentSearches() {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // ignore
    }
    setRecentSearches([])
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault()
    if (!playlistUrlInput.trim()) return
    setImportLoading(true)
    setImportError(null)
    setImportedResults(null)
    setImportedTitle(null)
    try {
      const { playlistTitle, results: found } = await importYoutubePlaylist(playlistUrlInput)
      setImportedTitle(playlistTitle)
      setImportedResults(found)
      if (found.length === 0) setImportError("That playlist doesn't have any playable tracks.")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't import that playlist. Check the link and try again.")
    } finally {
      setImportLoading(false)
    }
  }

  async function handleImportAddAllToLibrary() {
    if (!firebaseUser || !importedResults || bulkBusy) return
    setBulkBusy(true)
    try {
      const toAdd = importedResults.filter((r) => !savedTrackIds.has(r.youtubeVideoId))
      const tracks = await Promise.all(toAdd.map((r) => saveTrack(resultToSaveInput(r))))
      await Promise.all(tracks.map((t) => saveToLibrary(firebaseUser.uid, t.trackId)))
      notify(
        toAdd.length === 0
          ? 'Every track from this playlist is already in your library.'
          : `Added ${toAdd.length} ${toAdd.length === 1 ? 'track' : 'tracks'} to your library.`,
      )
    } catch {
      notify('Could not add all tracks. Please try again.', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleImportCreatePlaylist() {
    if (!firebaseUser || !importedResults || importedResults.length === 0 || bulkBusy) return
    setBulkBusy(true)
    try {
      const tracks = await Promise.all(importedResults.map((r) => saveTrack(resultToSaveInput(r))))
      const title = importedTitle?.trim() || 'Imported playlist'
      const playlistId = await createPlaylist(firebaseUser.uid, title)
      await reorderPlaylistTracks(playlistId, tracks.map((t) => t.trackId))
      notify(`Created “${title}” with ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}.`)
      navigate(`/app/playlists/${playlistId}`)
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  /** Searches one line at a time (not in parallel) so a bulk paste of many songs doesn't burst past the per-user search rate limit all at once. */
  async function handlePasteSearch(event: FormEvent) {
    event.preventDefault()
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_BULK_LINES)
    if (lines.length === 0) return
    setPasteRunning(true)
    setPasteLines(lines.map((line) => ({ line, status: 'pending', result: null, included: true })))
    for (let i = 0; i < lines.length; i += 1) {
      setPasteLines((prev) => prev?.map((l, idx) => (idx === i ? { ...l, status: 'searching' } : l)) ?? prev)
      try {
        const found = await searchYoutube(lines[i])
        const top = found[0] ?? null
        setPasteLines((prev) =>
          prev?.map((l, idx) => (idx === i ? { ...l, status: top ? 'found' : 'notfound', result: top } : l)) ?? prev,
        )
      } catch {
        setPasteLines((prev) => prev?.map((l, idx) => (idx === i ? { ...l, status: 'error', result: null } : l)) ?? prev)
      }
    }
    setPasteRunning(false)
  }

  function toggleLineIncluded(index: number) {
    setPasteLines((prev) => prev?.map((l, idx) => (idx === index ? { ...l, included: !l.included } : l)) ?? prev)
  }

  function pasteMatchedTracks(): YoutubeSearchResult[] {
    return (pasteLines ?? []).filter((l) => l.included && l.result).map((l) => l.result!)
  }

  async function handlePasteAddAllToLibrary() {
    if (!firebaseUser || pasteActionBusy) return
    const matched = pasteMatchedTracks()
    if (matched.length === 0) return
    setPasteActionBusy(true)
    try {
      const tracks = await Promise.all(matched.map((r) => saveTrack(resultToSaveInput(r))))
      await Promise.all(tracks.map((t) => saveToLibrary(firebaseUser.uid, t.trackId)))
      notify(`Added ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} to your library.`)
    } catch {
      notify('Could not add all tracks. Please try again.', 'error')
    } finally {
      setPasteActionBusy(false)
    }
  }

  async function handlePasteCreatePlaylist() {
    if (!firebaseUser || pasteActionBusy) return
    const matched = pasteMatchedTracks()
    if (matched.length === 0) return
    setPasteActionBusy(true)
    try {
      const tracks = await Promise.all(matched.map((r) => saveTrack(resultToSaveInput(r))))
      const title = pastePlaylistName.trim() || 'Imported playlist'
      const playlistId = await createPlaylist(firebaseUser.uid, title)
      await reorderPlaylistTracks(playlistId, tracks.map((t) => t.trackId))
      notify(`Created “${title}” with ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}.`)
      navigate(`/app/playlists/${playlistId}`)
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setPasteActionBusy(false)
    }
  }

  const showYoutubeSection = results !== null || loading || error !== null

  function renderResultRow(result: YoutubeSearchResult) {
    const alreadySaved = savedTrackIds.has(result.youtubeVideoId)
    return (
      <div
        key={result.youtubeVideoId}
        className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-3">
          {result.thumbnail ? <img src={result.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink-0">{result.title}</p>
            {result.isLive ? (
              <span className="shrink-0 rounded-full bg-danger-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-500">
                Live
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-ink-3">
            {result.channelTitle}
            {result.durationSeconds ? ` · ${formatDuration(result.durationSeconds)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handlePlay(result)}
            loading={pendingAction === `play:${result.youtubeVideoId}`}
          >
            Play
          </Button>
          <button
            type="button"
            onClick={() => void handleAddToLibrary(result)}
            disabled={pendingAction !== null || alreadySaved}
            aria-label={alreadySaved ? 'Already in your library' : 'Add to library'}
            title={alreadySaved ? 'Already in your library' : 'Add to library'}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 transition hover:bg-white/[0.09] hover:text-ink-0 disabled:opacity-50"
          >
            {alreadySaved ? <Check size={18} className="text-brand-400" /> : <Plus size={18} />}
          </button>
          <button
            type="button"
            onClick={() => void handleAddToPlaylist(result)}
            disabled={pendingAction !== null}
            aria-label="Add to playlist"
            title="Add to playlist"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 transition hover:bg-white/[0.09] hover:text-ink-0 disabled:opacity-50"
          >
            <ListPlus size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-2xl font-medium tracking-[-0.025em] text-ink-0">Search</h1>
        <form onSubmit={handleSubmit} className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={term}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search your library or YouTube for a track, artist or channel…"
            className="pl-11"
            autoFocus
          />
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => handleScopeChange(true)}
            aria-pressed={musicOnly}
            className={`rounded-full px-3 py-1 font-medium transition ${musicOnly ? 'bg-brand-500 text-[#080a05]' : 'text-ink-3 hover:text-ink-1'}`}
          >
            Songs
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange(false)}
            aria-pressed={!musicOnly}
            className={`rounded-full px-3 py-1 font-medium transition ${!musicOnly ? 'bg-brand-500 text-[#080a05]' : 'text-ink-3 hover:text-ink-1'}`}
          >
            All videos
          </button>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink-1"
        >
          <ListMusic size={14} />
          Import a whole album or playlist from YouTube
          {importOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {importOpen ? (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <form onSubmit={handleImport} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={playlistUrlInput}
                onChange={(e) => setPlaylistUrlInput(e.target.value)}
                placeholder="Paste a YouTube playlist/album link…"
                className="flex-1"
              />
              <Button type="submit" loading={importLoading} disabled={!playlistUrlInput.trim()}>
                Import
              </Button>
            </form>
            <p className="mt-2 text-xs text-ink-3">
              Most official albums are uploaded to YouTube as a playlist — paste its link (not a single video)
              to pull in every track at once, then review before adding anything.
            </p>

            {importLoading ? <LoadingState label="Fetching playlist…" /> : null}
            {importError ? <p className="mt-3 text-sm text-danger-500">{importError}</p> : null}

            {importedResults && importedResults.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-0">
                    {importedTitle} <span className="text-ink-3">({importedResults.length} tracks)</span>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void handleImportAddAllToLibrary()} loading={bulkBusy}>
                      Add all to library
                    </Button>
                    <Button size="sm" onClick={() => void handleImportCreatePlaylist()} loading={bulkBusy}>
                      Create playlist
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">{importedResults.map(renderResultRow)}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink-1"
        >
          <ClipboardList size={14} />
          Migrate a playlist by pasting song names
          {pasteOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {pasteOpen ? (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <form onSubmit={handlePasteSearch} className="flex flex-col gap-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'One song per line, e.g.\nBlinding Lights – The Weeknd\nLose Yourself – Eminem'}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0 placeholder:text-ink-3 outline-none focus:border-brand-500/70"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-ink-3">Up to {MAX_BULK_LINES} lines — each one is a separate search, so this can take a moment.</p>
                <Button type="submit" size="sm" loading={pasteRunning} disabled={!pasteText.trim()}>
                  Search all
                </Button>
              </div>
            </form>

            {pasteLines ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input
                    value={pastePlaylistName}
                    onChange={(e) => setPastePlaylistName(e.target.value)}
                    placeholder="New playlist name"
                    className="max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handlePasteAddAllToLibrary()}
                      loading={pasteActionBusy}
                      disabled={pasteRunning || pasteMatchedTracks().length === 0}
                    >
                      Add matched to library
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handlePasteCreatePlaylist()}
                      loading={pasteActionBusy}
                      disabled={pasteRunning || pasteMatchedTracks().length === 0}
                    >
                      Create playlist
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {pasteLines.map((line, index) => (
                    <div
                      key={`${line.line}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      {line.status === 'searching' || line.status === 'pending' ? (
                        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-surface-3" />
                      ) : line.result?.thumbnail ? (
                        <img src={line.result.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-surface-3" />
                      )}
                      <div className="min-w-0 flex-1">
                        {line.result ? (
                          <>
                            <p className="truncate text-sm font-semibold text-ink-0">{line.result.title}</p>
                            <p className="truncate text-xs text-ink-3">
                              Matched for “{line.line}” · {line.result.channelTitle}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="truncate text-sm text-ink-1">{line.line}</p>
                            <p className="truncate text-xs text-ink-3">
                              {line.status === 'searching' || line.status === 'pending'
                                ? 'Searching…'
                                : line.status === 'error'
                                  ? 'Search failed'
                                  : 'No match found'}
                            </p>
                          </>
                        )}
                      </div>
                      {line.result ? (
                        <button
                          type="button"
                          onClick={() => toggleLineIncluded(index)}
                          aria-label={line.included ? 'Exclude from import' : 'Include in import'}
                          title={line.included ? 'Exclude from import' : 'Include in import'}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                            line.included
                              ? 'border-brand-400/30 bg-brand-500/15 text-brand-400'
                              : 'border-white/[0.08] bg-black/25 text-ink-3'
                          }`}
                        >
                          {line.included ? <Check size={18} /> : <X size={18} />}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {libraryMatches.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">From your library</h2>
          <div className="scrollbar-none flex gap-5 overflow-x-auto pb-2">
            {libraryMatches.map((track) => (
              <TrackCard key={track.trackId} track={track} queue={libraryMatches} />
            ))}
          </div>
        </div>
      ) : null}

      {!term.trim() ? (
        recentSearches.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Recent searches</h2>
              <button onClick={clearRecentSearches} className="text-xs font-medium text-ink-3 hover:text-ink-1">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((query) => (
                <button
                  key={query}
                  onClick={() => {
                    setTerm(query)
                    void runSearch(query)
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-ink-1 hover:bg-white/[0.08]"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Search for music" description="Find tracks on YouTube, then save them to your library or a playlist." />
        )
      ) : null}

      {showYoutubeSection ? (
        <div>
          {term.trim() ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">From YouTube</h2> : null}
          {loading ? (
            <LoadingState label="Searching…" />
          ) : error ? (
            <ErrorState description={error} />
          ) : results && results.length === 0 ? (
            <EmptyState title="No results" description="Try a different search term." />
          ) : (
            <div className="flex flex-col gap-2">{(results ?? []).map(renderResultRow)}</div>
          )}
        </div>
      ) : null}

      {pickerTrack ? <PlaylistPickerModal track={pickerTrack} onClose={() => setPickerTrack(null)} /> : null}
    </div>
  )
}
