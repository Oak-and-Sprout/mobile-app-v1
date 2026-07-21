import type { Screen } from '../App'

export default function Welcome({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="bg-gradient-to-r from-brand to-brand-emerald bg-clip-text text-3xl font-bold text-transparent">
        Welcome to Sprout Track
      </h1>
      <button
        className="w-full max-w-sm rounded-xl bg-gradient-to-r from-brand to-brand-emerald px-6 py-3 font-semibold text-white"
        onClick={() => navigate({ name: 'add-family', prefillInput: 'https://sprout-track.com' })}
      >
        Use Sprout Track
      </button>
      <button
        className="w-full max-w-sm rounded-xl border border-mint-border bg-mint px-6 py-3 font-semibold text-brand-deep"
        onClick={() => navigate({ name: 'add-family' })}
      >
        Connect to my own server
      </button>
    </main>
  )
}
