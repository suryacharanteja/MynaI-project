import { MessageCircle, Star, ListChecks, Code2, Lightbulb, Clock, Database } from 'lucide-react'
import type { AnswerCard } from '@shared/transcript-types'
import { MarkdownLite } from './MarkdownLite'

export function AnswerCardView({ card }: { card: AnswerCard }): React.JSX.Element {
  return (
    <div className="space-y-4 p-4">
      <Section icon={<MessageCircle size={14} />} label="Question">
        <p className="text-sm text-neutral-300">{card.question}</p>
      </Section>

      <Section icon={<Star size={14} />} label="Answer">
        <MarkdownLite text={card.answer} />
      </Section>

      {card.keySteps && card.keySteps.length > 0 && (
        <Section icon={<ListChecks size={14} />} label="Key Steps">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-200">
            {card.keySteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>
      )}

      {card.code && (
        <Section icon={<Code2 size={14} />} label="Code">
          <pre className="overflow-x-auto rounded-lg bg-black/60 p-3 font-mono text-xs leading-relaxed text-emerald-200">
            <code>{card.code.content}</code>
          </pre>
        </Section>
      )}

      {card.explanation && (
        <Section icon={<Lightbulb size={14} />} label="Explanation">
          <MarkdownLite text={card.explanation} />
        </Section>
      )}

      {(card.timeComplexity || card.spaceComplexity) && (
        <div className="flex gap-4 text-xs text-neutral-400">
          {card.timeComplexity && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> Time: {card.timeComplexity}
            </span>
          )}
          {card.spaceComplexity && (
            <span className="flex items-center gap-1">
              <Database size={12} /> Space: {card.spaceComplexity}
            </span>
          )}
        </div>
      )}

      {card.status === 'streaming' && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
          Streaming…
        </div>
      )}
    </div>
  )
}

function Section({
  icon,
  label,
  children
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}
