// Screens for the Sprout Track mobile shell mockup (v1 storybook theme)
const Ic = ({ id, s = 18, style }) => <svg width={s} height={s} style={style}><use href={`#${id}`}/></svg>;

function Header({ title, onBack, right }) {
  return (
    <div className="m-hd">
      {onBack && <button className="m-iconbtn" aria-label="Back" onClick={onBack}><Ic id="i-back" s={20}/></button>}
      <h1 style={onBack ? null : { paddingLeft: 8 }}>{title}</h1>
      {right}
    </div>
  );
}

function ErrBox({ children }) { return <div className="m-err" role="alert"><Ic id="i-alert" s={17}/><span>{children}</span></div>; }

function Welcome({ go }) {
  return (
    <div className="m-scr">
      <div className="wel">
        <img className="sprite" src="v1-storybook/art/butterfly.svg" alt="" width="56" style={{ top: 86, right: 26, transform: 'rotate(10deg)', position: 'absolute' }}/>
        <img src="v1-storybook/art/teddy.svg" alt="" width="108" style={{ marginBottom: 18 }}/>
        <span className="kick">Sprout Track</span>
        <h1>The family page, <em>in your pocket.</em></h1>
        <p className="lede">Pair this phone with your family once — after that it&rsquo;s one tap and a glance to get back to the book.</p>
        <div className="btns">
          <button className="m-btn" onClick={go.account}>Sign in with my account</button>
          <button className="m-btn ghost" onClick={() => go('sprout-track.com/')}>Join with a family link</button>
          <button className="m-btn ghost" onClick={() => go('')}>I run my own server</button>
        </div>
        <p className="assure">Works the same for hosted and self-hosted families.</p>
      </div>
    </div>
  );
}

const ERR_TEXT = {
  'invalid': <>That doesn&rsquo;t look like an address. Try something like <b>myhost.com/smith-family</b>.</>,
  'no-slug': <>Add your family&rsquo;s name to the end — like <b>myhost.com/smith-family</b>.</>,
  'family not found': 'No family by that name on this server. Check the spelling?',
  'not a Sprout server': <>We reached it, but it isn&rsquo;t a Sprout Track server.</>,
  'unreachable': <>Can&rsquo;t reach that server. Check the address and your connection.</>,
  'wrong PIN': <>That PIN didn&rsquo;t work. Give it another look and try again.</>,
  'locked': <>Too many tries — the server is taking a breather. Try again in a few minutes.</>,
};

