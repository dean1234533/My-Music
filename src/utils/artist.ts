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

/**
 * A track's uploading channel is sometimes completely unrelated to who actually
 * performs it — a reposter, a radio show, a curator channel with its own brand
 * name. No amount of channel-name cleanup can group that with the artist's own
 * uploads, because the channel name shares no text with the artist at all.
 * Confirmed live: "Lauryn Hill - ..." uploaded by channels named
 * "nfltrackstarnydc" and "WeedHipHop" stayed split off from "Lauryn Hill - Topic"
 * (the artist's own channel) since there's nothing to strip or fold between
 * "nfltrackstarnydc" and "Lauryn Hill". A music video's own title very commonly
 * credits the real artist as a prefix ("Artist - Song Title") regardless of who
 * uploaded it — that's checked here, and wins over the channel name whenever
 * it's present.
 */
export function extractArtistFromTitle(title: string): string | null {
  const match = title.match(/^([^-]{2,40}?)\s+-\s+.+/)
  if (!match) return null
  let candidate = match[1].trim()
  if (!candidate) return null
  // A title crediting multiple collaborating artists ("Nines ft. Tiggs Da Author",
  // "Wretch 32 x Avelino", "Uncle Murda, DUSTY LOCANE") should still group with the
  // primary artist's other tracks, not become its own permanent one-off group —
  // confirmed live, dozens of these sat as separate single-track playlists instead
  // of folding into the featured primary artist. Only the portion before the first
  // featuring/collaboration marker is kept.
  candidate = candidate.split(/\s+(?:ft\.?|feat\.?|featuring|x)\s+|\s*[,&]\s*/i)[0].trim()
  if (!candidate) return null
  // An unbalanced opening parenthesis means the matched "-" was actually inside a
  // parenthetical aside on the song title itself, not a genuine "Artist - Song"
  // boundary — e.g. "Some Song (Bonus Track - Album Version)" would otherwise
  // wrongly extract "Some Song (Bonus Track" as the "artist".
  const openParens = (candidate.match(/\(/g) ?? []).length
  const closeParens = (candidate.match(/\)/g) ?? []).length
  if (openParens !== closeParens) return null
  return candidate
}

/** The name to actually group/label a track's artist by — see extractArtistFromTitle
 * for why the title's own "Artist - Song" credit wins over the uploading channel. */
export function resolvedArtistName(track: { artist: string; title: string }): string {
  return extractArtistFromTitle(track.title) ?? track.artist
}

/**
 * A last-resort fallback for a track that's still alone in its own group after
 * everything above — its title has no "Artist - Song" delimiter at all (so
 * extractArtistFromTitle found nothing), e.g. "dmx ATF" or "DMX Mickey", both
 * genuinely by DMX but with no dash to signal it. If the title's own dash/colon/
 * pipe-delimited segments (or the title as a whole, when there are none) include
 * one that *starts with* an artist who already has an established, larger group,
 * it almost certainly belongs there too. Deliberately conservative: only a
 * segment *start* counts, not "appears anywhere" — "Timbaland - Who Am I (feat.
 * Twista)" must never fold into Twista's group just because Twista is mentioned;
 * it's Timbaland's own track. Only called for singles, and only against groups
 * that already have more than one track — a coincidental one-word overlap with
 * another equally-unestablished single would be too weak a signal to act on.
 */
export function findEstablishedArtistMatch(
  title: string,
  establishedGroups: { key: string; label: string }[],
): { key: string; label: string } | null {
  const segments = title
    .split(/\s*-\s*|\s*[:|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const group of establishedGroups) {
    const labelKey = artistGroupKey(group.label)
    if (labelKey.length < 3) continue
    for (const segment of segments) {
      if (artistGroupKey(segment).startsWith(labelKey)) return group
    }
  }
  return null
}
