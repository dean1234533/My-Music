/**
 * The app's one scrollable content area (see AppShell's <main id="app-main">)
 * doesn't reset its scroll position on its own when the content underneath it
 * changes — neither on a real route change, nor on an in-place view swap like
 * Library's artist grid -> that artist's track list (same route, just local
 * state). Left alone, whatever scroll position the previous view was at
 * carries straight into the new one — landing mid-page instead of at the
 * top, and if the new content is shorter than that scroll position, the
 * browser clamps it near the bottom of barely-there content, which reads as
 * "I can't scroll at all" (user-reported, about clicking into an artist).
 */
export function scrollAppToTop() {
  document.getElementById('app-main')?.scrollTo({ top: 0 })
}
