import { useState } from 'react'
import { ListPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PlaylistPickerModal } from '@/components/music/PlaylistPickerModal'
import type { TrackDoc } from '@/types/track'

export function TrackActions({ track, labels = false }: { track: TrackDoc; labels?: boolean }) {
  const { firebaseUser } = useAuth()
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)

  if (!firebaseUser) return null

  const baseClass = labels
    ? 'flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-ink-1 transition hover:bg-white/[0.08] hover:text-ink-0'
    : 'grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 backdrop-blur transition hover:bg-white/[0.09] hover:text-ink-0'

  return (
    <>
      <div className="flex items-center gap-2">
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
