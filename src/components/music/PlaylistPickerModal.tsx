import { useEffect, useState } from 'react'
import { Check, ListMusic, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { addTrackToPlaylist, createPlaylist, removeTrackFromPlaylist, subscribeOwnPlaylists } from '@/services/playlistService'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import type { PlaylistDoc } from '@/types/playlist'
import type { TrackDoc } from '@/types/track'

export function PlaylistPickerModal({ track, onClose }: { track: TrackDoc; onClose: () => void }) {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists)
  }, [firebaseUser])

  async function addToPlaylist(playlist: PlaylistDoc) {
    if (playlist.trackIds.includes(track.trackId)) {
      setPendingId(playlist.playlistId)
      try {
        await removeTrackFromPlaylist(playlist.playlistId, track.trackId)
        notify(`Removed “${track.title}” from ${playlist.title}.`, 'info')
      } catch {
        notify('Could not remove this track. Please try again.', 'error')
      } finally {
        setPendingId(null)
      }
      return
    }
    setPendingId(playlist.playlistId)
    try {
      await addTrackToPlaylist(playlist.playlistId, track.trackId)
      notify(`Added “${track.title}” to ${playlist.title}.`)
      onClose()
    } catch {
      notify('Could not add this track. Please try again.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  async function createAndAdd() {
    if (!firebaseUser || !newTitle.trim()) return
    setPendingId('new')
    const title = newTitle.trim()
    try {
      const playlistId = await createPlaylist(firebaseUser.uid, title)
      await addTrackToPlaylist(playlistId, track.trackId)
      notify(`Created ${title} and added “${track.title}”.`)
      onClose()
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal title="Add to playlist" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-3">
            {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : <ListMusic className="m-3 h-6 w-6 text-ink-3" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-0">{track.title}</p>
            <p className="text-xs text-ink-3">Choose where to save this track</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-1">Create a new playlist</p>
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void createAndAdd()}
              placeholder="Playlist or album name"
              autoFocus
            />
            <Button type="button" onClick={createAndAdd} loading={pendingId === 'new'} disabled={!newTitle.trim()}>
              <Plus size={16} />
              Create
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-1">Your playlists</p>
          {playlists === null ? (
            <p className="py-4 text-center text-sm text-ink-3">Loading playlists…</p>
          ) : playlists.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-ink-3">No playlists yet. Create one above.</div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {playlists.map((playlist) => {
                const alreadyAdded = playlist.trackIds.includes(track.trackId)
                return (
                  <button
                    key={playlist.playlistId}
                    type="button"
                    onClick={() => void addToPlaylist(playlist)}
                    disabled={pendingId !== null}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.05] disabled:opacity-60"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2"><ListMusic size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-0">{playlist.title}</span>
                      <span className="text-xs text-ink-3">{playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}</span>
                    </span>
                    {alreadyAdded ? <span className="flex items-center gap-1 text-xs font-medium text-brand-400"><Check size={14} /> Remove</span> : <Plus size={17} className="text-ink-2" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
