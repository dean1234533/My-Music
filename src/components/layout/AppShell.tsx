import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { TopBar } from './TopBar'
import { appNavItems } from './navConfig'
import { scrollAppToTop } from '@/lib/scroll'

/** The single app layout — one nav, one shell, no per-role variants. */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  // React Router doesn't reset scroll on navigation on its own — without this, going
  // from a long scrolled-down page to a short one landed mid-page instead of at the top.
  useEffect(() => {
    scrollAppToTop()
  }, [location.pathname])

  return (
    <div className="flex h-svh w-full max-w-full flex-col overflow-x-hidden bg-transparent">
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar items={appNavItems} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          {/* Bottom padding reserves space for the player bar (its real height, via the
              --player-bar-height CSS var PlayerBar keeps updated) stacked on top of the
              mobile nav bar below md — a fixed guessed padding fell short of the bar's
              actual height in practice and clipped content behind it. */}
          {/* overflow-x-hidden here too, not just on the outer shell — an element with
              overflow-y-auto but no explicit overflow-x implicitly computes overflow-x as
              auto per the CSS spec, so overflowing content (e.g. a button row too wide for
              a narrow screen) could make *this* element pan sideways on its own, regardless
              of the ancestor's own overflow-x-hidden (user-reported: "the playlist page on
              mobile moves from left to right"). */}
          <main
            id="app-main"
            className="w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-[calc(var(--player-bar-height,0px)+4rem+env(safe-area-inset-bottom)+1.5rem)] pt-4 md:px-8 md:pb-[calc(var(--player-bar-height,0px)+env(safe-area-inset-bottom)+2rem)] md:pt-8 xl:px-12"
          >
            <div className="mx-auto min-w-0 max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav items={appNavItems} />
    </div>
  )
}
