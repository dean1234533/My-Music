import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SavedTrackDoc } from '@/types/savedTrack'

function savedTrackRef(uid: string, trackId: string) {
  return doc(db, 'savedTracks', `${uid}_${trackId}`)
}

/**
 * A track's presence in `savedTracks` is what makes it part of a user's
 * permanent library, independent of whether it's ever favourited or added
 * to a playlist — see src/types/savedTrack.ts. The shared `tracks/{trackId}`
 * doc (global YouTube metadata cache) is untouched by this; this collection
 * only ever records ownership.
 */
export async function isInLibrary(uid: string, trackId: string): Promise<boolean> {
  const snap = await getDoc(savedTrackRef(uid, trackId))
  return snap.exists()
}

export async function saveToLibrary(uid: string, trackId: string): Promise<void> {
  await setDoc(savedTrackRef(uid, trackId), { uid, trackId, addedAt: serverTimestamp() })
}

/**
 * Removes the track from this user's library only — never touches the
 * shared `tracks/{trackId}` metadata doc, which may still be referenced by
 * this user's own favourites/playlists or by other users' libraries.
 */
export async function removeFromLibrary(uid: string, trackId: string): Promise<void> {
  await deleteDoc(savedTrackRef(uid, trackId))
}

export function subscribeLibrary(
  uid: string,
  onChange: (savedTracks: SavedTrackDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'savedTracks'), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as SavedTrackDoc)),
    (error) => {
      console.error('[subscribeLibrary] listener error:', error)
      onError?.(error)
    },
  )
}
