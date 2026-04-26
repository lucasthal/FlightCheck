interface Props {
  title: string
  items: Record<string, string>
}

export function KeyValCard({ title, items }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="space-y-2">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="flex gap-3">
            <span className="text-sm font-semibold text-cockpit-text-primary flex-shrink-0 w-24">{key}</span>
            <span className="text-sm text-cockpit-text-secondary leading-snug">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
