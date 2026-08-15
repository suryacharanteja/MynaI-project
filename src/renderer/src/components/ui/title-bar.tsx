import { Move } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Frameless windows (frame:false) have no native title bar to drag by.
 * The drag-region div below opts back into OS window dragging via
 * -webkit-app-region: drag; interactive children must opt out with
 * -webkit-app-region: no-drag or clicks won't reach them.
 */
export function TitleBar({ children }: { children: ReactNode }): React.JSX.Element {
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
      </div>
    </div>
  )
}
