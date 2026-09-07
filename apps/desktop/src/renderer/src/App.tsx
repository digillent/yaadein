import { useEffect, useState } from 'react'
import { getShellTitle } from '@shared/appInfo'
import type { MediaInspection } from '@shared/mediaTypes'
import type { AuthSession, GraphMeProfile } from '@shared/authTypes'
import type { AcceptUploadHarnessResult, CosmosHarnessResult } from '@shared/decisionTypes'

type WorkingBucket = 'preserve' | 'duplicate' | 'rejected'

/** Convert an HTML date input (YYYY-MM-DD) to an ISO instant for the move API. */
function eventDateInputToIso(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`
}

export default function App() {
  const title =
    typeof window !== 'undefined' && window.yaadein?.appName
      ? window.yaadein.appName
      : getShellTitle()

  const [workingRoot, setWorkingRoot] = useState('')
  const [sourcePath, setSourcePath] = useState('')
  const [bucket, setBucket] = useState<WorkingBucket>('preserve')
  const [eventDateOverride, setEventDateOverride] = useState('')
  const [status, setStatus] = useState<string>('')
  const [inspection, setInspection] = useState<MediaInspection | null>(null)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [meProfile, setMeProfile] = useState<GraphMeProfile | null>(null)
  const [cosmosHarness, setCosmosHarness] = useState<CosmosHarnessResult | null>(null)
  const [blobHarness, setBlobHarness] = useState<AcceptUploadHarnessResult | null>(null)

  useEffect(() => {
    void window.yaadein.getAuthSession().then(setSession).catch(() => {
      setSession({
        signedIn: false,
        accountName: null,
        username: null,
        homeAccountId: null,
        userId: null,
      })
    })
  }, [])

  async function chooseWorkingRoot(): Promise<void> {
    const path = await window.yaadein.pickWorkingDirectory()
    if (path) {
      setWorkingRoot(path)
      setStatus(`Working folder: ${path}`)
    }
  }

  async function ensureTree(): Promise<void> {
    if (!workingRoot) {
      setStatus('Choose a working folder first.')
      return
    }
    setBusy(true)
    try {
      await window.yaadein.ensureWorkingFolder(workingRoot)
      setStatus(`Ensured preserve / duplicate / rejected under ${workingRoot}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function chooseSource(): Promise<void> {
    const path = await window.yaadein.pickSourceFile()
    if (path) {
      setSourcePath(path)
      setInspection(null)
      setStatus(`Source: ${path}`)
    }
  }

  async function inspectSource(): Promise<void> {
    if (!sourcePath) {
      setStatus('Choose a source file first.')
      return
    }
    setBusy(true)
    try {
      const result = await window.yaadein.inspectMedia({
        sourcePath,
        ...(eventDateOverride
          ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
          : {}),
      })
      setInspection(result)
      setStatus(
        `Inspected ${result.originalFilename}: ${result.contentHash.slice(0, 12)}… (${result.organizeDateSource})`,
      )
    } catch (error) {
      setInspection(null)
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function moveSample(): Promise<void> {
    if (!workingRoot || !sourcePath) {
      setStatus('Choose a working folder and a source file first.')
      return
    }
    setBusy(true)
    try {
      const result = await window.yaadein.moveMedia({
        sourcePath,
        workingRoot,
        bucket,
        nameDisambiguator: 'devmove',
        ...(eventDateOverride
          ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
          : {}),
      })
      setSourcePath('')
      setInspection(null)
      setStatus(
        `Moved to ${result.destinationPath} (${result.yearMonth})${
          eventDateOverride ? ' [event date override]' : ' [auto date]'
        }`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function signIn(): Promise<void> {
    setBusy(true)
    try {
      const next = await window.yaadein.signIn()
      setSession(next)
      setMeProfile(null)
      setCosmosHarness(null)
      setBlobHarness(null)
      setStatus(next.signedIn ? `Signed in as ${next.username ?? next.accountName}` : 'Signed out')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function signOut(): Promise<void> {
    setBusy(true)
    try {
      const next = await window.yaadein.signOut()
      setSession(next)
      setMeProfile(null)
      setCosmosHarness(null)
      setBlobHarness(null)
      setStatus('Signed out')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function callMe(): Promise<void> {
    setBusy(true)
    try {
      const profile = await window.yaadein.fetchMe()
      setMeProfile(profile)
      setStatus(`Graph /me: ${profile.displayName ?? profile.userPrincipalName ?? profile.id}`)
    } catch (error) {
      setMeProfile(null)
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function runCosmosHarness(): Promise<void> {
    setBusy(true)
    try {
      const result = await window.yaadein.cosmosHarnessRoundTrip()
      setCosmosHarness(result)
      setStatus(
        result.lookedUp
          ? `Cosmos OK: upserted+looked up ${result.upserted.contentHash.slice(0, 12)}…`
          : `Cosmos upsert OK but lookup missed ${result.upserted.contentHash.slice(0, 12)}…`,
      )
    } catch (error) {
      setCosmosHarness(null)
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function runAcceptUpload(): Promise<void> {
    if (!sourcePath) {
      setStatus('Choose a source file first.')
      return
    }
    setBusy(true)
    try {
      const result = await window.yaadein.acceptAndUpload({
        sourcePath,
        ...(eventDateOverride
          ? { captureDateIso: eventDateInputToIso(eventDateOverride) }
          : {}),
      })
      setBlobHarness(result)
      setStatus(
        `Accept+upload ${result.document.cloudStatus}: ${result.cloudObjectId ?? 'no blob id'} (source not moved)`,
      )
    } catch (error) {
      setBlobHarness(null)
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="shell">
      <h1>{title}</h1>
      <p className="tagline">Clear digital clutter and preserve the memories that matter.</p>

      <section className="devPanel" aria-label="Auth harness">
        <h2>Sign-in (Entra + PKCE)</h2>
        <p className="hint">
          Sign-in requests the Cosms delegated scope. Storage uses a separate token on upload.
          Cosms harness writes a lean REJECTED sample; Accept+upload writes ACCEPTED and syncs Blob
          (does not move into preserve/).
        </p>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void signIn()}>
            Sign in
          </button>
          <button type="button" disabled={busy || !session?.signedIn} onClick={() => void signOut()}>
            Sign out
          </button>
          <button type="button" disabled={busy || !session?.signedIn} onClick={() => void callMe()}>
            Call Graph /me
          </button>
          <button
            type="button"
            disabled={busy || !session?.signedIn}
            onClick={() => void runCosmosHarness()}
          >
            Cosms upsert + lookup
          </button>
          <button
            type="button"
            disabled={busy || !session?.signedIn || !sourcePath}
            onClick={() => void runAcceptUpload()}
          >
            Accept + upload Blob
          </button>
        </div>
        <p className="status" role="status">
          {session?.signedIn
            ? `Signed in: ${session.username ?? session.accountName ?? 'account'}${
                session.userId ? ` (oid ${session.userId.slice(0, 8)}…)` : ''
              }`
            : 'Not signed in'}
        </p>
        {meProfile ? <pre className="inspection">{JSON.stringify(meProfile, null, 2)}</pre> : null}
        {cosmosHarness ? (
          <pre className="inspection">{JSON.stringify(cosmosHarness, null, 2)}</pre>
        ) : null}
        {blobHarness ? <pre className="inspection">{JSON.stringify(blobHarness, null, 2)}</pre> : null}
      </section>

      <section className="devPanel" aria-label="Working folder harness">
        <h2>Working folder + media inspect</h2>
        <p className="hint">
          Organize date: user override → EXIF → oldest filesystem time. Inspect returns SHA-256,
          size, metadata, and tags.
        </p>

        <div className="row">
          <button type="button" disabled={busy} onClick={() => void chooseWorkingRoot()}>
            Choose working folder
          </button>
          <button type="button" disabled={busy || !workingRoot} onClick={() => void ensureTree()}>
            Ensure folders
          </button>
        </div>

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
              value={bucket}
              disabled={busy}
              onChange={(event) => setBucket(event.target.value as WorkingBucket)}
            >
              <option value="preserve">preserve</option>
              <option value="duplicate">duplicate</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label className="bucket">
            Event date override
            <input
              type="date"
              value={eventDateOverride}
              disabled={busy}
              onChange={(event) => setEventDateOverride(event.target.value)}
            />
          </label>
          {eventDateOverride ? (
            <button type="button" disabled={busy} onClick={() => setEventDateOverride('')}>
              Clear override
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !workingRoot || !sourcePath}
            onClick={() => void moveSample()}
          >
            Move file
          </button>
        </div>

        <p className="status" role="status">
          {status || 'No action yet.'}
        </p>

        {inspection ? (
          <pre className="inspection">{JSON.stringify(inspection, null, 2)}</pre>
        ) : null}
      </section>
    </main>
  )
}
