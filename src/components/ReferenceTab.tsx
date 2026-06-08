import type { ReferenceSection } from '../types'
import { SpeedsCard } from './reference/SpeedsCard'
import { ManeuverCard } from './reference/ManeuverCard'
import { TableCard } from './reference/TableCard'
import { KeyValCard } from './reference/KeyValCard'

interface Props {
  sections: ReferenceSection[]
}

export function ReferenceTab({ sections }: Props) {
  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-cockpit-text-dim text-sm">
        No reference data available for this aircraft.
      </div>
    )
  }

  return (
    <div className="text-scale-scope max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
      {sections.map((section, i) => {
        if (section.kind === 'speeds') return <SpeedsCard key={i} title={section.title} items={section.items} />
        if (section.kind === 'maneuver') return <ManeuverCard key={i} title={section.title} steps={section.steps} standards={section.standards} />
        if (section.kind === 'table') return <TableCard key={i} title={section.title} columns={section.columns} rows={section.rows} notes={section.notes} />
        if (section.kind === 'keyval') return <KeyValCard key={i} title={section.title} items={section.items} />
        return null
      })}
    </div>
  )
}
