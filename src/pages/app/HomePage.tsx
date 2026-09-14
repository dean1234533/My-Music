import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListMusic, Search as SearchIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRecentlyPlayed } from '@/services/historyService'
import { subscribeFavorites } from '@/services/favoriteService'
import { subscribeOwnPlaylists } from '@/services/playlistService'
import { subscribeLibrary } from '@/services/libraryService'
import { getTracks } from '@/services/trackService'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'
import type { PlaylistDoc } from '@/types/playlist'
import type { SavedTrackDoc } from '@/types/savedTrack'

function millis(ts: unknown): number {
  const t = ts as { toMillis?: () => number } | null
  return t?.toMillis ? t.toMillis() : 0
}

export function HomePage() {
  const { firebaseUser, profile } = useAuth()
  const [recentlyPlayed, setRecentlyPlayed] = useState<TrackDoc[] | null>(null)
  const [favorites, setFavorites] = useState<TrackDoc[] | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<SavedTrackDoc[] | null>(null)
  const [savedTrackMap, setSavedTrackMap] = useState<Map<string, TrackDoc>>(new Map())

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRecentlyPlayed(firebaseUser.uid, (history) => {
      void getTracks(history.map((h) => h.trackId)).then((byId) => {
        setRecentlyPlayed(history.map((h) => byId.get(h.trackId)).filter((t): t is TrackDoc => !!t))
      })
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeFavorites(firebaseUser.uid, (favs) => {
      void getTracks(favs.map((f) => f.trackId)).then((byId) => {
        setFavorites(favs.map((f) => byId.get(f.trackId)).filter((t): t is TrackDoc => !!t))
      })
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeLibrary(firebaseUser.uid, setSavedTracks)
  }, [firebaseUser])

  useEffect(() => {
    const ids = (savedTracks ?? []).map((s) => s.trackId)
    if (ids.length === 0) {
      setSavedTrackMap(new Map())
      return
    }
    void getTracks(ids).then(setSavedTrackMap)
  }, [savedTracks])

  // Derived from the same resolved history list recentlyPlayed already builds (one entry per
  // play event, duplicates included for repeat plays) — counting occurrences per track gives a
  // real "most played" signal without a separate query or any fabricated data. Only surfaced
  // once a track has genuinely been played more than once, so this never just mirrors "Recently
  // played" with nothing to say.
  const mostPlayed = useMemo(() => {
    const counts = new Map<string, { track: TrackDoc; count: number }>()
    for (const track of recentlyPlayed ?? []) {
      const existing = counts.get(track.trackId)
      if (existing) existing.count += 1
      else counts.set(track.trackId, { track, count: 1 })
    }
    return [...counts.values()]
      .filter((c) => c.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((c) => c.track)
  }, [recentlyPlayed])

  const recentlyAdded = useMemo(() => {
    return [...(savedTracks ?? [])]
      .sort((a, b) => millis(b.addedAt) - millis(a.addedAt))
      .map((s) => savedTrackMap.get(s.trackId))
      .filter((t): t is TrackDoc => !!t)
      .slice(0, 20)
  }, [savedTracks, savedTrackMap])

  const loading = recentlyPlayed === null || favorites === null || playlists === null || savedTracks === null
  const firstName = profile?.displayName?.split(' ')[0]
  const isEmpty = loading
    ? false
    : recentlyPlayed.length === 0 && favorites.length === 0 && playlists.length === 0 && recentlyAdded.length === 0

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-white/[0.08] pb-8 pt-2">
        <p className="eyebrow">Your music</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">
          {firstName ? `Good to have you back, ${firstName}.` : 'Good to have you back.'}
        </h1>
        <p className="mt-3 text-base text-ink-2">Everything you've saved, played and built — in one place.</p>
      </div>

      {loading ? (
        <LoadingState label="Loading your music…" />
      ) : isEmpty ? (
        <EmptyState
          title="Your library is empty"
          description="Search YouTube for tracks, then save them to your library or a playlist to see them here."
          action={
            <Link
              to="/app/search"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:underline"
            >
              <SearchIcon size={16} /> Search for music
            </Link>
          }
        />
      ) : (
        <>
          <Rail
            title="Recently played"
            tracks={recentlyPlayed}
            emptyHint="Tracks you play will show up here."
          />
          <Rail
            title="Most played"
            tracks={mostPlayed}
            emptyHint="Play a track a few times to see it here."
          />
          <Rail
            title="Recently added"
            tracks={recentlyAdded}
            emptyHint="Tracks you save will show up here."
          />
          <Rail
            title="Liked songs"
            tracks={favorites}
            emptyHint="Songs you like will show up here."
          />
          <PlaylistRail playlists={playlists} />
        </>
      )}
    </div>
  )
}

function Rail({ title, tracks, emptyHint }: { title: string; tracks: TrackDoc[]; emptyHint: string }) {
  if (tracks.length === 0) return null
  return (
    <div>
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      {tracks.length === 0 ? (
        <p className="text-sm text-ink-3">{emptyHint}</p>
      ) : (
        <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
          {tracks.map((track) => (
            <TrackCard key={track.trackId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaylistRail({ playlists }: { playlists: PlaylistDoc[] }) {
  if (playlists.length === 0) return null
  return (
    <div>
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">Your playlists</h2>
      <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
        {playlists.map((playlist) => (
          <Link
            key={playlist.playlistId}
            to={`/app/playlists/${playlist.playlistId}`}
            className="group w-44 shrink-0 sm:w-52"
          >
            <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-[1.25rem] bg-surface-2 shadow-[0_18px_45px_rgba(0,0,0,.22)] ring-1 ring-white/[0.07] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_65px_rgba(0,0,0,.4)]">
              <ListMusic className="h-8 w-8 text-ink-3" />
            </div>
            <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-0">{playlist.title}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
