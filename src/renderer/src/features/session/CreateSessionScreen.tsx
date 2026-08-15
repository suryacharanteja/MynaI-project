import { useState } from 'react'
import { Briefcase, Phone, FileText, User, Plus, Sparkles, MessageSquare } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import { FieldLabel, TextArea, TextInput } from '../../components/ui/field-shell'
import { Toggle } from '../../components/ui/toggle'

const MODEL_OPTIONS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gpt-4o-mini', 'claude-haiku-4-5']
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'French']

export function CreateSessionScreen({ onCreate }: { onCreate?: () => void }): React.JSX.Element {
  const { form, setSessionType, setField } = useSessionStore()
  const [activeTab, setActiveTab] = useState<'create' | 'sessions'>('create')

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-neutral-100 shadow-2xl backdrop-blur-xl">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-lg">🦜</span>
          <span>MynaI</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 px-4 pt-3">
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
              activeTab === key ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          No call sessions yet.
        </div>
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
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Briefcase size={16} /> Interview
              </button>
              <button
                onClick={() => setSessionType('regular-call')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  form.sessionType === 'regular-call'
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-neutral-400 hover:text-neutral-200'
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
              <button className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
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
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10">
                <User size={14} /> {form.profileId ?? 'Select Profile'}
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10">
                <Plus size={14} /> Add Documents
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10">
                <Plus size={14} /> Add Extra Context
              </button>
            </div>
          </div>

          {/* Output Settings */}
          <div>
            <FieldLabel>Output Settings</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <select
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 outline-none"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={form.outputLanguage}
                onChange={(e) => setField('outputLanguage', e.target.value)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 outline-none"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/10">
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
        <div className="border-t border-white/10 p-3">
          <button
            onClick={onCreate}
            className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Create Session
          </button>
        </div>
      )}
    </div>
  )
}
