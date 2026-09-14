import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import type { NavItem } from './navConfig'

/** Five destinations total now — all fit as persistent bottom tabs, no "More" overflow sheet needed. */
export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 border-t border-white/[0.07] bg-surface-1/95 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'flex flex-1 translate-y-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[0.6875rem] font-semibold leading-none transition-colors',
              isActive ? 'text-brand-400' : 'text-ink-3 active:bg-white/[0.05]',
            )
          }
        >
          <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
          <span className="whitespace-nowrap">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
