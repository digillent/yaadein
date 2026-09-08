import { useEffect, useMemo, useState } from 'react'
import type { CherishListResult, CherishMediaEntry, TagFilter } from '@shared/cherishTypes'
import { buildLocalMediaPreview } from '@shared/buildLocalMediaPreview'
import {
  collectTagFilters,
  matchesAllTagFilters,
  tagFilterKey,
} from '@shared/tagFilter'
import { LazyMediaThumb } from './LazyMediaThumb'

const GRID_PAGE_SIZE = 120

type Props = {
  workingRoot: string
  busy: boolean
  signedIn: boolean
  onStatus: (message: string) => void
  onBusy: (run: () => Promise<void>) => Promise<void>
  onSignIn: () => Promise<void>
  onBackHome: () => void
  onRestoreFromCloud: () => Promise<void>
}

function formatTags(entry: CherishMediaEntry): string {
  const parts = [
    ...entry.tags.people.map((v) => `people:${v}`),
    ...entry.tags.places.map((v) => `places:${v}`),
    ...entry.tags.events.map((v) => `events:${v}`),
  ]
  return parts.length > 0 ? parts.join(' · ') : 'No tags'
}

function formatCopyNote(entry: CherishMediaEntry): string | null {
  if (entry.localCopyCount <= 1) {
    return null
  }
  return `${entry.localCopyCount} local copies (same SHA-256); extras: ${entry.extraLocalPaths.join(', ')}`
}

