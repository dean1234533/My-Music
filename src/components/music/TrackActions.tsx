import { useEffect, useState } from 'react'
import { Heart, ListPlus } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { addFavorite, isFavorite, removeFavorite } from '@/services/favoriteService'
import { PlaylistPickerModal } from '@/components/music/PlaylistPickerModal'
import type { TrackDoc } from '@/types/track'

export function TrackActions({ track, labels = false }: { track: TrackDoc; labels?: boolean }) {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [favorited, setFavorited] = useState(false)
  const [pending, setPending] = useState(false)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)

  useEffect(() => {
    if (!firebaseUser) {
      setFavorited(false)
      return
    }
    let cancelled = false
    void isFavorite(firebaseUser.uid, track.trackId).then((value) => {
      if (!cancelled) setFavorited(value)
    })
    return () => {
      cancelled = true
    }
  }, [firebaseUser, track.trackId])

  if (!firebaseUser) return null

  async function toggleFavorite() {
    if (!firebaseUser || pending) return
    setPending(true)
    try {
      if (favorited) {
        await removeFavorite(firebaseUser.uid, track.trackId)
        setFavorited(false)
        notify(`Removed “${track.title}” from favourites.`, 'info')
      } else {
        await addFavorite(firebaseUser.uid, track.trackId)
        setFavorited(true)
        notify(`Added “${track.title}” to favourites.`)
      }
    } catch {
      notify('Could not update favourites. Please try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  const baseClass = labels
    ? 'flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-ink-1 transition hover:bg-white/[0.08] hover:text-ink-0'
    : 'grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 backdrop-blur transition hover:bg-white/[0.09] hover:text-ink-0'

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void toggleFavorite()}
          disabled={pending}
          className={clsx(baseClass, favorited && 'border-danger-500/25 text-danger-500')}
          aria-label={favorited ? 'Remove from favourites' : 'Add to favourites'}
          title={favorited ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Heart size={17} className={clsx(favorited && 'fill-current')} />
          {labels ? <span>{favorited ? 'Favourited' : 'Favourite'}</span> : null}
        </button>
        <button
          type="button"
          onClick={() => setShowPlaylistPicker(true)}
          className={baseClass}
          aria-label="Add to playlist"
          title="Add to playlist"
        >
          <ListPlus size={18} />
          {labels ? <span>Add to playlist</span> : null}
        </button>
      </div>
      {showPlaylistPicker ? <PlaylistPickerModal track={track} onClose={() => setShowPlaylistPicker(false)} /> : null}
    </>
  )
}
