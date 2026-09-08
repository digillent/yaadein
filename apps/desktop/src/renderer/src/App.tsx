import { useEffect, useState } from 'react'
import { getShellTitle } from '@shared/appInfo'
import type { CleanupBucket, CleanupListResult } from '@shared/cleanupTypes'
import type { RestorePreserveResult, RestoreProgress } from '@shared/restoreTypes'
import type { ReviewAcceptProgress } from '@shared/reviewTypes'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { sessionUpdated, meProfileUpdated, authClearedExtras } from './store/authSlice'
import {
  scanProgressUpdated,
  scanStarted,
  scanCompleted,
  scanFailed,
} from './store/scanSlice'
import {
  reviewQueueLoaded,
  reviewAdvanced,
  reviewIndexSet,
  selectCurrentReviewPath,
} from './store/reviewSlice'
import {
  workingRootSet,
  scanRootSet,
  sourcePathSet,
  moveBucketSet,
  eventDateOverrideSet,
  type WorkingBucket,
} from './store/settingsSlice'
import { reviewActionFromKey } from './reviewKeys'
import { ReviewMediaStage } from './ReviewMediaStage'
import { RejectedLibraryPanel } from './RejectedLibraryPanel'
import { DuplicateComparePanel } from './DuplicateComparePanel'
import { ViewMediaPanel } from './ViewMediaPanel'
import { isMediaPath } from '@shared/mediaPath'
import {
  busySet,
  statusSet,
  screenSet,
  settingsHydratedSet,
  inspectionSet,
  cosmosHarnessSet,
  blobHarnessSet,
  harnessExtrasCleared,
} from './store/uiSlice'

