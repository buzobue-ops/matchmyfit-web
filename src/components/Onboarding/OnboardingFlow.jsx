import { useState, useCallback } from 'react'
import {
  sendUsernameStep,
  sendMeasurementsStep,
  sendPhotoStep,
  sendCompleteProfile,
  resetOnboardingSession,
} from '../../services/webhookService.js'
import UsernameStep from './UsernameStep.jsx'
import MeasurementsStep from './MeasurementsStep.jsx'
import PhotoStep from './PhotoStep.jsx'
import LoadingOverlay from '../UI/LoadingOverlay.jsx'

// ─── Derive a clean username from OAuth display name or email ─────────────
function deriveUsername(user) {
  if (user?.displayName) {
    return user.displayName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30) || 'user'
  }
  if (user?.email) {
    return user.email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'user'
  }
  return 'user'
}

export default function OnboardingFlow({ user, onComplete, onUpdateUser }) {
  // For OAuth users (Google/Apple) skip the username step entirely
  const isOAuth = user?.authProvider === 'google' || user?.authProvider === 'apple'
  const TOTAL_STEPS = isOAuth ? 2 : 3

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  // Step 1 data — auto-filled for OAuth users
  const [username, setUsername] = useState(
    user?.username || (isOAuth ? deriveUsername(user) : '')
  )

  // Step 2 data
  const [measurements, setMeasurements] = useState({
    height: '', chest: '', waist: '', hips: '', shoulders: '', inseam: '',
  })

  // Step 3 data
  const [photoBase64, setPhotoBase64] = useState(null)
  const [photoUploaded, setPhotoUploaded] = useState(false)

  // ─── Can proceed? ──────────────────────────────────────────────────
  // isOAuth:     step 0 = measurements, step 1 = photo
  // non-OAuth:   step 0 = username,     step 1 = measurements, step 2 = photo
  const measurementsStep = isOAuth ? 0 : 1
  const photoStep        = isOAuth ? 1 : 2

  const canProceed = (() => {
    if (!isOAuth && step === 0) return username.trim().length > 0
    if (step === measurementsStep) return measurements.height.trim().length > 0
    if (step === photoStep) return photoBase64 !== null && photoUploaded
    return false
  })()

  // ─── Step transitions ──────────────────────────────────────────────
  async function handleNext() {
    setError(null)
    setLoading(true)

    try {
      // Username step (non-OAuth only)
      if (!isOAuth && step === 0) {
        setLoadingMsg('Salvataggio username…')
        await sendUsernameStep(user.id, username.trim())
        onUpdateUser({ username: username.trim() })
        setStep(1)

      // Measurements step
      } else if (step === measurementsStep) {
        setLoadingMsg('Salvataggio misure…')

        // For OAuth users, register username silently before measurements
        if (isOAuth) {
          await sendUsernameStep(user.id, username)
          onUpdateUser({ username })
        }

        const parsed = {
          height: parseFloat(measurements.height) || null,
          chest: parseFloat(measurements.chest) || null,
          waist: parseFloat(measurements.waist) || null,
          hips: parseFloat(measurements.hips) || null,
          shoulders: parseFloat(measurements.shoulders) || null,
          inseam: parseFloat(measurements.inseam) || null,
        }
        await sendMeasurementsStep(user.id, parsed)
        onUpdateUser({ height: parsed.height, bodySizes: parsed })
        setStep(step + 1)

      // Photo step → finalize profile
      } else if (step === photoStep) {
        setLoadingMsg('Completamento profilo…')
        const updatedUser = {
          ...user,
          username: username.trim(),
          height: parseFloat(measurements.height) || null,
          bodySizes: {
            height: parseFloat(measurements.height) || null,
            chest: parseFloat(measurements.chest) || null,
            waist: parseFloat(measurements.waist) || null,
            hips: parseFloat(measurements.hips) || null,
            shoulders: parseFloat(measurements.shoulders) || null,
            inseam: parseFloat(measurements.inseam) || null,
          },
        }
        await sendCompleteProfile(updatedUser)
        onComplete(updatedUser)
      }
    } catch (err) {
      if (err.code === 409) {
        // User already exists → skip to search
        onComplete({ ...user, username: username.trim() })
      } else {
        setError(err.message || 'Qualcosa è andato storto. Riprova.')
      }
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  function handleBack() {
    setError(null)
    setStep(s => Math.max(0, s - 1))
  }

  // ─── Photo upload (called by PhotoStep when user picks image) ─────
  const handlePhotoSelected = useCallback(async (base64) => {
    setPhotoBase64(base64)
    setPhotoUploaded(false)
    setError(null)
    setLoading(true)
    setLoadingMsg('Caricamento foto…')
    try {
      await sendPhotoStep(user.id, base64)
      setPhotoUploaded(true)
    } catch (err) {
      setError('Caricamento foto fallito: ' + (err.message || 'riprova.'))
      setPhotoBase64(null)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [user.id])

  // ─── Progress bar ────────────────────────────────────────────────────
  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-ios-bg flex flex-col">
      {/* Nav bar */}
      <div className="ios-navbar px-4 safe-top">
        <div className="flex items-center justify-between h-11">
          <button
            onClick={handleBack}
            className={`text-ios-blue font-medium text-base transition-opacity ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}
          >
            Indietro
          </button>
          <span className="text-[13px] text-ios-gray-1 font-medium">
            Passo {step + 1} di {TOTAL_STEPS}
          </span>
          <div className="w-16" />
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-ios-gray-5 rounded-full mb-2 overflow-hidden">
          <div
            className="h-full bg-ios-blue rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content – scrollable */}
      <div className="flex-1 overflow-y-auto pt-[72px] pb-32 relative">
        {loading && <LoadingOverlay message={loadingMsg} />}

        <div className="px-4 max-w-lg mx-auto w-full page-enter" key={step}>
          {!isOAuth && step === 0 && (
            <UsernameStep username={username} onChange={setUsername} />
          )}
          {step === measurementsStep && (
            <MeasurementsStep values={measurements} onChange={setMeasurements} />
          )}
          {step === photoStep && (
            <PhotoStep
              photoBase64={photoBase64}
              photoUploaded={photoUploaded}
              onPhotoSelected={handlePhotoSelected}
            />
          )}

          {error && (
            <div className="mt-4 p-4 bg-[#FF3B30]/10 rounded-ios animate-fade-in">
              <p className="text-[#FF3B30] text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-ios-gray-5 px-4 pt-3 safe-bottom">
        <button
          onClick={handleNext}
          disabled={!canProceed || loading}
          className="ios-btn-primary"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="spinner spinner-white" />
              {loadingMsg || 'Attendere…'}
            </span>
          ) : step === TOTAL_STEPS - 1 ? (
            'Completa profilo'
          ) : (
            'Avanti'
          )}
        </button>
      </div>
    </div>
  )
}
