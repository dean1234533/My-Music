import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ListMusic } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { subscribeFavorites } from '@/services/favoriteService'
import { subscribeOwnPlaylists } from '@/services/playlistService'
import { subscribeRecentlyPlayed } from '@/services/historyService'
import { removeFromLibrary, subscribeLibrary } from '@/services/libraryService'
import { getTracks } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { TrackCard } from '@/components/music/TrackCard'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'
import type { FavoriteDoc } from '@/types/favorite'
import type { PlaylistDoc } from '@/types/playlist'
import type { PlayHistoryDoc } from '@/types/playHistory'
import type { SavedTrackDoc } from '@/types/savedTrack'

type Tab = 'all' | 'favorites' | 'recent-played' | 'artists'
type SortOrder = 'recent-added' | 'alphabetical' | 'artist'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All songs' },
  { id: 'favorites', label: 'Liked songs' },
  { id: 'recent-played', label: 'Recently played' },
  { id: 'artists', label: 'Artists' },
]

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: 'recent-added', label: 'Recently added' },
  { id: 'alphabetical', label: 'Alphabetical' },
  { id: 'artist', label: 'Artist' },
]

function millis(ts: unknown): number {
  const t = ts as { toMillis?: () => number } | null
  return t?.toMillis ? t.toMillis() : 0
}

