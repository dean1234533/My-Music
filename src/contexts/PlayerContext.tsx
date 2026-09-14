import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { markTrackUnavailable } from '@/services/trackService'
import { recordPlay } from '@/services/historyService'
import { getSettings } from '@/services/settingsService'
import type { TrackDoc } from '@/types/track'
import type { RepeatMode } from '@/types/settings'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { setPlaybackActive } from '@/lib/playbackActivity'
import { loadYoutubeIframeApi } from '@/lib/youtubeIframeApi'

interface PlayerContextValue {
  currentTrack: TrackDoc | null
  /** Original, unshuffled queue order — what's persisted/displayed as "up next" ordering. */
  queue: TrackDoc[]
  /** Actual playback order — equals `queue` unless shuffle is on. */
  playOrder: TrackDoc[]
  isPlaying: boolean
  isLoading: boolean
  progressSec: number
  durationSec: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  /** Attach the mounted DOM node the official YouTube player renders into (owned by PlayerBar). */
  attachContainer: (el: HTMLDivElement | null) => void
  playTrack: (track: TrackDoc, queue?: TrackDoc[]) => void
  /** Named wrappers around playTrack for call-site clarity — all three behave identically (play from the first track, queue the rest). */
  playPlaylist: (tracks: TrackDoc[]) => void
  playLikedSongs: (tracks: TrackDoc[]) => void
  playLibrary: (tracks: TrackDoc[]) => void
  playNext: (track: TrackDoc) => void
  /** Jumps to a track already in the queue/play order without resetting the queue. */
  playFromQueue: (trackId: string) => void
  addToQueue: (track: TrackDoc) => void
  addPlaylistToQueue: (tracks: TrackDoc[]) => void
  removeFromQueue: (trackId: string) => void
  clearQueue: () => void
  togglePlay: () => void
  /** Pauses without unloading the current track — distinct from stop(). */
  pause: () => void
  resume: () => void
  seek: (seconds: number) => void
  next: () => void
  previous: () => void
  /** Fully stops and tears down playback — distinct from pause, which keeps the track loaded. */
  stop: () => void
  setVolume: (volume: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined)

/** Pressing Previous restarts the current track once you're this far into it, rather than jumping back a track — standard music-player behaviour. */
const PREVIOUS_RESTART_THRESHOLD_SEC = 3

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const previousUserIdRef = useRef<string | null>(null)
  const playOrderRef = useRef<TrackDoc[]>([])
  const currentTrackRef = useRef<TrackDoc | null>(null)
  const progressSecRef = useRef(0)
  const repeatRef = useRef<RepeatMode>('off')
  const autoplayNextRef = useRef(true)
  const [currentTrack, setCurrentTrack] = useState<TrackDoc | null>(null)
  const [queue, setQueue] = useState<TrackDoc[]>([])
  const [playOrder, setPlayOrder] = useState<TrackDoc[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progressSec, setProgressSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [volume, setVolumeState] = useState(80)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')

  useEffect(() => {
    playOrderRef.current = playOrder
  }, [playOrder])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    progressSecRef.current = progressSec
  }, [progressSec])

  useEffect(() => {
    repeatRef.current = repeat
  }, [repeat])

  useEffect(() => {
    if (!firebaseUser) return
    void getSettings(firebaseUser.uid).then((settings) => {
      setVolumeState(settings.defaultVolume)
      setShuffle(settings.shuffleByDefault)
      autoplayNextRef.current = settings.autoplayNext
    })
  }, [firebaseUser])

  useEffect(() => {
    setPlaybackActive(isPlaying || isLoading)
    return () => setPlaybackActive(false)
  }, [isPlaying, isLoading])

  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const destroyPlayer = useCallback(() => {
    stopProgressPolling()
    playerRef.current?.destroy()
    playerRef.current = null
  }, [stopProgressPolling])

  const resetState = useCallback(() => {
    destroyPlayer()
    setCurrentTrack(null)
    setQueue([])
    setPlayOrder([])
    setIsPlaying(false)
    setIsLoading(false)
    setProgressSec(0)
    setDurationSec(0)
  }, [destroyPlayer])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = firebaseUser?.uid ?? null
    if (previousUserId && previousUserId !== nextUserId) resetState()
    previousUserIdRef.current = nextUserId
  }, [firebaseUser?.uid, resetState])

  useEffect(() => destroyPlayer, [destroyPlayer])

  const stepQueueRef = useRef<(direction: 1 | -1) => void>(() => {})

  /**
   * Reflects a track's newly-discovered unavailable state into every place
   * it's currently held in memory (not just Firestore), so the "no longer
   * available" indicator in PlayerBar/FullScreenPlayer shows immediately and
   * persistently — previously this only surfaced as a toast that vanished,
   * while currentTrack kept reporting unavailable: false since it was never
   * re-read from Firestore after the write.
   */
  const markUnavailableLocally = useCallback((trackId: string) => {
    const patch = (list: TrackDoc[]) => list.map((t) => (t.trackId === trackId ? { ...t, unavailable: true } : t))
    setCurrentTrack((prev) => (prev && prev.trackId === trackId ? { ...prev, unavailable: true } : prev))
    setQueue(patch)
    setPlayOrder(patch)
  }, [])

  const loadAndPlay = useCallback(async (track: TrackDoc) => {
    setIsLoading(true)
    stopProgressPolling()
    try {
      // PlayerBar mounts its ref'd container as soon as the app loads (it's always
      // rendered, just visually hidden until a track exists), so this should already be
      // set — but a few retries guard against any remaining first-paint timing edge case
      // rather than failing outright the instant a user presses play.
      let container = containerRef.current
      for (let attempt = 0; !container && attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        container = containerRef.current
      }
      if (!container) throw new Error('Player is not ready yet — please try again.')

      const YT = await loadYoutubeIframeApi()
      destroyPlayer()

      await new Promise<void>((resolve, reject) => {
        playerRef.current = new YT.Player(container, {
          videoId: track.youtubeVideoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              event.target.setVolume(volume)
              // The user already deliberately pressed play in our UI —
              // starting the official player here is that same gesture,
              // never an autoplay the visitor didn't ask for.
              event.target.playVideo()
              resolve()
            },
            onError: (event) => {
              // 2 invalid param, 5 HTML5 error, 100 not found/removed, 101/150 embedding disabled.
              const code = event.data
              const message =
                code === 100
                  ? 'This track is no longer available on YouTube.'
                  : code === 101 || code === 150
                    ? 'The owner has disabled embedded playback for this track.'
                    : 'This track could not be played.'
              if (code === 100 || code === 101 || code === 150) {
                markUnavailableLocally(track.trackId)
                void markTrackUnavailable(track.trackId).catch(() => {})
              }
              reject(new Error(message))
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true)
                setDurationSec(event.target.getDuration() || 0)
                stopProgressPolling()
                progressIntervalRef.current = window.setInterval(() => {
                  setProgressSec(playerRef.current?.getCurrentTime() ?? 0)
                }, 500)
              } else if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                stopProgressPolling()
              } else if (event.data === YT.PlayerState.ENDED) {
                setIsPlaying(false)
                stopProgressPolling()
                if (repeatRef.current === 'track') {
                  void loadAndPlay(track)
                } else if (autoplayNextRef.current) {
                  stepQueueRef.current(1)
                }
              }
            },
          },
        })
      })

      if (firebaseUser) void recordPlay(firebaseUser.uid, track.trackId).catch(() => {})
    } catch (error) {
      setIsPlaying(false)
      notify(error instanceof Error ? error.message : 'This track is not available to play.', 'error')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destroyPlayer, firebaseUser, notify, stopProgressPolling, volume])

  const buildPlayOrder = useCallback((newQueue: TrackDoc[], startTrack: TrackDoc) => {
    if (!shuffle) return newQueue
    const rest = newQueue.filter((t) => t.trackId !== startTrack.trackId)
    return [startTrack, ...shuffleArray(rest)]
  }, [shuffle])

  const playTrack = useCallback(
    (track: TrackDoc, nextQueue?: TrackDoc[]) => {
      const resolvedQueue = nextQueue ?? [track]
      setCurrentTrack(track)
      setQueue(resolvedQueue)
      setPlayOrder(buildPlayOrder(resolvedQueue, track))
      setProgressSec(0)
      setDurationSec(0)
      void loadAndPlay(track)
    },
    [buildPlayOrder, loadAndPlay],
  )

  /**
   * These four mutators apply the *same* structural change to both `queue`
   * and `playOrder` independently, rather than ever resetting playOrder back
   * to queue's order. Since both lists start out equal (or, under shuffle,
   * playOrder starts as a permutation of queue), applying identical
   * append/insert/remove operations to both keeps them in sync — unshuffled
   * sessions stay unshuffled, and a shuffled session's existing order is
   * never silently discarded just because the queue was edited (spec:
   * shuffle must survive queue mutations; adding a song must never look like
   * a reshuffle).
   */
  const playNext = useCallback((track: TrackDoc) => {
    const current = currentTrackRef.current
    const insertAfterCurrent = (list: TrackDoc[]): TrackDoc[] => {
      const withoutTrack = list.filter((t) => t.trackId !== track.trackId)
      const index = current ? withoutTrack.findIndex((t) => t.trackId === current.trackId) : -1
      const next = [...withoutTrack]
      next.splice(index + 1, 0, track)
      return next
    }
    setQueue(insertAfterCurrent)
    setPlayOrder(insertAfterCurrent)
  }, [])

  const addToQueue = useCallback((track: TrackDoc) => {
    const append = (list: TrackDoc[]): TrackDoc[] =>
      list.some((t) => t.trackId === track.trackId) ? list : [...list, track]
    setQueue(append)
    setPlayOrder(append)
  }, [])

  /** Appends every track not already queued, in order, to the end of the queue. */
  const addPlaylistToQueue = useCallback((tracks: TrackDoc[]) => {
    const append = (list: TrackDoc[]): TrackDoc[] => {
      const existingIds = new Set(list.map((t) => t.trackId))
      const additions = tracks.filter((t) => !existingIds.has(t.trackId))
      return additions.length === 0 ? list : [...list, ...additions]
    }
    setQueue(append)
    setPlayOrder(append)
  }, [])

  const removeFromQueue = useCallback((trackId: string) => {
    const remove = (list: TrackDoc[]): TrackDoc[] => list.filter((t) => t.trackId !== trackId)
    setQueue(remove)
    setPlayOrder(remove)
  }, [])

  /** Jumps to a specific track already sitting in the current queue/play order, without altering the queue itself — distinct from playTrack, which starts a brand-new queue. */
  const playFromQueue = useCallback((trackId: string) => {
    const track = playOrderRef.current.find((t) => t.trackId === trackId) ?? queue.find((t) => t.trackId === trackId)
    if (!track) return
    setCurrentTrack(track)
    setProgressSec(0)
    setDurationSec(0)
    void loadAndPlay(track)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, loadAndPlay])

  const clearQueue = useCallback(() => {
    setQueue([])
    setPlayOrder([])
  }, [])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player || !currentTrack) return
    if (isPlaying) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }, [currentTrack, isPlaying])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const resume = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  /** Plays a playlist/liked-songs/library list from its first track, queuing the rest. Thin, named wrappers around playTrack for call-site clarity. */
  const playPlaylist = useCallback((tracks: TrackDoc[]) => {
    if (tracks.length === 0) return
    playTrack(tracks[0], tracks)
  }, [playTrack])
  const playLikedSongs = playPlaylist
  const playLibrary = playPlaylist

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
    setProgressSec(seconds)
  }, [])

  const stepQueue = useCallback(
    (direction: 1 | -1) => {
      const current = currentTrackRef.current
      const order = playOrderRef.current
      if (!current || order.length === 0) return
      const index = order.findIndex((t) => t.trackId === current.trackId)
      let nextIndex = index + direction
      if (repeatRef.current === 'queue') {
        nextIndex = (nextIndex + order.length) % order.length
      }
      const nextTrack = order[nextIndex]
      if (!nextTrack) {
        resetState()
        return
      }
      setCurrentTrack(nextTrack)
      setProgressSec(0)
      setDurationSec(0)
      void loadAndPlay(nextTrack)
    },
    [loadAndPlay, resetState],
  )
  stepQueueRef.current = stepQueue

  const next = useCallback(() => stepQueue(1), [stepQueue])

  /**
   * Standard music-player behaviour: once meaningfully into a track,
   * Previous restarts it rather than jumping back a track. Also restarts
   * (rather than stopping) when there's genuinely nowhere earlier to go —
   * pressing Previous at the very start of the queue should never just stop
   * playback outright.
   */
  const previous = useCallback(() => {
    const current = currentTrackRef.current
    const order = playOrderRef.current
    if (!current) return
    const index = order.findIndex((t) => t.trackId === current.trackId)
    const hasEarlierTrack = index > 0 || (repeatRef.current === 'queue' && order.length > 1)
    if (progressSecRef.current > PREVIOUS_RESTART_THRESHOLD_SEC || !hasEarlierTrack) {
      seek(0)
      return
    }
    stepQueue(-1)
  }, [seek, stepQueue])

  const stop = useCallback(() => resetState(), [resetState])

  const setVolume = useCallback((value: number) => {
    setVolumeState(value)
    playerRef.current?.setVolume(value)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const nextShuffle = !prev
      const current = currentTrackRef.current
      if (current) {
        setPlayOrder(nextShuffle ? buildPlayOrder(queue, current) : queue)
      }
      return nextShuffle
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, buildPlayOrder])

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => (prev === 'off' ? 'queue' : prev === 'queue' ? 'track' : 'off'))
  }, [])

  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
  }, [])

  // Lock-screen/notification "Now Playing" controls (title, artist, artwork,
  // play/pause/next/previous/seek). This is the one legitimate lever a website
  // has toward better background behaviour — it doesn't grant background
  // playback by itself (that's a hard platform limit for audio coming from a
  // cross-origin YouTube iframe, not something fixable here), but registering
  // it correctly is what lets a browser/OS that DOES allow background media
  // for this tab show real controls and treat playback as intentional "now
  // playing" media instead of an anonymous background video.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.thumbnail ? [{ src: currentTrack.thumbnail, sizes: '480x360', type: 'image/jpeg' }] : [],
    })
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', resume)
    navigator.mediaSession.setActionHandler('pause', pause)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('stop', stop)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') seek(details.seekTime)
    })
    return () => {
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'stop', 'seekto'] as const) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Some actions aren't supported in every browser — safe to ignore.
        }
      }
    }
  }, [resume, pause, previous, next, stop, seek])

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      playOrder,
      isPlaying,
      isLoading,
      progressSec,
      durationSec,
      volume,
      shuffle,
      repeat,
      attachContainer,
      playTrack,
      playPlaylist,
      playLikedSongs,
      playLibrary,
      playNext,
      playFromQueue,
      addToQueue,
      addPlaylistToQueue,
      removeFromQueue,
      clearQueue,
      togglePlay,
      pause,
      resume,
      seek,
      next,
      previous,
      stop,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      currentTrack,
      queue,
      playOrder,
      isPlaying,
      isLoading,
      progressSec,
      durationSec,
      volume,
      shuffle,
      repeat,
      attachContainer,
      playTrack,
      playPlaylist,
      playLikedSongs,
      playLibrary,
      playNext,
      playFromQueue,
      addToQueue,
      addPlaylistToQueue,
      removeFromQueue,
      clearQueue,
      togglePlay,
      pause,
      resume,
      seek,
      next,
      previous,
      stop,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
