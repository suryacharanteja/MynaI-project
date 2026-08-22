import { Tooltip } from './tooltip'

export function MinimizedBubble({ onRestore }: { onRestore: () => void }): React.JSX.Element {
  return (
    <Tooltip label="Click to expand MynaI">
      {/* Not a drag region: a button spanning the whole clickable area with
          -webkit-app-region:drag on itself has its click swallowed by the
          OS drag gesture, since drag/click are resolved at the OS level
          before React's onClick ever fires — the bubble isn't draggable,
          just clickable-to-restore, so no drag region is needed here. */}
      <button
        onClick={onRestore}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-neutral-950/95 text-2xl shadow-2xl backdrop-blur-xl transition hover:scale-105"
      >
        🦜
      </button>
    </Tooltip>
  )
}
