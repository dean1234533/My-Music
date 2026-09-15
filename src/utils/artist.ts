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

// Other common channel-naming conventions beyond Topic/VEVO — confirmed live as
// real splits for one artist: "MichaelJackson80s" vs "Michael Jackson" (decade
// tribute-channel suffix), "GhettsOfficial" vs "Ghetts" (Official-channel
// suffix), "Black Sherif Music" vs "BlackSherif" (Music-channel suffix),
// "KIICOTV"/"Layyah's TV" vs "Kiico"/"Layyah" (TV-channel suffix). Only used for
// the *grouping key*, never the display label — these words are still part of
// the literal channel name, just not distinguishing information once a plainer
// variant of the same artist already exists.
export function stripChannelDecoration(artist: string): string {
  let s = artist.replace(/\s*-?\s*\d{2}s$/i, '') // trailing decade, e.g. "80s"
  for (const word of ['official', 'music', 'tv']) {
    const re = new RegExp(`\\s*-?\\s*${word}$`, 'i')
    if (re.test(s)) {
      s = s.replace(re, '')
      break
    }
  }
  return s.replace(/'s$/i, '').trim()
}

/**
 * A stable grouping key for "the same real artist" — deliberately more aggressive
 * than stripArtistNoise (which only strips clean, unambiguous suffixes safe to show
 * in a title): also folds "&"/"+" to "and", strips accents (so an oddly-typed
 * "JAŸ-Z" lines up with "JayZ"), and drops every remaining non-alphanumeric
 * character (so "Dr. Dre"/"DrDre" and "T.I."/"TI" line up too) — spaces included,
 * since a channel-decorated name like "PotterPayperVEVO" has no space to begin
 * with and still needs to match plain "Potter Payper".
 */
export function artistGroupKey(artist: string): string {
  const cleaned = stripChannelDecoration(stripArtistNoise(artist))
  const foldedAmpersand = cleaned.replace(/\s*[&+]\s*/g, ' and ')
  const withoutAccents = foldedAmpersand.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  return withoutAccents.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'
}

/**
 * Picks the best display label among a merged artist group's raw name variants —
 * prefers whichever one stripChannelDecoration leaves untouched (i.e. already
 * looked like a plain artist name, e.g. "Ghetts" over "GhettsOfficial", "Michael
 * Jackson" over "MichaelJackson80s"), then one with real spacing, then the longest.
 */
export function pickArtistLabel(candidates: string[]): string {
  const nonEmpty = candidates.filter(Boolean)
  if (nonEmpty.length === 0) return 'Unknown artist'
  // "Pure" means nothing further would be stripped from it by either cleanup pass —
  // stripChannelDecoration alone isn't enough here, since "PotterPayperVEVO" would
  // otherwise pass as "pure" (VEVO isn't one of its suffixes; stripArtistNoise
  // handles that one).
  const pure = nonEmpty.filter((c) => stripChannelDecoration(stripArtistNoise(c)) === c)
  const pool = pure.length > 0 ? pure : nonEmpty
  return pool.find((c) => c.includes(' ')) || pool.reduce((best, c) => (c.length > best.length ? c : best))
}
