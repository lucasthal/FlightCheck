import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Aircraft } from '../types'
import { useAuth } from '../hooks/useAuth'
import { getDisplayName } from '../lib/displayName'
import { useFeedback } from '../hooks/useFeedback'

interface Props {
  isOpen: boolean
  onClose: () => void
  aircraft: Aircraft | null
  phaseName: string | null
}

export function FeedbackModal({ isOpen, onClose, aircraft, phaseName }: Props) {
  const { user } = useAuth()
  const { submit, submitting, error, success, reset } = useFeedback(user)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(getDisplayName(user) ?? '')
      setMessage('')
      reset()
      // allow modal to finish mounting before stealing focus
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  // intentionally omit reset and user — re-running on auth refresh would clear a message being composed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (success) {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [success, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, submitting, onClose])

  // Focus trap — re-queries on each keydown so disabled buttons are excluded during submit
  useEffect(() => {
    if (!isOpen) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const modal = dialogRef.current
      if (!modal) return
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  const contextLabel = aircraft
    ? [aircraft.name, phaseName].filter(Boolean).join(' · ')
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit({
      name,
      message,
      aircraftId: aircraft?.id ?? null,
      aircraftName: aircraft?.name ?? null,
      phaseName,
    })
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!submitting) onClose() }}
      />

      {/* Card */}
      <div className="relative bg-[var(--cockpit-card)] border border-[var(--cockpit-border)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="feedback-title" className="text-base font-semibold text-cockpit-text-primary">
            Send Feedback
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="p-1.5 rounded-lg text-cockpit-text-dim hover:text-cockpit-text-primary
                       transition-colors duration-150 cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="fb-name" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Name
            </label>
            <input
              id="fb-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-primary text-sm
                         focus:outline-none focus:border-cockpit-accent/50 focus:ring-2 focus:ring-cockpit-accent/10
                         transition-all duration-150"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="fb-email" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="fb-email"
              type="email"
              value={user?.email ?? ''}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-dim text-sm opacity-50 cursor-not-allowed"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="fb-message" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Message
            </label>
            <textarea
              id="fb-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="What's on your mind?"
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-primary text-sm placeholder-cockpit-text-dim resize-none
                         focus:outline-none focus:border-cockpit-accent/50 focus:ring-2 focus:ring-cockpit-accent/10
                         transition-all duration-150"
            />
          </div>

          {/* Context strip */}
          {contextLabel && (
            <div>
              <p className="text-xs text-cockpit-text-dim uppercase tracking-wide mb-1">Attaching context</p>
              <p className="text-xs font-mono text-cockpit-text-dim bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2">
                {contextLabel}
              </p>
            </div>
          )}

          {/* Error — always rendered so aria-live announces changes */}
          <div aria-live="polite" aria-atomic="true">
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium
                         hover:text-cockpit-text-primary hover:border-cockpit-text-dim
                         transition-all duration-150 cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50
                ${success
                  ? 'bg-cockpit-green/20 text-cockpit-green border border-cockpit-green/30'
                  : 'bg-cockpit-accent text-cockpit-on-accent hover:opacity-90'
                }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-cockpit-bg/30 border-t-cockpit-bg animate-spin" />
                  Sending…
                </span>
              ) : success ? 'Sent!' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
