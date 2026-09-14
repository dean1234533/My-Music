import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    // z-[70]: above the mini player bar (z-50), the full-screen "Now playing" view (z-[60])
    // and its floating video (z-[61]) — all of which share the same fixed-position layer and
    // are always mounted, so a dialog at a lower/equal z-index gets painted over by whichever
    // of those happens to come later in the DOM (this hid the "New playlist" input entirely
    // behind the mini player bar).
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90svh] w-full overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-1 p-5 sm:max-w-lg sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-0">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
