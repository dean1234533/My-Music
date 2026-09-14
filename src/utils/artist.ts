// YouTube channel names for the same real artist routinely differ — a plain upload
// channel, an auto-generated "Artist - Topic" channel, and an "ArtistVEVO" channel
// are all one artist but three different `track.artist` strings (confirmed live:
// "Potter Payper", "Potter Payper - Topic", and "PotterPayperVEVO" were three
// separate groups for one artist). Stripping these known, exact YouTube suffix
// conventions merges them back together for both the Library "Artists" tab and
// each artist's auto-maintained playlist.
export function stripArtistNoise(artist: string): string {
  const trimmed = artist.trim()
  const withoutTopic = trimmed.replace(/\s*-\s*topic$/i, '')
  const withoutVevo = withoutTopic.replace(/\s*-?\s*vevo$/i, '')
  return withoutVevo.trim() || trimmed
}

/**
 * A stable grouping key for "the same real artist" — spaces removed too, since a
 * VEVO-derived name like "PotterPayperVEVO" strips down to "PotterPayper" with no
 * space to restore, and still needs to line up with plain "Potter Payper".
 */
export function artistGroupKey(artist: string): string {
  return stripArtistNoise(artist).toLowerCase().replace(/\s+/g, '') || 'unknown'
}
