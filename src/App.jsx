import { useState, useEffect, useCallback } from 'react'
import { loadUser, saveUser, clearUser, syncHistoryFromServer } from './services/storageService.js'
import { checkAccountAndFetchProfile } from './services/webhookService.js'
import { decodeJWT } from './services/authService.js'
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
// The iOS container app loads the WebView with:
//   ?nativeAuth=1&provider=google|apple&email=…&name=…&token=…[&id=…]
// Returns the base user object (NO onboardingComplete — determined by backend).
//
// CRITICAL — identity consistency:
//   Measurements/photo are stored in Google Sheets keyed by user.id.
//   The webapp (browser Google login) uses id = JWT `sub`. To find the same
//   profile inside the native app, the id MUST resolve to that same `sub`.
//   Resolution order:
//     1. explicit `id` param (if native passes the provider sub directly)
//     2. decode `token` (id_token JWT) → `sub`   ← matches webapp exactly
//     3. fallback: native_<normalized-email>     ← last resort, stable per email
function readNativeAuth() {
  try {
    const p = new URLSearchParams(window.location.search)
    if (p.get('nativeAuth') !== '1') return null
    const provider = p.get('provider') || 'google'
    const email    = (p.get('email') || '').trim().toLowerCase()
    const name     = p.get('name')  || ''
    const token    = p.get('token') || ''

    // Resolve a stable user id that matches the webapp's Google-sub identity
    let id = p.get('id') || null
    if (!id && token) {
      try {
        const payload = decodeJWT(token)
        if (payload?.sub) id = payload.sub
      } catch { /* token not a JWT — ignore */ }
    }
    if (!id && email) id = 'native_' + email
    if (!id) return null

    // Clean URL immediately so params don't persist on reload
    window.history.replaceState({}, '', window.location.pathname)
    return { id, email, displayName: name, authProvider: provider, token }
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

  // ─── On mount: native auth handoff OR restore existing session ───────────
  // Declared AFTER handleAuthSuccess to avoid a temporal-dead-zone reference.
  useEffect(() => {
    // 1. Native app passes user via URL params → resolve identity, check backend.
    //    handleAuthSuccess handles both cases:
    //      • NEW user → onboarding wizard (measurements, photo)
    //      • OLD user → restore profile, go straight to home
    const nativeUser = readNativeAuth()
    if (nativeUser) {
      setLoadingMsg('Verifica profilo…')
      handleAuthSuccess(nativeUser)
      return
    }

    // 2. Native logout bridge
    window.onMatchMyFitLogout = () => {
      clearUser(); setUser(null); setRoute('no-access')
    }

    // 3. Restore existing session (WebView reloaded without nativeAuth params)
    const stored = loadUser()
    if (!stored) {
      setRoute('no-access')
      return
    }
    if (stored.onboardingComplete) {
      setUser(stored)
      if (!hasConsented() && !localStorage.getItem(GDPR_KEY)) setShowGdprBanner(true)
      syncHistoryFromServer(stored.id)
      setRoute(sharedUrl ? 'browse' : 'home')
    } else {
      setUser(stored)
      setRoute('onboarding')
    }
  }, [handleAuthSuccess, sharedUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Called by OnboardingFlow when all steps complete ─────────────────
  const handleOnboardingComplete = useCallback((updatedUser) => {
    const finalUser = { ...updatedUser, onboardingComplete: true }
    saveUser(finalUser)
    setUser(finalUser)
    setRoute('home')
  }, [])

  // ─── Sign out — notify native app and clear session ─────────────────────
  const handleSignOut = useCallback(() => {
    clearUser()
    setUser(null)
    // Tell native app to handle re-login (it owns the auth layer)
    window.MatchMyFitNative?.logout?.()
    setRoute('no-access')
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

  if (route === 'no-access') {
    return <NoAccessPage />
  }

  // Legacy web login — kept as fallback for direct browser testing
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

// ─── NoAccessPage ─────────────────────────────────────────────────────────
// Shown when the webapp is opened outside the native iOS app context.
// In production, users should always arrive via the native app (nativeAuth=1).
function NoAccessPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #111111 0%, #1A1710 45%, #111111 100%)',
      padding: 32,
      gap: 24,
    }}>
      {/* FitMyCart app icon */}
      <div style={{ width: 80, height: 80, borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <svg width="80" height="80" viewBox="0 0 1024 1024" fill="none">
          <defs>
            <linearGradient id="nbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1C1C1C"/><stop offset="100%" stopColor="#0a0a0a"/></linearGradient>
            <linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#D4B896"/><stop offset="100%" stopColor="#B8926A"/></linearGradient>
          </defs>
          <rect width="1024" height="1024" fill="url(#nbg)"/>
          <path d="M136 168 L256 168 L390 620 L790 620 L856 310 L298 310" stroke="white" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="434" cy="736" r="66" stroke="white" strokeWidth="42" fill="none"/>
          <circle cx="690" cy="736" r="66" stroke="white" strokeWidth="42" fill="none"/>
          <rect x="370" y="392" width="168" height="112" rx="38" stroke="url(#ng)" strokeWidth="28" fill="none"/>
          <rect x="464" y="448" width="168" height="112" rx="38" stroke="url(#ng)" strokeWidth="28" fill="none"/>
          <rect x="452" y="436" width="68" height="68" rx="14" fill="#111111"/>
          <rect x="466" y="450" width="40" height="40" rx="8" fill="url(#ng)"/>
          <path d="M730 188 C730 162 706 142 682 158 C658 142 634 162 634 188 C634 222 682 256 682 256 C682 256 730 222 730 188Z" fill="url(#ng)"/>
        </svg>
      </div>

      {/* Wordmark */}
      <svg width="180" height="54" viewBox="0 0 180 54" fill="none">
        <text x="0" y="44" fontFamily="'Cormorant Garamond',serif" fontWeight="600" fontSize="48" fill="white" letterSpacing="-1">Fit</text>
        <text x="54" y="35" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontStyle="italic" fontSize="30" fill="#C8A882">My</text>
        <text x="88" y="44" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontSize="48" fill="white" letterSpacing="-1">Cart</text>
        <line x1="0" y1="50" x2="172" y2="50" stroke="#C8A882" strokeWidth="0.7" opacity="0.35"/>
      </svg>

      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 15, fontWeight: 300,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 1.6,
      }}>
        Disponibile tramite l&apos;app iOS.<br/>
        Apri FitMyCart per accedere.
      </p>

      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 300, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
        Alpha · Solo su invito
      </p>
    </div>
  )
}
