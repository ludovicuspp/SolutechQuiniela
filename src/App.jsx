import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useNotificationStore } from './store/notificationStore'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen from './components/SplashScreen'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MatchesPage from './pages/MatchesPage'
import MyBetsPage from './pages/MyBetsPage'
import WalletPage from './pages/WalletPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import SoportePage from './pages/SoportePage'

export default function App() {
  const { initialize, setupTokenRefreshListener, user } = useAuthStore()
  const { init: initTheme, dark } = useThemeStore()
  const { fetchNotifications, subscribeToNotifications } = useNotificationStore()

  // Splash solo al hacer login (null → user). No al arrancar con sesión ya activa.
  const [showSplash, setShowSplash] = useState(false)
  const prevUserRef = useRef(undefined)

  useEffect(() => {
    initTheme()
    initialize()
    const unsubToken = setupTokenRefreshListener()
    return () => {
      unsubToken?.()
      useAuthStore.getState().authUnsubscribe?.()
    }
  }, [])

  // Mostrar splash solo cuando el usuario acaba de hacer login (null → user)
  useEffect(() => {
    if (prevUserRef.current === undefined) {
      // Primera evaluación — registrar estado inicial sin mostrar splash
      prevUserRef.current = user
      return
    }
    if (prevUserRef.current === null && user !== null) {
      // Login exitoso: mostrar splash 3s
      setShowSplash(true)
    }
    prevUserRef.current = user
  }, [user])

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id)
      const unsub = subscribeToNotifications(user.id)
      return unsub
    }
  }, [user?.id])

  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} duration={3000} />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: dark ? '#1e293b' : '#fff',
            color: dark ? '#f1f5f9' : '#0f172a',
            borderRadius: '12px',
            border: dark ? '1px solid #334155' : '1px solid #e2e8f0',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />

        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="partidos" element={<MatchesPage />} />
          <Route path="mis-apuestas" element={<MyBetsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="ranking" element={<LeaderboardPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="soporte" element={<SoportePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
