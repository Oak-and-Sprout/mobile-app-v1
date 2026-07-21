import type { Screen } from '../App'
import type { ServerEntry } from '../services/server-registry'

export default function Offline({ navigate, entry }: { navigate: (s: Screen) => void; entry: ServerEntry }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Can't reach the server</h1>
      <p className="text-gray-500">Check your connection and try again.</p>
      <button
        className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={() => navigate({ name: 'connecting', entry })}
      >
        Retry
      </button>
      <button className="text-brand" onClick={() => navigate({ name: 'families' })}>
        Switch family
      </button>
    </main>
  )
}
