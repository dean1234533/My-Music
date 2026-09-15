import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createPlaylist, subscribeOwnPlaylists } from '@/services/playlistService'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Modal } from '@/components/common/Modal'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import type { PlaylistDoc } from '@/types/playlist'

export function PlaylistsPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')

  const filteredPlaylists = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return playlists ?? []
    return (playlists ?? []).filter((p) => p.title.toLowerCase().includes(q))
  }, [playlists, filter])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists, () =>
      notify('Could not load your playlists.', 'error'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!firebaseUser || !newTitle.trim()) return
    setCreating(true)
    try {
      const playlistId = await createPlaylist(firebaseUser.uid, newTitle.trim())
      notify(`Created ${newTitle.trim()}.`)
      setShowCreate(false)
      setNewTitle('')
      navigate(`/app/playlists/${playlistId}`)
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-[-0.025em] text-ink-0">Playlists</h1>
        <div className="flex flex-wrap items-center gap-2">
          {playlists && playlists.length > 0 ? (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter playlists…"
              className="w-full max-w-xs"
              aria-label="Filter playlists"
            />
          ) : null}
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New playlist
          </Button>
        </div>
      </div>

      {playlists === null ? (
        <LoadingState label="Loading your playlists…" />
      ) : playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          description="Create a playlist to start organizing your tracks."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New playlist
            </Button>
          }
        />
      ) : filteredPlaylists.length === 0 ? (
        <EmptyState title="No matching playlists." />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredPlaylists.map((playlist) => (
            <PlaylistCard key={playlist.playlistId} playlist={playlist} fill />
          ))}
        </div>
      )}

      {showCreate ? (
        <Modal title="New playlist" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Playlist name"
              autoFocus
            />
            <Button type="submit" loading={creating} disabled={!newTitle.trim()}>
              Create
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
