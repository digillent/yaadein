import { useState } from 'react'
import { getShellTitle } from '@shared/appInfo'

type WorkingBucket = 'preserve' | 'duplicate' | 'rejected'

export default function App() {
  const title =
    typeof window !== 'undefined' && window.yaadein?.appName
      ? window.yaadein.appName
      : getShellTitle()

  const [workingRoot, setWorkingRoot] = useState('')
  const [sourcePath, setSourcePath] = useState('')
  const [bucket, setBucket] = useState<WorkingBucket>('preserve')
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

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
      setStatus(`Source: ${path}`)
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
        captureDateIso: new Date().toISOString(),
        nameDisambiguator: 'devmove',
      })
      setSourcePath('')
      setStatus(`Moved to ${result.destinationPath}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="shell">
      <h1>{title}</h1>
      <p className="tagline">Clear digital clutter and preserve the memories that matter.</p>

      <section className="devPanel" aria-label="Working folder harness">
        <h2>Working folder (Milestone 2)</h2>
        <p className="hint">Dev harness: ensure the tree and move a sample file into YYYY/MM.</p>

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
      </section>
    </main>
  )
}
