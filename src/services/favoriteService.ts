import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FavoriteDoc } from '@/types/favorite'

function favoriteRef(uid: string, trackId: string) {
  return doc(db, 'favorites', `${uid}_${trackId}`)
}

export async function isFavorite(uid: string, trackId: string): Promise<boolean> {
  const snap = await getDoc(favoriteRef(uid, trackId))
  return snap.exists()
}

export async function addFavorite(uid: string, trackId: string): Promise<void> {
  await setDoc(favoriteRef(uid, trackId), { uid, trackId, createdAt: serverTimestamp() })
}

export async function removeFavorite(uid: string, trackId: string): Promise<void> {
  await deleteDoc(favoriteRef(uid, trackId))
}

export function subscribeFavorites(
  uid: string,
  onChange: (favorites: FavoriteDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'favorites'), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as FavoriteDoc)),
    (error) => {
      console.error('[subscribeFavorites] listener error:', error)
      onError?.(error)
    },
  )
}
