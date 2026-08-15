import type { ReactNode } from 'react'

export function FieldLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-200">
      {icon}
      <span>{children}</span>
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07]"
    />
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      {...props}
      className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07]"
    />
  )
}
