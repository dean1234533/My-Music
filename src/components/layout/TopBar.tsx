import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/common/BrandMark'

export function TopBar() {
  const { profile } = useAuth()

  return (
    <header className="sticky top-0 z-30 flex w-full min-w-0 items-center justify-between border-b border-white/[0.07] bg-surface-0/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
      <Link to="/app/home" className="flex min-w-0 items-center">
        <BrandMark />
      </Link>
      <Link to="/app/settings" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3">
        {profile?.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-ink-1">
            {(profile?.displayName ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
    </header>
  )
}
