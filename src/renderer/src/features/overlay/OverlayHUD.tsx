import { TranscriptStrip } from './TranscriptStrip'
import { AnswerCardStack } from './AnswerCardStack'
import { AskAiBar } from './AskAiBar'
import { useLiveTranscription } from './useLiveTranscription'

export function OverlayHUD({
  onHome,
  onMinimize,
  onClose
}: {
  onHome: () => void
  onMinimize: () => void
  onClose: () => void
}): React.JSX.Element {
  const { error, micOn, toggleMic, systemAudioIssue, retrySystemAudio } = useLiveTranscription()

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-neutral-100 shadow-2xl backdrop-blur-xl">
      <TranscriptStrip
        micOn={micOn}
        onToggleMic={toggleMic}
        onHome={onHome}
        onMinimize={onMinimize}
        onClose={onClose}
        systemAudioIssue={systemAudioIssue}
      />
      {error && (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-red-500/10 px-3 py-1.5">
          <p className="text-xs text-red-400">{error}</p>
          {systemAudioIssue && (
            <button
              onClick={retrySystemAudio}
              className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <AnswerCardStack />
      <AskAiBar />
    </div>
  )
}