export function LibraryPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const { playLibrary, playLikedSongs, playPlaylist } = usePlayer()
  const [savedTracks, setSavedTracks] = useState<SavedTrackDoc[] | null>(null)
  const [favorites, setFavorites] = useState<FavoriteDoc[] | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [history, setHistory] = useState<PlayHistoryDoc[] | null>(null)
  const [trackMap, setTrackMap] = useState<Map<string, TrackDoc>>(new Map())
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<SortOrder>('recent-added')
  const [filter, setFilter] = useState('')
  const [selectedArtistKey, setSelectedArtistKey] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeLibrary(firebaseUser.uid, setSavedTracks)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeFavorites(firebaseUser.uid, setFavorites)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRecentlyPlayed(firebaseUser.uid, setHistory)
  }, [firebaseUser])

  // Union of savedTracks + favorites + every playlist's tracks + history — a track can end
  // up in the library view from any of those without needing its own savedTracks entry
  // (e.g. a track only ever added to a playlist still shows up, matching how tracks used to
  // work), but "All songs" itself is driven by savedTracks specifically (see allTracks below).
  const allKnownTrackIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of savedTracks ?? []) ids.add(s.trackId)
    for (const f of favorites ?? []) ids.add(f.trackId)
    for (const p of playlists ?? []) for (const id of p.trackIds) ids.add(id)
    for (const h of history ?? []) ids.add(h.trackId)
    return [...ids]
  }, [savedTracks, favorites, playlists, history])

  useEffect(() => {
    if (allKnownTrackIds.length === 0) {
      setTrackMap(new Map())
      return
    }
    void getTracks(allKnownTrackIds).then(setTrackMap)
  }, [allKnownTrackIds])

  const loading = savedTracks === null || favorites === null || playlists === null || history === null

  const allTracks = useMemo(
    () =>
      (savedTracks ?? [])
        .map((s) => {
          const track = trackMap.get(s.trackId)
          return track ? { track, addedAt: millis(s.addedAt) } : null
        })
        .filter((t): t is { track: TrackDoc; addedAt: number } => t !== null),
    [savedTracks, trackMap],
  )

  const favoriteTracks = useMemo(
    () => (favorites ?? []).map((f) => trackMap.get(f.trackId)).filter((t): t is TrackDoc => !!t),
    [favorites, trackMap],
  )

  const recentlyPlayed = useMemo(
    () => (history ?? []).map((h) => trackMap.get(h.trackId)).filter((t): t is TrackDoc => !!t),
    [history, trackMap],
  )

  function sortTracks(tracks: { track: TrackDoc; addedAt: number }[]): TrackDoc[] {
    const copy = [...tracks]
    if (sort === 'alphabetical') copy.sort((a, b) => a.track.title.localeCompare(b.track.title))
    else if (sort === 'artist') copy.sort((a, b) => a.track.artist.localeCompare(b.track.artist))
    else copy.sort((a, b) => b.addedAt - a.addedAt)
    return copy.map((c) => c.track)
  }

  const filteredAllTracks = useMemo(() => {
    const sorted = sortTracks(allTracks)
    const q = filter.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTracks, sort, filter])

  const artistGroups = useMemo(() => {
    const map = new Map<string, TrackDoc[]>()
    for (const { track } of allTracks) {
      const key = track.artist.trim().toLowerCase() || 'unknown'
      const existing = map.get(key)
      if (existing) existing.push(track)
      else map.set(key, [track])
    }
    return [...map.entries()]
      .map(([key, tracks]) => ({ key, label: tracks[0].artist.trim() || 'Unknown artist', tracks }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allTracks])

  const selectedArtist = useMemo(
    () => (selectedArtistKey ? artistGroups.find((g) => g.key === selectedArtistKey) ?? null : null),
    [artistGroups, selectedArtistKey],
  )

  async function handleRemove(trackId: string) {
    if (!firebaseUser) return
    try {
      await removeFromLibrary(firebaseUser.uid, trackId)
      notify('Removed from your library.')
    } catch {
      notify('Could not remove that track. Please try again.', 'error')
    }
  }

  if (loading) return <LoadingState label="Loading your library…" />

  if (allTracks.length === 0 && recentlyPlayed.length === 0 && favoriteTracks.length === 0) {
    return (
      <EmptyState
        title="Your library is empty"
        description="Save tracks from search to build your library."
        action={
          <Link to="/app/search" className="text-sm font-medium text-brand-400 hover:underline">
            Search for music →
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-[-0.025em] text-ink-0">Library</h1>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter your library…"
          className="w-full max-w-xs"
          aria-label="Filter your library"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                setSelectedArtistKey(null)
              }}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? 'bg-brand-500 text-[#080a05]' : 'bg-white/[0.05] text-ink-1 hover:bg-white/[0.09]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'all' ? (
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-ink-1 outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {tab === 'all' ? (
        <TrackGrid
          tracks={filteredAllTracks}
          emptyLabel={filter.trim() ? 'No matching songs.' : 'No saved songs yet.'}
          onRemove={(id) => void handleRemove(id)}
          onPlayAll={filteredAllTracks.length > 0 ? () => playLibrary(filteredAllTracks) : undefined}
        />
      ) : null}
      {tab === 'favorites' ? (
        <TrackGrid
          tracks={favoriteTracks}
          emptyLabel="Songs you like will appear here."
          onPlayAll={favoriteTracks.length > 0 ? () => playLikedSongs(favoriteTracks) : undefined}
        />
      ) : null}
      {tab === 'recent-played' ? <TrackGrid tracks={recentlyPlayed} emptyLabel="You haven't played anything yet." /> : null}
      {tab === 'artists' ? (
        artistGroups.length === 0 ? (
          <EmptyState title="No artists yet" description="Save some tracks to see them grouped by artist." />
        ) : selectedArtist ? (
          <div className="flex flex-col gap-6">
            <button
              type="button"
              onClick={() => setSelectedArtistKey(null)}
              className="flex w-fit items-center gap-1 text-sm text-ink-3 hover:text-ink-1"
            >
              <ChevronLeft size={16} /> Artists
            </button>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-white/[0.08]">
                {selectedArtist.tracks[0]?.thumbnail ? (
                  <img src={selectedArtist.tracks[0].thumbnail!} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <h2 className="text-2xl font-medium tracking-[-0.025em] text-ink-0">{selectedArtist.label}</h2>
                <p className="text-sm text-ink-3">
                  {selectedArtist.tracks.length} {selectedArtist.tracks.length === 1 ? 'song' : 'songs'}
                </p>
              </div>
            </div>
            <TrackGrid tracks={selectedArtist.tracks} emptyLabel="No songs." onPlayAll={() => playPlaylist(selectedArtist.tracks)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {artistGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelectedArtistKey(group.key)}
                className="group text-left"
              >
                <div className="aspect-square w-full overflow-hidden rounded-full bg-surface-2 shadow-[0_18px_45px_rgba(0,0,0,.22)] ring-1 ring-white/[0.07] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_65px_rgba(0,0,0,.4)]">
                  {group.tracks[0]?.thumbnail ? (
                    <img src={group.tracks[0].thumbnail!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-3">
                      <ListMusic className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-0">{group.label}</p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {group.tracks.length} {group.tracks.length === 1 ? 'song' : 'songs'}
                </p>
              </button>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function TrackGrid({
  tracks,
  emptyLabel,
  onRemove,
  onPlayAll,
}: {
  tracks: TrackDoc[]
  emptyLabel: string
  onRemove?: (trackId: string) => void
  onPlayAll?: () => void
}) {
  if (tracks.length === 0) return <EmptyState title={emptyLabel} />
  return (
    <div className="flex flex-col gap-4">
      {onPlayAll ? (
        <div>
          <button
            type="button"
            onClick={onPlayAll}
            className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-[#080a05] transition hover:bg-brand-400"
          >
            Play all
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tracks.map((track) => (
          <TrackCard
            key={track.trackId}
            track={track}
            queue={tracks}
            fill
            onRemove={onRemove ? () => onRemove(track.trackId) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
