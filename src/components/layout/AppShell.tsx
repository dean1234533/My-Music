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
          <main className="w-full min-w-0 flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-8 md:pb-28 md:pt-8 xl:px-12">
            <div className="mx-auto min-w-0 max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav items={appNavItems} />
    </div>
  )
}
