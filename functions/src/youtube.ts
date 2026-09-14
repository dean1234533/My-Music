const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export function isValidYoutubeVideoId(id: string): boolean {
  return VIDEO_ID_PATTERN.test(id)
}

// Mirrors src/utils/youtube.ts's extractYoutubePlaylistId — kept in sync by hand since
// functions/ and src/ are separate TS projects. Playlist IDs have no fixed length/prefix
// (PL..., OLAK5uy_... for albums, RD... for mixes, UU... for uploads), so this is
// deliberately loose; real confirmation happens when the YouTube Data API call itself
// either returns items or a not-found error.
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/

const PLAYLIST_URL_PATTERNS: RegExp[] = [
  /^https?:\/\/(?:www\.|music\.)?youtube\.com\/playlist\?(?:.*&)?list=([A-Za-z0-9_-]{10,64})(?:&.*)?$/,
  /^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:.*&)?list=([A-Za-z0-9_-]{10,64})(?:&.*)?$/,
]

export function extractYoutubePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  for (const pattern of PLAYLIST_URL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match?.[1]) return match[1]
  }
  return PLAYLIST_ID_PATTERN.test(trimmed) ? trimmed : null
}
