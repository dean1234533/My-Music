import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { TopBar } from './TopBar'
import { appNavItems } from './navConfig'

/** The single app layout — one nav, one shell, no per-role variants. */
export function AppShell({ children }: { children: ReactNode }) {
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
          <main
            className="w-full min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(var(--player-bar-height,0px)+4rem+env(safe-area-inset-bottom)+1.5rem)] pt-4 md:px-8 md:pb-[calc(var(--player-bar-height,0px)+env(safe-area-inset-bottom)+2rem)] md:pt-8 xl:px-12"
          >
            <div className="mx-auto min-w-0 max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav items={appNavItems} />
    </div>
  )
}
