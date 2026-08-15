import { Check } from 'lucide-react'

export function Toggle({
  checked,
  onChange,
  label,
  hint
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-neutral-200"
      title={hint}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
          checked ? 'border-emerald-400 bg-emerald-400 text-neutral-900' : 'border-white/20 bg-white/5'
        }`}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      {label}
    </button>
  )
}
