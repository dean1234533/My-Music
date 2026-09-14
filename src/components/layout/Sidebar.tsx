import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/common/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import type { NavItem } from './navConfig'

export function Sidebar({ items }: { items: NavItem[] }) {
  const { firebaseUser, profile } = useAuth()

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-surface-1/75 px-4 py-6 backdrop-blur-xl md:flex">
      <div className="mb-9 px-2"><BrandMark /></div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/[0.07] text-ink-0 shadow-[inset_3px_0_0_var(--color-brand-500)]'
                  : 'text-ink-2 hover:bg-white/[0.035] hover:text-ink-0',
              )
            }
          >
            <item.icon className="h-[17px] w-[17px] transition-colors group-hover:text-brand-400" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      {firebaseUser ? (
        <NavLink
          to="/app/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-white/[0.035] hover:text-ink-0"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-ink-1">
                {(profile?.displayName ?? firebaseUser.email ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate">{profile?.displayName ?? firebaseUser.email}</span>
        </NavLink>
      ) : null}
    </aside>
  )
}
