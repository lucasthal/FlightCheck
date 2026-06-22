interface Props {
  title: string
  columns: string[]
  rows: (string | number)[][]
  notes?: string[]
  extrapolatedRows?: number[]
}

export function TableCard({ title, columns, rows, notes, extrapolatedRows }: Props) {
  const extrapolatedSet = extrapolatedRows ? new Set(extrapolatedRows) : null

  const groups = buildRowGroups(rows)
  const hasGroups = groups.some(g => g.count > 1)

  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs font-mono">
          <thead>
            <tr>
              {hasGroups
                ? columns.slice(1).map((col, i) => (
                    <th
                      key={i}
                      className="py-1.5 px-2 text-left font-bold text-cockpit-text-dim bg-cockpit-panel/60"
                    >
                      {col}
                    </th>
                  ))
                : columns.map((col, i) => (
                    <th
                      key={i}
                      className={`py-1.5 px-2 text-left font-bold text-cockpit-text-dim bg-cockpit-panel/60
                        ${i === 0 ? 'sticky left-0 bg-cockpit-card z-10' : ''}`}
                    >
                      {col}
                    </th>
                  ))
              }
            </tr>
          </thead>
          <tbody>
            {hasGroups
              ? renderGroupedRows(groups, rows, columns, extrapolatedSet)
              : rows.map((row, ri) => {
                  const isExtrapolated = extrapolatedSet?.has(ri) ?? false
                  return (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-cockpit-panel/20' : ''}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`py-1.5 px-2 ${
                            isExtrapolated
                              ? 'text-cockpit-extrapolated'
                              : ci === 0
                                ? 'font-semibold text-cockpit-text-primary'
                                : 'text-cockpit-text-secondary'
                          } ${ci === 0 ? 'sticky left-0 bg-cockpit-card z-10' : ''}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
      {extrapolatedSet && extrapolatedSet.size > 0 && (
        <p className="mt-2 text-xs text-cockpit-extrapolated leading-snug">
          * Values in this color are linearly interpolated between POH data points
        </p>
      )}
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

interface RowGroup {
  label: string | number
  startIndex: number
  count: number
}

function buildRowGroups(rows: (string | number)[][]): RowGroup[] {
  const groups: RowGroup[] = []
  for (let i = 0; i < rows.length; i++) {
    const label = rows[i][0]
    if (groups.length > 0 && groups[groups.length - 1].label === label) {
      groups[groups.length - 1].count++
    } else {
      groups.push({ label, startIndex: i, count: 1 })
    }
  }
  return groups
}

function renderGroupedRows(
  groups: RowGroup[],
  rows: (string | number)[][],
  columns: string[],
  extrapolatedSet: Set<number> | null,
) {
  const elements: React.ReactNode[] = []
  let stripe = 0

  for (const group of groups) {
    elements.push(
      <tr key={`hdr-${group.startIndex}`}>
        <td
          colSpan={columns.length - 1}
          className="pt-3 pb-1 px-2 font-bold text-cockpit-amber text-[11px] uppercase tracking-wide border-b border-cockpit-border/40"
        >
          {columns[0]} {group.label}
        </td>
      </tr>,
    )

    for (let i = group.startIndex; i < group.startIndex + group.count; i++) {
      const row = rows[i]
      const isExtrapolated = extrapolatedSet?.has(i) ?? false
      elements.push(
        <tr key={i} className={stripe % 2 === 0 ? 'bg-cockpit-panel/20' : ''}>
          {row.slice(1).map((cell, ci) => (
            <td
              key={ci}
              className={`py-1.5 px-2 ${
                isExtrapolated
                  ? 'text-cockpit-extrapolated'
                  : ci === 0
                    ? 'font-semibold text-cockpit-text-primary'
                    : 'text-cockpit-text-secondary'
              }`}
            >
              {cell}
            </td>
          ))}
        </tr>,
      )
      stripe++
    }
  }

  return elements
}
