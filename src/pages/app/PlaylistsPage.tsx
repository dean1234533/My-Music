import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createPlaylist, subscribeOwnPlaylists } from '@/services/playlistService'
import { Button } from '@/components/common/Button'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import type { PlaylistDoc } from '@/types/playlist'

export function PlaylistsPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists, () =>
      notify('Could not load your playlists.', 'error'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser])

  async function handleCreate() {
    if (!firebaseUser) return
    const title = window.prompt('Playlist name')?.trim()
    if (!title) return
    setCreating(true)
    try {
      await createPlaylist(firebaseUser.uid, title)
      notify(`Created ${title}.`)
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-[-0.025em] text-ink-0">Playlists</h1>
        <Button onClick={() => void handleCreate()} loading={creating}>
          <Plus size={16} /> New playlist
        </Button>
      </div>

      {playlists === null ? (
        <LoadingState label="Loading your playlists…" />
      ) : playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          description="Create a playlist to start organizing your tracks."
          action={
            <Button onClick={() => void handleCreate()} loading={creating}>
              <Plus size={16} /> New playlist
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.playlistId} playlist={playlist} fill />
          ))}
        </div>
      )}
    </div>
  )
}
