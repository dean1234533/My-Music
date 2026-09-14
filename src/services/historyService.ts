import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PlayHistoryDoc } from '@/types/playHistory'

/** Personal retention default (spec: 100–500 entries) — kept small since it's just a "recently played" convenience, not an archive. */
export const HISTORY_LIMIT = 100

const TRIM_BUFFER = 20

/**
 * Records a play and trims this user's history back down to HISTORY_LIMIT
 * whenever it grows past a small buffer over that. The check itself is a
 * server-side count aggregation (getCountFromServer), not a full document
 * read of the whole history — the actual excess-fetching read only happens
 * in the rare case trimming is genuinely needed, so a normal play never
 * downloads the user's entire play-history collection just to record itself.
 */
export async function recordPlay(uid: string, trackId: string): Promise<void> {
  const ref = doc(collection(db, 'playHistory'))
  await setDoc(ref, { historyId: ref.id, uid, trackId, playedAt: serverTimestamp() })

  const baseQuery = query(collection(db, 'playHistory'), where('uid', '==', uid))
  const countSnap = await getCountFromServer(baseQuery)
  if (countSnap.data().count > HISTORY_LIMIT + TRIM_BUFFER) {
    const orderedQuery = query(baseQuery, orderBy('playedAt', 'desc'))
    const snap = await getDocs(orderedQuery)
    const excess = snap.docs.slice(HISTORY_LIMIT)
    await Promise.all(excess.map((d) => deleteDoc(d.ref)))
  }
}

export function subscribeRecentlyPlayed(
  uid: string,
  onChange: (history: PlayHistoryDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'playHistory'), where('uid', '==', uid), orderBy('playedAt', 'desc'), limit(HISTORY_LIMIT))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as PlayHistoryDoc)),
    (error) => {
      console.error('[subscribeRecentlyPlayed] listener error:', error)
      onError?.(error)
    },
  )
}

export async function clearHistory(uid: string): Promise<void> {
  const q = query(collection(db, 'playHistory'), where('uid', '==', uid))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}
