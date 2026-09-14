/**
 * Loads the official YouTube IFrame Player API exactly once. We only ever
 * drive the real youtube-nocookie.com embed through this API — there is no
 * separate audio element, no extraction, no proxying. See
 * src/contexts/PlayerContext.tsx for the single place that creates players.
 */

declare global {
  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }

  namespace YT {
    interface Player {
      playVideo(): void
      pauseVideo(): void
      stopVideo(): void
      seekTo(seconds: number, allowSeekAhead: boolean): void
      setVolume(volume: number): void
      getVolume(): number
      mute(): void
      unMute(): void
      getCurrentTime(): number
      getDuration(): number
      getPlayerState(): number
      loadVideoById(videoId: string): void
      cueVideoById(videoId: string): void
      /** The video this player is actually cued to/attempting to play — used to correlate an
       * error event with a specific video, since this one long-lived player is reused across
       * many tracks (see PlayerContext's loadAndPlay) and the app's own "current track" state
       * can already have moved on by the time an error for an earlier load actually arrives. */
      getVideoData(): { video_id: string; author: string; title: string }
      destroy(): void
    }

    interface PlayerEvent {
      target: Player
      data: number
    }

    const PlayerState: {
      UNSTARTED: -1
      ENDED: 0
      PLAYING: 1
      PAUSED: 2
      BUFFERING: 3
      CUED: 5
    }

    class Player {
      constructor(
        element: HTMLElement | string,
        options: {
          videoId?: string
          host?: string
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (event: PlayerEvent) => void
            onStateChange?: (event: PlayerEvent) => void
            onError?: (event: PlayerEvent) => void
          }
        },
      )
    }
  }
}

let apiPromise: Promise<typeof YT> | null = null

export function loadYoutubeIframeApi(): Promise<typeof YT> {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube playback requires a browser.'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      resolve(window.YT!)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }
  })
  return apiPromise
}