function titleFromSlug(slug) {
  return slug.split(/[-_]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function AddFamily({ prefill, signin, findResult, loginResult, bioKind, onBack, onSaved }) {
  const [addr, setAddr] = React.useState(prefill);
  const [busy, setBusy] = React.useState(false);
  const [located, setLocated] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [bio, setBio] = React.useState(true);
  const [pin, setPin] = React.useState(''); const [lid, setLid] = React.useState('');
  const [email, setEmail] = React.useState(''); const [pw, setPw] = React.useState('');
  const timer = React.useRef();
  React.useEffect(() => () => clearTimeout(timer.current), []);

  function find() {
    setErr(null); setLocated(null); setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      const clean = addr.trim().replace(/^https?:\/\//i, '');
      const parts = clean.split('/').filter(Boolean);
      if (!parts[0] || !/^[a-z0-9.:-]+$/i.test(parts[0])) return setErr('invalid');
      if (!parts[1]) return setErr('no-slug');
      if (findResult !== 'found') return setErr(findResult);
      const hosted = /sprout-track\.com/i.test(parts[0]);
      setLocated({ name: titleFromSlug(parts[1]), host: parts[0], slug: parts[1], hosted, cleartext: /^http:\/\//i.test(addr.trim()) });
    }, 750);
  }

  function verify() {
    setErr(null); setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      if (loginResult !== 'works') return setErr(loginResult);
      onSaved({ ...located, bio });
    }, 900);
  }

  const canVerify = signin === 'email' ? email && pw : signin === 'ID + PIN' ? lid && pin : pin;
  return (
    <div className="m-scr">
      <Header title="Connect to a family" onBack={onBack}/>
      <div className="m-bd">
        <div className="f-grid">
          <div>
            <label className="fl" htmlFor="addr">Server address</label>
            <input className="fi" id="addr" value={addr} autoCapitalize="none" spellCheck="false" placeholder="myhost.com/smith-family" onChange={e => { setAddr(e.target.value); setLocated(null); setErr(null); }}/>
            <p className="fh">Your family&rsquo;s link — the same one you&rsquo;d open in a browser.</p>
          </div>
          {!located && <button className="m-btn" disabled={busy || !addr.trim()} onClick={find}>{busy ? 'Knocking on the door…' : 'Find my family'}</button>}
          {err && !located && <ErrBox>{ERR_TEXT[err]}</ErrBox>}
          {located && <>
            <div className="fam-card" style={{ cursor: 'default' }}>
              <div className={'fam-av' + (located.hosted ? '' : ' apr')}>{located.name[0]}</div>
              <div className="t">
                <div className="nm">{located.name}</div>
                <div className="host">{located.host}</div>
              </div>
              <span className={'chip ' + (located.hosted ? 'c-teal' : 'c-apr')}>{located.hosted ? 'Hosted' : 'Self-hosted'}</span>
            </div>
            {located.cleartext && <div className="m-warn"><Ic id="i-alert" s={17}/><span>Heads up — this connection isn&rsquo;t encrypted. Fine on your home network, risky on public Wi-Fi.</span></div>}
            <div className="fgroup">
              <b>How you sign in</b>
              <p className="fh">{signin === 'email' ? 'The account you use on sprout-track.com.' : 'Same PIN as the website — we check it with your server, then keep it safe here.'}</p>
              {signin === 'email' ? (
                <div className="f-grid">
                  <div><label className="fl" htmlFor="em">Email</label><input className="fi" id="em" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
                  <div><label className="fl" htmlFor="pw">Password</label><input className="fi" id="pw" type="password" placeholder="Your password" value={pw} onChange={e => setPw(e.target.value)}/></div>
                </div>
              ) : signin === 'ID + PIN' ? (
                <div className="f-2">
                  <div><label className="fl" htmlFor="lid">Login ID</label><input className="fi" id="lid" inputMode="numeric" maxLength="2" placeholder="11" value={lid} onChange={e => setLid(e.target.value)}/></div>
                  <div><label className="fl" htmlFor="pin">PIN</label><input className="fi" id="pin" type="password" inputMode="numeric" maxLength="10" placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)}/></div>
                </div>
              ) : (
                <div><label className="fl" htmlFor="pin">Family PIN</label><input className="fi" id="pin" type="password" inputMode="numeric" maxLength="10" placeholder="••••••" value={pin} onChange={e => setPin(e.target.value)}/></div>
              )}
            </div>
            <label className="fcheck">
              <input type="checkbox" checked={bio} onChange={e => setBio(e.target.checked)}/>
              <span><b>Unlock with {bioKind} next time</b><small>Your PIN lives in this phone&rsquo;s secure keychain — a glance opens the book.</small></span>
            </label>
            {err && <ErrBox>{ERR_TEXT[err]}</ErrBox>}
            <button className="m-btn" disabled={busy || !canVerify} onClick={verify}>{busy ? 'Checking with your server…' : 'Verify & save'}</button>
          </>}
        </div>
      </div>
    </div>
  );
}

function AccountSignIn({ loginResult, bioKind, onBack, onSaved }) {
  const [email, setEmail] = React.useState(''); const [pw, setPw] = React.useState('');
  const [bio, setBio] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const timer = React.useRef();
  React.useEffect(() => () => clearTimeout(timer.current), []);
  function verify() {
    setErr(null); setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      if (loginResult !== 'works') return setErr(loginResult === 'wrong PIN' ? 'wrong-account' : loginResult);
      onSaved({ name: 'Sprout Test', host: 'sprout-track.com', slug: 'sprout-test', hosted: true, bio });
    }, 900);
  }
  return (
    <div className="m-scr">
      <Header title="Sign in to Sprout Track" onBack={onBack}/>
      <div className="m-bd">
        <div className="f-grid">
          <p className="fh" style={{ marginTop: 0 }}>The same account you use on sprout-track.com — your family comes with it, no address to type.</p>
          <div><label className="fl" htmlFor="acEm">Email</label><input className="fi" id="acEm" type="email" autoCapitalize="none" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
          <div><label className="fl" htmlFor="acPw">Password</label><input className="fi" id="acPw" type="password" placeholder="Your password" value={pw} onChange={e => setPw(e.target.value)}/></div>
          <label className="fcheck">
            <input type="checkbox" checked={bio} onChange={e => setBio(e.target.checked)}/>
            <span><b>Unlock with {bioKind} next time</b><small>Your password lives in this phone&rsquo;s secure keychain — a glance opens the book.</small></span>
          </label>
          {err && <ErrBox>{err === 'wrong-account' ? <>That email and password didn&rsquo;t match. Give it another look and try again.</> : ERR_TEXT[err]}</ErrBox>}
          <button className="m-btn" disabled={busy || !email || !pw} onClick={verify}>{busy ? 'Checking with Sprout Track…' : 'Sign me in'}</button>
          <p className="fh" style={{ textAlign: 'center' }}>New here? Start your trial at sprout-track.com — then come back and sign in.</p>
        </div>
      </div>
    </div>
  );
}

