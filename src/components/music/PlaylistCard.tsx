import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListMusic } from 'lucide-react'
import { getTracks } from '@/services/trackService'
import type { PlaylistDoc } from '@/types/playlist'

/**
 * Shows the first track's thumbnail as the playlist's cover art (falling
 * back to a generic icon for an empty playlist or a track with no
 * thumbnail) — real cover art instead of every playlist looking identical.
 *
 * fill mirrors TrackCard's own convention: rail contexts (Home) want a fixed
 * width; grid contexts (the Playlists page) want the card to fill its cell.
 */
export function PlaylistCard({ playlist, fill }: { playlist: PlaylistDoc; fill?: boolean }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const firstTrackId = playlist.trackIds[0]

  useEffect(() => {
    if (!firstTrackId) {
      setCoverUrl(null)
      return
    }
    let cancelled = false
    void getTracks([firstTrackId]).then((map) => {
      if (!cancelled) setCoverUrl(map.get(firstTrackId)?.thumbnail ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [firstTrackId])

  return (
    <Link to={`/app/playlists/${playlist.playlistId}`} className={fill ? 'group w-full min-w-0' : 'group w-44 shrink-0 sm:w-52'}>
      <div className="aspect-square w-full overflow-hidden rounded-[1.25rem] bg-surface-2 shadow-[0_18px_45px_rgba(0,0,0,.22)] ring-1 ring-white/[0.07] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_65px_rgba(0,0,0,.4)]">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ListMusic className="h-8 w-8 text-ink-3" />
          </div>
        )}
      </div>
      <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-0">{playlist.title}</p>
      <p className="mt-1 text-[13px] text-ink-2">
        {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
      </p>
    </Link>
  )
}
