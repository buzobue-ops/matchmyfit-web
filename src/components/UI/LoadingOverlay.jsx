export default function LoadingOverlay({ message = 'Caricamento…', fullscreen = false }) {
  const base = 'flex flex-col items-center justify-center gap-4'
  const cls = fullscreen
    ? `${base} fixed inset-0 bg-ios-bg z-50`
    : `${base} absolute inset-0 bg-white/70 backdrop-blur-sm rounded-ios z-10`

  return (
    <div className={cls}>
      <div className="spinner" />
      {message && (
        <p className="text-sm text-ios-gray-1 font-medium">{message}</p>
      )}
    </div>
  )
}
