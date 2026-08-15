import { TranscriptStrip } from './TranscriptStrip'
import { AnswerCardStack } from './AnswerCardStack'
import { AskAiBar } from './AskAiBar'

export function OverlayHUD(): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-neutral-100 shadow-2xl backdrop-blur-xl">
      <TranscriptStrip />
      <AnswerCardStack />
      <AskAiBar />
    </div>
  )
}
