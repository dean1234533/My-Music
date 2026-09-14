import { Home, Library, ListMusic, Search, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

// Single nav for the single app — no more per-role dashboards to switch
// between. Order matters: MobileNav shows these as persistent bottom tabs
// (there's no overflow "More" sheet needed now that there are only five).
export const appNavItems: NavItem[] = [
  { label: 'Home', to: '/app/home', icon: Home, end: true },
  { label: 'Search', to: '/app/search', icon: Search },
  { label: 'Library', to: '/app/library', icon: Library },
  { label: 'Playlists', to: '/app/playlists', icon: ListMusic },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]
