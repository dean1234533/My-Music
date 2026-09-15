import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ListMusic } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { removeFromLibrary, subscribeLibrary } from '@/services/libraryService'
import { getTracks } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { artistGroupKey, pickArtistLabel, resolvedArtistName, stripArtistNoise } from '@/utils/artist'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { TrackCard } from '@/components/music/TrackCard'
import type { TrackDoc } from '@/types/track'
import type { SavedTrackDoc } from '@/types/savedTrack'

/**
 * The library is browsed by artist only, never as a flat list of individual
 * tracks (user-reported: "when i click library it load single tracks when it
 * should never do this. i want the app to show the artist only so i can
 * press on the artist and see all tracks") — pick a playlist for anything
 * more specific than "everything by this artist".
 */
export function LibraryPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const { playPlaylist } = usePlayer()
  const [savedTracks, setSavedTracks] = useState<SavedTrackDoc[] | null>(null)
  const [trackMap, setTrackMap] = useState<Map<string, TrackDoc>>(new Map())
  const [filter, setFilter] = useState('')
  const [selectedArtistKey, setSelectedArtistKey] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeLibrary(firebaseUser.uid, setSavedTracks)
  }, [firebaseUser])

  useEffect(() => {
    const ids = (savedTracks ?? []).map((s) => s.trackId)
    if (ids.length === 0) {
      setTrackMap(new Map())
      return
    }
    void getTracks(ids).then(setTrackMap)
  }, [savedTracks])

  const loading = savedTracks === null

  const allTracks = useMemo(
    () => (savedTracks ?? []).map((s) => trackMap.get(s.trackId)).filter((t): t is TrackDoc => !!t),
    [savedTracks, trackMap],
  )

  const artistGroups = useMemo(() => {
    const map = new Map<string, { tracks: TrackDoc[]; labelCandidates: string[] }>()
    for (const track of allTracks) {
      const resolvedName = resolvedArtistName(track)
      const key = artistGroupKey(resolvedName)
      const cleaned = stripArtistNoise(resolvedName)
      const existing = map.get(key)
      if (existing) {
        existing.tracks.push(track)
        existing.labelCandidates.push(cleaned)
      } else {
        map.set(key, { tracks: [track], labelCandidates: [cleaned] })
      }
    }
    return [...map.entries()]
      .map(([key, { tracks, labelCandidates }]) => ({ key, label: pickArtistLabel(labelCandidates), tracks }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allTracks])

  const filteredArtistGroups = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return artistGroups
    return artistGroups.filter((g) => g.label.toLowerCase().includes(q))
  }, [artistGroups, filter])

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

  if (artistGroups.length === 0) {
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
        {!selectedArtist ? (
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter artists…"
            className="w-full max-w-xs"
            aria-label="Filter artists"
          />
        ) : null}
      </div>

      {selectedArtist ? (
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
          <TrackGrid tracks={selectedArtist.tracks} emptyLabel="No songs." onRemove={(id) => void handleRemove(id)} onPlayAll={() => playPlaylist(selectedArtist.tracks)} />
        </div>
      ) : filteredArtistGroups.length === 0 ? (
        <EmptyState title="No matching artists." />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredArtistGroups.map((group) => (
            <button key={group.key} type="button" onClick={() => setSelectedArtistKey(group.key)} className="group text-left">
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
      )}
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
