import { useState, useEffect, useCallback, useRef } from 'react'
import {
  loadSearchHistory,
  saveSearchResult,
  updateSearchResult,
  clearSearchHistory,
} from '../../services/storageService.js'
import { sendLinkStep, applyResponseToResult } from '../../services/webhookService.js'

export default function SearchPage({ user, onSignOut, onUpdateUser }) {
  const [link, setLink] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [history, setHistory] = useState([])
  const [currentSearchId, setCurrentSearchId] = useState(null)
  const [error, setError] = useState(null)
  const [showAccount, setShowAccount] = useState(false)
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

// ─── Result card ──────────────────────────────────────────────────────────

function ResultCard({ result, isActive, expanded, onToggle }) {
  const hasContent = result.responseText || result.responseImageBase64
  const isPending = result.status === 'pending'

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
            <p className="text-black text-[15px] leading-relaxed whitespace-pre-wrap mb-4">
              {result.responseText}
            </p>
          )}

          {result.responseImageBase64 && (
            <img
              src={`data:image/jpeg;base64,${result.responseImageBase64}`}
              alt="Risultato fit"
              className="w-full rounded-ios object-contain max-h-96 bg-ios-gray-5"
            />
          )}

          {!hasContent && !isPending && result.status !== 'failed' && (
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
            <img
              src={`data:image/jpeg;base64,${result.responseImageBase64}`}
              alt="Risultato"
              className="w-full rounded-ios object-contain max-h-72 bg-ios-gray-5"
            />
          )}

          {!result.responseText && !result.responseImageBase64 && (
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

function AccountSheet({ user, onClose, onSignOut }) {
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

// ─── Status dot ──────────────────────────────────────────────────────────

function StatusDot({ status, active }) {
  const color = {
    pending: active ? '#007AFF' : '#FF9500',
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
