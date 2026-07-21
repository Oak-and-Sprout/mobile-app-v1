import type { Screen } from '../App'
import { Ic } from '../components/Icons'
import type { ServerEntry } from '../services/server-registry'

export default function Offline({ navigate, entry }: { navigate: (s: Screen) => void; entry: ServerEntry }) {
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img src="/art/kitten.svg" alt="" width="104" />
        <h2>Can't reach your server.</h2>
        <p>{entry.familyName}'s server isn't answering right now. Everything already logged is safe — we just can't say hello.</p>
        <div className="btns">
          <button className="m-btn" onClick={() => navigate({ name: 'connecting', entry })}><Ic id="i-refresh" s={17} />Try again</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'families' })}>Switch family</button>
        </div>
      </div>
    </div>
  )
}
