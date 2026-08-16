export function MinimizedBubble({ onRestore }: { onRestore: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onRestore}
      title="Click to expand MynaI"
      className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-neutral-950/95 text-2xl shadow-2xl backdrop-blur-xl transition hover:scale-105"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>🦜</span>
    </button>
  )
}
