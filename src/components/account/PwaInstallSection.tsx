import { Button } from '@/components/common/Button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function PwaInstallSection() {
  const { canInstall, isStandalone, isIOS, install } = useInstallPrompt()

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Install app</h2>
      <div className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
        {isStandalone ? (
          <p className="text-sm text-support-400">My Music is installed on this device.</p>
        ) : canInstall ? (
          <Button size="sm" variant="secondary" onClick={() => void install()}>
            Install My Music
          </Button>
        ) : isIOS ? (
          <p className="text-sm text-ink-2">Tap Share, then “Add to Home Screen” to install My Music.</p>
        ) : (
          <p className="text-sm text-ink-2">Installation will appear here when this browser makes it available.</p>
        )}
      </div>
    </section>
  )
}
