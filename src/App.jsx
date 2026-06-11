import { useState, useEffect, useCallback } from 'react'
import { loadUser, saveUser, clearUser, syncHistoryFromServer } from './services/storageService.js'
import { checkAccountAndFetchProfile } from './services/webhookService.js'
import LoginPage from './components/Login/LoginPage.jsx'
import OnboardingFlow from './components/Onboarding/OnboardingFlow.jsx'
import HomePage from './components/Home/HomePage.jsx'
import SearchPage from './components/Search/SearchPage.jsx'
import OutfitPage from './components/Outfit/OutfitPage.jsx'
import ProfilePage from './components/Profile/ProfilePage.jsx'
import CartPage from './components/Cart/CartPage.jsx'
import BrowsePage from './components/Browse/BrowsePage.jsx'
import LoadingOverlay from './components/UI/LoadingOverlay.jsx'
import { GdprBanner } from './components/Legal/LegalModals.jsx'
import { hasConsented } from './components/Legal/ConsentStep.jsx'

const GDPR_KEY = 'mmf_gdpr_banner_v1'

// ─── Read shared URL from PWA share_target query params ───────────────────
function readSharedUrl() {
  try {
    const p = new URLSearchParams(window.location.search)
    const url = p.get('shared_url') || p.get('url') || ''
    const text = p.get('shared_text') || p.get('text') || ''
    // Prefer anything that looks like a URL
    const candidate = [url, text].find(v => v.startsWith('http'))
    if (candidate) {
      // Clean the query string so the shared URL doesn't stick on refresh
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
      return candidate
    }
  } catch { /* */ }
  return null
}

// ─── Native app auth handoff ──────────────────────────────────────────────
// The iOS container app loads the WebView with ?nativeAuth=1&provider=...&email=...
// This function reads those params, saves the user and cleans the URL.
// Returns a user object if nativeAuth=1, null otherwise.
function readNativeAuth() {
  try {
    const p = new URLSearchParams(window.location.search)
    if (p.get('nativeAuth') !== '1') return null
    const provider    = p.get('provider') || 'google'
    const email       = p.get('email')    || ''
    const name        = p.get('name')     || ''
    const token       = p.get('token')    || ''
    const id          = p.get('id')       || (email ? 'native_' + email : null)
    if (!id && !email) return null
    // Clean URL so params don't persist after a reload
    window.history.replaceState({}, '', window.location.pathname)
    return { id, email, displayName: name, authProvider: provider, token, onboardingComplete: true }
  } catch { return null }
}

// ─── Route states ────────────────────────────────────────────────────────
// 'loading'    initial check
// 'login'      unauthenticated
// 'onboarding' authenticated but profile incomplete
// 'home'       authenticated + onboarding complete → mode selection
// 'search'     Singolo Capo mode
// 'outfit'     Custom Outfit mode
// 'profile'    dedicated profile / measurements page
// 'cart'       shopping cart
// 'browse'     cerca & aggiungi link dal web

export default function App() {
  const [route, setRoute] = useState('loading')
  const [user, setUser] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('Caricamento…')
  const [showGdprBanner, setShowGdprBanner] = useState(false)
  // URL received via PWA Share Target
  const [sharedUrl, setSharedUrl] = useState(() => readSharedUrl())

  // ─── On mount: restore session from localStorage OR native handoff ──────
  useEffect(() => {
    // 1. Native app auth: iOS container passes user via URL params
    const nativeUser = readNativeAuth()
    if (nativeUser) {
      saveUser(nativeUser)
      setUser(nativeUser)
      syncHistoryFromServer(nativeUser.id)
      setRoute('home')
      return
    }

    // 2. Native logout bridge: iOS calls window.MatchMyFitNative.logout()
    window.onMatchMyFitLogout = () => {
      clearUser()
      setUser(null)
      setRoute('login')
    }

    const stored = loadUser()
    if (!stored) {
      setRoute('login')
      return
    }
    if (stored.onboardingComplete) {
      setUser(stored)
      if (!hasConsented() && !localStorage.getItem(GDPR_KEY)) {
        setShowGdprBanner(true)
      }
      // Sync search history from server (non-blocking)
      syncHistoryFromServer(stored.id)
      // If we received a shared URL via the PWA share_target, go straight to browse
      if (sharedUrl) {
        setRoute('browse')
      } else {
        setRoute('home')
      }
    } else {
      setUser(stored)
      setRoute('onboarding')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        syncHistoryFromServer(finalUser.id) // sync history after login
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

  // ─── GDPR banner (existing users che non hanno fatto onboarding recente) ──
  const gdprBanner = showGdprBanner ? (
    <GdprBanner onAccept={() => { localStorage.setItem(GDPR_KEY, '1'); setShowGdprBanner(false) }} />
  ) : null

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
      <>
        <HomePage
          user={user}
          onSelectSearch={() => setRoute('search')}
          onSelectOutfit={() => setRoute('outfit')}
          onSelectProfile={() => setRoute('profile')}
          onSelectCart={() => setRoute('cart')}
          onSelectBrowse={() => setRoute('browse')}
          onSignOut={handleSignOut}
          onUpdateUser={handleUpdateUser}
        />
        {gdprBanner}
      </>
    )
  }

  if (route === 'outfit') {
    return (
      <>
        <OutfitPage
          user={user}
          onBack={() => setRoute('home')}
          onSignOut={handleSignOut}
          onOpenCart={() => setRoute('cart')}
        />
        {gdprBanner}
      </>
    )
  }

  if (route === 'profile') {
    return (
      <>
        <ProfilePage
          user={user}
          onBack={() => setRoute('home')}
          onSave={(updates) => { handleUpdateUser(updates); setRoute('home') }}
        />
        {gdprBanner}
      </>
    )
  }

  if (route === 'cart') {
    return (
      <>
        <CartPage onBack={() => setRoute('home')} />
        {gdprBanner}
      </>
    )
  }

  if (route === 'browse') {
    return (
      <>
        <BrowsePage
          sharedUrl={sharedUrl}
          onClearShared={() => setSharedUrl(null)}
          onBack={() => setRoute('home')}
          onGoSearch={(url) => { setRoute('search') /* handled via storage */ }}
        />
        {gdprBanner}
      </>
    )
  }

  return (
    <>
      <SearchPage
        user={user}
        onBack={() => setRoute('home')}
        onSignOut={handleSignOut}
        onUpdateUser={handleUpdateUser}
        onOpenProfile={() => setRoute('profile')}
        onOpenCart={() => setRoute('cart')}
      />
      {gdprBanner}
    </>
  )
}
