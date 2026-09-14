import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_SETTINGS, type SettingsDoc } from '@/types/settings'

function settingsRef(uid: string) {
  return doc(db, 'settings', uid)
}

export async function getSettings(uid: string): Promise<SettingsDoc> {
  const snap = await getDoc(settingsRef(uid))
  if (snap.exists()) return snap.data() as SettingsDoc
  return { uid, ...DEFAULT_SETTINGS, updatedAt: null }
}

export async function updateSettings(uid: string, changes: Partial<Omit<SettingsDoc, 'uid' | 'updatedAt'>>): Promise<void> {
  await setDoc(settingsRef(uid), { uid, ...changes, updatedAt: serverTimestamp() }, { merge: true })
}
