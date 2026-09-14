import type { SVGProps } from 'react'

/** My Music's own swept double-note mark. */
export function MusicGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M7.4 16.7V7.6L18.2 4.8v8.9" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.4 10.35 18.2 7.55" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M7.4 16.25c0 1.75-1.48 3.05-3.2 3.05-1.18 0-2-.62-2-1.52 0-1.55 1.7-2.9 3.6-2.9.62 0 1.16.13 1.6.38v.99Z" fill="currentColor" />
      <path d="M18.2 13.25c0 1.75-1.48 3.05-3.2 3.05-1.18 0-2-.62-2-1.52 0-1.55 1.7-2.9 3.6-2.9.62 0 1.16.13 1.6.38v.99Z" fill="currentColor" />
      <path d="M9.9 4.25c1.45-.95 3.2-1.3 5.2-1.05" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".5" />
    </svg>
  )
}
