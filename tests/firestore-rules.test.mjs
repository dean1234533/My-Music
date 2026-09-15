import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

function blockFor(collectionPath) {
  const start = rules.indexOf(`match /${collectionPath}`)
  assert.notEqual(start, -1, `no rule block found for ${collectionPath}`)
  // Slice up to wherever the next top-level `match /` block begins (or end of file) —
  // a fixed-size chunk either cut a longer block short (tracks/{trackId} is over 1200
  // chars) or, made bigger to compensate, bled into the *next* block and broke
  // doesNotMatch assertions that legitimately match something later in the file.
  const nextMatch = rules.indexOf('\n    match /', start + 1)
  const end = nextMatch === -1 ? rules.length : nextMatch
  return rules.slice(start, end)
}

test('a user can read/write their own playlists but not another user\'s', () => {
  const block = blockFor('playlists/{playlistId}')
  assert.match(block, /allow read, update, delete: if isOwner\(resource\.data\.ownerId\)/)
  assert.match(block, /allow create: if isOwner\(request\.resource\.data\.ownerId\)/)
  // isOwner() ties access to request.auth.uid matching the ownerId field, not
  // just "any signed-in user" — so someone else's playlist can never match.
  assert.match(rules, /function isOwner\(field\) \{\s*return isSignedIn\(\) && request\.auth\.uid == field;/)
})

// ---------------------------------------------------------------------------
// The "like a track" feature was removed at the user's request (they only
// organize via playlists) — the favorites collection's rules must not still
// be present, since no client code references it anymore.
// ---------------------------------------------------------------------------

test('the favorites collection has no rule block left — the like/favorite feature was removed', () => {
  assert.equal(rules.indexOf('match /favorites'), -1)
})

test('a user can read/write their own savedTracks (independent library) but not another user\'s, and the doc ID must match ${uid}_${trackId}; re-saving an already-saved track is allowed as a no-op, but not with a different uid/trackId', () => {
  const block = blockFor('savedTracks/{savedId}')
  assert.match(block, /allow read, delete: if isOwner\(resource\.data\.uid\)/)
  assert.match(block, /allow create: if isOwner\(request\.resource\.data\.uid\)/)
  assert.match(block, /savedId == request\.resource\.data\.uid \+ '_' \+ request\.resource\.data\.trackId/)
  assert.doesNotMatch(block, /allow update: if false/)
  assert.match(block, /allow update: if isOwner\(resource\.data\.uid\)\s*&& request\.resource\.data\.uid == resource\.data\.uid\s*&& request\.resource\.data\.trackId == resource\.data\.trackId/)
})

test('a user can create/read their own playHistory entries but not another user\'s, and cannot update an existing entry', () => {
  const block = blockFor('playHistory/{historyId}')
  assert.match(block, /allow read, delete: if isOwner\(resource\.data\.uid\)/)
  assert.match(block, /allow create: if isOwner\(request\.resource\.data\.uid\)/)
  assert.match(block, /allow update: if false/)
})

test('a user can read/write their own settings doc only', () => {
  const block = blockFor('settings/{uid}')
  assert.match(block, /allow read, write: if isSelf\(uid\)/)
  assert.match(rules, /function isSelf\(uid\) \{\s*return isSignedIn\(\) && request\.auth\.uid == uid;/)
})

test('any authenticated user can create a tracks/{videoId} doc as long as the doc ID matches youtubeVideoId and is a valid 11-char YouTube ID, and cannot change identity fields after creation', () => {
  const block = blockFor('tracks/{trackId}')
  assert.match(block, /allow create: if isSignedIn\(\)/)
  assert.match(block, /trackId == request\.resource\.data\.youtubeVideoId/)
  assert.match(block, /trackId\.matches\('\^\[A-Za-z0-9_-\]\{11\}\$'\)/)
  assert.match(block, /request\.resource\.data\.source == 'youtube'/)
  // Identity fields frozen post-creation.
  assert.match(block, /request\.resource\.data\.youtubeVideoId == resource\.data\.youtubeVideoId/)
  assert.match(block, /request\.resource\.data\.source == resource\.data\.source/)
  assert.match(block, /request\.resource\.data\.createdAt == resource\.data\.createdAt/)
  // unavailable can only ever go false -> true, never back.
  assert.match(block, /resource\.data\.get\('unavailable', false\) != true/)
  assert.match(block, /request\.resource\.data\.unavailable == true/)
  assert.match(block, /allow delete: if false/)
})

test('a signed-out user is denied everywhere', () => {
  // Every owner-scoped collection routes through isSignedIn()/isSelf()/isOwner(), all of
  // which require request.auth != null, and the catch-all denies everything unmatched.
  for (const fn of ['isSignedIn', 'isSelf', 'isOwner']) {
    assert.match(rules, new RegExp(`function ${fn}\\(`))
  }
  assert.match(rules, /function isSignedIn\(\) \{\s*return request\.auth != null;/)
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
})

test('rateLimits is denied to all client access', () => {
  const block = blockFor('rateLimits/{key}')
  assert.match(block, /allow read, write: if false/)
})

test('users/{uid} allows owner read/update and a client fallback create matching the caller\'s own uid', () => {
  const block = blockFor('users/{uid}')
  assert.match(block, /allow read, update: if isSelf\(uid\)/)
  assert.match(block, /allow create: if isSelf\(uid\) && request\.resource\.data\.uid == uid/)
  assert.match(block, /allow delete: if false/)
})

test('no leftover marketplace collections are referenced', () => {
  for (const collection of [
    'artistProfiles', 'djProfiles', 'crates', 'follows', 'stories', 'licenceRequests',
    'licenceOffers', 'licenceAgreements', 'subscriptions', 'fanOffers', 'notifications',
    'reports', 'auditLogs', 'transactions', 'copyrightClaims', 'trackMedia', 'artistSlugs',
    'artistPosts', 'trackSlugs', 'albums', 'blockedUsers', 'trackLikes',
  ]) {
    assert.doesNotMatch(rules, new RegExp(`match /${collection}/`))
  }
})
