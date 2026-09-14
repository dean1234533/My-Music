import { useState } from 'react'
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import { usePlayer } from '@/contexts/PlayerContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/format'
import { TrackActions } from '@/components/music/TrackActions'
import { FullScreenPlayer } from '@/components/player/FullScreenPlayer'

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

  return (
    <>
    {/* Always mounted (never conditionally removed) — the YouTube IFrame API needs this
        node to exist in the DOM *before* the very first play attempt. Returning null here
        until a track exists (as this used to) meant PlayerContext.loadAndPlay's very first
        call always found attachContainer's ref still null and failed with "Player is not
        ready yet.", since React hadn't yet rendered this component for the first time when
        that synchronous check ran (user-reported: "when i search for a track i cant play
        songs from there" — always failed on the first play of a session). Hiding via the
        `hidden` utility (display:none) keeps the node mounted while invisible, which is all
        that's needed — it becomes visible automatically once currentTrack is set. */}
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
          {/* Official YouTube player mount — this is the actual playback surface, not decoration. Never hidden behind a custom UI, and never nested inside a <button> (would trap the iframe's own interaction). */}
          <div className="relative h-11 w-20 shrink-0 overflow-hidden rounded-[10px] bg-black ring-1 ring-white/10 sm:h-14 sm:w-24">
            <div ref={attachContainer} className="h-full w-full" />
          </div>
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
    {expanded && currentTrack ? <FullScreenPlayer onClose={() => setExpanded(false)} /> : null}
    </>
  )
}
