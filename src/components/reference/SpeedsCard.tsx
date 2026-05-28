interface Props {
  title: string
  items: Record<string, string>
}

export function SpeedsCard({ title, items }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3 min-w-0">
            <span className="text-sm text-cockpit-text-secondary">{key}</span>
            <span className="text-sm font-mono font-semibold text-cockpit-text-primary flex-shrink-0">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
