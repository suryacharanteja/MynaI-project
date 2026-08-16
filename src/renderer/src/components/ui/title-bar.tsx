import { Home, Minus, Move, X } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Frameless windows (frame:false) have no native title bar to drag by.
 * The drag-region div below opts back into OS window dragging via
 * -webkit-app-region: drag; interactive children must opt out with
 * -webkit-app-region: no-drag or clicks won't reach them.
 */
export function TitleBar({
  children,
  onHome,
  onMinimize,
  onClose
}: {
  children?: ReactNode
  onHome?: () => void
  onMinimize?: () => void
  onClose?: () => void
}): React.JSX.Element {
  return (
    <div
      className="flex items-center justify-between border-b border-black/10 px-3 py-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 font-semibold text-neutral-900">
        <span
          className="flex items-center text-neutral-400"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Drag anywhere on this bar to move the window"
        >
          <Move size={14} />
        </span>
        <span className="text-lg leading-none">🦜</span>
        <span>MynaI</span>
      </div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {children}
        {onHome && (
          <button
            onClick={onHome}
            title="Back to home"
            className="rounded-full p-1.5 text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900"
          >
            <Home size={16} />
          </button>
        )}
        {onMinimize && (
          <button
            onClick={onMinimize}
            title="Minimize to bubble"
            className="rounded-full p-1.5 text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900"
          >
            <Minus size={16} />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            title="Close MynaI"
            className="rounded-full p-1.5 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
