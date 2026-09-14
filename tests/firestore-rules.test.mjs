import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

function blockFor(collectionPath) {
  const start = rules.indexOf(`match /${collectionPath}`)
  assert.notEqual(start, -1, `no rule block found for ${collectionPath}`)
  // Grab a generous chunk after the match line — enough to cover the whole block
  // without needing full brace-matching for these small, flat rule blocks.
  return rules.slice(start, start + 1200)
}

test('a user can read/write their own playlists but not another user\'s', () => {
  const block = blockFor('playlists/{playlistId}')
  assert.match(block, /allow read, update, delete: if isOwner\(resource\.data\.ownerId\)/)
  assert.match(block, /allow create: if isOwner\(request\.resource\.data\.ownerId\)/)
  // isOwner() ties access to request.auth.uid matching the ownerId field, not
  // just "any signed-in user" — so someone else's playlist can never match.
  assert.match(rules, /function isOwner\(field\) \{\s*return isSignedIn\(\) && request\.auth\.uid == field;/)
})

test('a user can read/write their own favorites but not another user\'s, and the doc ID must match ${uid}_${trackId}; re-saving an already-favourited track is allowed as a no-op, but not with a different uid/trackId', () => {
  const block = blockFor('favorites/{favoriteId}')
  assert.match(block, /allow read, delete: if isOwner\(resource\.data\.uid\)/)
  assert.match(block, /allow create: if isOwner\(request\.resource\.data\.uid\)/)
  assert.match(block, /favoriteId == request\.resource\.data\.uid \+ '_' \+ request\.resource\.data\.trackId/)
  // setDoc() without merge is a full overwrite — Firestore treats it as an update whenever
  // the doc already exists, so re-adding an already-favourited track must not be a flat
  // `allow update: if false` (that was the actual bug: "add all to library" always fails
  // for tracks already saved, since the second setDoc call to the same doc ID is an update).
  assert.doesNotMatch(block, /allow update: if false/)
  assert.match(block, /allow update: if isOwner\(resource\.data\.uid\)\s*&& request\.resource\.data\.uid == resource\.data\.uid\s*&& request\.resource\.data\.trackId == resource\.data\.trackId/)
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
