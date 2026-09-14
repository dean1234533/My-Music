import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PlaylistDoc } from '@/types/playlist'

function playlistRef(playlistId: string) {
  return doc(db, 'playlists', playlistId)
}

export function newPlaylistId(): string {
  return doc(collection(db, 'playlists')).id
}

export async function createPlaylist(ownerId: string, title: string): Promise<string> {
  const playlistId = newPlaylistId()
  await setDoc(playlistRef(playlistId), {
    playlistId,
    ownerId,
    title,
    trackIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return playlistId
}

export function subscribeOwnPlaylists(
  ownerId: string,
  onChange: (playlists: PlaylistDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'playlists'), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as PlaylistDoc)),
    (error) => {
      console.error('[subscribeOwnPlaylists] listener error:', error)
      onError?.(error)
    },
  )
}

export async function getPlaylist(playlistId: string): Promise<PlaylistDoc | null> {
  const snap = await getDoc(playlistRef(playlistId))
  return snap.exists() ? (snap.data() as PlaylistDoc) : null
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  await updateDoc(playlistRef(playlistId), { trackIds: arrayUnion(trackId), updatedAt: serverTimestamp() })
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  await updateDoc(playlistRef(playlistId), { trackIds: arrayRemove(trackId), updatedAt: serverTimestamp() })
}

export async function renamePlaylist(playlistId: string, title: string): Promise<void> {
  await updateDoc(playlistRef(playlistId), { title, updatedAt: serverTimestamp() })
}

/** Persists a manual drag-to-reorder — the full, already-reordered trackIds array replaces the old one. */
export async function reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
  await updateDoc(playlistRef(playlistId), { trackIds, updatedAt: serverTimestamp() })
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await deleteDoc(playlistRef(playlistId))
}
