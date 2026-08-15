import { useState } from 'react'
import { Briefcase, Phone, FileText, User, Plus, Sparkles, MessageSquare, Settings } from 'lucide-react'
import type { LlmProvider } from '@shared/session-types'
import { useSessionStore } from '../../stores/session-store'
import { FieldLabel, TextArea, TextInput } from '../../components/ui/field-shell'
import { Toggle } from '../../components/ui/toggle'
import { SettingsModal } from '../settings/SettingsModal'
import { TitleBar } from '../../components/ui/title-bar'
import { CallSessionsList } from './CallSessionsList'

// Gemini list verified against the live /v1beta/models endpoint with a real key.
// OpenAI/Zen lists are best-effort from published docs — not verified against a live key yet.
const PROVIDER_LABELS: Record<LlmProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  'opencode-zen': 'OpenCode Zen'
}
const PROVIDER_MODELS: Record<LlmProvider, string[]> = {
  gemini: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  openai: ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex'],
  'opencode-zen': ['opencode/gpt-5.6-sol', 'opencode/claude-sonnet-5', 'opencode/gemini-3.7-flash']
}
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'French']

export function CreateSessionScreen({ onCreate }: { onCreate?: () => void }): React.JSX.Element {
  const { form, setSessionType, setField } = useSessionStore()
  const [activeTab, setActiveTab] = useState<'create' | 'sessions'>('create')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  function handleProviderChange(provider: LlmProvider): void {
    setField('provider', provider)
    setField('model', PROVIDER_MODELS[provider][0])
  }

  async function handleCreate(): Promise<void> {
    setCreating(true)
    try {
      await window.mynai.createSession(form)
      onCreate?.()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 text-neutral-900 shadow-2xl backdrop-blur-xl">
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <TitleBar>
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
              onChange={(e) => setField('company', e.target.value)}
            />
          </div>

          {/* Job Description */}
          <div>
            <FieldLabel icon={<FileText size={14} />}>Job Description</FieldLabel>
            <TextArea
              rows={4}
              placeholder="Software Engineer versed in Python, SQL, and AWS..."
              value={form.jobDescription}
              onChange={(e) => setField('jobDescription', e.target.value)}
            />
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
                  <option key={m} value={m}>
                    {m}
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
            {creating ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      )}
    </div>
  )
}
