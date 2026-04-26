interface Props {
  title: string
  columns: string[]
  rows: (string | number)[][]
  notes?: string[]
}

export function TableCard({ title, columns, rows, notes }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs font-mono">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`py-1.5 px-2 text-left font-bold text-cockpit-text-dim bg-cockpit-panel/60
                    ${i === 0 ? 'sticky left-0 bg-cockpit-card z-10' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-cockpit-panel/20' : ''}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`py-1.5 px-2 text-cockpit-text-secondary
                      ${ci === 0 ? 'sticky left-0 bg-cockpit-card font-semibold text-cockpit-text-primary z-10' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {notes.map((note, i) => (
            <p key={i} className="text-xs text-cockpit-text-dim leading-snug">* {note}</p>
          ))}
        </div>
      )}
    </div>
  )
}
