import { useEffect, useMemo, useState } from 'react'
import type { CleanupFileEntry, CleanupListResult } from '@shared/cleanupTypes'
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
}

/** Browse rejected/ as a year/month grid with delete and accept-back-to-preserve. */
export function RejectedLibraryPanel({
  workingRoot,
  busy,
  signedIn,
  onStatus,
  onBusy,
  onSignIn,
  onBackHome,
}: Props) {
  const [list, setList] = useState<CleanupListResult | null>(null)
  const [yearMonthFilter, setYearMonthFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE)

  const yearMonths = useMemo(() => {
    const values = new Set<string>()
    for (const file of list?.files ?? []) {
      if (file.yearMonth) {
        values.add(file.yearMonth)
      }
    }
    return [...values].sort().reverse()
  }, [list])

  const visibleFiles = useMemo(() => {
    const files = list?.files ?? []
    if (yearMonthFilter === 'all') {
      return files
    }
    return files.filter((f) => f.yearMonth === yearMonthFilter)
  }, [list, yearMonthFilter])

  useEffect(() => {
    setVisibleCount(GRID_PAGE_SIZE)
  }, [yearMonthFilter, list])

  const gridFiles = useMemo(
    () => visibleFiles.slice(0, visibleCount),
    [visibleFiles, visibleCount],
  )

  async function refreshList(): Promise<void> {
    await onBusy(async () => {
      try {
        const next = await window.yaadein.listCleanup({
          workingRoot,
          bucket: 'rejected',
        })
        setList(next)
        setSelected(new Set())
        setVisibleCount(GRID_PAGE_SIZE)
        onStatus(`Rejected library: ${next.files.length} file(s)`)
      } catch (error) {
        setList(null)
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  useEffect(() => {
    void refreshList()
    // intentionally load once when panel mounts / workingRoot changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingRoot])

  function toggleSelected(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  function selectAllVisible(): void {
    setSelected(new Set(visibleFiles.map((f) => f.absolutePath)))
  }

  async function deleteSelected(): Promise<void> {
    const paths = [...selected]
    if (paths.length === 0) {
      onStatus('Select files to delete.')
      return
    }
    await onBusy(async () => {
      try {
        const result = await window.yaadein.deleteCleanup({
          workingRoot,
          bucket: 'rejected',
          paths,
        })
        if (result.cancelled) {
          onStatus('Delete cancelled — Cosms unchanged.')
          return
        }
        onStatus(
          `Deleted ${result.deleted.length} local file(s) (${result.failed.length} failed). Cosms decisions retained.`,
        )
        await refreshList()
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  async function acceptFile(file: CleanupFileEntry): Promise<void> {
    if (!signedIn) {
      onStatus('Sign in required to accept rejected media.')
      return
    }
    await onBusy(async () => {
      try {
        const result = await window.yaadein.reviewAcceptRejected({
          sourcePath: file.absolutePath,
          workingRoot,
        })
        onStatus(`Accepted → SYNCED → preserve/: ${result.destinationPath}`)
        await refreshList()
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  return (
    <section className="rejectedLibrary" aria-label="Rejected library">
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
      </div>

      <p className="hint">
        Local rejected/ only. Delete removes files but keeps Cosms REJECTED. Accept uploads to Blob
        and moves to preserve/ (overwrites Cosms to ACCEPTED).
      </p>

      <div className="row">
        <label className="bucket">
          Month
          <select
            value={yearMonthFilter}
            disabled={busy}
            onChange={(event) => setYearMonthFilter(event.target.value)}
          >
            <option value="all">All months</option>
            {yearMonths.map((ym) => (
              <option key={ym} value={ym}>
                {ym}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || visibleFiles.length === 0} onClick={selectAllVisible}>
          Select visible
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void deleteSelected()}
        >
          Delete selected…
        </button>
      </div>

      <p className="status" role="status">
        Showing {gridFiles.length} of {visibleFiles.length} · selected {selected.size}
      </p>

      <div className="rejectedGrid">
        {gridFiles.map((file) => (
          <article key={file.absolutePath} className="rejectedCard">
            <label className="rejectedSelect">
              <input
                type="checkbox"
                checked={selected.has(file.absolutePath)}
                disabled={busy}
                onChange={() => toggleSelected(file.absolutePath)}
              />
              <span>{file.yearMonth ?? '—'}</span>
            </label>
            <LazyMediaThumb
              absolutePath={file.absolutePath}
              alt={file.relativePath}
              className="rejectedThumb"
            />
            <p className="rejectedName" title={file.absolutePath}>
              {file.relativePath}
            </p>
            <div className="row">
              <button
                type="button"
                disabled={busy || !signedIn}
                onClick={() => void acceptFile(file)}
              >
                Accept
              </button>
            </div>
          </article>
        ))}
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

      {visibleFiles.length === 0 ? <p className="hint">No rejected files in this filter.</p> : null}
    </section>
  )
}
