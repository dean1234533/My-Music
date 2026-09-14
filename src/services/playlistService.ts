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
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { artistGroupKey, stripArtistNoise } from '@/utils/artist'
import type { PlaylistDoc } from '@/types/playlist'
import type { TrackDoc } from '@/types/track'

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

/** Deterministic, so every call for the same user+artist always targets the exact same
 * document — no query-then-create race is possible (see ensureArtistPlaylist below). */
function artistPlaylistId(uid: string, key: string): string {
  return `artist_${uid}_${key}`
}

/**
 * Every artist gets one always-up-to-date playlist of everything by them in the
 * user's library — saving a track by an artist for the first time creates that
 * playlist, saving another by the same artist adds to it. Matched by a
 * deterministic ID derived from the normalized artist grouping key
 * (src/utils/artist.ts) rather than by querying for an existing match, so
 * saving several tracks by the same artist at once (e.g. "Add all to
 * library") can never race into creating separate duplicate playlists for
 * that one artist — confirmed live: a query-then-create version of this did
 * exactly that, leaving one real artist split across dozens of playlists.
 * The transaction is what makes "does it exist yet" and "create/update it"
 * atomic against that one fixed document, even under concurrent calls.
 * Removing a track the user doesn't want stays a manual action via the
 * normal playlist "remove" button — this only ever adds.
 */
export async function ensureArtistPlaylist(uid: string, track: TrackDoc): Promise<void> {
  const key = artistGroupKey(track.artist)
  const ref = playlistRef(artistPlaylistId(uid, key))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      tx.set(ref, {
        playlistId: ref.id,
        ownerId: uid,
        title: stripArtistNoise(track.artist) || 'Unknown artist',
        trackIds: [track.trackId],
        autoArtistKey: key,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return
    }
    const data = snap.data() as PlaylistDoc
    if (!data.trackIds.includes(track.trackId)) {
      tx.update(ref, { trackIds: arrayUnion(track.trackId), updatedAt: serverTimestamp() })
    }
  })
}
