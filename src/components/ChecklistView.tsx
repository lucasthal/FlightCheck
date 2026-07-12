import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { Aircraft, ChecklistPhase, AircraftCategory, PhaseCategory } from '../types'
import { useChecklist } from '../hooks/useChecklist'
import { useProfiles } from '../hooks/useProfiles'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useAuth } from '../hooks/useAuth'
import { useWakeLock } from '../hooks/useWakeLock'
import { usePreferences } from '../hooks/usePreferences'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { tapFeedback } from '../lib/haptics'
import { PhaseNav } from './PhaseNav'
import { ChecklistItems } from './ChecklistItems'
import { EmergencyPanel } from './EmergencyPanel'
import { ProfilePicker } from './ProfilePicker'
import { SaveAsDialog } from './SaveAsDialog'
import { ProfileQuestionsDialog } from './ProfileQuestionsDialog'
import { ChecklistEditorView } from './ChecklistEditorView'
import { OfflineBanner } from './OfflineBanner'
import {
  ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
  Pencil, Settings,
} from 'lucide-react'
import { PhaseBanner } from './PhaseBanner'
import { PhaseStrip } from './PhaseStrip'
import { VSpeedCard } from './VSpeedCard'
import { ReferenceTab } from './ReferenceTab'

// Position of the active (next-to-tap) item within the scroll container.
// 0.5 = exact center of items area; 0.85 = lower portion of items area,
// which on a typical phone screen falls into the natural thumb zone.
// Higher values put the active item lower on screen (closer to thumb)
// but require more checked items above before early items can reach the
// landing point via scroll (without a top spacer).
const ACTIVE_ITEM_POSITION_RATIO = 0.85

const CATEGORY_ACCENT: Record<AircraftCategory, string> = {
  SEP:        'text-cockpit-cat-sep',
  MEP:        'text-cockpit-cat-mep',
  Turboprop:  'text-cockpit-cat-tp',
  Jet:        'text-cockpit-cat-jet',
  Helicopter: 'text-cockpit-cat-heli',
}

const CATEGORY_BORDER: Record<AircraftCategory, string> = {
  SEP:        'border-cockpit-cat-sep/30',
  MEP:        'border-cockpit-cat-mep/30',
  Turboprop:  'border-cockpit-cat-tp/30',
  Jet:        'border-cockpit-cat-jet/30',
  Helicopter: 'border-cockpit-cat-heli/30',
}

interface Props {
  aircraft: Aircraft
  onBack: () => void
  onOpenSettings: () => void
  onPhaseChange?: (phaseName: string) => void
}

/** Convert ProfilePhase[] → ChecklistPhase[] so existing components work unchanged */
function profileToChecklistPhases(phases: import('../types').ProfilePhase[]): ChecklistPhase[] {
  return phases.map(ph => ({
    id: ph.id,
    name: ph.title,
    category: ph.category as PhaseCategory,
    items: ph.items.map(i => ({
      id: i.id,
      action: i.action,
      response: i.response,
      note: i.note,
      severity: i.severity,
    })),
  }))
}

