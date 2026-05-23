import { useState } from 'react'
import { createPortal } from 'react-dom'
import { loadSearchHistory } from '../../services/storageService.js'

const S = {
  ink:    '#111111',
  warm:   '#C8A882',
  muted:  '#8C8279',
  surface:'#FDFAF5',
  cream:  '#F5F0E8',
  border: '#E2DAD0',
  tagBg:  '#F0EAE0',
}

// ─── FitMyCart Logo SVG ────────────────────────────────────────────────────
function FitMyCartLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <svg width="148" height="30" viewBox="0 0 158 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0,2)">
          {/* cart */}
          <path d="M1 3 L5 3 L9 19 L21 19 L23 9 L7 9" stroke="#111111" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="11" cy="23" r="2" stroke="#111111" strokeWidth="1.2" fill="none"/>
          <circle cx="19" cy="23" r="2" stroke="#111111" strokeWidth="1.2" fill="none"/>
          {/* link symbol */}
          <rect x="9" y="11" width="6" height="4" rx="1.5" stroke="#C8A882" strokeWidth="1" fill="none"/>
          <rect x="12" y="13" width="6" height="4" rx="1.5" stroke="#C8A882" strokeWidth="1" fill="none"/>
          <rect x="11.5" y="12.5" width="2.5" height="2.5" rx="0.5" fill="#C8A882"/>
          {/* heart */}
          <path d="M20.5 5.5 C20.5 4.7 19.8 4 19 4.5 C18.2 4 17.5 4.7 17.5 5.5 C17.5 6.5 19 8 19 8 C19 8 20.5 6.5 20.5 5.5Z" fill="#C8A882"/>
        </g>
        <text x="32" y="26" fontFamily="'Cormorant Garamond',serif" fontWeight="600" fontSize="26" fill="#111111" letterSpacing="-0.5">Fit</text>
        <text x="74" y="20" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontStyle="italic" fontSize="18" fill="#C8A882">My</text>
        <text x="99" y="26" fontFamily="'Cormorant Garamond',serif" fontWeight="300" fontSize="26" fill="#111111" letterSpacing="-0.5">Cart</text>
        <line x1="32" y1="30" x2="158" y2="30" stroke="#C8A882" strokeWidth="0.5" opacity="0.4"/>
      </svg>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 8,
        fontWeight: 400,
        letterSpacing: '2.5px',
        textTransform: 'uppercase',
        color: '#8C8279',
        paddingLeft: 2,
      }}>
        Match · Fit · Favorite · Buy
      </div>
    </div>
  )
}

// ─── Avatar initials button ───────────────────────────────────────────────
function AvatarBtn({ user, onClick }) {
  const initials = (user?.displayName || user?.username || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <button
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'linear-gradient(135deg, #C8A882, #8B6545)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: 'white', fontWeight: 600,
        border: 'none', cursor: 'pointer', flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {initials}
    </button>
  )
}

