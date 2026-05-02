import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  /** If set, this is the name being copied (shown as hint). If null, editing the original. */
  sourceProfileName: string | null
  existingNames: string[]
  onSave: (name: string) => void
  onCancel: () => void
}

export function SaveAsDialog({ sourceProfileName, existingNames, onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const trimmed = name.trim()
  const duplicate = existingNames.includes(trimmed)
  const empty = trimmed.length === 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (empty || duplicate) return
    onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-cockpit-text-primary">
              {sourceProfileName ? 'Save As New Profile' : 'Name Your Profile'}
            </h3>
            <p className="text-xs text-cockpit-text-dim mt-1">
              {sourceProfileName
                ? `Copying "${sourceProfileName}"`
                : 'The original POH checklist will not be changed.'}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5 text-cockpit-text-dim">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. IFR Cross-Country"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
                       focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                       transition-all duration-150 mb-1"
          />
          {duplicate && (
            <p className="text-xs text-red-400 mb-3">A profile with this name already exists.</p>
          )}
          {!duplicate && <div className="mb-3" />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary
                         text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={empty || duplicate}
              className="flex-1 py-3 rounded-xl bg-cockpit-amber/15 border border-cockpit-amber/40
                         text-cockpit-amber text-sm font-semibold hover:bg-cockpit-amber/25
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
