import type { Screen } from '../App'

export default function Offline({ navigate, retry }: { navigate: (s: Screen) => void; retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Can't reach the server</h1>
      <p className="text-gray-500">Check your connection and try again.</p>
      <button
        className="rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={retry}
      >
        Retry
      </button>
      <button className="text-brand" onClick={() => navigate({ name: 'server-list' })}>
        Switch family
      </button>
    </main>
  )
}
