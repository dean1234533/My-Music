import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/common/BrandMark'
import type { NavItem } from './navConfig'

export function Sidebar({ items }: { items: NavItem[] }) {
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
    </aside>
  )
}
