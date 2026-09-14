import { useEffect, useMemo, useState } from 'react'
import { BrandMark } from '@/components/common/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { isStandaloneDisplayMode } from '@/lib/installPrompt'

const MINIMUM_SPLASH_TIME_MS = 650

export function PwaLaunchScreen() {
  const { initializing } = useAuth()
  const standalone = useMemo(() => isStandaloneDisplayMode(), [])
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false)

  useEffect(() => {
    if (!standalone) return
    const timer = window.setTimeout(() => setMinimumTimeElapsed(true), MINIMUM_SPLASH_TIME_MS)
    return () => window.clearTimeout(timer)
  }, [standalone])

  if (!standalone || (!initializing && minimumTimeElapsed)) return null

  return (
    <div
      className="fixed inset-0 z-[1000] grid min-h-[100svh] place-items-center overflow-hidden bg-[#050607] px-8 text-center"
      role="status"
      aria-label="Opening My Music"
    >
      <img
        src="/pwa-launch-bg.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,6,7,0.08),rgba(5,6,7,0.48)_75%)]" />

      <div className="relative -translate-y-[4svh] rounded-[2rem] border border-white/10 bg-black/35 px-9 py-8 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <BrandMark />
        <p className="mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-white/55">
          Music moves when we back it
        </p>
      </div>

      <span className="absolute bottom-[max(2.5rem,env(safe-area-inset-bottom))] h-1 w-20 overflow-hidden rounded-full bg-white/15">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-brand-400" />
      </span>
    </div>
  )
}