function Families({ families, onOpen, onRemove, onDefault, onAdd, onSettings }) {
  return (
    <div className="m-scr">
      <Header title="My families" right={<button className="m-iconbtn" aria-label="Settings" onClick={onSettings}><Ic id="i-gear" s={20}/></button>}/>
      <div className="m-bd">
        {families.length === 0 && (
          <div className="empty">
            <img src="v1-storybook/art/kitten.svg" alt="" width="84"/>
            <b>No families on this phone yet.</b>
            Pair one and it&rsquo;ll live right here.
          </div>
        )}
        {families.map(f => (
          <div className="fam-row" key={f.id}>
            <button className="fam-card" onClick={() => onOpen(f)}>
              <div className={'fam-av' + (f.hosted ? '' : ' apr')}>{f.name[0]}</div>
              <div className="t">
                <div className="nm">{f.name}{f.def && <span className="chip c-apr">Opens first</span>}</div>
                <div className="host">{f.host} · opened {f.last}</div>
              </div>
              {f.bio && <Ic id="i-face" s={18} style={{ color: 'var(--sub)', flexShrink: 0 }}/>}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className={'rowbtn star' + (f.def ? ' on' : '')} title="Open this family first" aria-label={`Make ${f.name} the default`} onClick={() => onDefault(f)}><Ic id={f.def ? 'i-starf' : 'i-star'} s={17}/></button>
              <button className="rowbtn x" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f)}><Ic id="i-x" s={15}/></button>
            </div>
          </div>
        ))}
        <button className="m-btn ghost" style={{ borderStyle: 'dashed', marginTop: 6 }} onClick={onAdd}><Ic id="i-plus" s={16}/>Add a family</button>
      </div>
    </div>
  );
}

function Settings({ autoOpen, setAutoOpen, defName, onBack, onClearAll }) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <div className="m-scr">
      <Header title="Settings" onBack={onBack}/>
      <div className="m-bd">
        <div className="sect">
          <div className="swrow">
            <div className="t"><b>Open my family automatically</b><p>Skip the list — jump straight into {defName ? <b style={{ fontWeight: 700 }}>{defName}</b> : 'your default family'} when the app opens. Your unlock is still the gate.</p></div>
            <button className={'sw' + (autoOpen ? ' on' : '')} role="switch" aria-checked={autoOpen} aria-label="Open my family automatically" onClick={() => setAutoOpen(!autoOpen)}><i></i></button>
          </div>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-shield" s={19}/><h3>Your PINs stay put</h3></div>
          <p>Saved sign-ins live in this phone&rsquo;s secure keychain and never leave it. Remove a family and its PIN goes with it.</p>
        </div>
        <div className="sect">
          <div className="sect-hd"><Ic id="i-alert" s={19} style={{ color: 'var(--rust)' }}/><h3 style={{ color: 'var(--rust)' }}>Clear this phone</h3></div>
          <p style={{ marginBottom: 12 }}>Removes every saved family and PIN from this phone. Your family&rsquo;s data stays safe on the server.</p>
          {confirming ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <p style={{ fontWeight: 700, color: 'var(--rust)' }}>This clears the book from this phone — the server keeps everything. Sure?</p>
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="m-btn danger solid sm" onClick={onClearAll}>Yes, clear it</button>
                <button className="m-btn ghost sm" onClick={() => setConfirming(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            <button className="m-btn danger sm" onClick={() => setConfirming(true)}>Clear all data</button>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--sub)', marginTop: 22 }}>Sprout Track Mobile v0.1.0<br/>The tracker itself lives on your server.</p>
      </div>
    </div>
  );
}

function Offline({ family, onRetry, onSwitch }) {
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img src="v1-storybook/art/kitten.svg" alt="" width="104"/>
        <h2>Can&rsquo;t reach your server.</h2>
        <p>{family ? family.name : 'Your family'}&rsquo;s server isn&rsquo;t answering right now. Everything already logged is safe — we just can&rsquo;t say hello.</p>
        <div className="btns">
          <button className="m-btn" onClick={onRetry}><Ic id="i-refresh" s={17}/>Try again</button>
          <button className="m-btn ghost" onClick={onSwitch}>Switch family</button>
        </div>
      </div>
    </div>
  );
}

