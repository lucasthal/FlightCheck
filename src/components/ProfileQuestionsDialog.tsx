import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { PROFILE_QUESTIONS } from '../data/profileQuestions'

interface Props {
  onConfirm: (enabled: Record<string, boolean>) => void
  onCancel: () => void
}

export function ProfileQuestionsDialog({ onConfirm, onCancel }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(PROFILE_QUESTIONS.map(q => [q.id, true]))
  )

  const toggle = (id: string) => setEnabled(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-cockpit-text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cockpit-info" />
            Customize Checklist
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5 text-cockpit-text-dim">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-cockpit-text-dim mb-5">
          Optional items to include — can be removed later in edit mode
        </p>

        <div className="space-y-3 mb-5">
          {PROFILE_QUESTIONS.map(q => (
            <button
              key={q.id}
              onClick={() => toggle(q.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150
                ${enabled[q.id]
                  ? 'border-cockpit-info/40 bg-cockpit-info/10'
                  : 'border-cockpit-border bg-cockpit-card/30 opacity-50'
                }`}
            >
              <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                ${enabled[q.id] ? 'border-cockpit-info bg-cockpit-info' : 'border-cockpit-border'}`}
              >
                {enabled[q.id] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6L4.5 9L10.5 3" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-cockpit-text-primary">{q.label}</p>
                <p className="text-xs text-cockpit-text-dim mt-0.5">{q.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary
                       text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(enabled)}
            className="flex-1 py-3 rounded-xl bg-cockpit-accent/15 border border-cockpit-accent/40
                       text-cockpit-accent text-sm font-semibold hover:bg-cockpit-accent/25 transition-colors"
          >
            Create Profile
          </button>
        </div>
      </div>
    </div>
  )
}
