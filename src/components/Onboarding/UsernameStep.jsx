export default function UsernameStep({ username, onChange }) {
  return (
    <div className="flex flex-col items-center pt-8">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-ios-blue/10 flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M20 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z" fill="#007AFF"/>
          <path d="M4 34c0-6.627 7.163-12 16-12s16 5.373 16 12" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-black mb-2 text-center">Scegli il tuo username</h2>
      <p className="text-ios-gray-1 text-base text-center mb-8 max-w-[280px]">
        Sarà il tuo identificatore unico su MatchMyFit
      </p>

      {/* Form */}
      <div className="w-full ios-section">
        <div className="ios-row">
          <svg className="mr-3 flex-shrink-0" width="20" height="20" viewBox="0 0 20 20" fill="#8E8E93">
            <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z"/>
          </svg>
          <input
            className="ios-input"
            type="text"
            placeholder="username"
            value={username}
            onChange={e => onChange(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            maxLength={30}
          />
          {username.length > 0 && (
            <button
              onClick={() => onChange('')}
              className="ml-2 text-ios-gray-3 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path fillRule="evenodd" d="M9 18A9 9 0 109 0a9 9 0 000 18zm-3-6a1 1 0 011.414 0L9 13.586l1.586-1.586a1 1 0 111.414 1.414L10.414 15l1.586 1.586a1 1 0 01-1.414 1.414L9 16.414l-1.586 1.586a1 1 0 01-1.414-1.414L7.586 15 6 13.414A1 1 0 019 12z" clipRule="evenodd"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-ios-gray-2 text-xs mt-3">
        Solo lettere, numeri e underscore. Max 30 caratteri.
      </p>
    </div>
  )
}
