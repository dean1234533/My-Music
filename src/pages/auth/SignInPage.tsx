import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { signInWithEmail } from '@/services/authService'
import { friendlyAuthError } from '@/utils/authErrors'
import { ensureUserDocument } from '@/services/userService'
import { isSafeReturnPath } from '@/utils/returnTo'
import { useSeo } from '@/lib/seo'
import type { User } from 'firebase/auth'

async function dashboardAfterSignIn(user: User): Promise<string> {
  await ensureUserDocument(user)
  return '/app/home'
}

export function SignInPage() {
  useSeo({
    title: 'Sign In',
    description: 'Sign in to My Music to search, save and play your personal music library.',
    path: '/sign-in',
  })
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  const returnToParam = searchParams.get('returnTo')
  const redirectTo = from ? `${from.pathname}${from.search}` : isSafeReturnPath(returnToParam) ? returnToParam : null
  const signUpHref = returnToParam ? `/sign-up?returnTo=${encodeURIComponent(returnToParam)}` : '/sign-up'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const credential = await signInWithEmail(email, password)
      navigate(redirectTo ?? (await dashboardAfterSignIn(credential.user)))
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Don&apos;t have an account?{' '}
        <Link to={signUpHref} className="font-medium text-brand-400 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