/** Browse preserve/ keepers with multi-select tag filters (AND); reject to rejected/. */
export function ViewMediaPanel({
  workingRoot,
  busy,
  signedIn,
  onStatus,
  onBusy,
  onSignIn,
  onBackHome,
  onRestoreFromCloud,
}: Props) {
  const [list, setList] = useState<CherishListResult | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [focusPath, setFocusPath] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE)

  const availableFilters = useMemo(
    () => collectTagFilters(list?.files ?? []),
    [list],
  )

  const selectedFilters: TagFilter[] = useMemo(
    () => availableFilters.filter((f) => selectedKeys.has(tagFilterKey(f))),
    [availableFilters, selectedKeys],
  )

  const visibleFiles = useMemo(() => {
    const files = list?.files ?? []
    return files.filter((file) => matchesAllTagFilters(file.tags, selectedFilters))
  }, [list, selectedFilters])

  useEffect(() => {
    setVisibleCount(GRID_PAGE_SIZE)
  }, [selectedFilters, list])

  const gridFiles = useMemo(
    () => visibleFiles.slice(0, visibleCount),
    [visibleFiles, visibleCount],
  )

  const focusEntry = visibleFiles.find((f) => f.absolutePath === focusPath) ?? null
  const focusPreview = focusEntry ? buildLocalMediaPreview(focusEntry.absolutePath) : null

  async function refreshList(): Promise<void> {
    await onBusy(async () => {
      try {
        const next = await window.yaadein.listCherishMedia({ workingRoot })
        setList(next)
        setSelectedKeys(new Set())
        setSelectedPaths(new Set())
        setFocusPath(null)
        setVisibleCount(GRID_PAGE_SIZE)
        const tagged = next.files.filter((f) => f.hasCosmosAccepted).length
        const extras = next.files.reduce((sum, f) => sum + Math.max(0, f.localCopyCount - 1), 0)
        onStatus(
          next.tagsFromCosmos
            ? `View media: ${next.files.length} unique hash(es) in preserve/ (${tagged} with Cosms tags)${
                extras > 0 ? `; ${extras} extra local copy(ies) hidden` : ''
              }`
            : `View media: ${next.files.length} unique hash(es) in preserve/ (sign in for Cosms tags)${
                extras > 0 ? `; ${extras} extra local copy(ies) hidden` : ''
              }`,
        )
      } catch (error) {
        setList(null)
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  useEffect(() => {
    void refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingRoot, signedIn])

  function toggleFilter(filter: TagFilter): void {
    const key = tagFilterKey(filter)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleSelected(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  function filtersForDimension(dimension: TagFilter['dimension']): TagFilter[] {
    return availableFilters.filter((f) => f.dimension === dimension)
  }

  async function rejectPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      onStatus('Select media to reject.')
      return
    }
    if (!signedIn) {
      onStatus('Sign in required to reject (updates Cosms).')
      return
    }
    await onBusy(async () => {
      let ok = 0
      const errors: string[] = []
      try {
        for (const sourcePath of paths) {
          try {
            await window.yaadein.rejectCherishMedia({ workingRoot, sourcePath })
            ok += 1
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (errors.length === 0) {
          onStatus(`Rejected ${ok}: Blob deleted, Cosms REJECTED, moved to rejected/.`)
        } else {
          onStatus(
            `Rejected ${ok}; ${errors.length} failed. ${errors[0]}${
              errors.length > 1 ? ` (+${errors.length - 1} more)` : ''
            }`,
          )
        }
        const next = await window.yaadein.listCherishMedia({ workingRoot })
        setList(next)
        setSelectedPaths(new Set())
        if (focusPath && paths.includes(focusPath)) {
          setFocusPath(null)
        }
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  return (
    <section className="cherishLibrary" aria-label="View media">
      <div className="row navRow">
        <button type="button" disabled={busy} onClick={onBackHome}>
          Home
        </button>
        <button type="button" disabled={busy} onClick={() => void refreshList()}>
          Refresh
        </button>
        <button
          type="button"
          disabled={busy || !signedIn}
          onClick={() => void onRestoreFromCloud()}
        >
          Restore from cloud
        </button>
        {!signedIn ? (
          <button type="button" disabled={busy} onClick={() => void onSignIn()}>
            Sign in
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !signedIn || selectedPaths.size === 0}
          onClick={() => void rejectPaths([...selectedPaths])}
        >
          Reject selected ({selectedPaths.size})
        </button>
      </div>

      <p className="hint">
        Previewable media under {workingRoot}/preserve/ only (skips .DS_Store and other non-media).
        One tile per exact content hash (SHA-256); extra local copies of the same bytes are noted,
        not shown as separate tiles. Multi-select tags use <strong>AND</strong>. Reject writes Cosms
        REJECTED, moves to rejected/, then deletes the Blob.
      </p>

      <div className="cherishFilters" aria-label="Tag filters">
        {(['people', 'places', 'events'] as const).map((dimension) => {
          const options = filtersForDimension(dimension)
          if (options.length === 0) {
            return null
          }
          return (
            <div key={dimension} className="cherishFilterGroup">
              <h3>{dimension}</h3>
              <div className="cherishFilterOptions">
                {options.map((filter) => {
                  const key = tagFilterKey(filter)
                  const checked = selectedKeys.has(key)
                  return (
                    <label key={key} className="cherishFilterOption">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleFilter(filter)}
                      />
                      {filter.value}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
        {availableFilters.length === 0 ? (
          <p className="hint">
            {list?.tagsFromCosmos
              ? 'No tags on accepted media yet.'
              : 'Sign in to load Cosms tags for filtering.'}
          </p>
        ) : null}
        {selectedFilters.length > 0 ? (
          <button type="button" disabled={busy} onClick={() => setSelectedKeys(new Set())}>
            Clear tag filters
          </button>
        ) : null}
      </div>

      <p className="status" role="status">
        Showing {gridFiles.length} of {visibleFiles.length} match
        {list ? ` (${list.files.length} unique in preserve/)` : ''}
        {selectedFilters.length > 0
          ? ` · AND ${selectedFilters.map(tagFilterKey).join(', ')}`
          : ''}
      </p>

      {focusEntry ? (
        <div className="cherishFocus" aria-label="Focused media">
          <div className="row">
            <button type="button" disabled={busy} onClick={() => setFocusPath(null)}>
              Close preview
            </button>
            <button
              type="button"
              disabled={busy || !signedIn}
              onClick={() => void rejectPaths([focusEntry.absolutePath])}
            >
              Reject this
            </button>
          </div>
          <div className="cherishFocusStage">
            {focusPreview?.kind === 'video' && focusPreview.streamUrl ? (
              <video
                src={focusPreview.streamUrl}
                controls
                playsInline
                className="cherishFocusMedia"
              />
            ) : focusPreview?.kind === 'image' && focusPreview.streamUrl ? (
              <img
                src={focusPreview.streamUrl}
                alt={focusEntry.originalFilename}
                className="cherishFocusMedia"
              />
            ) : (
              <p className="hint">No preview</p>
            )}
          </div>
          <p className="cherishName">{focusEntry.relativePath}</p>
          <p className="hint">{formatTags(focusEntry)}</p>
          {formatCopyNote(focusEntry) ? (
            <p className="hint cherishCopyNote">{formatCopyNote(focusEntry)}</p>
          ) : null}
        </div>
      ) : null}

      <div className="cherishGrid">
        {gridFiles.map((file) => {
          const checked = selectedPaths.has(file.absolutePath)
          return (
            <div key={file.absolutePath} className="cherishCard">
              <label className="cherishSelect">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={() => toggleSelected(file.absolutePath)}
                />
                Select
              </label>
              <button
                type="button"
                className="cherishCardOpen"
                disabled={busy}
                onClick={() => setFocusPath(file.absolutePath)}
              >
                <LazyMediaThumb
                  absolutePath={file.absolutePath}
                  alt={file.originalFilename}
                  className="cherishThumb"
                />
                <p className="cherishName">{file.originalFilename}</p>
                <p className="hint cherishTagLine">{formatTags(file)}</p>
                {file.localCopyCount > 1 ? (
                  <p className="hint cherishCopyNote">{file.localCopyCount}× same hash</p>
                ) : null}
              </button>
            </div>
          )
        })}
      </div>

      {visibleFiles.length > gridFiles.length ? (
        <div className="row">
          <button
            type="button"
            disabled={busy}
            onClick={() => setVisibleCount((n) => n + GRID_PAGE_SIZE)}
          >
            Show more ({visibleFiles.length - gridFiles.length} remaining)
          </button>
        </div>
      ) : null}

      {visibleFiles.length === 0 ? (
        <p className="hint">
          {list && list.files.length > 0
            ? 'No keepers match the selected tags.'
            : `No previewable media under ${workingRoot}/preserve/. Accept media in review or run restore.`}
        </p>
      ) : null}
    </section>
  )
}
