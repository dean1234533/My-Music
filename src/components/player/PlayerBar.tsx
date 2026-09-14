import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import { usePlayer } from '@/contexts/PlayerContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/format'
import { TrackActions } from '@/components/music/TrackActions'
import { FullScreenPlayer } from '@/components/player/FullScreenPlayer'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progressSec,
    durationSec,
    volume,
    shuffle,
    repeat,
    attachContainer,
    togglePlay,
    seek,
    next,
    previous,
    stop,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()
  const { firebaseUser } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const miniSlotRef = useRef<HTMLDivElement | null>(null)
  const fullSlotRef = useRef<HTMLDivElement | null>(null)
  // The one real, live YouTube iframe is a single DOM node (see attachContainer/PlayerContext)
  // that's visually repositioned via these coordinates rather than ever being moved in the
  // React tree — moving it via React unmount/remount would destroy and recreate the iframe,
  // restarting playback. Sized/positioned to exactly cover whichever placeholder slot (the mini
  // corner box, or FullScreenPlayer's big artwork box) is currently in the DOM.
  const [videoRect, setVideoRect] = useState<Rect>({ top: 0, left: 0, width: 56, height: 56 })

  useEffect(() => {
    function measure() {
      const el = expanded ? fullSlotRef.current : miniSlotRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setVideoRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }
    measure()
    // A frame later too — covers the FullScreenPlayer slot's very first mount, where layout
    // can settle a moment after the initial synchronous measurement.
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [expanded, currentTrack])

  return (
    <>
    {/* Always mounted (never conditionally removed) — the YouTube IFrame API needs this
        node to exist in the DOM *before* the very first play attempt, and it must never be
        unmounted/remounted afterward (that would destroy and recreate the iframe, restarting
        playback) — see videoRect above for how it moves between the mini and full-screen slots
        instead. Hidden via the `hidden` utility (display:none) while no track is loaded, which
        keeps the node mounted while invisible — that's all that's needed; it becomes visible
        automatically once currentTrack is set. */}
    <div
      className={clsx('fixed z-[61] overflow-hidden rounded-[10px] bg-black transition-[top,left,width,height] duration-150', !currentTrack && 'hidden')}
      style={{ top: videoRect.top, left: videoRect.left, width: videoRect.width, height: videoRect.height }}
    >
      <div ref={attachContainer} className="h-full w-full" />
    </div>
    <div
      id="player-bar"
      className={clsx(
        // MobileNav is also fixed to the very bottom of the screen (below md), so this must
        // sit above it (bottom offset = MobileNav's own min-h-16) rather than overlapping it —
        // both being fixed-bottom with this having the higher z-index previously meant the
        // player bar fully covered the nav any time a track was playing (user-reported:
        // "mobile has no nav"). At md and up MobileNav is hidden, so this sits flush again.
        'fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 border-t border-white/[0.08] bg-[#090b0d]/95 px-3 py-2 shadow-[0_-20px_50px_rgba(0,0,0,.2)] backdrop-blur-2xl md:bottom-[env(safe-area-inset-bottom)] md:px-6 md:py-3',
        !currentTrack && 'hidden',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2 md:hidden">
        <input
          type="range"
          min={0}
          max={durationSec || 30}
          value={progressSec}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full cursor-pointer accent-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Placeholder slot only — the real, live video visually overlays this exact spot
              (see videoRect above). Never holds the iframe itself. */}
          <div ref={miniSlotRef} className="relative h-14 w-14 shrink-0 ring-1 ring-white/10 sm:h-16 sm:w-16" />
          {currentTrack ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Open full-screen player"
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-ink-0">{currentTrack.title}</p>
              <p className="truncate text-xs text-ink-2">{currentTrack.artist}</p>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <button
            onClick={toggleShuffle}
            className={clsx('hidden rounded-full p-2 transition hover:bg-white/[0.06] sm:block', shuffle ? 'text-brand-400' : 'text-ink-2 hover:text-ink-0')}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            title="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={previous} className="rounded-full p-2 text-ink-2 transition hover:bg-white/[0.06] hover:text-ink-0" aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-surface-0 shadow-lg transition hover:scale-105 hover:bg-brand-500 disabled:bg-brand-500 disabled:opacity-90"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />
            )}
          </button>
          <button onClick={next} className="rounded-full p-2 text-ink-2 transition hover:bg-white/[0.06] hover:text-ink-0" aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            onClick={cycleRepeat}
            className={clsx('hidden rounded-full p-2 transition hover:bg-white/[0.06] sm:block', repeat !== 'off' ? 'text-brand-400' : 'text-ink-2 hover:text-ink-0')}
            aria-label={`Repeat: ${repeat}`}
            title={`Repeat: ${repeat === 'off' ? 'off' : repeat === 'queue' ? 'queue' : 'track'}`}
          >
            {repeat === 'track' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </button>
        </div>

        <div className="hidden flex-1 items-center gap-2 md:flex">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-3">
            {formatDuration(progressSec)}
          </span>
          <input
            type="range"
            min={0}
            max={durationSec || 30}
            value={progressSec}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer accent-brand-500"
          />
          <span className="w-10 shrink-0 text-xs tabular-nums text-ink-3">
            {formatDuration(durationSec)}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-ink-3" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-20 accent-brand-500"
          />
        </div>

        {firebaseUser && currentTrack ? (
          <div className="hidden shrink-0 sm:block"><TrackActions track={currentTrack} /></div>
        ) : null}

        <button
          type="button"
          onClick={stop}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-white/[0.08] hover:text-ink-0"
          aria-label="Stop"
          title="Stop"
        >
          <Square className="h-4 w-4" fill="currentColor" />
        </button>
      </div>
      {currentTrack?.unavailable ? (
        <p className="mt-2 text-center text-xs text-danger-500">This track is no longer available on YouTube.</p>
      ) : (
        <p className="mt-1 text-center text-[11px] text-ink-3">Played via YouTube</p>
      )}
    </div>
    {expanded && currentTrack ? <FullScreenPlayer onClose={() => setExpanded(false)} slotRef={fullSlotRef} /> : null}
    </>
  )
}
