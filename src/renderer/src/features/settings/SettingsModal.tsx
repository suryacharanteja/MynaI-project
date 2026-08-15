import { useEffect, useState } from 'react'
import { X, KeyRound, Check } from 'lucide-react'
import type { AppSettings } from '@shared/ipc-contract'
import { defaultAppSettings } from '@shared/ipc-contract'
import { TextInput } from '../../components/ui/field-shell'

const KEY_FIELDS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: 'geminiApiKey', label: 'Gemini API Key', placeholder: 'AIza...' },
  { key: 'openaiApiKey', label: 'OpenAI API Key', placeholder: 'sk-...' },
  { key: 'openCodeGoApiKey', label: 'OpenCode Go API Key', placeholder: '...' },
  { key: 'assemblyAiApiKey', label: 'AssemblyAI API Key', placeholder: '...' }
]

export function SettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.mynai
      .getSettings()
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(): Promise<void> {
    const next = await window.mynai.setSettings(settings)
    setSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[90%] max-w-sm rounded-2xl border border-black/10 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <KeyRound size={15} /> API Keys
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-500 hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>
        ) : (
          <div className="space-y-3">
            {KEY_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-neutral-600">{label}</label>
                <TextInput
                  type="password"
                  placeholder={placeholder}
                  value={settings[key] ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                />
              </div>
            ))}
            <button
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {saved ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : (
                'Save'
              )}
            </button>
            <p className="text-center text-[11px] text-neutral-400">
              Stored locally on this device, never leaves your machine except to call the provider you configure.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
