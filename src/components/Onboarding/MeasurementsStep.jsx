const FIELDS = [
  { key: 'height',    label: 'Altezza',   unit: 'cm', required: true },
  { key: 'chest',     label: 'Petto',     unit: 'cm' },
  { key: 'waist',     label: 'Vita',      unit: 'cm' },
  { key: 'hips',      label: 'Fianchi',   unit: 'cm' },
  { key: 'shoulders', label: 'Spalle',    unit: 'cm' },
  { key: 'inseam',    label: 'Cavallo',   unit: 'cm' },
]

export default function MeasurementsStep({ values, onChange }) {
  function handleChange(key, val) {
    // Allow only numbers and single decimal point
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return
    onChange(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="flex flex-col items-center pt-8">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-ios-blue/10 flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="14" width="28" height="8" rx="4" stroke="#007AFF" strokeWidth="2.5"/>
          <path d="M10 14v-2M14 14v-4M18 14v-2M22 14v-4M26 14v-2" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-black mb-2 text-center">Le tue misure</h2>
      <p className="text-ios-gray-1 text-base text-center mb-8 max-w-[280px]">
        Inserisci le tue misure in centimetri per trovare la taglia giusta
      </p>

      {/* Form */}
      <div className="w-full ios-section">
        {FIELDS.map((field, i) => (
          <div key={field.key} className="ios-row">
            <div className="flex-1">
              <div className="flex items-center">
                <span className="text-base text-black">
                  {field.label}
                  {field.required && <span className="text-ios-red ml-1">*</span>}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="text-right text-base text-black outline-none w-20
                           placeholder-ios-gray-3 bg-transparent"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={values[field.key]}
                onChange={e => handleChange(field.key, e.target.value)}
                step="0.1"
                min="0"
                max="300"
              />
              <span className="text-ios-gray-2 text-sm w-6">{field.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-ios-gray-2 text-xs mt-3 text-center px-4">
        Solo l'altezza è obbligatoria. Le altre misure migliorano l'accuratezza del fit.
      </p>
    </div>
  )
}
