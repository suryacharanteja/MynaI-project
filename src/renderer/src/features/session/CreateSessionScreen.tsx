import { useState, useEffect } from 'react'
import { Briefcase, Phone, FileText, User, Plus, Sparkles, MessageSquare, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { LlmProvider } from '@shared/session-types'
import { createSessionFormSchema } from '@shared/schemas'
import { useSessionStore } from '../../stores/session-store'
import { FieldLabel, TextArea, TextInput } from '../../components/ui/field-shell'
import { Toggle } from '../../components/ui/toggle'
import { SettingsModal } from '../settings/SettingsModal'
import { TitleBar } from '../../components/ui/title-bar'
import { CallSessionsList } from './CallSessionsList'

interface ModelOption {
  value: string
  label: string
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  'opencode-go': 'OpenCode Go',
  'opencode-zen': 'OpenCode Zen (Free)',
  deepseek: 'DeepSeek'
}
const PROVIDER_MODELS: Record<LlmProvider, ModelOption[]> = {
  gemini: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'].map((m) => ({
    value: m,
    label: m
  })),
  openai: ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex'].map((m) => ({ value: m, label: m })),
  'opencode-go': [
    { value: 'grok-4.5', label: 'Grok 4.5' },
    { value: 'glm-5.3', label: 'GLM-5.3' },
    { value: 'glm-5.2', label: 'GLM-5.2' },
    { value: 'glm-5.1', label: 'GLM-5.1' },
    { value: 'glm-5', label: 'GLM-5' },
    { value: 'gpt-5.6-luna', label: 'GPT 5.6 Luna' },
    { value: 'kimi-k3', label: 'Kimi K3' },
    { value: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
    { value: 'kimi-k2.6', label: 'Kimi K2.6' },
    { value: 'kimi-k2.5', label: 'Kimi K2.5' },
    { value: 'mimo-v2.5', label: 'MiMo-V2.5' },
    { value: 'mimo-v2.5-pro', label: 'MiMo-V2.5-Pro' },
    { value: 'mimo-v2-pro', label: 'MiMo-V2-Pro' },
    { value: 'mimo-v2-omni', label: 'MiMo-V2-Omni' },
    { value: 'minimax-m3', label: 'MiniMax M3' },
    { value: 'minimax-m2.7', label: 'MiniMax M2.7' },
    { value: 'minimax-m2.5', label: 'MiniMax M2.5' },
    { value: 'qwen3.8-max', label: 'Qwen3.8 Max' },
    { value: 'qwen3.7-max', label: 'Qwen3.7 Max' },
    { value: 'qwen3.7-plus', label: 'Qwen3.7 Plus' },
    { value: 'qwen3.6-plus', label: 'Qwen3.6 Plus' },
    { value: 'qwen3.5-plus', label: 'Qwen3.5 Plus' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'hy3', label: 'Hy3' },
    { value: 'hy3-preview', label: 'Hy3 Preview' }
  ],
  'opencode-zen': [
    { value: 'big-pickle', label: 'Big Pickle (Free)' },
    { value: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash (Free)' },
    { value: 'mimo-v2.5-free', label: 'MiMo-V2.5 (Free)' },
    { value: 'hy3-free', label: 'Hy3 (Free)' },
    { value: 'laguna-s-2.1-free', label: 'Laguna S 2.1 (Free)' },
    { value: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra (Free)' },
    { value: 'nemotron-3.5-lightning-free', label: 'Nemotron 3.5 Lightning (Free)' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }
  ]
}
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'French']

const API_KEY_FOR_PROVIDER: Record<LlmProvider, string> = {
  gemini: 'geminiApiKey',
  openai: 'openaiApiKey',
  'opencode-go': 'openCodeGoApiKey',
  'opencode-zen': 'openCodeZenApiKey',
  deepseek: 'deepseekApiKey'
}

type FieldErrors = Record<string, string>

export function CreateSessionScreen({ onCreate }: { onCreate?: () => void }): React.JSX.Element {
  const { form, setSessionType, setField } = useSessionStore()
  const [activeTab, setActiveTab] = useState<'create' | 'sessions'>('create')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [hasApiKey, setHasApiKey] = useState(true)

  useEffect(() => {
    window.mynai.getSettings().then((settings) => {
      const key = settings[API_KEY_FOR_PROVIDER[form.provider] as keyof typeof settings]
      setHasApiKey(!!key)
    })
  }, [form.provider])

  function validate(): FieldErrors {
    const result = createSessionFormSchema.safeParse(form)
    if (result.success) return {}
    const fieldErrors: FieldErrors = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message
      }
    }
    return fieldErrors
  }

  function handleProviderChange(provider: LlmProvider): void {
    setField('provider', provider)
    setField('model', PROVIDER_MODELS[provider][0].value)
  }

  async function handleCreate(): Promise<void> {
    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    if (!hasApiKey) {
      toast.error(`No ${PROVIDER_LABELS[form.provider]} API key configured. Open Settings to add one.`)
      return
    }

    setCreating(true)
    try {
      const result = await window.mynai.createSession(form)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Session created')
      onCreate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 text-neutral-900 shadow-2xl backdrop-blur-xl">
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <TitleBar onMinimize={() => window.mynai.windowMinimize()} onClose={() => window.mynai.windowClose()}>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-full p-1.5 text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900"
        >
          <Settings size={16} />
        </button>
      </TitleBar>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-black/10 px-4 pt-3">
        {(
          [
            ['create', 'Create'],
            ['sessions', 'Call Sessions']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === key ? 'bg-black/[0.06] text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' ? (
        <CallSessionsList />
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Session Type */}
          <div>
            <FieldLabel>Session Type</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSessionType('interview')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  form.sessionType === 'interview'
                    ? 'border-black/20 bg-black/[0.06] text-neutral-900'
                    : 'border-black/10 bg-black/[0.02] text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <Briefcase size={16} /> Interview
              </button>
              <button
                onClick={() => setSessionType('regular-call')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  form.sessionType === 'regular-call'
                    ? 'border-black/20 bg-black/[0.06] text-neutral-900'
                    : 'border-black/10 bg-black/[0.02] text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <Phone size={16} /> Regular Call
              </button>
            </div>
          </div>

          {/* Company + Fill from URL */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel icon={<Briefcase size={14} />}>Company</FieldLabel>
              <button className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
                <Sparkles size={12} /> Fill fields from Job Post URL
              </button>
            </div>
            <TextInput
              placeholder="Acme..."
              value={form.company}
              onChange={(e) => {
                setField('company', e.target.value)
                if (errors.company) setErrors((prev) => ({ ...prev, company: '' }))
              }}
            />
            {errors.company && <p className="mt-1 text-xs text-red-500">{errors.company}</p>}
          </div>

          {/* Job Description */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel icon={<FileText size={14} />}>Job Description</FieldLabel>
              <span
                className={`text-xs ${form.jobDescription.length > 2000 ? 'text-red-500' : 'text-neutral-400'}`}
              >
                {form.jobDescription.length}/2000
              </span>
            </div>
            <TextArea
              rows={4}
              placeholder="Software Engineer versed in Python, SQL, and AWS..."
              value={form.jobDescription}
              onChange={(e) => {
                setField('jobDescription', e.target.value)
                if (errors.jobDescription) setErrors((prev) => ({ ...prev, jobDescription: '' }))
              }}
            />
            {errors.jobDescription && <p className="mt-1 text-xs text-red-500">{errors.jobDescription}</p>}
          </div>

          {/* Context */}
          <div>
            <FieldLabel>Context</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 hover:bg-black/[0.06]">
                <User size={14} /> {form.profileId ?? 'Select Profile'}
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 hover:bg-black/[0.06]">
                <Plus size={14} /> Add Documents
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 hover:bg-black/[0.06]">
                <Plus size={14} /> Add Extra Context
              </button>
            </div>
          </div>

          {/* Output Settings */}
          <div>
            <FieldLabel>Output Settings</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <select
                value={form.provider}
                onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
                className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 outline-none"
              >
                {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 outline-none"
              >
                {PROVIDER_MODELS[form.provider].map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={form.outputLanguage}
                onChange={(e) => setField('outputLanguage', e.target.value)}
                className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 outline-none"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm text-neutral-700 hover:bg-black/[0.06]">
                <MessageSquare size={14} /> Answer Preferences
              </button>
            </div>
            {!hasApiKey && (
              <p className="mt-2 text-xs text-amber-600">
                No API key set for {PROVIDER_LABELS[form.provider]}. Add one in Settings before creating a session.
              </p>
            )}
          </div>

          {/* Behavior */}
          <div>
            <FieldLabel>Behavior</FieldLabel>
            <div className="flex gap-5">
              <Toggle
                checked={form.autoAnswer}
                onChange={(v) => setField('autoAnswer', v)}
                label="Auto Answer (Beta)"
                hint="Automatically detect and answer questions without pressing a button"
              />
              <Toggle
                checked={form.saveTranscript}
                onChange={(v) => setField('saveTranscript', v)}
                label="Save Transcript"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="border-t border-black/10 p-3">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      )}
    </div>
  )
}
