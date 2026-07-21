import type { Screen } from '../App'
import { Ic } from '../components/Icons'

export default function Fork({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="m-scr bleed">
      <div className="fork-top"><img className="fork-logo" src="/logo.png" alt="" /></div>
      <div className="fork-bd">
        <h1>Everyone you love, <em>on the same page.</em></h1>
        <p className="sub">How do you sign in to your family?</p>
        <button className="choice" onClick={() => navigate({ name: 'acct-signin' })}>
          <span className="ic ic-badge">
            <img src="/logo.png" alt="" />
            <span className="badge-user"><Ic id="i-user" s={15} /></span>
          </span>
          <span className="t"><b>With my Sprout Track account</b><span>Email &amp; password. New here? This creates your account too.</span></span>
          <Ic id="i-chevr" s={18} />
        </button>
        <button className="choice" onClick={() => navigate({ name: 'add-family', prefillInput: '' })}>
          <span className="ic ic-apr"><Ic id="i-link" s={22} /></span>
          <span className="t"><b>Family link shared with you?</b><span>Sign in here with the family link and your family PIN or personal caretaker PIN.</span></span>
          <Ic id="i-chevr" s={18} />
        </button>
        <p className="fork-foot">Either way, your sign-in stays in this phone&rsquo;s secure keychain.</p>
      </div>
    </div>
  )
}
