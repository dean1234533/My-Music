import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/common/Button'

const DISMISS_KEY = 'installBannerDismissedAt'
const DISMISS_DAYS = 7
const AUTHENTICATED_ROUTE_PREFIXES = ['/app']

function isAuthenticatedRoute(pathname: string): boolean {
  return AUTHENTICATED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Private browsing / storage disabled — the banner will just show again next time, which is fine.
  }
}

/**
 * Only shown once signed in and inside an authenticated workspace — the deferred `beforeinstallprompt` event is
 * still captured at module scope before sign-in (see lib/installPrompt.ts),
 * since Chrome only fires it once and never re-fires it; this component just
 * doesn't render its UI until there's a signed-in user inside the app to show it to.
 * Hidden once the app is standalone and for DISMISS_DAYS after dismissal.
 */
export function InstallBanner() {
  const { firebaseUser } = useAuth()
  const { pathname } = useLocation()
  const { canInstall, isStandalone, isIOS, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(recentlyDismissed)
  const [installing, setInstalling] = useState(false)

  if (!firebaseUser || !isAuthenticatedRoute(pathname)) return null
  if (isStandalone || dismissed) return null
  if (!canInstall && !isIOS) return null

  async function handleInstall() {
    setInstalling(true)
    try {
      const outcome = await install()
      if (outcome !== 'unavailable') {
        dismiss()
        setDismissed(true)
      }
    } finally {
      setInstalling(false)
    }
  }

  function handleDismiss() {
    dismiss()
    setDismissed(true)
  }

  return (
    <div
      role="region"
      aria-label="Install My Music"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-start gap-3 rounded-t-2xl border border-surface-border bg-surface-1 p-4 shadow-2xl sm:bottom-4 sm:rounded-2xl"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
        <Download className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink-0">Install My Music</p>
        {canInstall ? (
          <p className="mt-0.5 text-xs text-ink-2">
            Add My Music to your device for faster access and a better app experience.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-ink-2">
            Tap <Share className="mb-0.5 inline h-3.5 w-3.5" /> Share, then "Add to Home Screen" to install this app.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {canInstall ? (
            <Button size="sm" onClick={handleInstall} loading={installing}>
              Install App
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={handleDismiss}>
            Not Now
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
