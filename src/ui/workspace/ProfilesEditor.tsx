import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ConditionsFile, PublishProfile, WorkspaceConfig } from '../../core/workspace/types'
import { validateIdentifierKeys, type IdentifierError, type KeyCandidate } from '../../core/workspace/identifier-keys'
import { writeWorkspaceConfig } from '../../fs'
import { ConfirmDialog } from './ConfirmDialog'

const AUTOSAVE_DELAY_MS = 1200

interface DraftProfile {
  id: string
  name: string
  /** Dimension name -> selected values for this profile. May reference dimension
   *  names or values no longer present in conditionsFile (orphaned by a since-deleted
   *  dimension/value) — preserved verbatim, never pruned by this component. */
  selections: Record<string, string[]>
  /** True for profiles loaded from disk at mount; false for profiles added this session and never saved. */
  existedAtLoad: boolean
}

interface ProfilesEditorProps {
  handle: FileSystemDirectoryHandle
  /** Read once via a lazy useState initializer — same never-resync rationale as VariablesEditor.initialVariables. */
  initialProfiles: Record<string, PublishProfile>
  /**
   * Live, read-only reference data for rendering the toggle groups — this
   * component never mutates it. Deliberately NOT snapshotted at mount (unlike
   * initialProfiles) so a dimension just added in the sibling Conditions
   * editor becomes togglable here immediately, without a remount.
   */
  conditionsFile: ConditionsFile
  /** Full workspace config, so a save can preserve name/site/formatVersion untouched. */
  workspaceConfig: WorkspaceConfig
  onSaved: () => void
}

export interface ProfilesEditorHandle {
  /** No-op if the current draft is invalid — nothing safe to write. The
   *  draft stays in memory (this component never unmounts) until fixed. */
  flushSave: () => Promise<void>
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function profilesFromRecord(profiles: Record<string, PublishProfile>): DraftProfile[] {
  return Object.entries(profiles)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, profile]) => ({
      id: crypto.randomUUID(),
      name,
      selections: Object.fromEntries(Object.entries(profile).map(([dimension, values]) => [dimension, [...values]])),
      existedAtLoad: true,
    }))
}

// TODO(future phase): surface an "N unused entries — clean up" affordance for
// selections that reference a since-deleted dimension/value, instead of only
// silently preserving them until a human happens to edit that profile card.
function serializeProfiles(profiles: DraftProfile[]): Record<string, PublishProfile> {
  const result: Record<string, PublishProfile> = {}
  for (const profile of profiles) {
    const name = profile.name.trim()
    if (!name) continue
    result[name] = profile.selections
  }
  return result
}

