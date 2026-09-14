import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Functions } from 'firebase/functions'
import type { FirebaseStorage } from 'firebase/storage'
import type { Messaging } from 'firebase/messaging'

// My Music is a separate, personal fork of another app — it must never fall
// back to any hardcoded project config (a previous version of this file fell
// back to that other app's own production Firebase project, which would have
// meant this app silently read/wrote real production data whenever env vars
// were missing). There is no fallback: every value must come from your own
// Firebase project's env vars (see .env.example), or the app fails loudly
// at startup instead of connecting to the wrong project.
const requiredEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    throw new Error(
      `Missing ${key} — set VITE_FIREBASE_* env vars for your own Firebase project in .env (see .env.example). This app never falls back to a default project.`,
    )
  }
}

const firebaseConfig = {
  ...requiredEnv,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
}

export const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

// Storage and Functions are lazy, not eager top-level exports like auth/db above — a *static*
// `import ... from 'firebase/storage'` pulls that whole SDK into every page's bundle regardless of
// whether the resulting binding is actually called, since Rollup resolves static imports at the
// module-graph level, not at call time. PlayerContext is mounted unconditionally on every route
// and used to import trackService.ts's static `functions`/`storage` exports just to reach two
// db-only playback calls, dragging both SDKs into the homepage's eager chunk (SEO audit: Speed
// Index 5.4s, ~435KB estimated unused JS). The `import('firebase/storage')` calls below are
// dynamic — only these getters' own call sites, all of them already behind a lazy route/component
// boundary, ever trigger the actual module fetch.
let storageInstance: FirebaseStorage | undefined
export async function getFirebaseStorage(): Promise<FirebaseStorage> {
  if (!storageInstance) {
    const { getStorage } = await import('firebase/storage')
    storageInstance = getStorage(firebaseApp)
  }
  return storageInstance
}

let functionsInstance: Functions | undefined
export async function getFirebaseFunctions(): Promise<Functions> {
  if (!functionsInstance) {
    const { getFunctions } = await import('firebase/functions')
    functionsInstance = getFunctions(firebaseApp)
  }
  return functionsInstance
}

let messagingInstance: Messaging | null | undefined
/**
 * Lazily initialised and support-checked — getMessaging() throws outright
 * on browsers/contexts without Push API support (older Safari, some
 * embedded webviews), so this must never run eagerly at module load.
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) return messagingInstance
  const { getMessaging, isSupported } = await import('firebase/messaging')
  messagingInstance = (await isSupported()) ? getMessaging(firebaseApp) : null
  return messagingInstance
}
