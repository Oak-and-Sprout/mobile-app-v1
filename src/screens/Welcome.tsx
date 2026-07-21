import type { Screen } from '../App'

export default function Welcome({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr">
      <div className="wel">
        <img className="sprite" src="/art/butterfly.svg" alt="" width="56" style={{ top: 86, right: 26, transform: 'rotate(10deg)' }} />
        <img src="/art/teddy.svg" alt="" width="108" style={{ marginBottom: 18 }} />
        <span className="kick">Sprout Track</span>
        <h1>The family page, <em>in your pocket.</em></h1>
        <p className="lede">Pair this phone with your family once — after that it&rsquo;s one tap and a glance to get back to the book.</p>
        <div className="btns">
          <button className="m-btn" onClick={() => navigate({ name: 'account-signin' })}>Sign in with my account</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'add-family', prefillInput: 'sprout-track.com/' })}>Join with a family link</button>
          <button className="m-btn ghost" onClick={() => navigate({ name: 'add-family' })}>I run my own server</button>
        </div>
        <p className="assure">Works the same for hosted and self-hosted families.</p>
      </div>
    </div>
  )
}
