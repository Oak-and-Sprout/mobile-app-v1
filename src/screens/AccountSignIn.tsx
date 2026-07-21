import type { Screen } from '../App'
import { Header } from '../components/chrome'

export default function AccountSignIn({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr">
      <Header title="Sign in to Sprout Track" onBack={() => navigate({ name: 'welcome' })} />
    </div>
  )
}
