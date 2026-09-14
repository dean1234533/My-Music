import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/StateViews'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingState label="Checking your session…" />

  if (!firebaseUser) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }

  return <>{children}</>
}
