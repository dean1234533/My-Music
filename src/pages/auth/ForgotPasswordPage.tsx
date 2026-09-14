import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { requestPasswordReset } from '@/services/authService'
import { friendlyAuthError } from '@/utils/authErrors'
import { useSeo } from '@/lib/seo'

export function ForgotPasswordPage() {
  useSeo({
    title: 'Reset Your Password',
    description: 'Request a password reset email for your My Music account.',
    path: '/forgot-password',
  })
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to set a new password.">
      {sent ? (
        <p className="text-sm text-ink-1">
          If an account exists for <span className="font-medium text-ink-0">{email}</span>, a reset
          link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {error ? <p className="text-sm text-danger-500">{error}</p> : null}
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-2">
        <Link to="/sign-in" className="font-medium text-brand-400 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
