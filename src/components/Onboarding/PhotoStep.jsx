import { useRef } from 'react'
import { ImageDisclaimerBox } from '../Legal/LegalModals.jsx'

// Reads EXIF orientation from raw base64 JPEG and returns the orientation value (1-8).
function readExifOrientation(base64) {
  try {
    const bin = atob(base64.slice(0, 65536)) // only need first 64 KB for EXIF
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1 // not JPEG
    let i = 2
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xFF) break
      const marker = bytes[i + 1]
      const len = (bytes[i + 2] << 8) | bytes[i + 3]
      if (marker === 0xE1) { // APP1 = EXIF
        if (String.fromCharCode(bytes[i+4], bytes[i+5], bytes[i+6], bytes[i+7]) !== 'Exif') break
        const tiff = i + 10
        const le = bytes[tiff] === 0x49
        const r16 = (o) => le ? bytes[tiff+o] | (bytes[tiff+o+1] << 8) : (bytes[tiff+o] << 8) | bytes[tiff+o+1]
        const r32 = (o) => le
          ? bytes[tiff+o] | (bytes[tiff+o+1]<<8) | (bytes[tiff+o+2]<<16) | (bytes[tiff+o+3]<<24)
          : (bytes[tiff+o]<<24) | (bytes[tiff+o+1]<<16) | (bytes[tiff+o+2]<<8) | bytes[tiff+o+3]
        const ifd = r32(4)
        const count = r16(ifd)
        for (let j = 0; j < count; j++) {
          const e = ifd + 2 + j * 12
          if (r16(e) === 0x0112) return r16(e + 8)
        }
      }
      i += 2 + len
    }
  } catch { /* ignore */ }
  return 1
}

// Draws the image on a canvas with EXIF rotation corrected, returns corrected base64.
async function autoOrientBase64(base64) {
  const orientation = readExifOrientation(base64)
  if (orientation === 1) return base64 // no rotation needed

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (orientation > 4) { canvas.width = h; canvas.height = w }
      else                  { canvas.width = w; canvas.height = h }
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0,  1,  w, 0); break
        case 3: ctx.transform(-1, 0, 0, -1,  w, h); break
        case 4: ctx.transform( 1, 0, 0, -1,  0, h); break
        case 5: ctx.transform( 0, 1, 1,  0,  0, 0); break
        case 6: ctx.transform( 0, 1,-1,  0,  h, 0); break
        case 7: ctx.transform( 0,-1,-1,  0,  h, w); break
        case 8: ctx.transform( 0,-1, 1,  0,  0, w); break
        default: break
      }
      ctx.drawImage(img, 0, 0)
      const result = canvas.toDataURL('image/jpeg', 0.88).replace(/^data:image\/jpeg;base64,/, '')
      resolve(result)
    }
    img.onerror = () => resolve(base64)
    img.src = `data:image/jpeg;base64,${base64}`
  })
}

export default function PhotoStep({ photoBase64, photoUploaded, onPhotoSelected }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const raw = reader.result.replace(/^data:image\/[^;]+;base64,/, '')
      const corrected = await autoOrientBase64(raw)
      onPhotoSelected(corrected)
    }
    reader.readAsDataURL(file)
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
      <p className="text-ios-gray-1 text-base text-center mb-3 max-w-[280px]">
        Carica una foto a figura intera per aiutarci a trovare il fit perfetto
      </p>

      {/* Mirror tip */}
      <div className="flex items-start gap-2 rounded-ios px-4 py-3 mb-4 w-full"
           style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}>
        <span className="text-lg leading-tight">💡</span>
        <p className="text-ios-blue text-sm font-medium leading-snug">
          È consigliato fare una foto allo specchio a figura intera
        </p>
      </div>

      {/* Legal disclaimer */}
      <div className="w-full mb-1">
        <ImageDisclaimerBox />
      </div>

      {/* Photo preview or placeholder */}
      <div className="w-full mb-4">
        {hasPhoto ? (
          <div className="relative">
            <img
              src={`data:image/jpeg;base64,${photoBase64}`}
              alt="Foto corpo"
              className="w-full max-h-80 object-contain rounded-ios-lg bg-ios-gray-5"
            />
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
            onClick={() => galleryInputRef.current?.click()}
            className="w-full h-48 rounded-ios-lg border-2 border-dashed border-ios-gray-4
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

      {/* Two action buttons */}
      <div className="w-full flex gap-3 mb-2">
        <button
          onClick={() => cameraInputRef.current?.click()}
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
          onClick={() => galleryInputRef.current?.click()}
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

      {/* Camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {photoUploaded && (
        <p className="text-ios-green text-sm text-center mt-3 font-medium">
          Foto caricata con successo! Premi "Completa profilo" per continuare.
        </p>
      )}

      <p className="text-ios-gray-2 text-xs text-center mt-3 px-6">
        Scatta in piedi, con buona illuminazione, su sfondo neutro.
      </p>
    </div>
  )
}
