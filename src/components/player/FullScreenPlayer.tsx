import { useState, type RefObject } from 'react'
import { ChevronDown, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square, X } from 'lucide-react'
import { clsx } from 'clsx'
import { usePlayer } from '@/contexts/PlayerContext'
import { TrackActions } from '@/components/music/TrackActions'
import { formatDuration } from '@/utils/format'

/**
 * The expanded, full-screen "Now Playing" view — mainly for mobile, where the
 * compact PlayerBar has no room for full-size artwork/queue access, or for
 * reaching the real YouTube player's own controls (play bar, settings gear,
 * fullscreen, and — on iOS Safari — the native Picture-in-Picture toggle,
 * none of which have room to render usably at the compact bar's tiny size).
 * Opened by tapping the track info in PlayerBar; closes back to the compact
 * bar, never stops playback. `slotRef` marks where PlayerBar should visually
 * position the one real, live video while this view is open — see
 * PlayerBar.tsx's videoRect for why it's moved by CSS position, not by
 * actually reparenting the iframe.
 */
export function FullScreenPlayer({ onClose, slotRef }: { onClose: () => void; slotRef: RefObject<HTMLDivElement | null> }) {
  const {
    currentTrack,
    playOrder,
    isPlaying,
    isLoading,
    progressSec,
    durationSec,
    shuffle,
    repeat,
    togglePlay,
    seek,
    next,
    previous,
    stop,
    toggleShuffle,
    cycleRepeat,
    removeFromQueue,
    playFromQueue,
  } = usePlayer()
  const [showQueue, setShowQueue] = useState(false)

  if (!currentTrack) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#090b0d] text-ink-0">
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Minimise player"
          className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-white/[0.08] hover:text-ink-0"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Now playing</p>
        <button
          type="button"
          onClick={() => setShowQueue((v) => !v)}
          aria-label="Toggle queue"
          aria-pressed={showQueue}
          className={clsx('grid h-10 w-10 place-items-center rounded-full hover:bg-white/[0.08]', showQueue ? 'text-brand-400' : 'text-ink-2 hover:text-ink-0')}
        >
          <ListMusic className="h-5 w-5" />
        </button>
      </div>

      {showQueue ? (
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Queue</h2>
          {playOrder.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-3">Your queue is empty.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {playOrder.map((track) => {
                const isCurrent = track.trackId === currentTrack.trackId
                return (
                  <div
                    key={track.trackId}
                    className={clsx('flex items-center gap-1 rounded-xl pr-2', isCurrent ? 'bg-white/[0.06]' : '')}
                  >
                    <button
                      type="button"
                      onClick={() => !isCurrent && playFromQueue(track.trackId)}
                      disabled={isCurrent}
                      aria-label={isCurrent ? `${track.title} — now playing` : `Play ${track.title}`}
                      className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left disabled:cursor-default"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                        {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={clsx('truncate text-sm', isCurrent ? 'font-semibold text-brand-400' : 'text-ink-0')}>{track.title}</p>
                        <p className="truncate text-xs text-ink-3">{track.artist}</p>
                      </div>
                    </button>
                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={() => removeFromQueue(track.trackId)}
                        aria-label={`Remove ${track.title} from queue`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-danger-500/10 hover:text-danger-500"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {/* Placeholder slot only — the real, live video visually overlays this exact spot
              (see PlayerBar.tsx's videoRect). The thumbnail behind it is just a fallback
              backdrop for the moment before that positioning settles. */}
          <div
            ref={slotRef}
            className="aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-surface-2 shadow-[0_30px_80px_rgba(0,0,0,.5)] ring-1 ring-white/[0.08]"
            style={currentTrack.thumbnail ? { backgroundImage: `url(${currentTrack.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!currentTrack.thumbnail ? (
              <div className="flex h-full w-full items-center justify-center text-ink-3">
                <Play className="h-12 w-12" />
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tracking-[-0.02em] text-ink-0">{currentTrack.title}</p>
                <p className="truncate text-sm text-ink-2">{currentTrack.artist}</p>
              </div>
              <TrackActions track={currentTrack} />
            </div>

            {currentTrack.unavailable ? (
              <p className="mt-3 text-sm text-danger-500">This track is no longer available on YouTube.</p>
            ) : null}

            <div className="mt-6">
              <input
                type="range"
                min={0}
                max={durationSec || 30}
                value={progressSec}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek"
                className="h-1.5 w-full cursor-pointer accent-brand-500"
              />
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-3">
                <span>{formatDuration(progressSec)}</span>
                <span>{formatDuration(durationSec)}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={toggleShuffle}
                aria-label="Shuffle"
                aria-pressed={shuffle}
                className={clsx('grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.06]', shuffle ? 'text-brand-400' : 'text-ink-2')}
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button onClick={previous} aria-label="Previous" className="grid h-11 w-11 place-items-center rounded-full text-ink-1 hover:bg-white/[0.06]">
                <SkipBack className="h-6 w-6" fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                disabled={isLoading}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-400 text-surface-0 shadow-lg transition hover:scale-105 hover:bg-brand-500 disabled:opacity-90"
              >
                {isLoading ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : isPlaying ? (
                  <Pause className="h-7 w-7" fill="currentColor" />
                ) : (
                  <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
                )}
              </button>
              <button onClick={next} aria-label="Next" className="grid h-11 w-11 place-items-center rounded-full text-ink-1 hover:bg-white/[0.06]">
                <SkipForward className="h-6 w-6" fill="currentColor" />
              </button>
              <button
                onClick={cycleRepeat}
                aria-label={`Repeat: ${repeat}`}
                title={`Repeat: ${repeat}`}
                className={clsx('grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.06]', repeat !== 'off' ? 'text-brand-400' : 'text-ink-2')}
              >
                {repeat === 'track' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  stop()
                  onClose()
                }}
                aria-label="Stop"
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink-2 hover:bg-white/[0.06] hover:text-ink-0"
              >
                <Square className="h-4 w-4" fill="currentColor" /> Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
