import { useState, useCallback } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Plus, Check, X, ChevronDown, ChevronRight, Sparkles, AlertTriangle } from 'lucide-react'
import type { ProfilePhase, ProfileItem, PhaseCategory } from '../types'
import type { useProfileEditor } from '../hooks/useProfileEditor'

type Editor = ReturnType<typeof useProfileEditor>

const PHASE_CATEGORIES: PhaseCategory[] = [
  'preflight', 'startup', 'taxi', 'runup', 'takeoff',
  'climb', 'cruise', 'descent', 'approach', 'landing', 'shutdown', 'emergency',
]

interface Props {
  editor: Editor
  profileName: string
  onSave: () => void
  onSaveAs: () => void
  onDiscard: () => void
  saving: boolean
}

export function ChecklistEditorView({ editor, profileName, onSave, onSaveAs, onDiscard, saving }: Props) {
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseTitle, setNewPhaseTitle] = useState('')
  const [newPhaseCategory, setNewPhaseCategory] = useState<PhaseCategory>('preflight')

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const phaseIds = editor.phases.map(ph => ph.id)

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const isPhase = phaseIds.includes(active.id as string)
    if (isPhase) {
      const oldIdx = phaseIds.indexOf(active.id as string)
      const newIdx = phaseIds.indexOf(over.id as string)
      if (newIdx === -1) return
      editor.reorderPhases(arrayMove(phaseIds, oldIdx, newIdx))
    } else {
      const sourcePhase = editor.phases.find(ph => ph.items.some(i => i.id === active.id))
      if (!sourcePhase) return
      const itemIds = sourcePhase.items.map(i => i.id)
      const oldIdx = itemIds.indexOf(active.id as string)
      const newIdx = itemIds.indexOf(over.id as string)
      if (newIdx === -1) return
      editor.reorderItems(sourcePhase.id, arrayMove(itemIds, oldIdx, newIdx))
    }
  }, [editor, phaseIds])

  const handleAddPhase = () => {
    const title = newPhaseTitle.trim()
    if (!title) return
    editor.addPhase(title, newPhaseCategory)
    setNewPhaseTitle('')
    setNewPhaseCategory('preflight')
    setAddingPhase(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 px-3 py-2.5 bg-cockpit-amber/5
                      border border-cockpit-amber/20 rounded-xl">
        <div>
          <p className="text-xs font-semibold text-cockpit-amber">Edit Mode</p>
          <p className="text-xs text-cockpit-text-dim truncate max-w-[160px]">{profileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
                       hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSaveAs}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
                       hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            Save As
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
                       text-cockpit-amber text-xs font-semibold hover:bg-cockpit-amber/25
                       disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Sortable phases + items */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phaseIds} strategy={verticalListSortingStrategy}>
          {editor.phases.map(phase => (
            <SortablePhaseSection key={phase.id} phase={phase} editor={editor} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add phase */}
      {addingPhase ? (
        <div className="mt-4 p-3 bg-cockpit-card border border-cockpit-amber/20 rounded-xl space-y-2">
          <input
            type="text"
            placeholder="Phase name (e.g. Cruise)"
            value={newPhaseTitle}
            onChange={e => setNewPhaseTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
                       focus:outline-none focus:border-cockpit-amber/50 transition-all"
          />
          <select
            value={newPhaseCategory}
            onChange={e => setNewPhaseCategory(e.target.value as PhaseCategory)}
            className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-secondary text-sm focus:outline-none focus:border-cockpit-amber/50"
          >
            {PHASE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setAddingPhase(false)}
              className="flex-1 py-2 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPhase}
              disabled={!newPhaseTitle.trim()}
              className="flex-1 py-2 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
                         text-cockpit-amber text-xs font-semibold disabled:opacity-40"
            >
              Add Phase
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingPhase(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     border border-dashed border-cockpit-border text-xs text-cockpit-text-dim
                     hover:border-cockpit-amber/30 hover:text-cockpit-text-secondary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Phase
        </button>
      )}
    </div>
  )
}

function SortablePhaseSection({ phase, editor }: { phase: ProfilePhase; editor: Editor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id })
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(phase.title)
  const [collapsed, setCollapsed] = useState(false)
  const itemIds = phase.items.map(i => i.id)

  const commitTitle = () => {
    const t = titleDraft.trim()
    if (t && t !== phase.title) editor.updatePhase(phase.id, { title: t })
    else setTitleDraft(phase.title)
    setEditingTitle(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-4 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Phase header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder phase"
          className="text-cockpit-text-dim hover:text-cockpit-text-secondary cursor-grab active:cursor-grabbing p-0.5"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand phase' : 'Collapse phase'}
          className="p-0.5 text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
        </button>

        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(phase.title); setEditingTitle(false) } }}
            autoFocus
            className="flex-1 px-2 py-1 rounded-lg bg-cockpit-bg border border-cockpit-amber/50
                       text-cockpit-text-primary text-sm font-semibold focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-cockpit-text-primary">
            {phase.title}
            {collapsed && (
              <span className="ml-2 text-xs font-normal text-cockpit-text-dim">
                {phase.items.length} items
              </span>
            )}
          </span>
        )}

        <button
          onClick={() => { setTitleDraft(phase.title); setEditingTitle(true) }}
          aria-label={`Rename phase ${phase.title}`}
          className="p-1 rounded-lg text-cockpit-text-dim hover:text-cockpit-amber hover:bg-cockpit-card transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.deletePhase(phase.id)}
          aria-label={`Delete phase ${phase.title}`}
          className="p-1 rounded-lg text-cockpit-text-dim hover:text-red-400 hover:bg-cockpit-card transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="bg-cockpit-card/40 border border-cockpit-border/40 rounded-xl overflow-hidden">
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {phase.items.map((item, idx) => (
              <SortableItemRow key={item.id} item={item} index={idx} phaseId={phase.id} editor={editor} />
            ))}
          </SortableContext>

          {/* Add item */}
          <button
            onClick={() => editor.addItem(phase.id, { action: 'New item' })}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cockpit-text-dim
                       hover:bg-cockpit-card hover:text-cockpit-text-secondary border-t border-cockpit-border/30
                       transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add item
          </button>
        </div>
      )}
    </div>
  )
}

