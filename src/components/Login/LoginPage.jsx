import { useEffect, useRef, useState } from 'react'
import { initGoogleSignIn, renderGoogleButton, signInWithApple } from '../../services/authService.js'
import { GOOGLE_CLIENT_ID } from '../../config.js'

export default function LoginPage({ onAuthSuccess }) {
  const [error, setError] = useState(null)
  const [appleLoading, setAppleLoading] = useState(false)
  const googleBtnRef = useRef(null)
  const googleReady = useRef(false)

  // ─── Init Google Sign In ────────────────────────────────────────────
  useEffect(() => {
    function tryInit() {
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 300)
        return
      }
      if (googleReady.current) return
      googleReady.current = true

      initGoogleSignIn((user) => {
        setError(null)
        onAuthSuccess(user)
      })

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'it',
        })
      }
    }
    tryInit()
  }, [onAuthSuccess])

  // ─── Apple Sign In ──────────────────────────────────────────────────
  async function handleApple() {
    setAppleLoading(true)
    setError(null)
    try {
      // Attempt to load Apple ID SDK if not yet available (e.g., in PWA/offline)
      if (!window.AppleID?.auth) {
        await new Promise((resolve, reject) => {
          if (window.AppleID?.auth) return resolve()
          const script = document.createElement('script')
          script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Apple SDK not available'))
          document.head.appendChild(script)
          setTimeout(() => reject(new Error('Apple SDK timeout')), 5000)
        })
      }
      const user = await signInWithApple()
      onAuthSuccess(user)
    } catch (e) {
      if (e.error === 'popup_closed_by_user' || e.error === 'user_cancelled_authorize') {
        // user cancelled – ignore silently
      } else if (e.message?.includes('not available') || e.message?.includes('timeout')) {
        setError('Accesso con Apple non disponibile in questo browser. Usa Google oppure apri l\'app in Safari.')
      } else {
        setError(e.message || 'Accesso Apple non riuscito. Riprova.')
      }
    } finally {
      setAppleLoading(false)
    }
  }

  const isConfigured = !GOOGLE_CLIENT_ID.startsWith('YOUR_')

  return (
    <div className="min-h-screen flex flex-col bg-black overflow-hidden">
      {/* ── Hero gradient ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe-top relative">
        {/* Background — on-brand dark warm */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(160deg, #111111 0%, #1A1710 45%, #111111 100%)',
          }}
        />
        {/* Subtle texture grid (brand touch) */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.03 }}>
          <svg width="100%" height="100%"><defs><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0M0 80V0" stroke="#C8A882" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
        </div>

        {/* ── FitMyCart Brand ── */}
        <div className="relative z-10 flex flex-col items-center mb-12">

          {/* App icon — FitMyCart iOS master */}
          <div style={{ width: 88, height: 88, borderRadius: 20, overflow: 'hidden', marginBottom: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 4px 20px rgba(200,168,130,0.15)' }}>
            <svg width="88" height="88" viewBox="0 0 1024 1024" fill="none">
              <defs>
                <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1C1C1C"/>
                  <stop offset="100%" stopColor="#0a0a0a"/>
                </linearGradient>
                <linearGradient id="lgold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#D4B896"/>
                  <stop offset="100%" stopColor="#B8926A"/>
                </linearGradient>
              </defs>
              <rect width="1024" height="1024" fill="url(#lbg)"/>
              {/* subtle grid */}
              <g opacity="0.05" stroke="#C8A882" strokeWidth="1.5">
                <line x1="0" y1="256" x2="1024" y2="256"/><line x1="0" y1="512" x2="1024" y2="512"/>
                <line x1="0" y1="768" x2="1024" y2="768"/><line x1="256" y1="0" x2="256" y2="1024"/>
                <line x1="512" y1="0" x2="512" y2="1024"/><line x1="768" y1="0" x2="768" y2="1024"/>
              </g>
              {/* Cart outline */}
              <path d="M136 168 L256 168 L390 620 L790 620 L856 310 L298 310" stroke="white" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              {/* Wheels */}
              <circle cx="434" cy="736" r="66" stroke="white" strokeWidth="42" fill="none"/>
              <circle cx="690" cy="736" r="66" stroke="white" strokeWidth="42" fill="none"/>
              {/* Link / fitting icon (gold) */}
              <rect x="370" y="392" width="168" height="112" rx="38" stroke="url(#lgold)" strokeWidth="28" fill="none"/>
              <rect x="464" y="448" width="168" height="112" rx="38" stroke="url(#lgold)" strokeWidth="28" fill="none"/>
              <rect x="452" y="436" width="68" height="68" rx="14" fill="#111111"/>
              <rect x="466" y="450" width="40" height="40" rx="8" fill="url(#lgold)"/>
              {/* Heart */}
              <path d="M730 188 C730 162 706 142 682 158 C658 142 634 162 634 188 C634 222 682 256 682 256 C682 256 730 222 730 188Z" fill="url(#lgold)"/>
              {/* Top gloss */}
              <rect width="1024" height="380" fill="white" opacity="0.018"/>
            </svg>
          </div>

          {/* Wordmark — Cormorant Garamond (already loaded) */}
          <svg width="210" height="60" viewBox="0 0 210 60" fill="none" style={{ marginBottom: 8 }}>
            <text x="0" y="50" fontFamily="'Cormorant Garamond',serif" fontWeight="600" fontSize="56" fill="white" letterSpacing="-1">Fit</text>
            <text x="62" y="40" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontStyle="italic" fontSize="34" fill="#C8A882">My</text>
            <text x="103" y="50" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontSize="56" fill="white" letterSpacing="-1">Cart</text>
            <line x1="0" y1="57" x2="200" y2="57" stroke="#C8A882" strokeWidth="0.7" opacity="0.35"/>
          </svg>

          {/* Tagline */}
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 300, letterSpacing: '4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
            Match. Fit. Favorite. Buy.
          </p>
        </div>

        {/* Auth card */}
        <div className="relative z-10 w-full max-w-sm">
          <div
            className="rounded-ios-xl overflow-hidden"
            style={{
              background: 'rgba(28,28,30,0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="px-6 pt-6 pb-8 flex flex-col gap-4">
              <p className="text-white/60 text-sm text-center">
                Continua con
              </p>

              {/* Google button */}
              {isConfigured ? (
                <div ref={googleBtnRef} id="google-signin-btn" className="w-full min-h-[46px]" />
              ) : (
                <div className="w-full py-3.5 px-4 rounded-ios flex items-center gap-3 bg-white text-black font-medium text-sm opacity-50">
                  <GoogleIcon />
                  <span>Configura GOOGLE_CLIENT_ID</span>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs">oppure</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Apple button */}
              <button
                onClick={handleApple}
                disabled={appleLoading}
                className="w-full py-3.5 px-4 rounded-ios flex items-center justify-center gap-3
                           bg-white text-black font-semibold text-base
                           active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {appleLoading ? (
                  <div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} />
                ) : (
                  <AppleIcon />
                )}
                {!appleLoading && <span>Continua con Apple</span>}
              </button>

              {/* Error */}
              {error && (
                <p className="text-[#FF453A] text-sm text-center px-2 animate-fade-in">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Legal */}
          <p className="text-white/25 text-xs text-center mt-5 px-4">
            Continuando accetti i nostri Termini di Servizio e la Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" fill="black">
      <path d="M13.769 10.689c-.023-2.572 2.1-3.81 2.193-3.872-1.194-1.745-3.05-1.983-3.709-2.009-1.574-.16-3.08.928-3.878.928-.797 0-2.026-.906-3.334-.881-1.715.025-3.302 1.001-4.18 2.54-1.785 3.09-.457 7.672 1.281 10.183.852 1.227 1.867 2.603 3.2 2.553 1.29-.052 1.775-.828 3.334-.828 1.559 0 2.001.828 3.358.8 1.38-.024 2.255-1.253 3.1-2.483.979-1.42 1.38-2.797 1.404-2.867-.031-.013-2.68-1.027-2.706-3.964l.037.9z"/>
      <path d="M11.309 3.046c.704-.857 1.181-2.039 1.049-3.22-.015.005-2.609.043-3.491 1.018-.766.893-1.395 2.07-1.22 3.224 1.358.105 2.741-.69 3.662-1.022z"/>
    </svg>
  )
}
