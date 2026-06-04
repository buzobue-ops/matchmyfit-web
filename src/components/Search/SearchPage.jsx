import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  loadSearchHistory,
  saveSearchResult,
  updateSearchResult,
  clearSearchHistory,
  addToCart,
  isInCart,
} from '../../services/storageService.js'
import { sendLinkStep, applyResponseToResult, sendProfileUpdate } from '../../services/webhookService.js'
import { requestPermission, notifySearchComplete } from '../../services/notificationService.js'
import { AiAdviceDisclaimer } from '../Legal/LegalModals.jsx'

// ─── Inline style constants ───────────────────────────────────────────────
const S = {
  ink:    '#111111',
  warm:   '#C8A882',
  muted:  '#8C8279',
  surface:'#FDFAF5',
  cream:  '#F5F0E8',
  border: '#E2DAD0',
  tagBg:  '#F0EAE0',
  red:    '#C94040',
  green:  '#3A7A3A',
  greenBg:'#E8F5E8',
}
const serif  = "'Cormorant Garamond', serif"
const sans   = "'DM Sans', sans-serif"

// ─── Size-advice helpers (mirrors OutfitPage) ─────────────────────────────
function formatPrice(p) {
  if (p == null || isNaN(Number(p))) return null
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(p))
}

function extractSizeBadge(text) {
  if (!text) return null
  const tagged = text.match(/[Tt]aglia\s+(XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL|\d{2}(?:\/\d{2})?)\b/i)
  if (tagged) return tagged[1].toUpperCase()
  const m = text.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL|\d{2}(?:\/\d{2})?)\b(?!\s*%)/)
  return m ? m[1].toUpperCase() : null
}

// Returns { advice, badge } when responseText contains "CAPO: ..."
function parseSingleAdvice(text) {
  if (!text) return null
  const m = text.match(/CAPO\s*:\s*([\s\S]+?)$/i)
  if (!m) return null
  const advice = m[1].trim()
  const badge = extractSizeBadge(advice)
  return { advice, badge }
}