export function ChecklistView({ aircraft, onBack, onOpenSettings, onPhaseChange }: Props) {
  const profiles = useProfiles(aircraft.id)
  const { isOnline } = useNetworkStatus()
  const editor = useProfileEditor()
  const { user } = useAuth()
  const { preferences } = usePreferences()

  useWakeLock({ enabled: preferences.keep_screen_awake })

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [pendingProfileName, setPendingProfileName] = useState<string | null>(null)
  const [showNewFlightConfirm, setShowNewFlightConfirm] = useState(false)
  const [showResetProfileConfirm, setShowResetProfileConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingBack, setPendingBack] = useState(false)
  const [pendingProfileId, setPendingProfileId] = useState<string | null | undefined>(undefined) // undefined = not pending

  // Build active aircraft: original phases replaced by profile phases if active profile exists
  const activeAircraft: Aircraft = profiles.activeProfile
    ? { ...aircraft, phases: profileToChecklistPhases(profiles.activeProfile.phases) }
    : aircraft

  const {
    activePhaseId, selectPhase, toggleItem, completePhase, resetFlight,
    getPhaseProgress, isItemChecked, isPhaseComplete,
  } = useChecklist(activeAircraft, profiles.activeProfile?.id ?? null)

  const [showEmergency, setShowEmergency] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'checklist' | 'reference'>('checklist')
  const contentRef = useRef<HTMLDivElement>(null)
  const [bottomSpacer, setBottomSpacer] = useState(0)

  const normalPhases = activeAircraft.phases.filter(p => p.category !== 'emergency')
  const emergencyPhases = activeAircraft.phases.filter(p => p.category === 'emergency')
  const activePhase = activeAircraft.phases.find(p => p.id === activePhaseId)

  const { checked: phaseChecked, total: phaseTotal } = getPhaseProgress(activePhaseId)
  const phaseAllChecked = phaseTotal > 0 && phaseChecked === phaseTotal

  const totalItems = normalPhases.reduce((sum, p) => sum + p.items.length, 0)
  const totalChecked = normalPhases.reduce((sum, p) => sum + getPhaseProgress(p.id).checked, 0)
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  const accentColor = CATEGORY_ACCENT[aircraft.category]
  const accentBorder = CATEGORY_BORDER[aircraft.category]

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePhaseId])

  useLayoutEffect(() => {
    if (!preferences.autoscroll) {
      setBottomSpacer(0)
      return
    }
    const recalc = () => {
      const c = contentRef.current
      if (!c) return
      const firstItem = c.querySelector<HTMLElement>('[data-item-id]')
      const itemHalf = firstItem ? firstItem.clientHeight / 2 : 24
      // Bottom spacer only — gives the final scroll target (Complete Phase
      // button) enough runway to reach the click-through ratio. No top
      // spacer per user request: items start at the top of the scroll area.
      // Trade-off: early items will appear near the top of the viewport
      // until enough have been checked to let later ones reach the landing
      // point at ACTIVE_ITEM_POSITION_RATIO.
      setBottomSpacer(Math.max(0, c.clientHeight * (1 - ACTIVE_ITEM_POSITION_RATIO) - itemHalf))
    }
    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [preferences.autoscroll, activePhaseId, editMode])

  // Reset phase selection when active profile changes (phase IDs differ between profile and original)
  useEffect(() => {
    const first = normalPhases[0]
    if (first) selectPhase(first.id)
  }, [profiles.activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit mode helpers ──────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    if (!profiles.activeProfile) {
      // On original — must Save As first
      setShowSaveAs(true)
    } else {
      editor.load(profiles.activeProfile.phases)
      setEditMode(true)
    }
  }, [profiles.activeProfile, editor])

  const handleSave = useCallback(async () => {
    if (!profiles.activeProfile) return
    setSaving(true)
    setSaveError(null)
    try {
      await editor.save(profiles.activeProfile.id)
      const freshProfiles = await profiles.fetchProfiles()
      const freshProfile = freshProfiles.find(p => p.id === profiles.activeProfile!.id)
      if (freshProfile) editor.load(freshProfile.phases)
      setEditMode(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [profiles, editor])

  const handleSaveAsFromEditMode = useCallback(() => {
    setShowSaveAs(true)
  }, [])

  const handleDiscard = useCallback(() => {
    if (editor.isDirty) {
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
    }
  }, [editor])

  const handleSaveAsConfirm = useCallback(async (name: string) => {
    setShowSaveAs(false)
    if (!profiles.activeProfile) {
      // No active profile — creating from original aircraft template, show questions first
      setPendingProfileName(name)
      setShowQuestions(true)
      return
    }
    // Has active profile — copying it, skip questions
    setCreating(true)
    try {
      const freshProfiles = await profiles.createFromProfile(profiles.activeProfile, name)
      const newProfile = freshProfiles.find(p => p.is_active)
      if (newProfile) { editor.load(newProfile.phases); setEditMode(true) }
    } finally {
      setCreating(false)
    }
  }, [profiles, editor])

  const handleQuestionsConfirm = useCallback(async (enabledQuestions: Record<string, boolean>) => {
    setShowQuestions(false)
    const name = pendingProfileName
    setPendingProfileName(null)
    if (!name) return
    setCreating(true)
    try {
      const freshProfiles = await profiles.createFromAircraft(aircraft, name, enabledQuestions)
      const newProfile = freshProfiles.find(p => p.is_active)
      if (newProfile) { editor.load(newProfile.phases); setEditMode(true) }
    } finally {
      setCreating(false)
    }
  }, [pendingProfileName, profiles, aircraft, editor])

  const handleQuestionsCancel = useCallback(() => {
    setShowQuestions(false)
    setPendingProfileName(null)
  }, [])

  // Guard: back button while editing
  const handleBack = useCallback(() => {
    if (editMode && editor.isDirty) {
      setPendingBack(true)
      setShowDiscardConfirm(true)
    } else {
      onBack()
    }
  }, [editMode, editor.isDirty, onBack])

  // Guard: profile switch while editing
  const handleProfileSelect = useCallback((profileId: string | null) => {
    if (editMode && editor.isDirty) {
      setPendingProfileId(profileId)
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
      profiles.setActive(profileId)
    }
  }, [editMode, editor.isDirty, profiles])

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardConfirm(false)
    editor.reset()
    setEditMode(false)
    if (pendingBack) {
      setPendingBack(false)
      onBack()
    } else if (pendingProfileId !== undefined) {
      profiles.setActive(pendingProfileId)
      setPendingProfileId(undefined)
    }
  }, [editor, onBack, pendingBack, pendingProfileId, profiles])

  const handlePhaseSelect = (phaseId: string) => {
    selectPhase(phaseId)
    setSidebarOpen(false)
    const phase = activeAircraft.phases.find(p => p.id === phaseId)
    if (phase) onPhaseChange?.(phase.name)
  }

  const handleToggleItem = useCallback((id: string) => {
    if (!isItemChecked(id) && activePhase && preferences.autoscroll && contentRef.current) {
      const container = contentRef.current
      const items = activePhase.items
      const idx = items.findIndex(i => i.id === id)
      // First, see if there's another unchecked item after this one. Otherwise
      // (we just checked the last one), target the Complete Phase button so
      // the user's thumb doesn't have to leave the click-through zone.
      const nextItem = items.slice(idx + 1).find(i => !isItemChecked(i.id))
      const el = nextItem
        ? container.querySelector<HTMLElement>(`[data-item-id="${nextItem.id}"]`)
        : container.querySelector<HTMLElement>('[data-complete-target]')
      if (el) {
        const top = el.offsetTop - container.clientHeight * ACTIVE_ITEM_POSITION_RATIO + el.clientHeight / 2
        container.scrollTo({ top, behavior: 'smooth' })
      }
    }
    if (preferences.haptic_feedback) tapFeedback()
    toggleItem(id)
  }, [toggleItem, isItemChecked, activePhase, preferences.autoscroll, preferences.haptic_feedback])

  const handleCompletePhase = () => {
    completePhase(activePhaseId)
    const idx = normalPhases.findIndex(p => p.id === activePhaseId)
    if (idx < normalPhases.length - 1) handlePhaseSelect(normalPhases[idx + 1].id)
  }

  if (showEmergency) {
    return <EmergencyPanel phases={emergencyPhases} onClose={() => setShowEmergency(false)} />
  }

  return (
    <div className="flex flex-col h-screen bg-cockpit-bg overflow-hidden">
      <OfflineBanner visible={!isOnline || profiles.isOffline} />
      {/* Top bar */}
      <header className={`safe-top flex-shrink-0 bg-cockpit-panel border-b ${accentBorder} shadow-cockpit z-20`}>
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}
                style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}
              >
                {aircraft.category}
              </span>
              <span
                className="text-cockpit-text-dim text-xs"
                style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}
              >
                ·
              </span>
              <span
                className="text-xs text-cockpit-text-dim truncate"
                style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}
              >
                {aircraft.manufacturer}
              </span>
            </div>
            <div
              className="font-bold text-sm truncate leading-tight text-cockpit-text-primary"
              style={{ fontSize: 'calc(0.875rem * var(--text-scale))' }}
            >
              {aircraft.model} — {aircraft.name.split(' ').slice(-1)[0]}
            </div>
            {/* Profile picker */}
            <div className="mt-1">
              <ProfilePicker
                profiles={profiles.profiles}
                activeProfile={profiles.activeProfile}
                onSelect={handleProfileSelect}
                onSaveAs={() => setShowSaveAs(true)}
                onResetToOriginal={() => setShowResetProfileConfirm(true)}
                disabled={editMode}
              />
            </div>
          </div>

          {/* Progress badge */}
          {!editMode && (
            <div className="flex-shrink-0 hidden sm:flex items-center gap-2">
              <div className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border ${
                overallProgress === 100
                  ? 'bg-cockpit-green/10 border-cockpit-green/30 text-cockpit-green'
                  : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary'
              }`}>
                {overallProgress}%
              </div>
            </div>
          )}

          {/* Edit toggle */}
          {!editMode && (
            <button
              onClick={enterEditMode}
              title="Edit checklist"
              className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim hover:text-cockpit-accent transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {/* Emergency — desktop */}
          {!editMode && emergencyPhases.length > 0 && (
            <button onClick={() => setShowEmergency(true)} className="hidden sm:flex emergency-btn">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>EMERG</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="p-2 rounded-xl text-cockpit-text-primary bg-cockpit-card/60 hover:bg-cockpit-card border border-cockpit-border/50 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Mobile menu */}
          {!editMode && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress bar — hidden in edit mode */}
        {!editMode && (
          <div className="h-0.5 bg-cockpit-card">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${overallProgress}%`,
                background: overallProgress === 100
                  ? 'rgb(var(--c-green))'
                  : `linear-gradient(90deg, rgb(var(--c-accent)), rgb(var(--c-accent-dim)))`,
              }}
            />
          </div>
        )}

        {/* Tab bar — hidden in edit mode */}
        {!editMode && (
          <div className="flex border-t border-cockpit-border/40">
            {(['checklist', 'reference'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors
                  ${activeTab === tab
                    ? `${accentColor} border-b-2 border-current`
                    : 'text-cockpit-text-dim hover:text-cockpit-text-secondary border-b-2 border-transparent'
                  }`}
              >
                {tab === 'checklist' ? 'Checklist' : 'Reference'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Edit mode: full-outline editor */}
      {editMode ? (
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <ChecklistEditorView
            editor={editor}
            profileName={profiles.activeProfile?.name ?? ''}
            onSave={handleSave}
            onSaveAs={handleSaveAsFromEditMode}
            onDiscard={handleDiscard}
            saving={saving}
            isOnline={isOnline}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-cockpit-panel/60 border-r border-cockpit-border/50 overflow-y-auto">
            <PhaseNavContent
              aircraft={activeAircraft}
              normalPhases={normalPhases}
              emergencyPhases={emergencyPhases}
              activePhaseId={activePhaseId}
              onSelectPhase={handlePhaseSelect}
              onEmergency={() => setShowEmergency(true)}
              onReset={() => setShowNewFlightConfirm(true)}
              getPhaseProgress={getPhaseProgress}
              isPhaseComplete={isPhaseComplete}
              totalChecked={totalChecked}
              totalItems={totalItems}
            />
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-cockpit-panel border-r border-cockpit-border flex flex-col animate-slide-in-right">
                <div className="flex items-center justify-between px-4 py-4 border-b border-cockpit-border safe-top">
                  <div>
                    <div className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}>{aircraft.category}</div>
                    <div className="font-semibold text-cockpit-text-primary text-sm">{aircraft.name}</div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-white/5">
                    <X className="w-5 h-5 text-cockpit-text-secondary" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <PhaseNavContent
                    aircraft={activeAircraft}
                    normalPhases={normalPhases}
                    emergencyPhases={emergencyPhases}
                    activePhaseId={activePhaseId}
                    onSelectPhase={handlePhaseSelect}
                    onEmergency={() => { setShowEmergency(true); setSidebarOpen(false) }}
                    onReset={() => { setShowNewFlightConfirm(true); setSidebarOpen(false) }}
                    getPhaseProgress={getPhaseProgress}
                    isPhaseComplete={isPhaseComplete}
                    totalChecked={totalChecked}
                    totalItems={totalItems}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <main ref={contentRef} className="flex-1 overflow-y-auto">
            {activeTab === 'reference' ? (
              <ReferenceTab sections={aircraft.referenceData} />
            ) : activePhase ? (
              <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
                {Object.keys(aircraft.vSpeeds).length > 0 && (
                  <VSpeedCard vSpeeds={aircraft.vSpeeds} category={aircraft.category} />
                )}
                <PhaseBanner
                  phase={activePhase}
                  checked={phaseChecked}
                  total={phaseTotal}
                  isComplete={isPhaseComplete(activePhaseId)}
                  normalPhases={normalPhases}
                  activePhaseId={activePhaseId}
                  isPhaseComplete={isPhaseComplete}
                  category={aircraft.category}
                />
                <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={handleToggleItem} />
                <div className="mt-6" data-complete-target="true">
                  <button
                    onClick={handleCompletePhase}
                    disabled={!phaseAllChecked}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-200
                      ${phaseAllChecked
                        ? 'bg-cockpit-green/15 border-cockpit-green/40 text-cockpit-green hover:bg-cockpit-green/25 shadow-green-glow active:scale-98'
                        : 'bg-cockpit-card/30 border-cockpit-border/30 text-cockpit-text-dim cursor-not-allowed'
                      }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isPhaseComplete(activePhaseId) ? 'Phase Complete ✓' : 'Mark Phase Complete & Advance'}
                  </button>
                  {!phaseAllChecked && phaseTotal > 0 && (
                    <p className="text-center text-xs text-cockpit-text-dim mt-2">
                      {phaseTotal - phaseChecked} item{phaseTotal - phaseChecked !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
                <div style={{ height: bottomSpacer }} aria-hidden="true" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-cockpit-text-dim">
                Select a phase to begin
              </div>
            )}
          </main>
        </div>
      )}

      {!editMode && (
        <PhaseStrip
          normalPhases={normalPhases}
          emergencyPhases={emergencyPhases}
          activePhaseId={activePhaseId}
          isPhaseComplete={isPhaseComplete}
          onSelectPhase={handlePhaseSelect}
          onEmergency={() => setShowEmergency(true)}
          onReset={() => setShowNewFlightConfirm(true)}
          category={aircraft.category}
        />
      )}

      {/* Reset to original modal — deletes active profile */}
      {showResetProfileConfirm && profiles.activeProfile && (
        <ConfirmModal
          title="Reset to Original?"
          body={`This will permanently delete the "${profiles.activeProfile.name}" profile and revert to the POH checklist.`}
          confirmLabel="Reset to Original"
          confirmClass="text-cockpit-caution border-cockpit-caution/40 bg-cockpit-caution/15 hover:bg-cockpit-caution/25"
          onConfirm={async () => {
            if (profiles.activeProfile) await profiles.deleteProfile(profiles.activeProfile.id)
            setShowResetProfileConfirm(false)
          }}
          onCancel={() => setShowResetProfileConfirm(false)}
        />
      )}

      {/* New flight reset modal — clears checked items only */}
      {showNewFlightConfirm && (
        <ResetFlightModal
          aircraftName={aircraft.name}
          onConfirm={() => {
            const first = normalPhases[0]
            if (first) resetFlight(aircraft.id, first.id)
            setShowNewFlightConfirm(false)
          }}
          onCancel={() => setShowNewFlightConfirm(false)}
        />
      )}

      {/* Discard changes confirmation */}
      {showDiscardConfirm && (
        <ConfirmModal
          title="Discard Changes?"
          body="You have unsaved edits. Discard them?"
          confirmLabel="Discard"
          confirmClass="text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
          onConfirm={handleDiscardConfirm}
          onCancel={() => { setShowDiscardConfirm(false); setPendingBack(false); setPendingProfileId(undefined) }}
        />
      )}

      {/* Save error */}
      {saveError && (
        <ConfirmModal
          title="Save Failed"
          body={saveError}
          confirmLabel="OK"
          confirmClass="text-cockpit-caution border-cockpit-caution/40 bg-cockpit-caution/15 hover:bg-cockpit-caution/25"
          onConfirm={() => setSaveError(null)}
          onCancel={() => setSaveError(null)}
        />
      )}

      {/* Save As dialog */}
      {showSaveAs && (
        <SaveAsDialog
          sourceProfileName={profiles.activeProfile?.name ?? null}
          existingNames={profiles.profiles.map(p => p.name)}
          onSave={handleSaveAsConfirm}
          onCancel={() => setShowSaveAs(false)}
        />
      )}

      {/* Profile setup questions (from-aircraft only) */}
      {showQuestions && (
        <ProfileQuestionsDialog
          onConfirm={handleQuestionsConfirm}
          onCancel={handleQuestionsCancel}
        />
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 bg-cockpit-panel border border-cockpit-border rounded-2xl px-8 py-6 shadow-cockpit">
            <div className="w-8 h-8 border-2 border-cockpit-accent/30 border-t-cockpit-accent rounded-full animate-spin" />
            <p className="text-sm text-cockpit-text-secondary">Creating profile…</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PhaseNavContentProps {
  aircraft: Aircraft
  normalPhases: ChecklistPhase[]
  emergencyPhases: ChecklistPhase[]
  activePhaseId: string
  onSelectPhase: (id: string) => void
  onEmergency: () => void
  onReset: () => void
  getPhaseProgress: (id: string) => { checked: number; total: number }
  isPhaseComplete: (id: string) => boolean
  totalChecked: number
  totalItems: number
}

function PhaseNavContent({
  normalPhases, emergencyPhases, activePhaseId, onSelectPhase,
  onEmergency, onReset, getPhaseProgress, isPhaseComplete,
  totalChecked, totalItems,
}: PhaseNavContentProps) {
  const overallPct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <div className="px-2 py-3 mb-1">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-cockpit-text-dim font-medium">Overall progress</span>
          <span className="font-mono font-semibold text-cockpit-text-secondary">{totalChecked}/{totalItems}</span>
        </div>
        <div className="h-1.5 bg-cockpit-card rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%`, background: overallPct === 100 ? 'rgb(var(--c-green))' : 'rgb(var(--c-accent))' }} />
        </div>
      </div>
      <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider px-2 pb-1.5">Normal Procedures</p>
      {normalPhases.map(phase => (
        <PhaseNav
          key={phase.id}
          phase={phase}
          isActive={phase.id === activePhaseId}
          isComplete={isPhaseComplete(phase.id)}
          progress={getPhaseProgress(phase.id)}
          onClick={() => onSelectPhase(phase.id)}
        />
      ))}
      {emergencyPhases.length > 0 && (
        <>
          <div className="my-2 border-t border-cockpit-border/40" />
          <button
            onClick={onEmergency}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold
                       text-red-400 border border-red-500/20 bg-red-500/5
                       hover:bg-red-500/10 hover:border-red-500/30 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Procedures
          </button>
        </>
      )}
      <div className="mt-3 pt-3 border-t border-cockpit-border/40">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                     text-cockpit-text-dim hover:text-cockpit-text-primary hover:bg-white/5 w-full transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Flight
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; confirmClass: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <h3 className="font-bold text-cockpit-text-primary mb-2">{title}</h3>
        <p className="text-sm text-cockpit-text-secondary mb-5 leading-relaxed">{body}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetFlightModal({ aircraftName, onConfirm, onCancel }: {
  aircraftName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-cockpit-caution/10 border border-cockpit-caution/20">
            <RotateCcw className="w-5 h-5 text-cockpit-caution" />
          </div>
          <div>
            <h3 className="font-bold text-cockpit-text-primary">Start New Flight?</h3>
            <p className="text-xs text-cockpit-text-dim mt-0.5">{aircraftName}</p>
          </div>
        </div>
        <p className="text-sm text-cockpit-text-secondary mb-5 leading-relaxed">
          All checked items will be cleared and the checklist reset to Preflight.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-cockpit-caution/15 border border-cockpit-caution/40 text-cockpit-caution text-sm font-semibold hover:bg-cockpit-caution/25 transition-colors">Reset</button>
        </div>
      </div>
    </div>
  )
}
