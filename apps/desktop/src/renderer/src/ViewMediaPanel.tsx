import { useEffect, useMemo, useState } from 'react'
import type { CherishListResult, CherishMediaEntry, TagFilter } from '@shared/cherishTypes'
import type { MediaPreview } from '@shared/reviewTypes'
import {
  collectTagFilters,
  matchesAllTagFilters,
  tagFilterKey,
} from '@shared/tagFilter'

type Props = {
  workingRoot: string
  busy: boolean
  signedIn: boolean
  onStatus: (message: string) => void
  onBusy: (run: () => Promise<void>) => Promise<void>
  onSignIn: () => Promise<void>
  onBackHome: () => void
}

function formatTags(entry: CherishMediaEntry): string {
  const parts = [
    ...entry.tags.people.map((v) => `people:${v}`),
    ...entry.tags.places.map((v) => `places:${v}`),
    ...entry.tags.events.map((v) => `events:${v}`),
  ]
  return parts.length > 0 ? parts.join(' · ') : 'No tags'
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
}: Props) {
  const [list, setList] = useState<CherishListResult | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [previews, setPreviews] = useState<Record<string, MediaPreview | null>>({})
  const [focusPath, setFocusPath] = useState<string | null>(null)

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

  const focusEntry = visibleFiles.find((f) => f.absolutePath === focusPath) ?? null
  const focusPreview = focusEntry ? previews[focusEntry.absolutePath] : null

  async function refreshList(): Promise<void> {
    await onBusy(async () => {
      try {
        const next = await window.yaadein.listCherishMedia({ workingRoot })
        setList(next)
        setSelectedKeys(new Set())
        setSelectedPaths(new Set())
        setFocusPath(null)
        const tagged = next.files.filter((f) => f.hasCosmosAccepted).length
        onStatus(
          next.tagsFromCosmos
            ? `View media: ${next.files.length} previewable in preserve/ (${tagged} with Cosms tags)`
            : `View media: ${next.files.length} previewable in preserve/ (sign in for Cosms tags)`,
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

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const next: Record<string, MediaPreview | null> = { ...previews }
      const paths = [
        ...visibleFiles.slice(0, 48).map((f) => f.absolutePath),
        ...(focusPath ? [focusPath] : []),
      ]
      for (const path of paths) {
        if (next[path] !== undefined) {
          continue
        }
        try {
          next[path] = await window.yaadein.previewMedia(path)
        } catch {
          next[path] = null
        }
        if (cancelled) {
          return
        }
        setPreviews({ ...next })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFiles, focusPath])

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
        Multi-select tags use <strong>AND</strong>. Reject deletes the Blob, writes Cosms REJECTED,
        and moves the file to rejected/.
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
        {visibleFiles.length} of {list?.files.length ?? 0} shown
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
            {focusPreview?.kind === 'video' &&
            (focusPreview.streamUrl || focusPreview.dataUrl) ? (
              <video
                src={focusPreview.streamUrl ?? focusPreview.dataUrl ?? undefined}
                controls
                playsInline
                className="cherishFocusMedia"
              />
            ) : focusPreview?.kind === 'image' &&
              (focusPreview.streamUrl || focusPreview.dataUrl) ? (
              <img
                src={focusPreview.dataUrl ?? focusPreview.streamUrl ?? undefined}
                alt={focusEntry.originalFilename}
                className="cherishFocusMedia"
              />
            ) : (
              <p className="hint">No preview</p>
            )}
          </div>
          <p className="cherishName">{focusEntry.relativePath}</p>
          <p className="hint">{formatTags(focusEntry)}</p>
        </div>
      ) : null}

      <div className="cherishGrid">
        {visibleFiles.map((file) => {
          const preview = previews[file.absolutePath]
          const src = preview?.dataUrl ?? preview?.streamUrl ?? null
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
                <div className="cherishThumb">
                  {preview?.kind === 'video' && src ? (
                    <video src={src} muted playsInline />
                  ) : preview?.kind === 'image' && src ? (
                    <img src={src} alt={file.originalFilename} />
                  ) : (
                    <span className="hint">…</span>
                  )}
                </div>
                <p className="cherishName">{file.originalFilename}</p>
                <p className="hint cherishTagLine">{formatTags(file)}</p>
              </button>
            </div>
          )
        })}
      </div>

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