function Connecting({ family }) {
  return (
    <div className="m-scr">
      <div className="center-scr">
        <img className="pulse-logo" src="v1-storybook/logo.png" alt=""/>
        <h2>Opening {family.name}…</h2>
        <p style={{ color: 'var(--sub)', fontSize: 14.5 }}>{family.host} · signing you in with your saved PIN</p>
        <div className="dots"><i></i><i></i><i></i></div>
      </div>
    </div>
  );
}

function BioSheet({ phase, kind, family }) {
  return (
    <div className="bio-ovl">
      <div className="bio-card">
        {phase === 'ok'
          ? <svg className="ok-ic" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>
          : <span className="bio-scan" style={{ display: 'inline-block' }}><Ic id={kind === 'Touch ID' ? 'i-finger' : 'i-face'} s={54}/></span>}
        <b>{phase === 'ok' ? 'Unlocked' : kind}</b>
        <span>{phase === 'ok' ? family.name : `Sprout Track · ${family.name}`}</span>
      </div>
    </div>
  );
}

const WV_ACTS = [
  { ic: 'i-bottle', bg: '#dbe7f5', c: '#274f82', l: 'Feed' },
  { ic: 'i-drop', bg: '#f5dcc4', c: '#8a4a12', l: 'Diaper' },
  { ic: 'i-moon', bg: '#e7d9ef', c: '#6b3f8a', l: 'Sleep' },
  { ic: 'i-bath', bg: '#cfe5df', c: '#0a544d', l: 'Bath' },
  { ic: 'i-note', bg: '#f3e7c4', c: '#7a5c12', l: 'Note' },
];
const WV_ROWS = [
  { ic: 'i-bottle', bg: '#dbe7f5', c: '#274f82', t: 'Bottle — 4 oz', s: 'Finished the whole thing', who: 'Mom', w: 'w-mom', time: '2:10 pm' },
  { ic: 'i-moon', bg: '#e7d9ef', c: '#6b3f8a', t: 'Nap', s: '1 h 20 m — woke up happy', who: 'Nanny', w: 'w-nanny', time: '12:45 pm' },
  { ic: 'i-drop', bg: '#f5dcc4', c: '#8a4a12', t: 'Diaper — wet', s: 'Quick change', who: 'Dad', w: 'w-dad', time: '12:40 pm' },
  { ic: 'i-bottle', bg: '#dbe7f5', c: '#274f82', t: 'Nursing — 18 min', s: 'Left side', who: 'Mom', w: 'w-mom', time: '11:05 am' },
  { ic: 'i-note', bg: '#f3e7c4', c: '#7a5c12', t: 'Note', s: '\u201CGiggled at the ceiling fan.\u201D', who: 'Gma', w: 'w-gma', time: '9:32 am' },
  { ic: 'i-drop', bg: '#f5dcc4', c: '#8a4a12', t: 'Diaper — dirty', s: '', who: 'Gma', w: 'w-gma', time: '9:20 am' },
];

function Webview({ family, onExit }) {
  return (
    <div className="m-scr wv">
      <div className="wv-head">
        <div><div className="hi">Good afternoon —</div><div className="fam">{family.name}</div></div>
        <div className="baby-chip">Jackson<small>1 yr 8 mo</small></div>
      </div>
      <div className="wv-acts">
        {WV_ACTS.map(a => (
          <button className="act" key={a.l}>
            <span className="ic" style={{ background: a.bg, color: a.c }}><Ic id={a.ic} s={21}/></span>{a.l}
          </button>
        ))}
      </div>
      <div className="wv-stats"><span>Last feed <b>2:10 pm</b></span><span>Last diaper <b>12:40 pm</b></span><span>Sleep today <b>3 h 05 m</b></span></div>
      <div className="tl">
        <div className="tl-day">Today</div>
        {WV_ROWS.map((r, i) => (
          <div className="tl-row" key={i}>
            <span className="tl-ic" style={{ background: r.bg, color: r.c }}><Ic id={r.ic} s={18}/></span>
            <div className="t"><b>{r.t}</b>{r.s && <span>{r.s}</span>}</div>
            <span className={'who ' + r.w}>{r.who}</span>
            <time>{r.time}</time>
          </div>
        ))}
      </div>
      <button className="wv-exit" onClick={onExit}>‹ Back to the shell &nbsp;·&nbsp; demo only</button>
    </div>
  );
}

Object.assign(window, { Welcome, AddFamily, AccountSignIn, Families, Settings, Offline, Connecting, BioSheet, Webview });
