import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, ListPlus, Plus, Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { PlaylistPickerModal } from '@/components/music/PlaylistPickerModal'
import { TrackCard } from '@/components/music/TrackCard'
import { LoadingState, EmptyState, ErrorState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePlayer } from '@/contexts/PlayerContext'
import { searchYoutube, type YoutubeSearchResult } from '@/services/youtubeSearchService'
import { getTracks, saveTrack } from '@/services/trackService'
import { saveToLibrary, subscribeLibrary } from '@/services/libraryService'
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

export function SearchPage() {
  const { notify } = useToast()
  const { firebaseUser } = useAuth()
  const { playTrack } = usePlayer()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<YoutubeSearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [pickerTrack, setPickerTrack] = useState<TrackDoc | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kept locally so results can be marked "Already in your library" and so
  // matching library tracks can be shown instantly (no YouTube call) as the
  // user types — see matchesQuery() below.
  const [savedTracks, setSavedTracks] = useState<SavedTrackDoc[] | null>(null)
  const [libraryTrackMap, setLibraryTrackMap] = useState<Map<string, TrackDoc>>(new Map())

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

  async function runSearch(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const found = await searchYoutube(trimmed)
      setResults(found)
      saveRecentSearch(trimmed)
      setRecentSearches(loadRecentSearches())
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
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

  const showYoutubeSection = results !== null || loading || error !== null

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
            <div className="flex flex-col gap-2">
              {(results ?? []).map((result) => {
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
              })}
            </div>
          )}
        </div>
      ) : null}

      {pickerTrack ? <PlaylistPickerModal track={pickerTrack} onClose={() => setPickerTrack(null)} /> : null}
    </div>
  )
}
