import { getShellTitle } from '@shared/appInfo'

export default function App() {
  const title =
    typeof window !== 'undefined' && window.yaadein?.appName
      ? window.yaadein.appName
      : getShellTitle()

  return (
    <main className="shell">
      <h1>{title}</h1>
      <p className="tagline">Clear digital clutter and preserve the memories that matter.</p>
    </main>
  )
}
