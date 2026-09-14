import { Pause, Play, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { TrackActions } from '@/components/music/TrackActions'
import { formatDuration } from '@/utils/format'
import type { TrackDoc } from '@/types/track'

/**
 * fill is opt-in — every existing caller renders TrackCard in a horizontal-scroll rail,
 * where a fixed width is correct. A real multi-column grid (e.g. a full library view)
 * needs the card to fill its own grid cell instead, so the grid's column count — not this
 * component's hardcoded width — determines how many fit per row at any viewport size.
 *
 * onRemove is opt-in — only a caller showing a track in a removable context (the Library
 * grid) passes it; everywhere else (Home rails, Search results) the button is absent.
 */
export function TrackCard({
  track,
  queue,
  fill,
  onRemove,
  removeLabel = 'Remove from library',
}: {
  track: TrackDoc
  queue?: TrackDoc[]
  fill?: boolean
  onRemove?: () => void
  removeLabel?: string
}) {
  const { playTrack, togglePlay, currentTrack, isPlaying } = usePlayer()
  const isCurrent = currentTrack?.trackId === track.trackId
  const isCurrentlyPlaying = isCurrent && isPlaying

  return (
    <div className={fill ? 'group w-full min-w-0' : 'group w-44 shrink-0 sm:w-52'}>
      <button
        type="button"
        onClick={() => (isCurrent ? togglePlay() : playTrack(track, queue))}
        disabled={track.unavailable}
        aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        className="relative block aspect-square w-full overflow-hidden rounded-[1.25rem] bg-surface-2 shadow-[0_18px_45px_rgba(0,0,0,.22)] ring-1 ring-white/[0.07] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_65px_rgba(0,0,0,.4)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            <Play className="h-8 w-8" />
          </div>
        )}
        {track.unavailable ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
            Unavailable
          </span>
        ) : null}
        <div
          className={`absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/65 via-transparent to-transparent p-4 transition-opacity group-hover:opacity-100 ${
            isCurrentlyPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-surface-0 shadow-xl transition-transform hover:scale-105">
            {isCurrentlyPlaying ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
            )}
          </span>
        </div>
      </button>
      <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-0">{track.title}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] text-ink-2">{track.artist}</span>
        <div className="flex shrink-0 items-center gap-1">
          <TrackActions track={track} />
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeLabel}
              title={removeLabel}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 backdrop-blur transition hover:bg-danger-500/10 hover:text-danger-500"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
      {track.durationSeconds ? (
        <p className="mt-1 text-[11px] tabular-nums text-ink-3">{formatDuration(track.durationSeconds)}</p>
      ) : null}
    </div>
  )
}
