import * as functionsV1 from 'firebase-functions/v1'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'

/**
 * Creates the Firestore user document the moment a Firebase Auth account is
 * created, so every signed-in user has a doc to hang settings/library data
 * off of without trusting the client to create it first.
 */
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const ref = db.collection('users').doc(user.uid)
  const existing = await ref.get()
  if (existing.exists) return

  await ref.set({
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
})
