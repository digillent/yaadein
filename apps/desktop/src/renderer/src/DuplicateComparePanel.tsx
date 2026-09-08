import { useEffect, useState } from 'react'
import type { CleanupFileEntry } from '@shared/cleanupTypes'
import type { DuplicateComparePair } from '@shared/duplicateTypes'
import { buildLocalMediaPreview } from '@shared/buildLocalMediaPreview'
import { duplicateActionFromKey } from './duplicateKeys'

type Props = {
  workingRoot: string
  busy: boolean
  signedIn: boolean
  onStatus: (message: string) => void
  onBusy: (run: () => Promise<void>) => Promise<void>
  onSignIn: () => Promise<void>
  onBackHome: () => void
}

function PreviewPane({
  label,
  path,
}: {
  label: string
  path: string | null
}) {
  const preview = path ? buildLocalMediaPreview(path) : null
  const src = preview?.streamUrl ?? null
  return (
    <div className="dupPane">
      <h3>{label}</h3>
      <div className="dupStage">
        {preview?.kind === 'video' && src ? (
          <video src={src} controls playsInline className="dupMedia" />
        ) : preview?.kind === 'image' && src ? (
          <img src={src} alt={path ?? label} className="dupMedia" />
        ) : (
          <p className="hint">{path ? 'No preview' : 'Unavailable'}</p>
        )}
      </div>
      <p className="dupPath" title={path ?? undefined}>
        {path ?? '—'}
      </p>
    </div>
  )
}

/** Side-by-side original ‖ duplicate with ←/→ navigate and ↓ delete duplicate. */
export function DuplicateComparePanel({
  workingRoot,
  busy,
  signedIn,
  onStatus,
  onBusy,
  onSignIn,
  onBackHome,
}: Props) {
  const [files, setFiles] = useState<CleanupFileEntry[]>([])
  const [index, setIndex] = useState(0)
  const [pair, setPair] = useState<DuplicateComparePair | null>(null)
  const [resolving, setResolving] = useState(false)

  const current = files[index] ?? null

  async function refreshList(): Promise<void> {
    await onBusy(async () => {
      try {
        // Same listing path as Tools cleanup — files under workingRoot/duplicate/.
        const listed = await window.yaadein.listCleanup({
          workingRoot,
          bucket: 'duplicate',
        })
        setFiles(listed.files)
        setIndex(0)
        setPair(null)
        onStatus(`Duplicates in ${workingRoot}: ${listed.files.length} file(s)`)
      } catch (error) {
        setFiles([])
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  useEffect(() => {
    void refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingRoot])

  useEffect(() => {
    if (!current) {
      setPair(null)
      return
    }

    let cancelled = false
    setResolving(true)
    void (async () => {
      try {
        const resolved = await window.yaadein.resolveDuplicate({
          workingRoot,
          duplicatePath: current.absolutePath,
        })
        if (cancelled) {
          return
        }
        setPair(resolved)
        onStatus(resolved.original.detail)
      } catch (error) {
        if (!cancelled) {
          setPair(null)
          onStatus(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (!cancelled) {
          setResolving(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.absolutePath, signedIn, workingRoot])

  async function deleteCurrent(): Promise<void> {
    if (!current) {
      return
    }
    await onBusy(async () => {
      try {
        const result = await window.yaadein.deleteCleanup({
          workingRoot,
          bucket: 'duplicate',
          paths: [current.absolutePath],
        })
        if (result.cancelled) {
          onStatus('Delete cancelled.')
          return
        }
        onStatus(`Deleted duplicate (${result.deleted.length}). Original untouched.`)
        const listed = await window.yaadein.listCleanup({
          workingRoot,
          bucket: 'duplicate',
        })
        setFiles(listed.files)
        setIndex((i) => (listed.files.length === 0 ? 0 : Math.min(i, listed.files.length - 1)))
        setPair(null)
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (busy) {
        return
      }
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      const action = duplicateActionFromKey(event.key)
      if (!action) {
        return
      }
      event.preventDefault()
      if (action === 'prev') {
        setIndex((i) => (files.length === 0 ? 0 : (i - 1 + files.length) % files.length))
        return
      }
      if (action === 'next') {
        setIndex((i) => (files.length === 0 ? 0 : (i + 1) % files.length))
        return
      }
      void deleteCurrent()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  return (
    <section className="dupCompare" aria-label="Duplicate compare">
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
        Original = Cosms ACCEPTED media (preserve/ or Blob) ‖ duplicate under {workingRoot}
        /duplicate/. ← prev · → next · ↓ delete duplicate only.
      </p>

      <p className="status" role="status">
        {files.length === 0
          ? `No files under ${workingRoot}/duplicate/.`
          : `${index + 1} / ${files.length}: ${current?.relativePath ?? ''}${
              resolving ? ' · resolving original…' : ''
            }`}
      </p>

      <div className="dupSideBySide">
        <PreviewPane label="Original" path={pair?.original.path ?? null} />
        <PreviewPane label="Duplicate" path={current?.absolutePath ?? null} />
      </div>

      {pair ? (
        <p className="hint">
          Original: {pair.original.status} — {pair.original.detail}
        </p>
      ) : null}

      <div className="row reviewActions">
        <button
          type="button"
          disabled={busy || files.length === 0}
          onClick={() =>
            setIndex((i) => (files.length === 0 ? 0 : (i - 1 + files.length) % files.length))
          }
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={busy || !current}
          onClick={() => void deleteCurrent()}
        >
          ↓ Delete duplicate
        </button>
        <button
          type="button"
          disabled={busy || files.length === 0}
          onClick={() => setIndex((i) => (files.length === 0 ? 0 : (i + 1) % files.length))}
        >
          Next →
        </button>
      </div>
    </section>
  )
}
