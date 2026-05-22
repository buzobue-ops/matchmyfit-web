import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  loadSearchHistory,
  saveSearchResult,
  updateSearchResult,
  clearSearchHistory,
} from '../../services/storageService.js'
import { sendLinkStep, applyResponseToResult, sendProfileUpdate } from '../../services/webhookService.js'

export default function SearchPage({ user, onSignOut, onUpdateUser }) {
  const [link, setLink] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [history, setHistory] = useState([])
  const [currentSearchId, setCurrentSearchId] = useState(null)
  const [error, setError] = useState(null)
  const [showAccount, setShowAccount] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const inputRef = useRef(null)

  const refresh = useCallback(() => {
    setHistory(loadSearchHistory().sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    ))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ─── Perform search ──────────────────────────────────────────────────
  async function performSearch() {
    const trimmed = link.trim()
    if (!trimmed || isSearching) return

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

  function handleKeyDown(e) {
    if (e.key === 'Enter') performSearch()
  }

  const latest = history[0] || null

  return (
    <div className="min-h-screen bg-ios-bg flex flex-col">
      {/* ── Nav bar ── */}
      <div className="ios-navbar px-4 safe-top z-40">
        <div
          className="flex items-center justify-between"
          style={{ height: 44 }}
        >
          <span className="text-[17px] font-semibold text-black">MatchMyFit</span>
          <button
            onClick={() => setShowAccount(a => !a)}
            className="w-8 h-8 rounded-full bg-ios-blue flex items-center justify-center
                       text-white text-sm font-bold active:opacity-70 transition-opacity"
          >
            {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
          </button>
        </div>
      </div>

      {/* ── Account sheet ── */}
      {showAccount && (
        <AccountSheet
          user={user}
          onClose={() => setShowAccount(false)}
          onSignOut={onSignOut}
          onEditProfile={() => { setShowAccount(false); setShowProfileEdit(true) }}
        />
      )}

      {/* ── Profile edit sheet ── */}
      {showProfileEdit && (
        <ProfileEditSheet
          user={user}
          onClose={() => setShowProfileEdit(false)}
          onSave={(updates) => { onUpdateUser(updates); setShowProfileEdit(false) }}
        />
      )}

      {/* ── Main content ── */}
      <div
        className="flex-1 overflow-y-auto px-4"
        style={{ paddingTop: 'calc(44px + env(safe-area-inset-top) + 16px)' }}
      >
        {/* Large title */}
        <h1 className="ios-large-title mb-1">Cerca</h1>
        <p className="text-ios-gray-1 text-base mb-5">
          Incolla il link di un capo per trovare la tua taglia
        </p>

        {/* Search input card */}
        <div className="ios-card px-4 py-3 flex items-center gap-3 mb-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#8E8E93" strokeWidth="1.8"/>
            <path d="M13 13l3 3" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-base text-black
                       placeholder-ios-gray-2 min-w-0"
            type="url"
            inputMode="url"
            placeholder="Incolla link prodotto…"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={handleKeyDown}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {link.length > 0 && (
            <button onClick={() => setLink('')} className="text-ios-gray-3">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <circle cx="9" cy="9" r="9" fill="#C7C7CC"/>
                <path d="M6 6l6 6M12 6l-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={performSearch}
          disabled={!link.trim() || isSearching}
          className="ios-btn-primary mb-5"
        >
          {isSearching ? (
            <span className="flex items-center justify-center gap-2">
              <div className="spinner spinner-white" />
              Analisi in corso…
            </span>
          ) : 'Analizza'}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-[#FF3B30]/10 rounded-ios p-4 mb-4 animate-fade-in">
            <p className="text-[#FF3B30] text-sm">{error}</p>
          </div>
        )}

        {/* Latest result */}
        {latest && (
          <ResultCard
            result={latest}
            isActive={latest.id === currentSearchId}
            expanded={expandedId === latest.id}
            onToggle={() => setExpandedId(id => id === latest.id ? null : latest.id)}
          />
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="mt-6 mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-semibold text-black">Ricerche recenti</h2>
              <button
                onClick={() => { clearSearchHistory(); refresh(); setExpandedId(null) }}
                className="text-ios-red text-sm font-medium"
              >
                Cancella tutto
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {history.map(result => (
                <HistoryRow
                  key={result.id}
                  result={result}
                  expanded={expandedId === result.id}
                  onToggle={() => setExpandedId(id => id === result.id ? null : result.id)}
                />
              ))}
            </div>
          </section>
        )}

        {history.length === 0 && !isSearching && (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Render via portal directly into document.body so no ancestor
  // overflow:hidden or stacking context can clip it
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)',
               display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {/* Close button */}
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

      {/* Image — rotated -90° to correct orientation, sized to fit screen */}
      <img
        src={src}
        alt="Risultato fit"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100vh',
          maxHeight: '100vw',
          objectFit: 'contain',
          transform: 'rotate(-90deg)',
        }}
      />
    </div>,
    document.body
  )
}

// ─── Result image with rotation + tap-to-expand ───────────────────────────

function ResultImage({ src }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Rotated thumbnail: landscape image → portrait display */}
      <div
        className="relative w-full rounded-ios bg-ios-gray-5 overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
        style={{ paddingTop: '133%' }}   /* 4:3 landscape → 3:4 portrait */
        onClick={() => setOpen(true)}
        title="Tocca per ingrandire"
      >
        <img
          src={src}
          alt="Risultato fit"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '133%',
            height: '100%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            objectFit: 'cover',
          }}
        />
        {/* Expand hint */}
        <div className="absolute bottom-2 right-2 bg-black/40 rounded-full p-1">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  )
}

