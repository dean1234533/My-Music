import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_SETTINGS, type SettingsDoc } from '@/types/settings'

function settingsRef(uid: string) {
  return doc(db, 'settings', uid)
}

/**
 * updateSettings() writes with merge:true and only ever sends the field(s)
 * actually being changed (e.g. just defaultVolume from the volume slider),
 * so a real settings doc can easily exist with only some fields ever set —
 * the rest were simply never written. Returning that partial doc as-is
 * (as this used to) silently turned every field the user hadn't touched
 * yet into `undefined` instead of its real default, e.g. autoplayNext
 * reading as falsy and permanently disabling auto-advance to the next
 * queued track even though the Settings toggle still showed it as on
 * (user-reported: "it always plays one at a time and never auto skips").
 * Merging over DEFAULT_SETTINGS here means a field is only ever undefined
 * if it's genuinely missing from both the doc and the defaults.
 */
export async function getSettings(uid: string): Promise<SettingsDoc> {
  const snap = await getDoc(settingsRef(uid))
  if (snap.exists()) return { uid, ...DEFAULT_SETTINGS, ...snap.data() } as SettingsDoc
  return { uid, ...DEFAULT_SETTINGS, updatedAt: null }
}

export async function updateSettings(uid: string, changes: Partial<Omit<SettingsDoc, 'uid' | 'updatedAt'>>): Promise<void> {
  await setDoc(settingsRef(uid), { uid, ...changes, updatedAt: serverTimestamp() }, { merge: true })
}
