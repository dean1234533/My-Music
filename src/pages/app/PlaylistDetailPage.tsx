import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ListMusic, ListPlus, Pause, Play, Shuffle, Trash2, X } from 'lucide-react'
import {
  deletePlaylist,
  getPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
  reorderPlaylistTracks,
} from '@/services/playlistService'
import { getTracks } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import { formatDuration } from '@/utils/format'
import type { PlaylistDoc } from '@/types/playlist'
import type { TrackDoc } from '@/types/track'

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const { notify } = useToast()
  const { playTrack, playPlaylist, togglePlay, toggleShuffle, shuffle, currentTrack, isPlaying, addToQueue, addPlaylistToQueue } = usePlayer()
  const [playlist, setPlaylist] = useState<PlaylistDoc | null | undefined>(undefined)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  async function load() {
    if (!playlistId) return
    const doc = await getPlaylist(playlistId)
    setPlaylist(doc)
    if (doc) {
      const byId = await getTracks(doc.trackIds)
      setTracks(doc.trackIds.map((id) => byId.get(id)).filter((t): t is TrackDoc => !!t))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId])

  if (playlist === undefined) return <LoadingState label="Loading playlist…" />
  if (playlist === null) {
    return <EmptyState title="Playlist not found" description="It may have been deleted." />
  }

  async function handleRename() {
    const title = titleDraft.trim()
    if (!title || !playlist) return
    try {
      await renamePlaylist(playlist.playlistId, title)
      setPlaylist({ ...playlist, title })
    } catch {
      notify('Could not rename the playlist.', 'error')
    } finally {
      setEditingTitle(false)
    }
  }

  async function handleRemove(trackId: string) {
    if (!playlist) return
    const nextIds = playlist.trackIds.filter((id) => id !== trackId)
    setPlaylist({ ...playlist, trackIds: nextIds })
    setTracks((prev) => prev.filter((t) => t.trackId !== trackId))
    try {
      await removeTrackFromPlaylist(playlist.playlistId, trackId)
    } catch {
      notify('Could not remove that track.', 'error')
      void load()
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!playlist) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= tracks.length) return
    const nextTracks = [...tracks]
    ;[nextTracks[index], nextTracks[nextIndex]] = [nextTracks[nextIndex], nextTracks[index]]
    setTracks(nextTracks)
    const nextIds = nextTracks.map((t) => t.trackId)
    setPlaylist({ ...playlist, trackIds: nextIds })
    try {
      await reorderPlaylistTracks(playlist.playlistId, nextIds)
    } catch {
      notify('Could not reorder the playlist.', 'error')
      void load()
    }
  }

  async function handleDelete() {
    if (!playlist) return
    if (!window.confirm(`Delete "${playlist.title}"? This can't be undone.`)) return
    try {
      await deletePlaylist(playlist.playlistId)
      notify('Playlist deleted.')
      navigate('/app/playlists')
    } catch {
      notify('Could not delete the playlist.', 'error')
    }
  }

  function handlePlay() {
    if (tracks.length === 0) return
    playPlaylist(tracks)
  }

  function handleShufflePlay() {
    if (tracks.length === 0) return
    playPlaylist(tracks)
    if (!shuffle) toggleShuffle()
  }

  function handleAddToQueue() {
    if (tracks.length === 0) return
    addPlaylistToQueue(tracks)
    notify(`Added ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} to the queue.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app/playlists" className="text-sm text-ink-3 hover:text-ink-1">
        ← Playlists
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-2xl font-medium tracking-[-0.025em] text-ink-0 outline-none"
          />
        ) : (
          <h1
            className="cursor-text text-2xl font-medium tracking-[-0.025em] text-ink-0"
            onClick={() => {
              setTitleDraft(playlist.title)
              setEditingTitle(true)
            }}
            title="Click to rename"
          >
            {playlist.title}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handlePlay} disabled={tracks.length === 0}>
            <Play size={16} /> Play
          </Button>
          <Button variant="secondary" onClick={handleShufflePlay} disabled={tracks.length === 0}>
            <Shuffle size={16} /> Shuffle
          </Button>
          <Button variant="secondary" onClick={handleAddToQueue} disabled={tracks.length === 0}>
            <ListPlus size={16} /> Queue
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          title="This playlist is empty"
          description="Add tracks from search or your library."
          action={
            <Link to="/app/search" className="text-sm font-medium text-brand-400 hover:underline">
              Search for music →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-1">
          {tracks.map((track, index) => {
            const isCurrent = currentTrack?.trackId === track.trackId
            return (
              <div
                key={track.trackId}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => (isCurrent ? togglePlay() : playTrack(track, tracks))}
                  className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-3 text-ink-1"
                >
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ListMusic size={16} />
                  )}
                  {isCurrent && isPlaying ? <Pause size={14} className="absolute" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-0">{track.title}</p>
                  <p className="truncate text-xs text-ink-3">{track.artist}</p>
                </div>
                {track.durationSeconds ? (
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">{formatDuration(track.durationSeconds)}</span>
                ) : null}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      addToQueue(track)
                      notify(`Added “${track.title}” to the queue.`)
                    }}
                    aria-label="Add to queue"
                    title="Add to queue"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink-0"
                  >
                    <ListPlus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink-0 disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(index, 1)}
                    disabled={index === tracks.length - 1}
                    aria-label="Move down"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink-0 disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(track.trackId)}
                    aria-label="Remove from playlist"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-danger-500/10 hover:text-danger-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
