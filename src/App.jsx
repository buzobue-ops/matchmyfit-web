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

  // ─── Helper: profile is fully onboarded if n8n says step 2,
  //     OR if it has username + at least one body measurement.
  //     This handles cases where check-account returns an outdated step value.
  const profileIsComplete = useCallback((profile) => {
    if (!profile) return false
    if (profile.onboardingStep === 2) return true
    const m = profile.measurements || profile.bodySizes || {}
    const hasMeasurements = !!(
      profile.height || m.height || m.chest || m.waist || m.hips
    )
    return !!(profile.username && hasMeasurements)
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
      if (profileIsComplete(existingProfile)) {
        // Returning user — send straight to search, no re-onboarding
        finalUser = {
          ...existingProfile,
          ...authUser,          // authUser.id (Google sub) always wins
          onboardingComplete: true,
        }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('search')
      } else if (existingProfile) {
        // User exists but onboarding was interrupted — resume from where they left off
        finalUser = { ...existingProfile, ...authUser, onboardingComplete: false }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('onboarding')
      } else {
        // Brand new user
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
      // Network/server error: fall through to onboarding
      const fallback = { ...authUser, createdAt: new Date().toISOString(), onboardingComplete: false }
      saveUser(fallback)
      setUser(fallback)
      setRoute('onboarding')
    }
  }, [profileIsComplete])

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
