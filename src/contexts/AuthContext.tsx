import { onAuthStateChanged, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth } from '@/lib/firebase'
import { ensureUserDocument, subscribeToUserProfile } from '@/services/userService'
import type { UserProfile } from '@/types/user'

interface AuthContextValue {
  firebaseUser: User | null
  profile: UserProfile | null
  initializing: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [profileReadyUid, setProfileReadyUid] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      setProfileReadyUid(null)
      setInitializing(true)
      if (!user) {
        setProfile(null)
        setInitializing(false)
        return
      }
      try {
        await ensureUserDocument(user)
        setProfileReadyUid(user.uid)
      } catch (error) {
        console.error('Could not initialise the user profile.', error)
        setProfile(null)
        setInitializing(false)
      }
    })
    return unsubscribeAuth
  }, [])

  useEffect(() => {
    if (!firebaseUser || profileReadyUid !== firebaseUser.uid) return
    const unsubscribeProfile = subscribeToUserProfile(
      firebaseUser.uid,
      (nextProfile) => {
        setProfile(nextProfile)
        setInitializing(false)
      },
      () => setInitializing(false),
    )
    return unsubscribeProfile
  }, [firebaseUser, profileReadyUid])

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, profile, initializing }),
    [firebaseUser, profile, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
