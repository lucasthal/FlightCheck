import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface FeedbackPayload {
  name: string
  message: string
  aircraftId: string | null
  aircraftName: string | null
  phaseName: string | null
}

export function useFeedback(user: User | null) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (payload: FeedbackPayload) => {
    if (!user) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('feedback').insert({
      user_id: user.id,
      email: user.email,
      name: payload.name,
      message: payload.message,
      aircraft_id: payload.aircraftId,
      aircraft_name: payload.aircraftName,
      phase_name: payload.phaseName,
    })
    setSubmitting(false)
    if (err) {
      setError('Something went wrong — please try again')
    } else {
      setSuccess(true)
    }
  }

  const reset = () => {
    setError(null)
    setSuccess(false)
  }

  return { submit, submitting, error, success, reset }
}
