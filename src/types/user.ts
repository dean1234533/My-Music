import type { Timestamp } from 'firebase/firestore'

export interface UserProfile {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
