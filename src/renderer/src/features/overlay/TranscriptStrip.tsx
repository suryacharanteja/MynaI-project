import { useEffect, useRef } from 'react'
import { Mic, Radio, Sparkles } from 'lucide-react'
import { useOverlayStore } from '../../stores/overlay-store'

export function TranscriptStrip(): React.JSX.Element {
  const transcript = useOverlayStore((s) => s.transcript)
  const micLevel = useOverlayStore((s) => s.micLevel)
  const questionDetected = useOverlayStore((s) => s.questionDetected)
  const autoAnswerOn = useOverlayStore((s) => s.autoAnswerOn)
  const setAutoAnswerOn = useOverlayStore((s) => s.setAutoAnswerOn)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth })
  }, [transcript])

  const text = transcript.map((m) => m.text).join(' ')

  return (
    <div
      className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      title="Drag anywhere on this bar to move the window"
    >
      <div className="flex items-center gap-1.5 text-neutral-400">
        <Radio size={14} />
        <div className="flex h-3.5 items-end gap-[2px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-emerald-400 transition-all"
              style={{
                height: `${Math.max(2, Math.min(14, micLevel * 14 - i * 2))}px`,
                opacity: micLevel * 14 > i * 2.5 ? 1 : 0.25
              }}
            />
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-hidden whitespace-nowrap text-sm text-neutral-300">
        <span className="opacity-80">{text || 'Listening…'}</span>
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

      <Mic size={14} className="shrink-0 text-neutral-500" />
    </div>
  )
}