// ─── Account sheet ────────────────────────────────────────────────────────
function AccountSheet({ user, onClose, onSignOut, onEditProfile }) {
  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#FDFAF5',
        borderRadius: '28px 28px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* handle */}
        <div style={{ width: 40, height: 4, background: '#E2DAD0', borderRadius: 2, margin: '12px auto 16px' }} />
        <div style={{ padding: '0 24px 24px' }}>
          {/* user info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C8A882, #8B6545)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'white', fontWeight: 600, flexShrink: 0,
            }}>
              {(user?.displayName || user?.username || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#111111' }}>
                {user?.displayName || user?.username}
              </div>
              <div style={{ fontSize: 13, color: '#8C8279', marginTop: 2 }}>{user?.email || ''}</div>
            </div>
          </div>

          <div style={{
            background: 'white', border: '1.5px solid #E2DAD0',
            borderRadius: 16, padding: '0 16px', marginBottom: 16,
          }}>
            <div style={{ padding: '12px 0', borderBottom: '1px solid #F0EAE0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#8C8279' }}>@{user?.username}</span>
            </div>
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#8C8279', textTransform: 'capitalize' }}>{user?.authProvider}</span>
            </div>
          </div>

          <button
            onClick={onEditProfile}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, marginBottom: 10,
              background: '#F0EAE0', border: '1.5px solid #E2DAD0',
              color: '#111111', fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✏️  Modifica profilo
          </button>

          <button
            onClick={onSignOut}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: '#FFF0F0', border: '1.5px solid #E8B4B4',
              color: '#C94040', fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Esci
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', marginTop: 8,
              background: 'transparent', border: 'none',
              color: '#8C8279', fontSize: 14, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Recent chip ──────────────────────────────────────────────────────────
function RecentChip({ result }) {
  const label = result.productName || (result.productLink ? new URL(result.productLink).hostname.replace('www.', '') : '—')
  const initials = label.slice(0, 2).toUpperCase()
  const colors = ['#111111', '#C8A882', '#8C8279', '#3d2810']
  const col = colors[label.charCodeAt(0) % colors.length]
  return (
    <div style={{
      flexShrink: 0,
      background: 'white',
      border: '1px solid #E2DAD0',
      borderRadius: 14,
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 8,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: col,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'white',
        fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.5px',
        flexShrink: 0,
      }}>{initials}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>
          {label.slice(0, 16)}{label.length > 16 ? '…' : ''}
        </div>
        <div style={{ fontSize: 10, color: '#8C8279', marginTop: 1 }}>
          {result.status === 'completed' ? 'Completato' : result.status === 'failed' ? 'Fallito' : 'Analizzato'}
        </div>
      </div>
    </div>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────
export default function HomePage({ user, onSelectSearch, onSelectOutfit, onSelectProfile, onSelectCart, onSelectBrowse, onSignOut, onUpdateUser }) {
  const [showAccount, setShowAccount] = useState(false)
  const history = loadSearchHistory().slice(0, 6)
  const cartCount = (() => { try { return JSON.parse(localStorage.getItem('mmf_cart') || '[]').length } catch { return 0 } })()

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{
        padding: '52px 24px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <FitMyCartLogo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Cart icon */}
          <button
            onClick={onSelectCart}
            style={{
              position: 'relative',
              width: 38, height: 38, borderRadius: 12,
              background: 'white', border: "1.5px solid #E2DAD0",
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/>
              <circle cx="7" cy="13" r="1"/>
              <circle cx="12" cy="13" r="1"/>
            </svg>
            {cartCount > 0 && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#C8A882', color: 'white',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Sans', sans-serif",
              }}>{cartCount > 9 ? '9+' : cartCount}</div>
            )}
          </button>
          <AvatarBtn user={user} onClick={() => setShowAccount(true)} />
        </div>
      </div>

      {/* ── Hero card ── */}
      <div style={{
        margin: '24px 24px 0',
        background: '#111111',
        borderRadius: 28,
        height: 200,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2015 50%, #3d2810 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(200,168,130,0.08) 40px),
                            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(200,168,130,0.08) 40px)`,
        }} />
        {/* content */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: 28, height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(200,168,130,0.15)',
            border: '1px solid rgba(200,168,130,0.3)',
            padding: '4px 12px', borderRadius: 100,
            fontSize: 11, color: '#C8A882', fontWeight: 500,
            letterSpacing: 1, textTransform: 'uppercase',
            width: 'fit-content',
          }}>
            ✦  AI Stylist
          </div>
          <div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 32, fontWeight: 700,
              color: 'white', lineHeight: 1.1,
            }}>
              Fit.<br /><em style={{ color: '#C8A882', fontStyle: 'italic' }}>Match. Buy.</em>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, letterSpacing: 0.3 }}>
              Il tuo stylist AI personale
            </div>
          </div>
        </div>
      </div>

      {/* ── Mode label ── */}
      <div style={{
        padding: '24px 24px 12px',
        fontSize: 11, fontWeight: 600,
        letterSpacing: 2, textTransform: 'uppercase',
        color: '#8C8279',
      }}>
        Come vuoi iniziare?
      </div>

      {/* ── Mode cards ── */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* SINGOLO CAPO — primary */}
        <button
          onClick={onSelectSearch}
          style={{
            borderRadius: 24, background: '#111111',
            overflow: 'hidden', cursor: 'pointer',
            border: 'none', textAlign: 'left', width: '100%',
            transition: 'transform 0.18s ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C8A882', marginBottom: 6 }}>
                Modalità 01
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: 'white', lineHeight: 1.15 }}>
                Singolo<br />Capo
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 1.5 }}>
                Incolla un link e scopri fit, taglia e stile.
              </div>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(200,168,130,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A882" strokeWidth="1.5" strokeLinecap="round">
                <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H5v10a1 1 0 001 1h12a1 1 0 001-1V10h1.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
              </svg>
            </div>
          </div>
          <div style={{
            position: 'relative',
            height: 0,
          }}>
            <div style={{
              position: 'absolute', right: 20, bottom: 20,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14,
            }}>→</div>
          </div>
        </button>

        {/* CERCA & AGGIUNGI — tertiary */}
        <button
          onClick={onSelectBrowse}
          style={{
            borderRadius: 24, background: S.tagBg,
            border: `1.5px solid ${S.border}`,
            overflow: 'hidden', cursor: 'pointer',
            textAlign: 'left', width: '100%',
            transition: 'transform 0.18s ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: S.muted, marginBottom: 4 }}>
                Modalità 03
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: S.ink, lineHeight: 1.15 }}>
                Cerca &amp; Aggiungi
              </div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 6, lineHeight: 1.5 }}>
                Naviga sul web e salva i link preferiti.
              </div>
            </div>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(17,17,17,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
            }}>🌐</div>
          </div>
        </button>

        {/* CUSTOM OUTFIT — secondary */}
        <button
          onClick={onSelectOutfit}
          style={{
            borderRadius: 24, background: 'white',
            border: '1.5px solid #E2DAD0',
            overflow: 'hidden', cursor: 'pointer',
            textAlign: 'left', width: '100%',
            transition: 'transform 0.18s ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8C8279', marginBottom: 6 }}>
                Modalità 02
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: '#111111', lineHeight: 1.15 }}>
                Custom<br />Outfit
              </div>
              <div style={{ fontSize: 12, color: '#8C8279', marginTop: 8, lineHeight: 1.5 }}>
                Componi un look completo sulla tua figura.
              </div>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: '#F0EAE0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, flexShrink: 0,
            }}>
              🪡
            </div>
          </div>
          <div style={{ position: 'relative', height: 0 }}>
            <div style={{
              position: 'absolute', right: 20, bottom: 20,
              width: 28, height: 28, borderRadius: '50%',
              background: '#111111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14,
            }}>→</div>
          </div>
        </button>
      </div>

      {/* ── Recent ── */}
      {history.length > 0 && (
        <div style={{ padding: '28px 24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111111' }}>Recenti</div>
            <button
              onClick={onSelectSearch}
              style={{ fontSize: 12, color: '#C8A882', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Vedi tutti
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {history.map(r => <RecentChip key={r.id} result={r} />)}
          </div>
        </div>
      )}

      {/* ── Account sheet ── */}
      {showAccount && (
        <AccountSheet
          user={user}
          onClose={() => setShowAccount(false)}
          onSignOut={onSignOut}
          onEditProfile={() => { setShowAccount(false); onSelectProfile?.() }}
        />
      )}
    </div>
  )
}
