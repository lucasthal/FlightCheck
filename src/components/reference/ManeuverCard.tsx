interface Props {
  title: string
  steps: string[]
  standards?: string[]
}

export function ManeuverCard({ title, steps, standards }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <ol className="space-y-1.5 mb-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cockpit-panel border border-cockpit-border text-xs font-mono font-bold text-cockpit-text-dim flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-cockpit-text-secondary leading-snug">{step}</span>
          </li>
        ))}
      </ol>
      {standards && standards.length > 0 && (
        <div className="border-t border-cockpit-border/50 pt-2.5 mt-1">
          <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider mb-1.5">Standards</p>
          {standards.map((s, i) => (
            <p key={i} className="text-xs text-cockpit-text-dim leading-snug">{s}</p>
          ))}
        </div>
      )}
    </div>
  )
}
