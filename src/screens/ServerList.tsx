import type { Screen } from '../App'

export default function ServerList({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My Families</h1>
      <button className="mt-4 text-brand" onClick={() => navigate({ name: 'add-server' })}>
        Add a family
      </button>
    </main>
  )
}
