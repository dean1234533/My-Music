import { HttpsError, onCall } from 'firebase-functions/v2/https'
import type { Query } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { db } from '../admin.js'

const RECENT_AUTH_WINDOW_SEC = 5 * 60

async function deleteQueryBatched(query: Query, batchSize = 300): Promise<void> {
  for (;;) {
    const snap = await query.limit(batchSize).get()
    if (snap.empty) return
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
    if (snap.size < batchSize) return
  }
}

/**
 * Deletes every piece of this user's personal library data: playlists,
 * favourites, saved-library entries, play history, settings, and the user
 * profile doc itself, then
 * the Firebase Auth account. The shared `tracks` cache (metadata keyed by
 * YouTube video ID) is left in place — it holds no personal data and may
 * still be referenced by nothing once this account is gone, which is fine to
 * leave behind rather than trying to reference-count it. Idempotent: safe to
 * re-run if a previous attempt partially failed.
 */
async function performAccountDeletion(uid: string): Promise<void> {
  await deleteQueryBatched(db.collection('playlists').where('ownerId', '==', uid))
  await deleteQueryBatched(db.collection('favorites').where('uid', '==', uid))
  await deleteQueryBatched(db.collection('savedTracks').where('uid', '==', uid))
  await deleteQueryBatched(db.collection('playHistory').where('uid', '==', uid))
  await db.collection('settings').doc(uid).delete()
  await db.collection('users').doc(uid).delete()

  try {
    await getAuth().deleteUser(uid)
  } catch (err) {
    // Already deleted (e.g. a retried run) — not an error.
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
  }
}

export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid

  const authTime = request.auth.token.auth_time as number | undefined
  if (!authTime || Date.now() / 1000 - authTime > RECENT_AUTH_WINDOW_SEC) {
    throw new HttpsError('failed-precondition', 'Please sign in again before deleting your account.')
  }

  try {
    await performAccountDeletion(uid)
  } catch {
    throw new HttpsError('internal', 'Account deletion failed partway through — it is safe to try again.')
  }

  return { ok: true }
})
