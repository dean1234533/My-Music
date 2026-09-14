import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { PlayerProvider } from '@/contexts/PlayerContext'
import { PlayerBar } from '@/components/player/PlayerBar'
import { ToastProvider } from '@/contexts/ToastContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import { PwaLaunchScreen } from '@/components/pwa/PwaLaunchScreen'
import { LoadingState } from '@/components/common/StateViews'

// Every page is route-level code-split: each becomes its own chunk, fetched
// only when actually navigated to, instead of one big bundle everyone
// downloads up front regardless of which page they'll ever visit.
const SignInPage = lazy(() => import('@/pages/auth/SignInPage').then((m) => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const AuthActionPage = lazy(() => import('@/pages/auth/AuthActionPage').then((m) => ({ default: m.AuthActionPage })))

const AppLayout = lazy(() => import('@/pages/app/AppLayout').then((m) => ({ default: m.AppLayout })))
const HomePage = lazy(() => import('@/pages/app/HomePage').then((m) => ({ default: m.HomePage })))
const SearchPage = lazy(() => import('@/pages/app/SearchPage').then((m) => ({ default: m.SearchPage })))
const LibraryPage = lazy(() => import('@/pages/app/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const PlaylistsPage = lazy(() => import('@/pages/app/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })))
const PlaylistDetailPage = lazy(() => import('@/pages/app/PlaylistDetailPage').then((m) => ({ default: m.PlaylistDetailPage })))
const SettingsPage = lazy(() => import('@/pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

/** No marketing site anymore — the root just sends people to the app (or to sign-in). */
function RootRedirect() {
  const { firebaseUser, initializing } = useAuth()
  if (initializing) return <LoadingState label="Loading…" />
  return <Navigate to={firebaseUser ? '/app/home' : '/sign-in'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PlayerProvider>
            <InstallBanner />
            <PwaLaunchScreen />
            <Suspense fallback={<LoadingState label="Loading…" />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />

                <Route path="/sign-in" element={<SignInPage />} />
                <Route path="/sign-up" element={<SignUpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/action" element={<AuthActionPage />} />

                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="home" replace />} />
                  <Route path="home" element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="library" element={<LibraryPage />} />
                  <Route path="playlists" element={<PlaylistsPage />} />
                  <Route path="playlists/:playlistId" element={<PlaylistDetailPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            {/* Rendered globally, not just inside AppShell — this holds the actual YouTube
                iframe mount, so playback survives route changes across the whole app. */}
            <PlayerBar />
          </PlayerProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
