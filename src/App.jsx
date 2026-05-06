import { useState, useEffect, useCallback } from 'react'
import { loadUser, saveUser, clearUser } from './services/storageService.js'
import { checkAccountAndFetchProfile } from './services/webhookService.js'
import LoginPage from './components/Login/LoginPage.jsx'
import OnboardingFlow from './components/Onboarding/OnboardingFlow.jsx'
import SearchPage from './components/Search/SearchPage.jsx'
import LoadingOverlay from './components/UI/LoadingOverlay.jsx'

// ─── Route states ────────────────────────────────────────────────────────
// 'loading'    initial check
// 'login'      unauthenticated
// 'onboarding' authenticated but profile incomplete
// 'search'     authenticated + onboarding complete

export default function App() {
  const [route, setRoute] = useState('loading')
  const [user, setUser] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('Caricamento…')

  // ─── On mount: restore session from localStorage ──────────────────────
  useEffect(() => {
    const stored = loadUser()
    if (!stored) {
      setRoute('login')
      return
    }
    // User was already fully onboarded (onboardingStep === 2 equivalent)
    if (stored.onboardingComplete) {
      setUser(stored)
      setRoute('search')
    } else {
      setUser(stored)
      setRoute('onboarding')
    }
  }, [])

  // ─── Called by LoginPage after successful OAuth ───────────────────────
  const handleAuthSuccess = useCallback(async (authUser) => {
    setLoadingMsg('Controllo account…')
    setRoute('loading')

    try {
      const existingProfile = await checkAccountAndFetchProfile({
        authProvider: authUser.authProvider,
        providerUserId: authUser.id,
        email: authUser.email,
      })

      let finalUser
      if (existingProfile && existingProfile.onboardingStep === 2) {
        // Existing user with complete onboarding
        finalUser = {
          ...authUser,
          ...existingProfile,
          onboardingComplete: true,
        }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('search')
      } else if (existingProfile) {
        // Existing user but onboarding incomplete
        finalUser = { ...authUser, ...existingProfile, onboardingComplete: false }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('onboarding')
      } else {
        // New user
        finalUser = {
          ...authUser,
          createdAt: new Date().toISOString(),
          onboardingComplete: false,
        }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('onboarding')
      }
    } catch (err) {
      console.error('[App] checkAccount error', err)
      // Proceed to onboarding even if check fails
      const fallback = { ...authUser, createdAt: new Date().toISOString(), onboardingComplete: false }
      saveUser(fallback)
      setUser(fallback)
      setRoute('onboarding')
    }
  }, [])

  // ─── Called by OnboardingFlow when all steps complete ─────────────────
  const handleOnboardingComplete = useCallback((updatedUser) => {
    const finalUser = { ...updatedUser, onboardingComplete: true }
    saveUser(finalUser)
    setUser(finalUser)
    setRoute('search')
  }, [])

  // ─── Sign out ─────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    clearUser()
    setUser(null)
    setRoute('login')
  }, [])

  // ─── Update user (called by AccountView or similar) ───────────────────
  const handleUpdateUser = useCallback((updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates }
      saveUser(next)
      return next
    })
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────
  if (route === 'loading') {
    return <LoadingOverlay message={loadingMsg} fullscreen />
  }

  if (route === 'login') {
    return <LoginPage onAuthSuccess={handleAuthSuccess} />
  }

  if (route === 'onboarding') {
    return (
      <OnboardingFlow
        user={user}
        onComplete={handleOnboardingComplete}
        onUpdateUser={handleUpdateUser}
      />
    )
  }

  return (
    <SearchPage
      user={user}
      onSignOut={handleSignOut}
      onUpdateUser={handleUpdateUser}
    />
  )
}