// ─── Result card ──────────────────────────────────────────────────────────

function ResultCard({ result, isActive, expanded, onToggle }) {
  const hasContent = result.responseText || result.responseImageBase64 || result.responseImageUrl
  const isPending = result.status === 'pending'
  const isPartial = result.status === 'partial'

  return (
    <div className="ios-card overflow-hidden mb-3 animate-slide-up">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-ios-gray-5 transition-colors"
      >
        <StatusDot status={result.status} active={isActive} />
        <div className="flex-1 min-w-0">
          <p className="text-black text-[15px] font-medium truncate">
            {result.productName || shortenURL(result.productLink)}
          </p>
          <p className="text-ios-gray-1 text-xs mt-0.5">
            {formatDate(result.createdAt)}
          </p>
        </div>
        <svg
          className={`text-ios-gray-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-ios-gray-5 px-4 py-4 animate-fade-in">
          {isPending && isActive && <WaitingIndicator />}

          {isPending && !isActive && (
            <p className="text-ios-gray-1 text-sm text-center py-2">In attesa di risultati…</p>
          )}

          {result.status === 'failed' && (
            <p className="text-ios-red text-sm text-center py-2">Analisi non riuscita.</p>
          )}

          {result.responseText && (
            <div className="bg-ios-blue/5 rounded-ios p-4 mb-4">
              <p className="text-black text-[15px] leading-relaxed whitespace-pre-wrap">
                {result.responseText}
              </p>
            </div>
          )}

          {result.responseImageBase64 && (
            <ResultImage src={`data:image/jpeg;base64,${result.responseImageBase64}`} />
          )}

          {result.responseImageUrl && !result.responseImageBase64 && (
            <ResultImage src={result.responseImageUrl} />
          )}

          {isPartial && isActive && (
            <div className="flex items-center gap-2 mt-3 px-1">
              <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <p className="text-ios-gray-1 text-sm">Generazione foto in corso…</p>
            </div>
          )}

          {!hasContent && !isPending && !isPartial && result.status !== 'failed' && (
            <p className="text-ios-gray-1 text-sm text-center py-2">Nessun risultato.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── History row ─────────────────────────────────────────────────────────

function HistoryRow({ result, expanded, onToggle }) {
  return (
    <div className="ios-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-ios-gray-5 transition-colors"
      >
        <StatusDot status={result.status} />
        <div className="flex-1 min-w-0">
          <p className="text-black text-[14px] truncate">
            {result.productName || shortenURL(result.productLink)}
          </p>
          <p className="text-ios-gray-1 text-xs mt-0.5">{formatDate(result.createdAt)}</p>
        </div>
        <svg
          className={`text-ios-gray-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          width="14" height="14" viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-ios-gray-5 px-4 py-3 animate-fade-in">
          <p className="text-ios-gray-1 text-xs break-all mb-3">{result.productLink}</p>

          {result.responseText && (
            <p className="text-black text-sm leading-relaxed whitespace-pre-wrap mb-3">
              {result.responseText}
            </p>
          )}

          {result.responseImageBase64 && (
            <ResultImage src={`data:image/jpeg;base64,${result.responseImageBase64}`} />
          )}

          {result.responseImageUrl && !result.responseImageBase64 && (
            <ResultImage src={result.responseImageUrl} />
          )}

          {!result.responseText && !result.responseImageBase64 && !result.responseImageUrl && (
            <p className="text-ios-gray-1 text-sm">
              {result.status === 'failed' ? 'Analisi non riuscita.' : 'Risultati non disponibili.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Account bottom sheet ────────────────────────────────────────────────

function AccountSheet({ user, onClose, onSignOut, onEditProfile }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-ios-xl safe-bottom
                      animate-slide-up shadow-ios-lg">
        <div className="w-10 h-1 bg-ios-gray-4 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-6 pb-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-ios-blue flex items-center justify-center
                            text-white text-2xl font-bold flex-shrink-0">
              {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-black font-semibold text-[17px] truncate">
                {user.displayName || user.username}
              </p>
              <p className="text-ios-gray-1 text-sm truncate">{user.email || ''}</p>
            </div>
          </div>

          <div className="ios-section mb-4">
            <div className="ios-row">
              <svg className="mr-3" width="18" height="18" viewBox="0 0 18 18" fill="#8E8E93">
                <path d="M9 9a4 4 0 100-8 4 4 0 000 8z"/>
                <path d="M2 16a7 7 0 1114 0H2z" strokeWidth="0" fill="#8E8E93"/>
              </svg>
              <span className="text-black text-base flex-1">@{user.username}</span>
            </div>
            <div className="ios-row">
              <svg className="mr-3" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="10" rx="2" stroke="#8E8E93" strokeWidth="1.5"/>
                <path d="M4 14l5-5 5 5" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-black text-base flex-1 capitalize">{user.authProvider}</span>
            </div>
          </div>

          <button
            onClick={onEditProfile}
            className="w-full py-3.5 rounded-ios text-ios-blue font-semibold text-base
                       bg-ios-blue/10 active:bg-ios-blue/20 transition-colors mb-3"
          >
            Modifica profilo
          </button>

          <button
            onClick={onSignOut}
            className="w-full py-3.5 rounded-ios text-ios-red font-semibold text-base
                       bg-[#FF3B30]/10 active:bg-[#FF3B30]/20 transition-colors mb-2"
          >
            Esci
          </button>

          <button onClick={onClose} className="ios-btn-text mb-2">
            Chiudi
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Profile edit sheet ──────────────────────────────────────────────────

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
    reader.onload = () => {
      setPhotoBase64(reader.result.replace(/^data:image\/[^;]+;base64,/, ''))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    if (!measurements.height) {
      setError("L'altezza è obbligatoria.")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const meas = {}
      MEASURE_FIELDS.forEach(f => {
        if (measurements[f.key]) meas[f.key] = parseFloat(measurements[f.key])
      })
      await sendProfileUpdate(user.id, {
        measurements: meas,
        imageBase64: photoBase64 || undefined,
      })
      const updates = {
        height: meas.height,
        measurements: meas,
        ...(photoBase64 ? { photoBase64 } : {}),
      }
      onSave(updates)
    } catch (err) {
      setError('Salvataggio non riuscito. Riprova.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 bg-ios-bg flex flex-col animate-slide-up">
        {/* Nav */}
        <div className="flex items-center justify-between px-4 safe-top"
             style={{ height: 'calc(44px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}>
          <button onClick={onClose} className="text-ios-blue text-base font-normal py-2 pr-4">
            Annulla
          </button>
          <span className="text-[17px] font-semibold text-black">Modifica profilo</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-ios-blue text-base font-semibold py-2 pl-4 disabled:opacity-40"
          >
            {isSaving ? 'Salvo…' : 'Salva'}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">

          {/* Measurements section */}
          <h2 className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide mb-2 px-1">
            Misure
          </h2>
          <div className="ios-section mb-6">
            {MEASURE_FIELDS.map(field => (
              <div key={field.key} className="ios-row">
                <span className="text-base text-black flex-1">
                  {field.label}
                  {field.required && <span className="text-ios-red ml-1">*</span>}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    className="text-right text-base text-black outline-none w-20
                               placeholder-ios-gray-3 bg-transparent"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={measurements[field.key]}
                    onChange={e => handleMeasure(field.key, e.target.value)}
                    step="0.1"
                    min="0"
                    max="300"
                  />
                  <span className="text-ios-gray-2 text-sm w-6">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-ios-gray-2 text-xs px-1 -mt-4 mb-6">
            Solo l'altezza è obbligatoria. Le altre misure migliorano l'accuratezza del fit.
          </p>

          {/* Photo section */}
          <h2 className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide mb-2 px-1">
            Foto
          </h2>

          {/* Mirror tip */}
          <div className="flex items-start gap-2 rounded-ios px-4 py-3 mb-4"
               style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}>
            <span className="text-lg leading-tight">💡</span>
            <p className="text-ios-blue text-sm font-medium leading-snug">
              È consigliato fare una foto allo specchio a figura intera
            </p>
          </div>

          {/* Preview */}
          {photoBase64 && (
            <img
              src={`data:image/jpeg;base64,${photoBase64}`}
              alt="Nuova foto"
              className="w-full max-h-72 object-contain rounded-ios-lg bg-ios-gray-5 mb-4"
            />
          )}

          {/* Camera + Gallery buttons */}
          <div className="flex gap-3 mb-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 py-3.5 rounded-ios border border-ios-blue
                         text-ios-blue font-semibold text-base flex items-center justify-center gap-2
                         active:bg-ios-blue/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="16" height="12" rx="2.5" stroke="#007AFF" strokeWidth="1.5"/>
                <circle cx="9" cy="10" r="3" stroke="#007AFF" strokeWidth="1.5"/>
                <path d="M6 4l1.2-2h3.6L12 4" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Scatta foto
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex-1 py-3.5 rounded-ios border border-ios-blue
                         text-ios-blue font-semibold text-base flex items-center justify-center gap-2
                         active:bg-ios-blue/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2.5" stroke="#007AFF" strokeWidth="1.5"/>
                <path d="M2 12l4-4 3 3 2-2 5 5" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6.5" cy="6.5" r="1.5" fill="#007AFF"/>
              </svg>
              Galleria
            </button>
          </div>

          <p className="text-ios-gray-2 text-xs px-1 mb-2">
            {photoBase64 ? 'Nuova foto selezionata.' : 'Lascia vuoto per mantenere la foto attuale.'}
          </p>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {/* Error */}
          {error && (
            <div className="bg-[#FF3B30]/10 rounded-ios p-4 mt-4">
              <p className="text-[#FF3B30] text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Fixed save button */}
        <div className="px-4 safe-bottom pb-4 pt-3 bg-ios-bg border-t border-ios-gray-5">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ios-btn-primary disabled:opacity-40"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner spinner-white" />
                Salvataggio…
              </span>
            ) : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Status dot ──────────────────────────────────────────────────────────

function StatusDot({ status, active }) {
  const color = {
    pending: active ? '#007AFF' : '#FF9500',
    partial: active ? '#007AFF' : '#FF9500',
    completed: '#34C759',
    failed: '#FF3B30',
  }[status] || '#8E8E93'

  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        animation: active && status === 'pending' ? 'pulseSoft 1.5s ease-in-out infinite' : 'none',
      }}
    />
  )
}

// ─── Waiting animation ───────────────────────────────────────────────────

function WaitingIndicator() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-ios-blue"
            style={{ animation: `pulseSoft 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <p className="text-ios-gray-1 text-sm font-medium">
        Analisi del capo in corso…
      </p>
      <p className="text-ios-gray-2 text-xs text-center max-w-[220px]">
        Stiamo confrontando le misure con il capo scelto. Può richiedere qualche minuto.
      </p>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-20 h-20 rounded-full bg-ios-gray-5 flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="18" cy="18" r="12" stroke="#C7C7CC" strokeWidth="2.5"/>
          <path d="M27 27l7 7" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-black font-semibold text-[17px]">Nessuna ricerca</p>
      <p className="text-ios-gray-1 text-base text-center max-w-[240px]">
        Incolla il link di un prodotto per scoprire la tua taglia perfetta
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
  } catch {
    return url.slice(0, 40)
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ora'
  if (diffMin < 60) return `${diffMin} min fa`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
