import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { Aircraft } from '../types'
import { FeedbackModal } from './FeedbackModal'

interface Props {
  aircraft: Aircraft | null
  phaseName: string | null
}

export function FeedbackButton({ aircraft, phaseName }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-6 right-6 z-40 w-11 h-11 flex items-center justify-center rounded-full
                   bg-[var(--cockpit-card)] border border-[var(--cockpit-border)]
                   text-cockpit-text-secondary hover:text-cockpit-text-primary
                   hover:border-cockpit-amber/60 hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]
                   transition-all duration-200 cursor-pointer"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        aircraft={aircraft}
        phaseName={phaseName}
      />
    </>
  )
}
