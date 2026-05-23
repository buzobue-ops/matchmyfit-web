import { useState, useEffect, useCallback } from 'react'
import { loadUser, saveUser, clearUser } from './services/storageService.js'
import { checkAccountAndFetchProfile } from './services/webhookService.js'
import LoginPage from './components/Login/LoginPage.jsx'
import OnboardingFlow from './components/Onboarding/OnboardingFlow.jsx'
import HomePage from './components/Home/HomePage.jsx'
import SearchPage from './components/Search/SearchPage.jsx'
import OutfitPage from './components/Outfit/OutfitPage.jsx'
import ProfilePage from './components/Profile/ProfilePage.jsx'
import CartPage from './components/Cart/CartPage.jsx'
import LoadingOverlay from './components/UI/LoadingOverlay.jsx'

// ─── Route states ────────────────────────────────────────────────────────
// 'loading'    initial check
// 'login'      unauthenticated
// 'onboarding' authenticated but profile incomplete
// 'home'       authenticated + onboarding complete → mode selection
// 'search'     Singolo Capo mode
// 'outfit'     Custom Outfit mode
// 'profile'    dedicated profile / measurements page
// 'cart'       shopping cart

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
    if (stored.onboardingComplete) {
      setUser(stored)
      setRoute('home')
    } else {
      setUser(stored)
      setRoute('onboarding')
    }
  }, [])

  // ─── Helper: profile is fully onboarded.
  //     n8n check-account may return only username (string) or a full object —
  //     either way, if the account exists in the DB and has a username,
  //     the user has completed enough onboarding to go straight to search.
  //     Measurements/photo can always be updated later via "Modifica profilo".
  const profileIsComplete = useCallback((profile) => {
    if (!profile) return false
    // Explicit step 2 / 'link' from n8n
    if (profile.onboardingStep === 2) return true
    // Username present means they went through at minimum step 1
    if (profile.username) return true
    return false
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
        // Returning user — send to home, no re-onboarding
        finalUser = {
          ...existingProfile,
          ...authUser,          // authUser.id (Google sub) always wins
          onboardingComplete: true,
        }
        saveUser(finalUser)
        setUser(finalUser)
        setRoute('home')
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
    setRoute('home')
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

  if (route === 'home') {
    return (
      <HomePage
        user={user}
        onSelectSearch={() => setRoute('search')}
        onSelectOutfit={() => setRoute('outfit')}
        onSelectProfile={() => setRoute('profile')}
        onSelectCart={() => setRoute('cart')}
        onSignOut={handleSignOut}
        onUpdateUser={handleUpdateUser}
      />
    )
  }

  if (route === 'outfit') {
    return (
      <OutfitPage
        user={user}
        onBack={() => setRoute('home')}
        onSignOut={handleSignOut}
        onOpenCart={() => setRoute('cart')}
      />
    )
  }

  if (route === 'profile') {
    return (
      <ProfilePage
        user={user}
        onBack={() => setRoute('home')}
        onSave={(updates) => { handleUpdateUser(updates); setRoute('home') }}
      />
    )
  }

  if (route === 'cart') {
    return (
      <CartPage
        onBack={() => setRoute('home')}
      />
    )
  }

  return (
    <SearchPage
      user={user}
      onBack={() => setRoute('home')}
      onSignOut={handleSignOut}
      onUpdateUser={handleUpdateUser}
      onOpenProfile={() => setRoute('profile')}
      onOpenCart={() => setRoute('cart')}
    />
  )
}
