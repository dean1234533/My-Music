import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { usePlayer } from '@/contexts/PlayerContext'
import { updateBasicProfile } from '@/services/userService'
import { signOut } from '@/services/authService'
import { getSettings, updateSettings } from '@/services/settingsService'
import { clearHistory } from '@/services/historyService'
import { exportUserData } from '@/services/accountService'
import { getStoredTheme, setTheme, type ThemePreference } from '@/lib/theme'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'
import type { SettingsDoc } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'

const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60]

function useCountdown(endsAt: number | null): string | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(interval)
  }, [endsAt])
  if (!endsAt) return null
  const remainingMs = Math.max(0, endsAt - Date.now())
  const minutes = Math.floor(remainingMs / 60_000)
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const RECENT_SEARCHES_KEY = 'myMusic.recentSearches'
const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-white/[0.12]'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function SettingsPage() {
  const { firebaseUser, profile } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const { sleepTimerEndsAt, setSleepTimer } = usePlayer()
  const sleepCountdown = useCountdown(sleepTimerEndsAt)
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme())

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [savingName, setSavingName] = useState(false)

  const [settings, setSettings] = useState<SettingsDoc | null>(null)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [exportUrl, setExportUrl] = useState<{ url: string; expiresInSeconds: number } | null>(null)
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '')
  }, [profile?.displayName])

  useEffect(() => {
    if (!firebaseUser) return
    void getSettings(firebaseUser.uid).then(setSettings)
  }, [firebaseUser])

  async function saveDisplayName() {
    if (!firebaseUser || !displayName.trim()) return
    setSavingName(true)
    try {
      await updateBasicProfile(firebaseUser.uid, { displayName: displayName.trim() })
      notify('Display name updated.')
    } catch {
      notify('Could not update your display name.', 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/sign-in')
  }

  async function updatePlaybackSetting(changes: Partial<SettingsDoc>) {
    if (!firebaseUser || !settings) return
    const next = { ...settings, ...changes }
    setSettings(next)
    try {
      await updateSettings(firebaseUser.uid, changes)
    } catch {
      notify('Could not save that setting.', 'error')
    }
  }

  async function handleClearHistory() {
    if (!firebaseUser) return
    setClearingHistory(true)
    try {
      await clearHistory(firebaseUser.uid)
      notify('Play history cleared.')
    } catch {
      notify('Could not clear your play history.', 'error')
    } finally {
      setClearingHistory(false)
    }
  }

  function handleClearRecentSearches() {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
      notify('Recent searches cleared.')
    } catch {
      notify('Could not clear recent searches.', 'error')
    }
  }

  async function handleExportData() {
    setExportBusy(true)
    try {
      const result = await exportUserData()
      setExportUrl(result)
    } catch {
      notify('Could not prepare your data export.', 'error')
    } finally {
      setExportBusy(false)
    }
  }

  const playback = settings ?? { ...DEFAULT_SETTINGS, uid: firebaseUser?.uid ?? '', updatedAt: null }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <h1 className="text-2xl font-medium tracking-[-0.025em] text-ink-0">Settings</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Account</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4">
          <div>
            <Label>Display name</Label>
            <div className="flex gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={() => void saveDisplayName()} loading={savingName}>
                Save
              </Button>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <p className="text-sm text-ink-2">{firebaseUser?.email}</p>
          </div>
          <div>
            <Button variant="secondary" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Display</h2>
        <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 p-4">
          <div>
            <p className="text-sm text-ink-0">Theme</p>
            <p className="text-xs text-ink-2">Not yet checked against every screen for contrast — say if anything looks off.</p>
          </div>
          <div className="flex gap-1.5">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setTheme(option.id)
                  setThemeState(option.id)
                }}
                aria-pressed={theme === option.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  theme === option.id ? 'bg-brand-500 text-[#080a05]' : 'bg-white/[0.05] text-ink-1 hover:bg-white/[0.09]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Playback</h2>
        <div className="flex flex-col divide-y divide-white/[0.06] rounded-xl border border-surface-border bg-surface-1 p-4">
          <div className="flex items-center justify-between py-3 first:pt-0">
            <div>
              <p className="text-sm text-ink-0">Autoplay next track</p>
              <p className="text-xs text-ink-2">Keep playing through your queue automatically.</p>
            </div>
            <Toggle checked={playback.autoplayNext} onChange={(value) => void updatePlaybackSetting({ autoplayNext: value })} />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink-0">Shuffle by default</p>
              <p className="text-xs text-ink-2">Start new queues shuffled.</p>
            </div>
            <Toggle checked={playback.shuffleByDefault} onChange={(value) => void updatePlaybackSetting({ shuffleByDefault: value })} />
          </div>
          <div className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-ink-0">Default volume</p>
              <span className="text-xs tabular-nums text-ink-3">{playback.defaultVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={playback.defaultVolume}
              onChange={(e) => void updatePlaybackSetting({ defaultVolume: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
          </div>
          <div className="py-3 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-0">Sleep timer</p>
                <p className="text-xs text-ink-2">
                  {sleepTimerEndsAt ? `Pausing in ${sleepCountdown}` : 'Automatically pause after a while.'}
                </p>
              </div>
              {sleepTimerEndsAt ? (
                <Button size="sm" variant="secondary" onClick={() => setSleepTimer(null)}>
                  Cancel
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  {SLEEP_TIMER_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => {
                        setSleepTimer(minutes)
                        notify(`Sleep timer set for ${minutes} minutes.`)
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-1 hover:bg-white/[0.08]"
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Library &amp; data</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <div>
              <p className="text-sm text-ink-0">Clear play history</p>
              <p className="text-xs text-ink-2">Removes your "recently played" list.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void handleClearHistory()} loading={clearingHistory}>
              Clear
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <div>
              <p className="text-sm text-ink-0">Clear recent searches</p>
              <p className="text-xs text-ink-2">Removes your recent search suggestions on this device.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleClearRecentSearches}>
              Clear
            </Button>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-0">Export my data</p>
                <p className="text-xs text-ink-2">Get a downloadable copy of your account data.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void handleExportData()} loading={exportBusy}>
                Export
              </Button>
            </div>
            {exportUrl ? (
              <p className="mt-2 text-xs text-ink-2">
                <a href={exportUrl.url} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                  Download your data
                </a>{' '}
                — link expires in {Math.round(exportUrl.expiresInSeconds / 60)} minutes.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Danger zone</h2>
        <AccountSecuritySection />
      </section>
    </div>
  )
}
