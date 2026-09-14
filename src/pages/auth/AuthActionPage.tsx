import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { friendlyAuthError } from '@/utils/authErrors'

/**
 * Handles every Firebase Auth email action link (password reset,
 * email-change revert) on our own domain instead of the default
 * firebaseapp.com page — this is the page the Firebase Console's
 * "Custom action URL" setting should point at. Firebase appends
 * ?mode=...&oobCode=...&apiKey=...&continueUrl=... itself; nothing here
 * needs to construct that link. There's no email-verification step in this
 * app, so a verifyEmail-mode link (none are ever sent) isn't handled here.
 */
export function AuthActionPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  if (!oobCode) {
    return (
      <AuthLayout title="Invalid link">
        <p className="text-sm text-ink-1">
          This link is missing required information. Request a new one and try again.
        </p>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  if (mode === 'resetPassword') return <ResetPasswordAction oobCode={oobCode} />
  if (mode === 'recoverEmail') return <RecoverEmailAction oobCode={oobCode} />

  return (
    <AuthLayout title="Unsupported link">
      <p className="text-sm text-ink-1">This type of link isn't supported here.</p>
      <BackToSignIn />
    </AuthLayout>
  )
}

function BackToSignIn() {
  return (
    <p className="mt-6 text-center text-sm text-ink-2">
      <Link to="/sign-in" className="font-medium text-brand-400 hover:underline">
        Back to sign in
      </Link>
    </p>
  )
}

function ResetPasswordAction({ oobCode }: { oobCode: string }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then(setEmail)
      .catch((err) => {
        setEmail(null)
        setError(friendlyAuthError(err))
      })
  }, [oobCode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setDone(true)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  if (email === undefined) {
    return (
      <AuthLayout title="Reset your password">
        <p className="text-sm text-ink-2">Checking your link…</p>
      </AuthLayout>
    )
  }

  if (email === null) {
    return (
      <AuthLayout title="This link isn't valid">
        <p className="text-sm text-danger-500">{error}</p>
        <p className="mt-4 text-sm text-ink-1">
          <Link to="/forgot-password" className="font-medium text-brand-400 hover:underline">
            Request a new reset link
          </Link>
        </p>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <p className="text-sm text-ink-1">Your password has been changed. You can sign in with it now.</p>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle={`For ${email}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <PasswordStrengthMeter password={password} />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}

function RecoverEmailAction({ oobCode }: { oobCode: string }) {
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending')
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkActionCode(auth, oobCode)
      .then((info) => {
        setRestoredEmail(info.data.email ?? null)
        return applyActionCode(auth, oobCode)
      })
      .then(() => setStatus('done'))
      .catch((err) => {
        setStatus('error')
        setError(friendlyAuthError(err))
      })
  }, [oobCode])

  if (status === 'pending') {
    return (
      <AuthLayout title="Reverting your email change">
        <p className="text-sm text-ink-2">One moment…</p>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout title="This link isn't valid">
        <p className="text-sm text-danger-500">{error}</p>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Email change reverted">
      <p className="text-sm text-ink-1">
        {restoredEmail ? `Your account email is back to ${restoredEmail}.` : 'Your account email has been restored.'} If
        you didn't make this change yourself, reset your password now — someone else may have access to your account.
      </p>
      <p className="mt-6 text-center text-sm text-ink-2">
        <Link to="/forgot-password" className="font-medium text-brand-400 hover:underline">
          Reset password
        </Link>
      </p>
      <BackToSignIn />
    </AuthLayout>
  )
}
