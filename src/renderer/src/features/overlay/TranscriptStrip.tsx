import { useEffect, useRef } from 'react'
import { Home, Mic, MicOff, Minus, Radio, Sparkles, X } from 'lucide-react'
import { useOverlayStore } from '../../stores/overlay-store'
import { Tooltip } from '../../components/ui/tooltip'

export function TranscriptStrip({
  micOn,
  onToggleMic,
  onHome,
  onMinimize,
  onClose,
  systemAudioIssue
}: {
  micOn: boolean
  onToggleMic: () => void
  onHome: () => void
  onMinimize: () => void
  onClose: () => void
  systemAudioIssue: boolean
}): React.JSX.Element {
  const transcript = useOverlayStore((s) => s.transcript)
  const partialText = useOverlayStore((s) => s.partialText)
  const sttStatus = useOverlayStore((s) => s.sttStatus)
  const questionDetected = useOverlayStore((s) => s.questionDetected)
  const autoAnswerOn = useOverlayStore((s) => s.autoAnswerOn)
  const setAutoAnswerOn = useOverlayStore((s) => s.setAutoAnswerOn)
  const scrollRef = useRef<HTMLDivElement>(null)

  const liveText = [
    transcript.map((m) => m.text).join(' '),
    partialText.system,
    partialText.mic
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth })
  }, [liveText])

  const isListening = sttStatus.system === 'listening' || sttStatus.mic === 'listening'
  const isConnecting = sttStatus.system === 'connecting' || sttStatus.mic === 'connecting'

  return (
    <div
      className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <Tooltip label={systemAudioIssue ? 'System audio: connected but no sound detected' : `System audio: ${sttStatus.system}`}>
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Radio
            size={14}
            className={systemAudioIssue ? 'text-amber-400' : isListening ? 'text-emerald-400' : undefined}
          />
        </div>
      </Tooltip>

      <div ref={scrollRef} className="flex-1 overflow-hidden whitespace-nowrap text-sm text-neutral-300">
        <span className="opacity-80">
          {liveText ||
            (systemAudioIssue
              ? 'No system audio detected…'
              : isConnecting
                ? 'Connecting…'
                : isListening
                  ? 'Listening…'
                  : 'Not listening')}
        </span>
      </div>

      {questionDetected && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Question detected
        </span>
      )}

      <button
        onClick={() => setAutoAnswerOn(!autoAnswerOn)}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          autoAnswerOn ? 'bg-white/15 text-white' : 'bg-white/5 text-neutral-500'
        }`}
      >
        <Sparkles size={12} />
        Auto Answer {autoAnswerOn ? 'On' : 'Off'}
      </button>

      <Tooltip label={micOn ? 'Mic on — click to mute' : 'Mic off — click to enable'}>
        <button
          onClick={onToggleMic}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className={`shrink-0 rounded-full p-1.5 transition ${
            micOn ? 'bg-white/15 text-emerald-400' : 'bg-white/5 text-neutral-500'
          }`}
        >
          {micOn ? <Mic size={14} /> : <MicOff size={14} />}
        </button>
      </Tooltip>

      <div
        className="flex shrink-0 items-center gap-0.5 border-l border-white/10 pl-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Tooltip label="Back to home">
          <button
            onClick={onHome}
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <Home size={14} />
          </button>
        </Tooltip>
        <Tooltip label="Minimize to bubble">
          <button
            onClick={onMinimize}
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <Minus size={14} />
          </button>
        </Tooltip>
        <Tooltip label="Close MynaI">
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-red-500/20 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
