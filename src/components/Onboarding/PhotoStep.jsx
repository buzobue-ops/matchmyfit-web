import { useRef } from 'react'

export default function PhotoStep({ photoBase64, photoUploaded, onPhotoSelected }) {
  const inputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      // Strip data URL prefix → raw base64
      const base64 = reader.result.replace(/^data:image\/[^;]+;base64,/, '')
      onPhotoSelected(base64)
    }
    reader.readAsDataURL(file)

    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const hasPhoto = photoBase64 !== null

  return (
    <div className="flex flex-col items-center pt-8">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-ios-blue/10 flex items-center justify-center mb-6">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <rect x="3" y="8" width="32" height="24" rx="5" stroke="#007AFF" strokeWidth="2.5"/>
          <circle cx="19" cy="20" r="7" stroke="#007AFF" strokeWidth="2.5"/>
          <circle cx="19" cy="20" r="3" fill="#007AFF"/>
          <path d="M14 8l2-4h6l2 4" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-black mb-2 text-center">Foto corpo intero</h2>
      <p className="text-ios-gray-1 text-base text-center mb-8 max-w-[280px]">
        Carica una foto a figura intera per aiutarci a trovare il fit perfetto
      </p>

      {/* Photo preview */}
      <div className="w-full mb-4">
        {hasPhoto ? (
          <div className="relative">
            <img
              src={`data:image/jpeg;base64,${photoBase64}`}
              alt="Foto corpo"
              className="w-full max-h-80 object-contain rounded-ios-lg bg-ios-gray-5"
            />
            {/* Upload badge */}
            {photoUploaded && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5
                              bg-ios-green text-white text-xs font-semibold
                              px-3 py-1.5 rounded-full shadow-ios">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                Caricata
              </div>
            )}
            {!photoUploaded && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5
                              bg-ios-orange text-white text-xs font-semibold
                              px-3 py-1.5 rounded-full shadow-ios animate-pulse-soft">
                Caricamento…
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full h-56 rounded-ios-lg border-2 border-dashed border-ios-gray-4
                       flex flex-col items-center justify-center gap-3
                       bg-ios-gray-5/50 active:bg-ios-gray-5 transition-colors"
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 32V16M16 24l8-8 8 8" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="4" width="40" height="40" rx="12" stroke="#C7C7CC" strokeWidth="2" strokeDasharray="4 4"/>
            </svg>
            <span className="text-ios-gray-2 text-sm font-medium">Tocca per scegliere la foto</span>
          </button>
        )}
      </div>

      {/* Button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full py-3.5 rounded-ios border border-ios-blue
                   text-ios-blue font-semibold text-base
                   active:bg-ios-blue/5 transition-colors"
      >
        {hasPhoto ? 'Cambia foto' : 'Scegli foto'}
      </button>

      {/* Hidden file input – accept images only, prefer camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {photoUploaded && (
        <p className="text-ios-green text-sm text-center mt-3 font-medium">
          Foto caricata con successo! Premi "Completa profilo" per continuare.
        </p>
      )}

      <p className="text-ios-gray-2 text-xs text-center mt-3 px-6">
        Consiglio: scatta in piedi, con buona illuminazione, su sfondo neutro.
      </p>
    </div>
  )
}
