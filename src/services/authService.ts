import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
  // Best-effort: drop the service worker's same-origin image cache so a
  // different user signing in on the same device/browser never gets served
  // a cached response tied to the previous session. No-ops in browsers
  // without Cache Storage support (or if the SW hasn't registered yet).
  try {
    if ('caches' in window) await caches.delete('images')
  } catch {
    // Non-critical — never block sign-out on this.
  }
}

/** True if the signed-in user can reauthenticate with an email/password credential. */
export function hasPasswordProvider(): boolean {
  return auth.currentUser?.providerData.some((p) => p.providerId === 'password') ?? false
}

export function hasGoogleProvider(): boolean {
  return auth.currentUser?.providerData.some((p) => p.providerId === 'google.com') ?? false
}

export async function reauthenticateWithPassword(currentPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new Error('No signed-in user')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
}

export async function reauthenticateWithGoogle(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('No signed-in user')
  await reauthenticateWithPopup(user, new GoogleAuthProvider())
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await reauthenticateWithPassword(currentPassword)
  const user = auth.currentUser
  if (!user) throw new Error('No signed-in user')
  await updatePassword(user, newPassword)
}
