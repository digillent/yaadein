import { useEffect } from 'react'
import { getShellTitle } from '@shared/appInfo'
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
  reviewPreviewUpdated,
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
import {
  busySet,
  statusSet,
  inspectionSet,
  cosmosHarnessSet,
  blobHarnessSet,
  harnessExtrasCleared,
} from './store/uiSlice'

/** Convert an HTML date input (YYYY-MM-DD) to an ISO instant for the move API. */
function eventDateInputToIso(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`
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
  const preview = useAppSelector((s) => s.review.preview)
  const currentReviewPath = useAppSelector(selectCurrentReviewPath)
  const busy = useAppSelector((s) => s.ui.busy)
  const status = useAppSelector((s) => s.ui.status)
  const inspection = useAppSelector((s) => s.ui.inspection)
  const cosmosHarness = useAppSelector((s) => s.ui.cosmosHarness)
  const blobHarness = useAppSelector((s) => s.ui.blobHarness)

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
    return window.yaadein.onScanProgress((progress) => {
      dispatch(scanProgressUpdated(progress))
    })
  }, [dispatch])

  useEffect(() => {
    if (!currentReviewPath) {
      dispatch(reviewPreviewUpdated(null))
      return
    }
    let cancelled = false
    void window.yaadein.previewMedia(currentReviewPath).then(
      (next) => {
        if (!cancelled) {
          dispatch(reviewPreviewUpdated(next))
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          dispatch(reviewPreviewUpdated(null))
          dispatch(statusSet(error instanceof Error ? error.message : String(error)))
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [currentReviewPath, dispatch])

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
      dispatch(statusSet(`Working folder: ${path}`))
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
        dispatch(reviewQueueLoaded(unknowns))
        dispatch(
          statusSet(
            `Scan done: ${result.movedRejected} rejected, ${result.movedDuplicate} duplicate, ${result.skippedUnknown} unknown, ${result.errors} errors`,
          ),
        )
      } catch (error) {
        dispatch(scanFailed())
        dispatch(statusSet(error instanceof Error ? error.message : String(error)))
      }
    })
  }

  async function acceptCurrent(): Promise<void> {
    if (!currentReviewPath || !workingRoot) {
      dispatch(statusSet('Need a review item and working folder.'))
      return
    }
    await withBusy(async () => {
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
      }
    })
  }

  async function rejectCurrent(): Promise<void> {
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

  return (
    <main className="shell">
      <header className="appHeader">
        <div>
          <h1>{title}</h1>
          <p className="tagline">Clear digital clutter and preserve the memories that matter.</p>
        </div>
        <p className="statusBar" role="status">
          {busy ? 'Working… · ' : ''}
          {session.signedIn
            ? `Signed in: ${session.username ?? session.accountName ?? 'account'}`
            : 'Not signed in'}
          {status ? ` · ${status}` : ''}
        </p>
      </header>

      <section className="devPanel" aria-label="Settings">
        <h2>Settings</h2>
        <p className="hint">Working folder and scan root used by classify, review, and moves.</p>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void chooseWorkingRoot()}>
            Choose working folder
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
      </section>

      <section className="devPanel" aria-label="Auth">
        <h2>Sign-in</h2>
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

      <section className="devPanel" aria-label="Scan">
        <h2>Scan + classify</h2>
        <p className="hint">
          Progress and results live in Redux. Unknowns load into the review queue.
        </p>
        <div className="row">
          <button
            type="button"
            disabled={busy || !session.signedIn || !workingRoot || !scanRoot}
            onClick={() => void runScan()}
          >
            Run scan
          </button>
        </div>
        <p className="status" role="status">
          {scanProgress
            ? `${scanProgress.phase}: ${scanProgress.filesProcessed}/${scanProgress.filesFound} · rejected ${scanProgress.movedRejected} · duplicate ${scanProgress.movedDuplicate} · unknown ${scanProgress.skippedUnknown}`
            : 'No scan in progress.'}
        </p>
        {scanResult ? <pre className="inspection">{JSON.stringify(scanResult, null, 2)}</pre> : null}
      </section>

      <section className="devPanel" aria-label="Review queue">
        <h2>Review queue</h2>
        <p className="hint">
          Accept → Cosms + Blob SYNCED → preserve/. Reject → Cosms lean → rejected/.
        </p>
        <div className="row">
          <button
            type="button"
            disabled={busy || !session.signedIn || !currentReviewPath || !workingRoot}
            onClick={() => void acceptCurrent()}
          >
            Accept → preserve
          </button>
          <button
            type="button"
            disabled={busy || !session.signedIn || !currentReviewPath || !workingRoot}
            onClick={() => void rejectCurrent()}
          >
            Reject → rejected
          </button>
          <button
            type="button"
            disabled={busy || reviewQueue.length === 0}
            onClick={() => dispatch(reviewIndexSet(reviewIndex + 1))}
          >
            Next in queue
          </button>
        </div>
        <p className="status" role="status">
          {reviewQueue.length === 0
            ? 'Queue empty — run scan to load unknowns.'
            : `${reviewIndex + 1}/${reviewQueue.length}: ${currentReviewPath}`}
        </p>
        {preview?.dataUrl ? (
          <img
            className="inspection"
            src={preview.dataUrl}
            alt={preview.sourcePath}
            style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}
          />
        ) : currentReviewPath ? (
          <p className="hint">No image preview (video or large file).</p>
        ) : null}
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