export default function SearchPage({ user, onBack, onSignOut, onUpdateUser, onOpenProfile, onOpenCart }) {
  const [link, setLink] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [history, setHistory] = useState([])
  const [currentSearchId, setCurrentSearchId] = useState(null)
  const [error, setError] = useState(null)
  const [showAccount, setShowAccount] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [cartCount, setCartCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmf_cart') || '[]').length } catch { return 0 }
  })
  const inputRef = useRef(null)

  function refreshCartCount() {
    try { setCartCount(JSON.parse(localStorage.getItem('mmf_cart') || '[]').length) } catch { /* */ }
  }

  const refresh = useCallback(() => {
    setHistory(loadSearchHistory().sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    ))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function performSearch() {
    const trimmed = link.trim()
    if (!trimmed || isSearching) return

    requestPermission()

    const searchId = crypto.randomUUID()
    setCurrentSearchId(searchId)
    setIsSearching(true)
    setError(null)

    const result = {
      id: searchId,
      productLink: trimmed,
      productName: null,
      responseText: null,
      responseImageBase64: null,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    saveSearchResult(result)
    refresh()
    setExpandedId(searchId)
    setLink('')

    try {
      await sendLinkStep(trimmed, user.id, searchId, {
        onUpdate: (updated) => {
          setHistory(prev => prev.map(r => r.id === updated.id ? updated : r))
          if (updated.status === 'completed') notifySearchComplete(updated.productName)
          setCurrentSearchId(null)
        },
      })
      refresh()
    } catch (err) {
      if (err.code === 'TIMEOUT') {
        setError('Risultato in elaborazione. Ricarica tra qualche minuto se non appare.')
      } else {
        setError(err.message || 'Ricerca non riuscita.')
        const failed = { ...result, status: 'failed' }
        updateSearchResult(failed)
        refresh()
      }
    } finally {
      setIsSearching(false)
    }
  }

  function handleKeyDown(e) { if (e.key === 'Enter') performSearch() }

  const latest = history[0] || null

  return (
    <div style={{ minHeight: '100vh', background: S.surface, fontFamily: sans }}>

      {/* ── Nav ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(253,250,245,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${S.border}`,
        padding: 'env(safe-area-inset-top) 24px 0',
      }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'white', border: `1.5px solid ${S.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
          >←</button>

          <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: S.ink }}>
            Singolo Capo
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Cart icon */}
            <button
              onClick={onOpenCart}
              style={{
                position: 'relative',
                width: 36, height: 36, borderRadius: 12,
                background: 'white', border: `1.5px solid ${S.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={S.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/>
                <circle cx="7" cy="13" r="1"/>
                <circle cx="12" cy="13" r="1"/>
              </svg>
              {cartCount > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: S.warm, color: 'white',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: sans,
                }}>{cartCount > 9 ? '9+' : cartCount}</div>
              )}
            </button>

            {/* Avatar */}
            <button
              onClick={() => setShowAccount(a => !a)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `linear-gradient(135deg, ${S.warm}, #8B6545)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              {(user.displayName || user.username || '?')[0].toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* ── Account sheet ── */}
      {showAccount && (
        <AccountSheet
          user={user}
          onClose={() => setShowAccount(false)}
          onSignOut={onSignOut}
          onEditProfile={() => { setShowAccount(false); if (onOpenProfile) onOpenProfile(); else setShowProfileEdit(true) }}
          onFeedback={() => { setShowAccount(false); setShowFeedback(true) }}
        />
      )}

      {/* ── Feedback modal ── */}
      {showFeedback && <FeedbackModal user={user} onClose={() => setShowFeedback(false)} />}

      {/* ── Lightbox ── */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* ── Profile edit ── */}
      {showProfileEdit && (
        <ProfileEditSheet
          user={user}
          onClose={() => setShowProfileEdit(false)}
          onSave={(updates) => { onUpdateUser(updates); setShowProfileEdit(false) }}
        />
      )}

      {/* ── Content ── */}
      <div style={{
        paddingTop: 'calc(52px + env(safe-area-inset-top) + 20px)',
        paddingLeft: 24, paddingRight: 24,
      }}>

        {/* Label */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: S.muted }}>
            Link prodotto
          </div>
        </div>

        {/* URL input */}
        <div style={{
          background: 'white', border: `1.5px solid ${S.border}`,
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 10,
          transition: 'border-color 0.2s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = S.warm}
          onBlurCapture={e => e.currentTarget.style.borderColor = S.border}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            placeholder="Incolla URL da Zara, H&M, ASOS…"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={handleKeyDown}
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: sans, fontSize: 13, color: S.ink,
            }}
          />
          {link.length > 0 && (
            <>
              <button
                onClick={() => setLink('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: S.muted }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
                  <circle cx="9" cy="9" r="9" fill="#E2DAD0"/>
                  <path d="M6 6l6 6M12 6l-6 6" stroke={S.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                onClick={performSearch}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: S.ink, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 14, flexShrink: 0,
                }}
              >↑</button>
            </>
          )}
        </div>

        {/* Analizza button */}
        <button
          onClick={performSearch}
          disabled={!link.trim() || isSearching}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 16,
            background: link.trim() && !isSearching ? S.ink : S.border,
            color: link.trim() && !isSearching ? 'white' : S.muted,
            fontFamily: sans, fontSize: 15, fontWeight: 600,
            border: 'none', cursor: link.trim() && !isSearching ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 16, transition: 'all 0.2s',
          }}
        >
          {isSearching ? (
            <>
              <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Analisi in corso…
            </>
          ) : 'Analizza'}
        </button>

        {/* Error */}
        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #E8B4B4', borderRadius: 14, padding: '12px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: S.red }}>{error}</p>
          </div>
        )}

        {/* Latest result */}
        {latest && (
          <ResultCard
            result={latest}
            user={user}
            isActive={latest.id === currentSearchId}
            expanded={expandedId === latest.id}
            onToggle={() => setExpandedId(id => id === latest.id ? null : latest.id)}
            onOpenLightbox={setLightboxSrc}
            onCartAdded={refreshCartCount}
          />
        )}

        {/* History */}
        {history.length > 1 && (
          <section style={{ marginTop: 24, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: S.muted }}>
                Ricerche recenti
                <span style={{ background: S.tagBg, color: S.muted, fontSize: 10, padding: '2px 8px', borderRadius: 100, marginLeft: 8 }}>
                  {history.length - 1}
                </span>
              </div>
              <button
                onClick={() => { clearSearchHistory(); refresh(); setExpandedId(null) }}
                style={{ fontSize: 12, color: S.red, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancella
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.slice(1).map(result => (
                <HistoryRow
                  key={result.id}
                  result={result}
                  user={user}
                  expanded={expandedId === result.id}
                  onToggle={() => setExpandedId(id => id === result.id ? null : result.id)}
                  onOpenLightbox={setLightboxSrc}
                  onCartAdded={refreshCartCount}
                />
              ))}
            </div>
          </section>
        )}

        {history.length === 0 && !isSearching && <EmptyState />}

        {/* Global feedback link */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 32px' }}>
          <button
            onClick={() => setShowFeedback(true)}
            style={{ fontSize: 12, color: S.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>⭐</span> Lascia un feedback su FitMyCart
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cart button ──────────────────────────────────────────────────────────

function CartBtn({ result, onAdded }) {
  const [inCart, setInCart] = useState(() => isInCart(result.productLink))
  const [flash, setFlash] = useState(false)

  function handleAdd(e) {
    e.stopPropagation()
    if (inCart) return
    const added = addToCart({
      id: result.id,
      name: result.productName || result.productLink,
      link: result.productLink,
      price: result.productPrice ?? null,
      recommendedSize: result.recommendedSize ?? null,
      source: 'search',
    })
    if (added) {
      setInCart(true)
      setFlash(true)
      setTimeout(() => setFlash(false), 1400)
      onAdded?.()
    }
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      title={inCart ? 'Già nel carrello' : 'Aggiungi al carrello'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 10,
        background: inCart ? S.tagBg : 'white',
        border: `1.5px solid ${inCart ? S.warm : S.border}`,
        color: inCart ? S.warm : S.muted,
        fontFamily: sans, fontSize: 11, fontWeight: 600,
        cursor: inCart ? 'default' : 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2h1.5l2.5 8h7l1.5-5H5"/>
        <circle cx="7" cy="13" r="1"/>
        <circle cx="12" cy="13" r="1"/>
      </svg>
      {flash ? '✓ Aggiunto' : inCart ? 'Nel carrello' : 'Carrello'}
    </button>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)',
               display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <button
        style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36,
                 borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                 border: 'none', cursor: 'pointer', display: 'flex',
                 alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <img
        src={src}
        alt="Risultato fit"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100vh', maxHeight: '100vw', objectFit: 'contain', transform: 'rotate(90deg)' }}
      />
    </div>,
    document.body
  )
}

// ─── Result image ─────────────────────────────────────────────────────────

function ResultImage({ src, onOpen }) {
  return (
    <button
      type="button"
      style={{ position: 'relative', width: '100%', borderRadius: 16, background: S.tagBg, overflow: 'hidden', paddingTop: '133%', display: 'block', border: 'none', cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onOpen(src) }}
    >
      <img
        src={src}
        alt="Risultato fit"
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '133%', height: '100%',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          objectFit: 'cover',
        }}
      />
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(17,17,17,0.5)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  )
}

// ─── Mini rating row ───────────────────────────────────────────────────────

function MiniRatingRow({ searchId, productName, userId, username }) {
  const [sent, setSent] = useState(false)
  const [hovered, setHovered] = useState(0)

  async function handleRate(rating) {
    if (sent) return
    setSent(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || '', username: username || '', rating, feedback: '', page: 'result', searchId: searchId || '', productName: productName || '' }),
      })
    } catch { /* silent */ }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
      <span style={{ fontSize: 11, color: S.muted, flex: 1 }}>
        {sent ? '✓ Grazie per il feedback!' : 'Risultato utile?'}
      </span>
      {!sent && [1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={(e) => { e.stopPropagation(); handleRate(star) }}
          style={{ fontSize: 14, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.15s', filter: hovered >= star ? 'none' : 'grayscale(1) opacity(0.35)' }}
        >⭐</button>
      ))}
    </div>
  )
}

// ─── Result card ───────────────────────────────────────────────────────────

function ResultCard({ result, user, isActive, expanded, onToggle, onOpenLightbox, onCartAdded }) {
  const hasContent = result.responseText || result.responseImageBase64 || result.responseImageUrl
  const isPending = result.status === 'pending'
  const isPartial = result.status === 'partial'
  const isCompleted = result.status === 'completed'

  return (
    <div style={{
      background: 'white', border: `1.5px solid ${S.border}`,
      borderRadius: 20, overflow: 'hidden', marginBottom: 12,
      animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <StatusDot status={result.status} active={isActive} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: S.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.productName || shortenURL(result.productLink)}
          </div>
          <div style={{ fontSize: 11, color: S.muted, marginTop: 2, letterSpacing: 0.3 }}>
            {formatDate(result.createdAt)}
          </div>
        </div>
        <svg
          style={{ color: S.muted, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          width="14" height="14" viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${S.border}`, padding: '14px 16px' }}>
          {isPending && isActive && <WaitingIndicator />}
          {isPending && !isActive && <p style={{ fontSize: 12, color: S.muted, textAlign: 'center', padding: '8px 0' }}>In attesa di risultati…</p>}
          {result.status === 'failed' && <p style={{ fontSize: 12, color: S.red, textAlign: 'center', padding: '8px 0' }}>Analisi non riuscita.</p>}

          {result.responseText && (() => {
            const parsed = parseSingleAdvice(result.responseText)
            if (parsed) {
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: S.muted, marginBottom: 6 }}>
                    Taglia consigliata
                  </div>
                  {/* Advice pill — mirrors OutfitPage SizeAdvicePill */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(200,168,130,0.08)', borderRadius: 12, borderLeft: `3px solid ${S.warm}`, marginBottom: result.productPrice ? 8 : 0 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>👔</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.warm }}>
                          Singolo Capo
                        </div>
                        {parsed.badge && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', background: S.warm, padding: '1px 8px', borderRadius: 8, letterSpacing: 0.5, flexShrink: 0 }}>
                            📏 {parsed.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: S.ink, lineHeight: 1.5 }}>{parsed.advice}</div>
                    </div>
                  </div>
                  {/* Price */}
                  {result.productPrice && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: S.tagBg, borderRadius: 10 }}>
                      <span style={{ fontSize: 12, color: S.muted }}>Prezzo</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: S.warm }}>{formatPrice(result.productPrice)}</span>
                    </div>
                  )}
                </div>
              )
            }
            // Fallback: plain text
            return (
              <div style={{ background: S.cream, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: S.muted, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{result.responseText}</p>
                {result.productPrice && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: 12, color: S.muted }}>Prezzo</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: S.warm }}>{formatPrice(result.productPrice)}</span>
                  </div>
                )}
              </div>
            )
          })()}

          {result.responseImageBase64 && (
            <ResultImage src={`data:image/jpeg;base64,${result.responseImageBase64}`} onOpen={onOpenLightbox} />
          )}
          {result.responseImageUrl && !result.responseImageBase64 && (
            <ResultImage src={result.responseImageUrl} onOpen={onOpenLightbox} />
          )}

          {isPartial && isActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: S.warm }} />
              <p style={{ fontSize: 12, color: S.muted }}>Generazione foto in corso…</p>
            </div>
          )}
          {!hasContent && !isPending && !isPartial && result.status !== 'failed' && (
            <p style={{ fontSize: 12, color: S.muted, textAlign: 'center', padding: '8px 0' }}>Nessun risultato.</p>
          )}
          {isCompleted && hasContent && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
                <CartBtn result={result} onAdded={onCartAdded} />
              </div>
              <AiAdviceDisclaimer />
              <MiniRatingRow searchId={result.id} productName={result.productName} userId={user?.id} username={user?.username} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── History row ───────────────────────────────────────────────────────────

function HistoryRow({ result, user, expanded, onToggle, onOpenLightbox, onCartAdded }) {
  const hasContent = result.responseText || result.responseImageBase64 || result.responseImageUrl
  const isCompleted = result.status === 'completed'

  return (
    <div style={{ background: 'white', border: `1px solid ${S.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <StatusDot status={result.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: S.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.productName || shortenURL(result.productLink)}
          </div>
          <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{formatDate(result.createdAt)}</div>
        </div>
        {result.status === 'completed' && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: S.greenBg, color: S.green, flexShrink: 0 }}>
            Completato
          </span>
        )}
        <svg
          style={{ color: S.muted, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          width="12" height="12" viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${S.border}`, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, color: S.muted, wordBreak: 'break-all', marginBottom: 10 }}>{result.productLink}</p>
          {result.responseText && (
            <p style={{ fontSize: 13, color: S.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
              {result.responseText}
            </p>
          )}
          {result.responseImageBase64 && (
            <ResultImage src={`data:image/jpeg;base64,${result.responseImageBase64}`} onOpen={onOpenLightbox} />
          )}
          {result.responseImageUrl && !result.responseImageBase64 && (
            <ResultImage src={result.responseImageUrl} onOpen={onOpenLightbox} />
          )}
          {!hasContent && (
            <p style={{ fontSize: 12, color: S.muted }}>
              {result.status === 'failed' ? 'Analisi non riuscita.' : 'Risultati non disponibili.'}
            </p>
          )}
          {isCompleted && hasContent && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
                <CartBtn result={result} onAdded={onCartAdded} />
              </div>
              <AiAdviceDisclaimer />
              <MiniRatingRow searchId={result.id} productName={result.productName} userId={user?.id} username={user?.username} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Account sheet ─────────────────────────────────────────────────────────

function AccountSheet({ user, onClose, onSignOut, onEditProfile, onFeedback }) {
  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: S.surface, borderRadius: '28px 28px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 40, height: 4, background: S.border, borderRadius: 2, margin: '12px auto 16px' }} />
        <div style={{ padding: '0 24px 24px' }}>
          {/* user info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `linear-gradient(135deg, ${S.warm}, #8B6545)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'white', fontWeight: 600, flexShrink: 0,
            }}>
              {(user.displayName || user.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: S.ink }}>{user.displayName || user.username}</div>
              <div style={{ fontSize: 13, color: S.muted, marginTop: 2 }}>{user.email || ''}</div>
            </div>
          </div>

          <div style={{ background: 'white', border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '0 16px', marginBottom: 14 }}>
            <div style={{ padding: '12px 0', borderBottom: `1px solid ${S.tagBg}` }}>
              <span style={{ fontSize: 13, color: S.muted }}>@{user.username}</span>
            </div>
            <div style={{ padding: '12px 0' }}>
              <span style={{ fontSize: 13, color: S.muted, textTransform: 'capitalize' }}>{user.authProvider}</span>
            </div>
          </div>

          <button
            onClick={onEditProfile}
            style={{
              width: '100%', padding: 14, borderRadius: 14, marginBottom: 10,
              background: S.tagBg, border: `1.5px solid ${S.border}`,
              color: S.ink, fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >Modifica profilo</button>

          <button
            onClick={onFeedback}
            style={{
              width: '100%', padding: 14, borderRadius: 14, marginBottom: 10,
              background: '#F0FBF0', border: '1.5px solid #C8E6C8',
              color: S.green, fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >⭐ Lascia un feedback</button>

          <button
            onClick={onSignOut}
            style={{
              width: '100%', padding: 14, borderRadius: 14, marginBottom: 8,
              background: '#FFF0F0', border: '1.5px solid #E8B4B4',
              color: S.red, fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >Esci</button>

          <button onClick={onClose} style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: S.muted, fontSize: 14, cursor: 'pointer', fontFamily: sans }}>
            Chiudi
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Feedback modal ─────────────────────────────────────────────────────────

function FeedbackModal({ user, onClose }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (rating === 0) { setError('Seleziona almeno una stella.'); return }
    setIsSending(true); setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: user.username || '', rating, feedback: text.trim(), page: 'search' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSent(true)
    } catch (err) {
      setError('Invio non riuscito. Riprova.')
    } finally { setIsSending(false) }
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: S.surface, borderRadius: '28px 28px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 40, height: 4, background: S.border, borderRadius: 2, margin: '12px auto 16px' }} />
        <div style={{ padding: '0 24px 24px' }}>
          {sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <span style={{ fontSize: 48 }}>🎉</span>
              <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: S.ink }}>Grazie per il feedback!</p>
              <p style={{ fontSize: 13, color: S.muted, textAlign: 'center' }}>Il tuo commento ci aiuta a migliorare FitMyCart.</p>
              <button onClick={onClose} style={{ marginTop: 8, width: '100%', padding: 14, borderRadius: 14, background: S.ink, color: 'white', fontFamily: sans, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Chiudi</button>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: S.ink, marginBottom: 4 }}>La tua esperienza</p>
              <p style={{ fontSize: 13, color: S.muted, marginBottom: 20 }}>Raccontaci com'è andata con FitMyCart</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star}
                    onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(star)}
                    style={{ fontSize: 36, background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.1s', filter: (hovered || rating) >= star ? 'none' : 'grayscale(1) opacity(0.35)' }}>⭐</button>
                ))}
              </div>
              <textarea
                style={{ width: '100%', borderRadius: 14, background: S.tagBg, border: `1.5px solid ${S.border}`, padding: '12px 14px', fontFamily: sans, fontSize: 13, color: S.ink, outline: 'none', resize: 'none', lineHeight: 1.6, marginBottom: 12, boxSizing: 'border-box' }}
                rows={4} placeholder="Scrivi la tua esperienza (opzionale)…"
                value={text} onChange={e => setText(e.target.value)} maxLength={500}
              />
              {error && <p style={{ fontSize: 12, color: S.red, marginBottom: 10 }}>{error}</p>}
              <button onClick={handleSubmit} disabled={isSending}
                style={{ width: '100%', padding: 14, borderRadius: 14, background: S.ink, color: 'white', fontFamily: sans, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: isSending ? 0.5 : 1, marginBottom: 8 }}>
                {isSending ? 'Invio…' : 'Invia feedback'}
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: 12, background: 'transparent', border: 'none', color: S.muted, fontSize: 14, cursor: 'pointer', fontFamily: sans }}>
                Annulla
              </button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Profile edit ────────────────────────────────────────────────────────

const MEASURE_FIELDS = [
  { key: 'height',    label: 'Altezza',  unit: 'cm', required: true },
  { key: 'chest',     label: 'Petto',    unit: 'cm' },
  { key: 'waist',     label: 'Vita',     unit: 'cm' },
  { key: 'hips',      label: 'Fianchi',  unit: 'cm' },
  { key: 'shoulders', label: 'Spalle',   unit: 'cm' },
  { key: 'inseam',    label: 'Cavallo',  unit: 'cm' },
]

function ProfileEditSheet({ user, onClose, onSave }) {
  const m = user.measurements || user.bodySizes || {}
  const [measurements, setMeasurements] = useState({
    height:    String(user.height    || m.height    || ''),
    chest:     String(user.chest     || m.chest     || ''),
    waist:     String(user.waist     || m.waist     || ''),
    hips:      String(user.hips      || m.hips      || ''),
    shoulders: String(user.shoulders || m.shoulders || ''),
    inseam:    String(user.inseam    || m.inseam    || ''),
  })
  const [photoBase64, setPhotoBase64] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  function handleMeasure(key, val) {
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return
    setMeasurements(prev => ({ ...prev, [key]: val }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoBase64(reader.result.replace(/^data:image\/[^;]+;base64,/, ''))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    if (!measurements.height) { setError("L'altezza è obbligatoria."); return }
    setIsSaving(true); setError(null)
    try {
      const meas = {}
      MEASURE_FIELDS.forEach(f => { if (measurements[f.key]) meas[f.key] = parseFloat(measurements[f.key]) })
      await sendProfileUpdate(user.id, { measurements: meas, imageBase64: photoBase64 || undefined })
      onSave({ height: meas.height, measurements: meas, ...(photoBase64 ? { photoBase64 } : {}) })
    } catch {
      setError('Salvataggio non riuscito. Riprova.')
    } finally { setIsSaving(false) }
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: S.surface, display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `calc(env(safe-area-inset-top) + 12px) 20px 12px`,
          borderBottom: `1px solid ${S.border}`,
        }}>
          <button onClick={onClose} style={{ color: S.warm, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: sans }}>Annulla</button>
          <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, color: S.ink }}>Modifica profilo</span>
          <button onClick={handleSave} disabled={isSaving} style={{ color: S.warm, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: sans, opacity: isSaving ? 0.4 : 1 }}>
            {isSaving ? 'Salvo…' : 'Salva'}
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>Misure</div>
          <div style={{ background: 'white', border: `1.5px solid ${S.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            {MEASURE_FIELDS.map((field, i) => (
              <div key={field.key} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                borderBottom: i < MEASURE_FIELDS.length - 1 ? `1px solid ${S.tagBg}` : 'none',
              }}>
                <span style={{ flex: 1, fontSize: 14, color: S.ink }}>
                  {field.label}{field.required && <span style={{ color: S.red }}> *</span>}
                </span>
                <input
                  type="number" inputMode="decimal" placeholder="0"
                  value={measurements[field.key]}
                  onChange={e => handleMeasure(field.key, e.target.value)}
                  style={{ textAlign: 'right', fontSize: 14, color: S.ink, background: 'transparent', border: 'none', outline: 'none', width: 60, fontFamily: sans }}
                />
                <span style={{ fontSize: 12, color: S.muted, width: 24 }}>{field.unit}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: S.muted, marginBottom: 10 }}>Foto</div>
          <div style={{ display: 'flex', alignItems: 'start', gap: 8, background: 'rgba(200,168,130,0.1)', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <p style={{ fontSize: 13, color: S.warm, fontWeight: 500, lineHeight: 1.4 }}>Foto allo specchio a figura intera consigliata</p>
          </div>
          {photoBase64 && <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Preview" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 14, background: S.tagBg, marginBottom: 14 }} />}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {[{ ref: cameraRef, capture: 'environment', label: '📷 Scatta' }, { ref: galleryRef, capture: undefined, label: '🖼 Galleria' }].map(btn => (
              <button key={btn.label} onClick={() => btn.ref.current?.click()}
                style={{ flex: 1, padding: '12px 8px', borderRadius: 14, border: `1.5px solid ${S.warm}`, background: 'white', color: S.warm, fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {btn.label}
              </button>
            ))}
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
          <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          {error && <div style={{ background: '#FFF0F0', border: '1px solid #E8B4B4', borderRadius: 14, padding: '12px 14px', marginTop: 10 }}><p style={{ fontSize: 13, color: S.red }}>{error}</p></div>}
        </div>
        {/* Save btn */}
        <div style={{ padding: '12px 24px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', borderTop: `1px solid ${S.border}`, background: S.surface }}>
          <button onClick={handleSave} disabled={isSaving}
            style={{ width: '100%', padding: 14, borderRadius: 16, background: S.ink, color: 'white', fontFamily: sans, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: isSaving ? 0.4 : 1 }}>
            {isSaving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────

function StatusDot({ status, active }) {
  const color = {
    pending:   active ? S.warm   : '#F0C070',
    partial:   active ? S.warm   : '#F0C070',
    completed: '#3A7A3A',
    failed:    S.red,
  }[status] || S.muted

  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      backgroundColor: color,
      animation: active && status === 'pending' ? 'pulseSoft 1.5s ease-in-out infinite' : 'none',
    }} />
  )
}

// ─── Waiting indicator ────────────────────────────────────────────────────

function WaitingIndicator() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    // After ~45s switch to photo-generation message
    const t = setTimeout(() => setPhase(1), 45000)
    return () => clearTimeout(t)
  }, [])

  const phases = [
    {
      label: 'Sto analizzando il capo e le tue misure…',
      sub: 'Confrontiamo le misure con il capo scelto.',
    },
    {
      label: 'Sto preparando la foto try-on…',
      sub: 'Generiamo la foto con il capo indossato su di te.',
    },
  ]
  const { label, sub } = phases[phase]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: S.warm, animation: `pulseSoft 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: S.muted, fontWeight: 500, textAlign: 'center', maxWidth: 260 }}>{label}</p>
      <p style={{ fontSize: 11, color: S.muted, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
        {sub} Può richiedere qualche minuto.
      </p>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 14 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: S.tagBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={S.border} strokeWidth="1.5" strokeLinecap="round">
          <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H5v10a1 1 0 001 1h12a1 1 0 001-1V10h1.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
        </svg>
      </div>
      <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: S.ink }}>Nessuna ricerca</p>
      <p style={{ fontSize: 14, color: S.muted, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
        Incolla il link di un capo per scoprire la tua taglia perfetta
      </p>
    </div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────

function shortenURL(url) {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace('www.', '')
    const path = pathname.split('/').filter(Boolean).slice(-1)[0] || ''
    return path ? `${host}/…/${path}` : host
  } catch { return url.slice(0, 40) }
}

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 1)  return 'Ora'
  if (diffMin < 60) return `${diffMin} min fa`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
