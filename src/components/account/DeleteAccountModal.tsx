import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import {
  hasGoogleProvider,
  hasPasswordProvider,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
  signOut,
} from '@/services/authService'
import { deleteAccount } from '@/services/accountService'
import { auth } from '@/lib/firebase'

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [reauthenticated, setReauthenticated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGoogleOnly = hasGoogleProvider() && !hasPasswordProvider()
  const canSubmit = reauthenticated && confirmText === 'DELETE' && !busy

  async function handleReauth() {
    setBusy(true)
    setError(null)
    try {
      if (isGoogleOnly) {
        await reauthenticateWithGoogle()
      } else {
        await reauthenticateWithPassword(password)
      }
      setReauthenticated(true)
    } catch {
      setError('Could not verify your identity. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      // Refresh the ID token so the callable sees a recent auth_time from the reauth above.
      await auth.currentUser?.getIdToken(true)
      await deleteAccount()
      await signOut()
      navigate('/', { state: { accountDeletionStarted: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account deletion failed. It is safe to try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Delete account" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-1">
          Deleting your account will permanently remove your profile, playlists, favourites, play history, and
          settings. This cannot be undone.
        </p>

        {!reauthenticated ? (
          <>
            {isGoogleOnly ? (
              <p className="text-ink-2">Confirm it's you by signing in with Google again.</p>
            ) : (
              <div>
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your current password"
                />
              </div>
            )}
            {error ? <p className="text-danger-500">{error}</p> : null}
            <Button variant="secondary" onClick={handleReauth} loading={busy} disabled={!isGoogleOnly && !password}>
              {isGoogleOnly ? 'Sign in with Google' : 'Verify password'}
            </Button>
          </>
        ) : (
          <>
            <div>
              <Label>{'Type DELETE to confirm'}</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
            </div>
            {error ? <p className="text-danger-500">{error}</p> : null}
            <Button variant="danger" onClick={handleDelete} loading={busy} disabled={!canSubmit}>
              Permanently delete account
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
