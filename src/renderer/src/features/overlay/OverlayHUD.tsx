import { TranscriptStrip } from './TranscriptStrip'
import { AnswerCardStack } from './AnswerCardStack'
import { AskAiBar } from './AskAiBar'
import { useLiveTranscription } from './useLiveTranscription'

export function OverlayHUD(): React.JSX.Element {
  const { error, micOn, toggleMic } = useLiveTranscription()

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-neutral-100 shadow-2xl backdrop-blur-xl">
      <TranscriptStrip micOn={micOn} onToggleMic={toggleMic} />
      {error && <p className="border-b border-white/10 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">{error}</p>}
      <AnswerCardStack />
      <AskAiBar />
    </div>
  )
}