function SortableItemRow({ item, index, phaseId, editor }: { item: ProfileItem; index: number; phaseId: string; editor: Editor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.action)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  const openNote = () => {
    setNoteDraft(item.note ?? '')
    setNoteOpen(true)
  }

  const saveNote = () => {
    const text = noteDraft.trim()
    const patch: { note?: string; severity?: 'caution' } = { note: text || undefined }
    if (text && !item.severity) patch.severity = 'caution'
    if (!text && item.severity === 'caution') patch.severity = undefined
    editor.updateItem(phaseId, item.id, patch)
    setNoteOpen(false)
  }

  const cancelNote = () => {
    setNoteOpen(false)
  }

  const commitEdit = () => {
    const t = draft.trim()
    if (t && t !== item.action) editor.updateItem(phaseId, item.id, { action: t })
    else setDraft(item.action)
    setEditing(false)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-cockpit-border/20 last:border-b-0
                    bg-cockpit-card/30 ${isDragging ? 'opacity-50 z-50' : ''}
                    ${item.note && !noteOpen ? 'border-l-2 border-l-yellow-500' : 'border-l-2 border-l-transparent'}`}
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder item"
          className="text-cockpit-text-dim hover:text-cockpit-text-secondary cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-cockpit-text-dim flex-shrink-0 w-5 text-right">
          {String(index + 1).padStart(2, '0')}
        </span>

        {editing ? (
          <>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setDraft(item.action); setEditing(false) } }}
              autoFocus
              className="flex-1 px-2 py-0.5 rounded-lg bg-cockpit-bg border border-cockpit-amber/50
                         text-cockpit-text-primary text-sm focus:outline-none"
            />
            <button onClick={commitEdit} aria-label="Confirm edit" className="p-1 text-cockpit-amber">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setDraft(item.action); setEditing(false) }} aria-label="Cancel edit" className="p-1 text-cockpit-text-dim">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-cockpit-text-primary leading-snug min-w-0 truncate">
              {item.action}
            </span>
            {item.severity === 'setup' && (
              <span title="Added by setup wizard"><Sparkles className="w-3.5 h-3.5 text-cockpit-blue flex-shrink-0" /></span>
            )}
            {!noteOpen && (item.note ? (
              <button
                onClick={openNote}
                className="text-xs whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-md
                           text-yellow-500 bg-yellow-500/10 border border-yellow-500/30
                           hover:bg-yellow-500/20 transition-colors"
              >
                Edit note
              </button>
            ) : (
              <button
                onClick={openNote}
                className="text-xs whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-md transition-colors
                  text-cockpit-text-dim hover:text-yellow-400 hover:bg-yellow-500/10"
              >
                Add note
              </button>
            ))}
            <button
              onClick={() => { setDraft(item.action); setEditing(true) }}
              aria-label={`Edit item ${item.action}`}
              className="p-1 rounded-lg text-cockpit-text-dim hover:text-cockpit-amber hover:bg-cockpit-bg transition-colors flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.deleteItem(phaseId, item.id)}
              aria-label={`Delete item ${item.action}`}
              className="p-1 rounded-lg text-cockpit-text-dim hover:text-red-400 hover:bg-cockpit-bg transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Inline note textarea (open state) */}
      {noteOpen && (
        <div className="px-3 pb-2.5 pt-1">
          <textarea
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            placeholder="Add a note…"
            autoFocus
            rows={3}
            className="w-full bg-cockpit-bg border border-yellow-500/30 rounded-lg px-3 py-2
                       text-xs text-cockpit-text-primary placeholder-cockpit-text-dim
                       focus:outline-none focus:border-yellow-500/60 resize-none"
          />
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={saveNote}
              className="text-xs px-3 py-1 rounded-md bg-yellow-500/15 border border-yellow-500/40
                         text-yellow-500 font-semibold hover:bg-yellow-500/25 transition-colors"
            >
              Save
            </button>
            <button
              onClick={cancelNote}
              className="text-xs px-3 py-1 rounded-md border border-cockpit-border
                         text-cockpit-text-dim hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved note display (closed state) */}
      {item.note && !noteOpen && (
        <div className="px-3 pb-2.5 pt-0.5">
          <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wider">Note</span>
            </div>
            <p className="text-[11px] text-yellow-200 leading-relaxed">{item.note}</p>
            <button
              onClick={() => editor.updateItem(phaseId, item.id, {
                note: undefined,
                ...(item.severity === 'caution' ? { severity: undefined } : {}),
              })}
              className="mt-1.5 text-[11px] text-cockpit-text-dim hover:text-red-400 transition-colors"
            >
              ✕ Remove note
            </button>
          </div>
        </div>
      )}
    </>
  )
}
