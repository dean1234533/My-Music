export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center" aria-label="My Music — your personal library">
      <span className="leading-none">
        <span className="wordmark block text-[1.12rem] text-ink-0 sm:text-[1.45rem]">My<span className="italic"> Music</span></span>
        {!compact ? <span className="mt-1 block pl-0.5 text-[0.4rem] font-semibold uppercase tracking-[0.22em] text-brand-400 sm:text-[0.47rem] sm:tracking-[0.34em]">Personal library</span> : null}
      </span>
    </span>
  )
}