/** Order-independent snapshot for dirty-checking — profile/selection add/delete/reorder never produces a spurious dirty flag. */
function canonicalJson(profiles: Record<string, PublishProfile>): string {
  const entries: Array<[string, Array<[string, string[]]>]> = Object.entries(profiles)
    .map(([name, profile]): [string, Array<[string, string[]]>] => [
      name,
      Object.entries(profile)
        .map(([dimension, values]): [string, string[]] => [dimension, [...values].sort()])
        .sort(([a], [b]) => a.localeCompare(b)),
    ])
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

function errorMessage(errors: IdentifierError[]): string {
  if (errors.includes('empty')) return 'Required'
  const invalid = errors.includes('invalid-format')
  const duplicate = errors.includes('duplicate')
  if (invalid && duplicate) return 'Only letters, numbers, _ and - are allowed, and this is already used'
  if (invalid) return 'Only letters, numbers, _ and - are allowed'
  if (duplicate) return 'Already used'
  return ''
}

export const ProfilesEditor = forwardRef<ProfilesEditorHandle, ProfilesEditorProps>(function ProfilesEditor(
  { handle, initialProfiles, conditionsFile, workspaceConfig, onSaved },
  forwardedRef,
) {
  const [profiles, setProfiles] = useState<DraftProfile[]>(() => profilesFromRecord(initialProfiles))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const profilesRef = useRef(profiles)
  const workspaceConfigRef = useRef(workspaceConfig)
  const lastSavedRef = useRef(canonicalJson(initialProfiles))
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    workspaceConfigRef.current = workspaceConfig
  }, [workspaceConfig])

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    },
    [],
  )

  const nameErrors = useMemo(
    () => validateIdentifierKeys(profiles.map((p): KeyCandidate => ({ id: p.id, key: p.name }))),
    [profiles],
  )
  const hasErrors = nameErrors.size > 0

  const currentJson = useMemo(() => canonicalJson(serializeProfiles(profiles)), [profiles])
  const dirty = currentJson !== lastSavedRef.current

  const attemptSave = useCallback(
    async (currentProfiles: DraftProfile[]) => {
      const errors = validateIdentifierKeys(currentProfiles.map((p): KeyCandidate => ({ id: p.id, key: p.name })))
      if (errors.size > 0) return
      const nextProfiles = serializeProfiles(currentProfiles)
      const nextJson = canonicalJson(nextProfiles)
      if (nextJson === lastSavedRef.current) return
      setSaveStatus('saving')
      try {
        await writeWorkspaceConfig(handle, { ...workspaceConfigRef.current, publishProfiles: nextProfiles })
        lastSavedRef.current = nextJson
        const savedIds = new Set(currentProfiles.filter((p) => p.name.trim()).map((p) => p.id))
        setProfiles((prev) => {
          const next = prev.map((p) => (savedIds.has(p.id) ? { ...p, existedAtLoad: true } : p))
          profilesRef.current = next
          return next
        })
        setSaveStatus('saved')
        setSaveError(null)
        onSaved()
      } catch (err) {
        setSaveStatus('error')
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    },
    [handle, onSaved],
  )

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void attemptSave(profilesRef.current)
    }, AUTOSAVE_DELAY_MS)
  }, [attemptSave])

  useImperativeHandle(forwardedRef, () => ({
    flushSave: async () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      await attemptSave(profilesRef.current)
    },
  }))

  function applyProfilesUpdate(updater: (prev: DraftProfile[]) => DraftProfile[]) {
    setProfiles((prev) => {
      const next = updater(prev)
      profilesRef.current = next
      return next
    })
  }

  function updateName(id: string, name: string) {
    applyProfilesUpdate((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
    scheduleAutosave()
  }

  function toggleValue(profileId: string, dimension: string, value: string) {
    applyProfilesUpdate((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p
        const current = p.selections[dimension] ?? []
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        return { ...p, selections: { ...p.selections, [dimension]: next } }
      }),
    )
    scheduleAutosave()
  }

  function addProfile() {
    applyProfilesUpdate((prev) => [...prev, { id: crypto.randomUUID(), name: '', selections: {}, existedAtLoad: false }])
  }

  function removeProfile(id: string) {
    applyProfilesUpdate((prev) => prev.filter((p) => p.id !== id))
    scheduleAutosave()
  }

  function requestDelete(id: string) {
    const profile = profiles.find((p) => p.id === id)
    if (!profile) return
    if (!profile.existedAtLoad) {
      removeProfile(id)
      return
    }
    setPendingDeleteId(id)
  }

  function confirmDelete() {
    if (pendingDeleteId) removeProfile(pendingDeleteId)
    setPendingDeleteId(null)
  }

  function handleExplicitSave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    void attemptSave(profiles)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      handleExplicitSave()
    }
  }

  const pendingDeleteProfile = profiles.find((p) => p.id === pendingDeleteId) ?? null
  const dimensionsWithValues = Object.entries(conditionsFile).filter(([, values]) => values.length > 0)

  const status = hasErrors
    ? { text: 'Fix errors to save', className: 'text-red-400' }
    : saveStatus === 'saving'
      ? { text: 'Saving…', className: 'text-gray-400' }
      : saveStatus === 'error'
        ? { text: 'Save failed', className: 'text-red-400' }
        : dirty
          ? { text: 'Unsaved', className: 'text-amber-400' }
          : { text: 'Saved', className: 'text-gray-400' }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-800" onKeyDown={handleKeyDown}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium text-gray-200">Publish profiles</h1>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            disabled={hasErrors || !dirty}
            className="rounded border border-gray-600 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleExplicitSave}
          >
            Save
          </button>
          <span className={`text-xs ${status.className}`}>{status.text}</span>
        </div>
      </header>
      {saveError && <p className="border-b border-gray-700 px-4 py-2 text-sm text-red-400">{saveError}</p>}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {profiles.map((profile) => {
            const errors = nameErrors.get(profile.id)
            return (
              <div key={profile.id} className="rounded border border-gray-700 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(event) => updateName(profile.id, event.target.value)}
                      placeholder="profile name"
                      className={`w-full rounded border bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none ${
                        errors ? 'border-red-500' : 'border-gray-600 focus:border-violet-400'
                      }`}
                    />
                    {errors && <p className="mt-1 text-xs text-red-400">{errorMessage(errors)}</p>}
                  </div>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400"
                    title="Delete profile"
                    aria-label={`Delete ${profile.name || 'profile'}`}
                    onClick={() => requestDelete(profile.id)}
                  >
                    ✕
                  </button>
                </div>

                {dimensionsWithValues.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">
                    Add condition dimensions and values first — see Edit conditions.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {dimensionsWithValues.map(([dimension, values]) => (
                      <div key={dimension}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{dimension}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {values.map((value) => (
                            <label key={value} className="flex items-center gap-1 text-xs text-gray-200">
                              <input
                                type="checkbox"
                                checked={profile.selections[dimension]?.includes(value) ?? false}
                                onChange={() => toggleValue(profile.id, dimension, value)}
                              />
                              {value}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {profiles.length === 0 && <p className="text-sm text-gray-400">No publish profiles yet.</p>}
        <button
          type="button"
          className="mt-3 rounded border border-gray-600 px-3 py-1.5 text-sm text-violet-400 hover:bg-gray-700"
          onClick={addProfile}
        >
          + Add profile
        </button>
      </div>

      {pendingDeleteProfile && (
        <ConfirmDialog
          title="Delete profile"
          message={`Delete "${pendingDeleteProfile.name}"? This can't be undone from here.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
})
