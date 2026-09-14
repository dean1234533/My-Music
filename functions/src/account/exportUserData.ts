import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'

const EXPORT_URL_TTL_MS = 24 * 60 * 60 * 1000

async function docsWhere(collection: string, field: string, uid: string) {
  const snap = await db.collection(collection).where(field, '==', uid).get()
  return snap.docs.map((d) => d.data())
}

/**
 * Produces a one-off JSON export of the caller's own library data, uploaded
 * to a private Storage path only this function can generate a signed URL
 * for (storage.rules blocks direct client reads/writes of exports/ entirely).
 */
export const exportUserData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid

  const userDoc = await db.collection('users').doc(uid).get()
  const settingsDoc = await db.collection('settings').doc(uid).get()

  const [playlists, favorites, savedTracks, playHistory] = await Promise.all([
    docsWhere('playlists', 'ownerId', uid),
    docsWhere('favorites', 'uid', uid),
    docsWhere('savedTracks', 'uid', uid),
    docsWhere('playHistory', 'uid', uid),
  ])

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: userDoc.exists ? userDoc.data() : null,
    settings: settingsDoc.exists ? settingsDoc.data() : null,
    playlists,
    favorites,
    savedTracks,
    playHistory,
  }

  const path = `exports/${uid}/${Date.now()}.json`
  const file = getStorage().bucket().file(path)
  await file.save(JSON.stringify(exportPayload, null, 2), { contentType: 'application/json' })

  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + EXPORT_URL_TTL_MS })
  return { url, expiresInSeconds: EXPORT_URL_TTL_MS / 1000 }
})