/** Convert an HTML date input (YYYY-MM-DD) to an ISO instant for the move API. */
function eventDateInputToIso(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`
}

function formatByteCount(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function acceptProgressLabel(progress: ReviewAcceptProgress): string {
  if (progress.phase === 'preparing') {
    return 'Preparing accept (Cosms)…'
  }
  if (progress.phase === 'moving') {
    return 'Upload complete — moving to preserve/…'
  }
  if (progress.percent !== null) {
    return `Uploading to cloud… ${formatByteCount(progress.bytesUploaded)} / ${formatByteCount(progress.bytesTotal)} (${progress.percent}%)`
  }
  return `Uploading to cloud… ${formatByteCount(progress.bytesUploaded)}`
}

export default function App() {
  const title =
    typeof window !== 'undefined' && window.yaadein?.appName
      ? window.yaadein.appName
      : getShellTitle()

  const dispatch = useAppDispatch()
  const session = useAppSelector((s) => s.auth.session)
  const meProfile = useAppSelector((s) => s.auth.meProfile)
  const { workingRoot, scanRoot, sourcePath, moveBucket, eventDateOverride } = useAppSelector(
    (s) => s.settings,
  )
  const scanProgress = useAppSelector((s) => s.scan.progress)
  const scanResult = useAppSelector((s) => s.scan.lastResult)
  const reviewQueue = useAppSelector((s) => s.review.queue)
  const reviewIndex = useAppSelector((s) => s.review.index)
  const currentReviewPath = useAppSelector(selectCurrentReviewPath)
  const busy = useAppSelector((s) => s.ui.busy)
  const status = useAppSelector((s) => s.ui.status)
  const screen = useAppSelector((s) => s.ui.screen)
  const settingsHydrated = useAppSelector((s) => s.ui.settingsHydrated)
  const inspection = useAppSelector((s) => s.ui.inspection)
  const cosmosHarness = useAppSelector((s) => s.ui.cosmosHarness)
  const blobHarness = useAppSelector((s) => s.ui.blobHarness)
  const [cleanupBucket, setCleanupBucket] = useState<CleanupBucket>('rejected')
  const [cleanupList, setCleanupList] = useState<CleanupListResult | null>(null)
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestorePreserveResult | null>(null)
  const [acceptProgress, setAcceptProgress] = useState<ReviewAcceptProgress | null>(null)

  useEffect(() => {
    void window.yaadein.getAuthSession().then(
      (next) => dispatch(sessionUpdated(next)),
      () =>
        dispatch(
          sessionUpdated({
            signedIn: false,
            accountName: null,
            username: null,
            homeAccountId: null,
            userId: null,
          }),
        ),
    )
  }, [dispatch])

  useEffect(() => {
    void window.yaadein.getPersistedSettings().then(
      (settings) => {
        if (settings.workingRoot) {
          dispatch(workingRootSet(settings.workingRoot))
          dispatch(screenSet('home'))
        } else {
          dispatch(screenSet('setup'))
        }
        if (settings.scanRoot) {
          dispatch(scanRootSet(settings.scanRoot))
        }
        if (settings.workingRoot) {
          dispatch(statusSet(`Working folder: ${settings.workingRoot}`))
        }
        dispatch(settingsHydratedSet(true))
      },
      () => {
        dispatch(screenSet('setup'))
        dispatch(settingsHydratedSet(true))
      },
    )
  }, [dispatch])

  useEffect(() => {
    if (!settingsHydrated) {
      return
    }
    if (!workingRoot && screen !== 'setup') {
      dispatch(screenSet('setup'))
    }
  }, [settingsHydrated, workingRoot, screen, dispatch])

  useEffect(() => {
    return window.yaadein.onScanProgress((progress) => {
      dispatch(scanProgressUpdated(progress))
    })
  }, [dispatch])

  useEffect(() => {
    return window.yaadein.onRestoreProgress((progress) => {
      setRestoreProgress(progress)
    })
  }, [])

  useEffect(() => {
    return window.yaadein.onReviewAcceptProgress((progress) => {
      setAcceptProgress((prev) => {
        if (
          prev &&
          prev.phase === progress.phase &&
          prev.percent === progress.percent &&
          prev.bytesUploaded === progress.bytesUploaded
        ) {
          return prev
        }
        return progress
      })
      dispatch(statusSet(acceptProgressLabel(progress)))
    })
  }, [dispatch])

  async function withBusy(run: () => Promise<void>): Promise<void> {
    dispatch(busySet(true))
    try {
      await run()
    } finally {
      dispatch(busySet(false))
    }
  }

  async function chooseWorkingRoot(): Promise<void> {
    const path = await window.yaadein.pickWorkingDirectory()
    if (path) {
      dispatch(workingRootSet(path))
      try {
        await window.yaadein.savePersistedSettings({ workingRoot: path })
        await window.yaadein.ensureWorkingFolder(path)
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
        return
      }
      dispatch(statusSet(`Working folder: ${path}`))
      dispatch(screenSet('home'))
    }
  }

  async function ensureTree(): Promise<void> {
    if (!workingRoot) {
      dispatch(statusSet('Choose a working folder first.'))
      return
    }
    await withBusy(async () => {
      try {
        await window.yaadein.ensureWorkingFolder(workingRoot)
        dispatch(statusSet(`Ensured preserve / duplicate / rejected under ${workingRoot}`))
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function chooseSource(): Promise<void> {
    const path = await window.yaadein.pickSourceFile()
    if (path) {
      dispatch(sourcePathSet(path))
      dispatch(inspectionSet(null))
      dispatch(statusSet(`Source: ${path}`))
    }
  }

  async function inspectSource(): Promise<void> {
    if (!sourcePath) {
      dispatch(statusSet('Choose a source file first.'))
      return
    }
    await withBusy(async () => {
      try {
        const result = await window.yaadein.inspectMedia({
          sourcePath,
          ...(eventDateOverride
            ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
            : {}),
        })
        dispatch(inspectionSet(result))
        dispatch(
          statusSet(
            `Inspected ${result.originalFilename}: ${result.contentHash.slice(0, 12)}… (${result.organizeDateSource})`,
          ),
        )
      } catch (error) {
        dispatch(inspectionSet(null))
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function moveSample(): Promise<void> {
    if (!workingRoot || !sourcePath) {
      dispatch(statusSet('Choose a working folder and a source file first.'))
      return
    }
    await withBusy(async () => {
      try {
        const result = await window.yaadein.moveMedia({
          sourcePath,
          workingRoot,
          bucket: moveBucket,
          nameDisambiguator: 'devmove',
          ...(eventDateOverride
            ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
            : {}),
        })
        dispatch(sourcePathSet(''))
        dispatch(inspectionSet(null))
        dispatch(
          statusSet(
            `Moved to ${result.destinationPath} (${result.yearMonth})${
              eventDateOverride ? ' [event date override]' : ' [auto date]'
            }`,
          ),
        )
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function signIn(): Promise<void> {
    await withBusy(async () => {
      try {
        const next = await window.yaadein.signIn()
        dispatch(sessionUpdated(next))
        dispatch(authClearedExtras())
        dispatch(harnessExtrasCleared())
        dispatch(
          statusSet(next.signedIn ? `Signed in as ${next.username ?? next.accountName}` : 'Signed out'),
        )
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function signOut(): Promise<void> {
    await withBusy(async () => {
      try {
        const next = await window.yaadein.signOut()
        dispatch(sessionUpdated(next))
        dispatch(authClearedExtras())
        dispatch(harnessExtrasCleared())
        dispatch(statusSet('Signed out'))
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function callMe(): Promise<void> {
    await withBusy(async () => {
      try {
        const profile = await window.yaadein.fetchMe()
        dispatch(meProfileUpdated(profile))
        dispatch(
          statusSet(`Graph /me: ${profile.displayName ?? profile.userPrincipalName ?? profile.id}`),
        )
      } catch (error) {
        dispatch(meProfileUpdated(null))
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function runCosmosHarness(): Promise<void> {
    await withBusy(async () => {
      try {
        const result = await window.yaadein.cosmosHarnessRoundTrip()
        dispatch(cosmosHarnessSet(result))
        dispatch(
          statusSet(
            result.lookedUp
              ? `Cosmos OK: upserted+looked up ${result.upserted.contentHash.slice(0, 12)}…`
              : `Cosmos upsert OK but lookup missed ${result.upserted.contentHash.slice(0, 12)}…`,
          ),
        )
      } catch (error) {
        dispatch(cosmosHarnessSet(null))
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function runAcceptUpload(): Promise<void> {
    if (!sourcePath) {
      dispatch(statusSet('Choose a source file first.'))
      return
    }
    await withBusy(async () => {
      try {
        const result = await window.yaadein.acceptAndUpload({
          sourcePath,
          ...(eventDateOverride
            ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
            : {}),
        })
        dispatch(blobHarnessSet(result))
        dispatch(
          statusSet(
            `Accept+upload ${result.document.cloudStatus}: ${result.cloudObjectId ?? 'no blob id'} (source not moved)`,
          ),
        )
      } catch (error) {
        dispatch(blobHarnessSet(null))
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function chooseScanRoot(): Promise<void> {
    const path = await window.yaadein.pickWorkingDirectory()
    if (path) {
      dispatch(scanRootSet(path))
      try {
        await window.yaadein.savePersistedSettings({ scanRoot: path })
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
        return
      }
      dispatch(statusSet(`Scan root: ${path}`))
    }
  }

  async function runScan(): Promise<void> {
    if (!session.signedIn) {
      dispatch(statusSet('Sign in required to scan.'))
      return
    }
    if (!workingRoot || !scanRoot) {
      dispatch(statusSet('Choose a working folder and a scan root first.'))
      return
    }
    await withBusy(async () => {
      dispatch(scanStarted())
      try {
        const result = await window.yaadein.runScan({
          scanRoots: [scanRoot],
          workingRoot,
        })
        dispatch(scanCompleted(result))
        const unknowns = result.results
          .filter((item) => item.outcome === 'skipped_unknown')
          .map((item) => item.sourcePath)
          .filter((path) => isMediaPath(path))
        dispatch(reviewQueueLoaded(unknowns))
        dispatch(
          statusSet(
            `Scan done: ${result.movedRejected} rejected, ${result.movedDuplicate} duplicate, ${result.skippedUnknown} unknown, ${result.errors} errors`,
          ),
        )
        if (unknowns.length > 0) {
          dispatch(screenSet('review'))
        }
      } catch (error) {
        dispatch(scanFailed())
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function acceptCurrent(): Promise<void> {
    if (!session.signedIn) {
      dispatch(statusSet('Sign in required to accept.'))
      return
    }
    if (!currentReviewPath || !workingRoot) {
      dispatch(statusSet('Need a review item and working folder.'))
      return
    }
    await withBusy(async () => {
      setAcceptProgress({
        phase: 'preparing',
        sourcePath: currentReviewPath,
        bytesUploaded: 0,
        bytesTotal: 0,
        percent: null,
      })
      dispatch(statusSet('Accepting — uploading to cloud. Other actions paused…'))
      try {
        const result = await window.yaadein.reviewAccept({
          sourcePath: currentReviewPath,
          workingRoot,
          ...(eventDateOverride
            ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
            : {}),
        })
        dispatch(statusSet(`Accepted → SYNCED → preserve/: ${result.destinationPath}`))
        dispatch(reviewAdvanced())
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      } finally {
        setAcceptProgress(null)
      }
    })
  }

  async function rejectCurrent(): Promise<void> {
    if (!session.signedIn) {
      dispatch(statusSet('Sign in required to reject.'))
      return
    }
    if (!currentReviewPath || !workingRoot) {
      dispatch(statusSet('Need a review item and working folder.'))
      return
    }
    await withBusy(async () => {
      try {
        const result = await window.yaadein.reviewReject({
          sourcePath: currentReviewPath,
          workingRoot,
          ...(eventDateOverride
            ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
            : {}),
        })
        dispatch(statusSet(`Rejected → rejected/: ${result.destinationPath}`))
        dispatch(reviewAdvanced())
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function refreshCleanupList(): Promise<void> {
    if (!workingRoot) {
      dispatch(statusSet('Choose a working folder first.'))
      return
    }
    await withBusy(async () => {
      try {
        const listed = await window.yaadein.listCleanup({
          workingRoot,
          bucket: cleanupBucket,
        })
        setCleanupList(listed)
        dispatch(
          statusSet(
            `Cleanup list ${cleanupBucket}/: ${listed.files.length} file(s), ${listed.totalBytes} bytes`,
          ),
        )
      } catch (error) {
        setCleanupList(null)
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function deleteCleanupBucket(): Promise<void> {
    if (!workingRoot) {
      dispatch(statusSet('Choose a working folder first.'))
      return
    }
    await withBusy(async () => {
      try {
        const listed =
          cleanupList && cleanupList.bucket === cleanupBucket
            ? cleanupList
            : await window.yaadein.listCleanup({ workingRoot, bucket: cleanupBucket })
        setCleanupList(listed)
        if (listed.files.length === 0) {
          dispatch(statusSet(`No files under ${cleanupBucket}/ to delete.`))
          return
        }
        const result = await window.yaadein.deleteCleanup({
          workingRoot,
          bucket: cleanupBucket,
          paths: listed.files.map((f) => f.absolutePath),
        })
        if (result.cancelled) {
          dispatch(statusSet('Cleanup cancelled — Cosms unchanged.'))
          return
        }
        const refreshed = await window.yaadein.listCleanup({
          workingRoot,
          bucket: cleanupBucket,
        })
        setCleanupList(refreshed)
        dispatch(
          statusSet(
            `Deleted ${result.deleted.length} local file(s) from ${cleanupBucket}/ (${result.failed.length} failed). Cosms decisions retained.`,
          ),
        )
      } catch (error) {
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function runRestore(): Promise<void> {
    if (!session.signedIn) {
      dispatch(statusSet('Sign in required to restore.'))
      return
    }
    if (!workingRoot) {
      dispatch(statusSet('Choose a working folder first.'))
      return
    }
    await withBusy(async () => {
      try {
        const result = await window.yaadein.runRestore({ workingRoot })
        setRestoreResult(result)
        dispatch(
          statusSet(
            `Restore done: ${result.restored} restored, ${result.skipped} skipped, ${result.failed} failed`,
          ),
        )
      } catch (error) {
        setRestoreResult(null)
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  useEffect(() => {
    if (screen !== 'review') {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (busy) {
        return
      }
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      const action = reviewActionFromKey(event.key)
      if (!action) {
        return
      }
      event.preventDefault()
      if (action === 'prev') {
        dispatch(reviewIndexSet(reviewIndex - 1))
        return
      }
      if (action === 'next') {
        dispatch(reviewIndexSet(reviewIndex + 1))
        return
      }
      if (action === 'accept') {
        if (!session.signedIn) {
          dispatch(statusSet('Sign in required to accept.'))
          return
        }
        void acceptCurrent()
        return
      }
      if (!session.signedIn) {
        dispatch(statusSet('Sign in required to reject.'))
        return
      }
      void rejectCurrent()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
    // accept/reject close over current path; rebind when reviewIndex / auth / busy change
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid rebinding every render
  }, [screen, busy, reviewIndex, session.signedIn, dispatch, currentReviewPath, workingRoot, eventDateOverride])

  if (!settingsHydrated) {
    return (
      <main className="shell">
        <header className="appHeader">
          <h1>{title}</h1>
          <p className="tagline">Loading…</p>
        </header>
      </main>
    )
  }

  const statusBar = (
    <p className="statusBar" role="status">
      {busy
        ? acceptProgress
          ? `${acceptProgressLabel(acceptProgress)} · `
          : 'Working… · '
        : ''}
      {session.signedIn
        ? `Signed in: ${session.username ?? session.accountName ?? 'account'}`
        : 'Not signed in'}
      {workingRoot ? ` · ${workingRoot}` : ''}
      {status ? ` · ${status}` : ''}
    </p>
  )

  const navHome = (
    <div className="row navRow">
      <button type="button" disabled={busy} onClick={() => dispatch(screenSet('home'))}>
        Home
      </button>
    </div>
  )

  if (screen === 'setup' || !workingRoot) {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Choose a Yaadein working folder once. We’ll remember it.</p>
          </div>
          {statusBar}
        </header>
        <section className="devPanel" aria-label="First-run setup">
          <h2>Set up working folder</h2>
          <p className="hint">
            This folder holds preserve/, duplicate/, and rejected/. You can change it later in
            Settings.
          </p>
          <div className="row">
            <button type="button" className="primaryAction" disabled={busy} onClick={() => void chooseWorkingRoot()}>
              Choose working folder
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'home') {
    return (
      <main className="shell">
        <header className="appHeader homeHero">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Clear digital clutter and preserve the memories that matter.</p>
          </div>
          {statusBar}
        </header>
        <div className="homeActions" role="navigation" aria-label="Home">
          <button
            type="button"
            className="primaryAction"
            disabled={busy}
            onClick={() => dispatch(screenSet('scan'))}
          >
            New scan
          </button>
          <button
            type="button"
            className="primaryAction"
            disabled={busy}
            onClick={() => dispatch(screenSet('review'))}
          >
            Review unknowns{reviewQueue.length > 0 ? ` (${reviewQueue.length})` : ''}
          </button>
          <button
            type="button"
            className="primaryAction"
            disabled={busy}
            onClick={() => dispatch(screenSet('rejected'))}
          >
            Rejected library
          </button>
          <button
            type="button"
            className="primaryAction"
            disabled={busy}
            onClick={() => dispatch(screenSet('duplicates'))}
          >
            Duplicate compare
          </button>
          <button
            type="button"
            className="primaryAction"
            disabled={busy}
            onClick={() => dispatch(screenSet('viewMedia'))}
          >
            View media
          </button>
        </div>
        <div className="row homeSecondary">
          <button type="button" disabled={busy} onClick={() => dispatch(screenSet('settings'))}>
            Settings
          </button>
          <button type="button" disabled={busy || session.signedIn} onClick={() => void signIn()}>
            Sign in
          </button>
          <button type="button" disabled={busy || !session.signedIn} onClick={() => void signOut()}>
            Sign out
          </button>
          <button type="button" disabled={busy} onClick={() => dispatch(screenSet('tools'))}>
            Tools
          </button>
          <button
            type="button"
            disabled={busy || !session.signedIn || !workingRoot}
            onClick={() => void runRestore()}
          >
            Restore from cloud
          </button>
        </div>
      </main>
    )
  }

  if (screen === 'viewMedia') {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Cherish keepers in preserve/ — filter by tags (AND).</p>
          </div>
          {statusBar}
        </header>
        <ViewMediaPanel
          workingRoot={workingRoot}
          busy={busy}
          signedIn={session.signedIn}
          onStatus={(message) => dispatch(statusSet(message))}
          onBusy={withBusy}
          onSignIn={signIn}
          onBackHome={() => dispatch(screenSet('home'))}
          onRestoreFromCloud={runRestore}
        />
      </main>
    )
  }

  if (screen === 'settings') {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Working folder and account.</p>
          </div>
          {statusBar}
        </header>
        {navHome}
        <section className="devPanel" aria-label="Settings">
          <h2>Settings</h2>
          <p className="hint">
            Working folder is saved under app userData and restored on launch — no re-prompt when set.
          </p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void chooseWorkingRoot()}>
              Change working folder
            </button>
            <button type="button" disabled={busy || !workingRoot} onClick={() => void ensureTree()}>
              Ensure folders
            </button>
            <button type="button" disabled={busy} onClick={() => void chooseScanRoot()}>
              Choose scan folder
            </button>
          </div>
          <p className="status" role="status">
            Working: {workingRoot || '—'}
            <br />
            Scan: {scanRoot || '—'}
          </p>
          <div className="row">
            <label className="bucket">
              Event date override
              <input
                type="date"
                value={eventDateOverride}
                disabled={busy}
                onChange={(event) => dispatch(eventDateOverrideSet(event.target.value))}
              />
            </label>
            {eventDateOverride ? (
              <button type="button" disabled={busy} onClick={() => dispatch(eventDateOverrideSet(''))}>
                Clear override
              </button>
            ) : null}
          </div>
          <div className="row">
            <button type="button" disabled={busy || session.signedIn} onClick={() => void signIn()}>
              Sign in
            </button>
            <button type="button" disabled={busy || !session.signedIn} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'tools') {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Cloud sync, harness, and local helpers.</p>
          </div>
          {statusBar}
        </header>
        {navHome}
        <section className="devPanel" aria-label="Sync from cloud" id="restore-from-cloud">
          <h2>Sync from cloud</h2>
          <p className="hint">
            Download Cosms <strong>ACCEPTED+SYNCED</strong> media from Blob into local{' '}
            <code>preserve/YYYY/MM</code>. Verifies SHA-256; skips files that already match. Sign in
            required.
          </p>
          <div className="row">
            <button
              type="button"
              className="primaryAction"
              disabled={busy || !session.signedIn || !workingRoot}
              onClick={() => void runRestore()}
            >
              Restore from Blob
            </button>
            {!session.signedIn ? (
              <button type="button" disabled={busy} onClick={() => void signIn()}>
                Sign in
              </button>
            ) : null}
          </div>
          <p className="status" role="status">
            {restoreProgress
              ? `${restoreProgress.phase}: ${restoreProgress.completed}/${restoreProgress.total} · skipped ${restoreProgress.skipped} · failed ${restoreProgress.failed}`
              : 'No restore run yet.'}
          </p>
          {restoreResult ? (
            <pre className="inspection">{JSON.stringify(restoreResult, null, 2)}</pre>
          ) : null}
        </section>
        <section className="devPanel" aria-label="Auth tools">
          <h2>Sign-in & cloud harness</h2>
          <p className="hint">Entra PKCE. Cosms/Storage use separate resource tokens when needed.</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void signIn()}>
              Sign in
            </button>
            <button type="button" disabled={busy || !session.signedIn} onClick={() => void signOut()}>
              Sign out
            </button>
            <button type="button" disabled={busy || !session.signedIn} onClick={() => void callMe()}>
              Call Graph /me
            </button>
            <button
              type="button"
              disabled={busy || !session.signedIn}
              onClick={() => void runCosmosHarness()}
            >
              Cosms upsert + lookup
            </button>
            <button
              type="button"
              disabled={busy || !session.signedIn || !sourcePath}
              onClick={() => void runAcceptUpload()}
            >
              Accept + upload Blob
            </button>
          </div>
          {meProfile ? <pre className="inspection">{JSON.stringify(meProfile, null, 2)}</pre> : null}
          {cosmosHarness ? (
            <pre className="inspection">{JSON.stringify(cosmosHarness, null, 2)}</pre>
          ) : null}
          {blobHarness ? <pre className="inspection">{JSON.stringify(blobHarness, null, 2)}</pre> : null}
        </section>
        <section className="devPanel" aria-label="Media tools">
          <h2>Media tools</h2>
          <p className="hint">Inspect and manual move helpers for development.</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void chooseSource()}>
              Choose source file
            </button>
            <button type="button" disabled={busy || !sourcePath} onClick={() => void inspectSource()}>
              Inspect media
            </button>
            <label className="bucket">
              Bucket
              <select
                value={moveBucket}
                disabled={busy}
                onChange={(event) => dispatch(moveBucketSet(event.target.value as WorkingBucket))}
              >
                <option value="preserve">preserve</option>
                <option value="duplicate">duplicate</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !workingRoot || !sourcePath}
              onClick={() => void moveSample()}
            >
              Move file
            </button>
          </div>
          {inspection ? <pre className="inspection">{JSON.stringify(inspection, null, 2)}</pre> : null}
        </section>
      </main>
    )
  }

  if (screen === 'rejected') {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Browse rejected media — delete locally or accept to keep.</p>
          </div>
          {statusBar}
        </header>
        <RejectedLibraryPanel
          workingRoot={workingRoot}
          busy={busy}
          signedIn={session.signedIn}
          onStatus={(message) => dispatch(statusSet(message))}
          onBusy={withBusy}
          onSignIn={signIn}
          onBackHome={() => dispatch(screenSet('home'))}
        />
      </main>
    )
  }

  if (screen === 'duplicates') {
    return (
      <main className="shell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">Compare duplicate vs Cosms ACCEPTED original — ↓ deletes the duplicate only.</p>
          </div>
          {statusBar}
        </header>
        <DuplicateComparePanel
          workingRoot={workingRoot}
          busy={busy}
          signedIn={session.signedIn}
          onStatus={(message) => dispatch(statusSet(message))}
          onBusy={withBusy}
          onSignIn={signIn}
          onBackHome={() => dispatch(screenSet('home'))}
        />
      </main>
    )
  }

  if (screen === 'review') {
    return (
      <main className="shell reviewShell">
        <header className="appHeader">
          <div>
            <h1>{title}</h1>
            <p className="tagline">
              ↑ accept · ↓ reject · ← prev · → next · scroll or buttons to zoom
            </p>
          </div>
          {statusBar}
        </header>
        <div className="row navRow">
          <button type="button" disabled={busy} onClick={() => dispatch(screenSet('home'))}>
            Home
          </button>
          <button type="button" disabled={busy} onClick={() => dispatch(screenSet('scan'))}>
            Scan
          </button>
        </div>

        <section className="reviewCard" aria-label="Tinder-style review">
          {acceptProgress ? (
            <div
              className="reviewBusyOverlay"
              role="alertdialog"
              aria-busy="true"
              aria-live="assertive"
              aria-label="Upload in progress"
            >
              <p className="reviewBusyTitle">
                {acceptProgress.phase === 'moving'
                  ? 'Finishing accept…'
                  : acceptProgress.phase === 'preparing'
                    ? 'Preparing accept…'
                    : 'Uploading to cloud…'}
              </p>
              <p className="hint reviewBusyDetail">{acceptProgressLabel(acceptProgress)}</p>
              {acceptProgress.percent !== null ? (
                <progress
                  className="reviewBusyProgress"
                  max={100}
                  value={acceptProgress.percent}
                />
              ) : (
                <progress className="reviewBusyProgress" />
              )}
              <p className="hint">Other actions are paused until this finishes.</p>
            </div>
          ) : null}
          <p className="reviewCounter" role="status">
            {reviewQueue.length === 0
              ? 'Queue empty — run a scan to load unknowns.'
              : `${reviewIndex + 1} / ${reviewQueue.length}`}
          </p>
          <ReviewMediaStage currentReviewPath={currentReviewPath} />
          <p className="reviewPath" title={currentReviewPath ?? undefined}>
            {currentReviewPath ?? '—'}
          </p>
          <div className="reviewKeyLegend" aria-hidden="true">
            <span>← prev</span>
            <span>→ next</span>
            <span>↑ accept</span>
            <span>↓ reject</span>
          </div>
          <div className="row reviewActions">
            <button
              type="button"
              disabled={busy || reviewQueue.length === 0}
              onClick={() => dispatch(reviewIndexSet(reviewIndex - 1))}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={busy || !session.signedIn || !currentReviewPath || !workingRoot}
              onClick={() => void rejectCurrent()}
            >
              ↓ Reject
            </button>
            <button
              type="button"
              disabled={busy || !session.signedIn || !currentReviewPath || !workingRoot}
              onClick={() => void acceptCurrent()}
            >
              ↑ Accept
            </button>
            <button
              type="button"
              disabled={busy || reviewQueue.length === 0}
              onClick={() => dispatch(reviewIndexSet(reviewIndex + 1))}
            >
              Next →
            </button>
          </div>
          {!session.signedIn ? (
            <div className="row">
              <button type="button" disabled={busy} onClick={() => void signIn()}>
                Sign in to accept / reject
              </button>
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  // scan workspace (default for screen === 'scan')
  return (
    <main className="shell">
      <header className="appHeader">
        <div>
          <h1>{title}</h1>
          <p className="tagline">Scan folders, classify known hashes, review unknowns.</p>
        </div>
        {statusBar}
      </header>
      {navHome}

      <section className="devPanel" aria-label="Scan">
        <h2>Scan + classify</h2>
        <p className="hint">
          Choose a scan folder (saved), then run. Unknowns open in Tinder-style review (arrow keys).
        </p>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void chooseScanRoot()}>
            Choose scan folder
          </button>
          <button
            type="button"
            disabled={busy || !session.signedIn || !workingRoot || !scanRoot}
            onClick={() => void runScan()}
          >
            Run scan
          </button>
          <button
            type="button"
            disabled={busy || reviewQueue.length === 0}
            onClick={() => dispatch(screenSet('review'))}
          >
            Open review{reviewQueue.length > 0 ? ` (${reviewQueue.length})` : ''}
          </button>
          {!session.signedIn ? (
            <button type="button" disabled={busy} onClick={() => void signIn()}>
              Sign in
            </button>
          ) : null}
        </div>
        <p className="status" role="status">
          Scan folder: {scanRoot || '—'}
          <br />
          {scanProgress
            ? `${scanProgress.phase}: ${scanProgress.filesProcessed}/${scanProgress.filesFound} · rejected ${scanProgress.movedRejected} · duplicate ${scanProgress.movedDuplicate} · unknown ${scanProgress.skippedUnknown}`
            : 'No scan in progress.'}
        </p>
        {scanResult ? <pre className="inspection">{JSON.stringify(scanResult, null, 2)}</pre> : null}
      </section>

      <section className="devPanel" aria-label="Local cleanup">
        <h2>Local cleanup</h2>
        <p className="hint">
          Permanently delete local files under rejected/ or duplicate/ only. Requires confirmation.
          Never touches preserve/. Cosmos accept/reject decisions are kept.
        </p>
        <div className="row">
          <label className="bucket">
            Bucket
            <select
              value={cleanupBucket}
              disabled={busy}
              onChange={(event) => {
                setCleanupBucket(event.target.value as CleanupBucket)
                setCleanupList(null)
              }}
            >
              <option value="rejected">rejected</option>
              <option value="duplicate">duplicate</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !workingRoot}
            onClick={() => void refreshCleanupList()}
          >
            List files
          </button>
          <button
            type="button"
            disabled={busy || !workingRoot || !cleanupList || cleanupList.files.length === 0}
            onClick={() => void deleteCleanupBucket()}
          >
            Delete all listed…
          </button>
        </div>
        <p className="status" role="status">
          {cleanupList
            ? `${cleanupList.bucket}/: ${cleanupList.files.length} file(s)`
            : 'List a cleanup bucket to preview files.'}
        </p>
        {cleanupList ? (
          <pre className="inspection">
            {JSON.stringify(
              cleanupList.files.map((f) => ({ path: f.relativePath, bytes: f.sizeBytes })),
              null,
              2,
            )}
          </pre>
        ) : null}
      </section>

      <section className="devPanel" aria-label="Restore preserve">
        <h2>Sync from cloud</h2>
        <p className="hint">
          Same as Tools → Sync from cloud: download ACCEPTED+SYNCED blobs into preserve/. Prefer
          Tools for the primary entry point.
        </p>
        <div className="row">
          <button
            type="button"
            disabled={busy || !session.signedIn || !workingRoot}
            onClick={() => void runRestore()}
          >
            Restore from Blob
          </button>
          <button type="button" disabled={busy} onClick={() => dispatch(screenSet('tools'))}>
            Open Tools
          </button>
        </div>
        <p className="status" role="status">
          {restoreProgress
            ? `${restoreProgress.phase}: ${restoreProgress.completed}/${restoreProgress.total} · skipped ${restoreProgress.skipped} · failed ${restoreProgress.failed}`
            : 'No restore run yet.'}
        </p>
        {restoreResult ? (
          <pre className="inspection">{JSON.stringify(restoreResult, null, 2)}</pre>
        ) : null}
      </section>
    </main>
  )
}

