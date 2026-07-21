// Family setup wizard (3 steps) - shown after creating an account with no family yet
// Mirrors app SetupWizard behavior: commit-as-you-go, slug availability check, caretaker rules
const WIZ_ART = { 1: 'teddy', 2: 'star', 3: 'kitten' };
const WIZ_ART_W = { 1: 62, 2: 44, 3: 58 };

function slugify(s) { return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
// Mirrors app/api/utils/slug-validation.ts
const RESERVED_URLS = ['account','api','coming-soon','family-manager','family-select','setup','sphome','login','auth','context','globals','layout','metadata','page','template','features','home','pricing','privacy','terms','health','logs','maintenance','status','update','uptime','version'];
// Slugs already taken by other families (demo stand-in for the server check)
const TAKEN_SLUGS = ['sprout-test', 'smith-family'];
function validateSlug(slug) {
  if (!slug || !slug.trim()) return { ok: false, err: 'Your family needs a link - type one or tap the suggest button.' };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, err: 'Links can only use lowercase letters, numbers, and hyphens.' };
  if (slug.length < 3) return { ok: false, err: 'Links need at least 3 characters.' };
  if (slug.length > 50) return { ok: false, err: 'Links max out at 50 characters.' };
  if (RESERVED_URLS.includes(slug.toLowerCase())) return { ok: false, err: <>The system uses <b>/{slug}</b> for itself - pick something else.</> };
  if (TAKEN_SLUGS.includes(slug.toLowerCase())) return { ok: false, err: <>Another family already lives at <b>/{slug}</b> - try a different one.</> };
  return { ok: true };
}
const digits = (v, max) => v.replace(/\D/g, '').slice(0, max);

function WizFrame({ step, savedNote, title, intro, children, footer }) {
  return (
    <div className="m-scr">
      <div className="wiz-hd">
        <div className="wiz-brand"><img src="v1-storybook/logo.png" alt=""/>Sprout Track</div>
        <div className="prog"><i style={{ width: `${(step / 3) * 100}%` }}></i></div>
        <div className="wiz-meta"><span className="wiz-step">Step {step} of 3</span>{savedNote && <span className="wiz-saved"><Ic id="i-check" s={13}/>{savedNote}</span>}</div>
      </div>
      <img className="wiz-art" src={`v1-storybook/art/${WIZ_ART[step]}.svg`} alt="" width={WIZ_ART_W[step]} style={{ transform: `rotate(${step === 2 ? 12 : -7}deg)` }}/>
      <div className="wiz-bd">
        <h2>{title}</h2>
        <p className="intro">{intro}</p>
        {children}
      </div>
      <div className="wiz-ft">{footer}</div>
    </div>
  );
}

function SetupWizard({ firstName, onCancel, onDone }) {
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const timer = React.useRef();
  React.useEffect(() => () => clearTimeout(timer.current), []);
  // step 1
  const [famName, setFamName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugState, setSlugState] = React.useState('idle'); // idle | checking | done
  // step 2
  const [mode, setMode] = React.useState('caretakers');
  const [pin, setPin] = React.useState(''); const [pin2, setPin2] = React.useState('');
  const [cts, setCts] = React.useState([]);
  const [ct, setCt] = React.useState({ id: '', name: firstName || '', type: firstName ? 'Account Owner' : '', role: 'Admin', pin: '' });
  const [ctErr, setCtErr] = React.useState(null);
  // step 3
  const [baby, setBaby] = React.useState({ first: '', last: '', dob: '', gender: '', feed: '02:00', diaper: '03:00', from: 'Start of feeding' });
  const FEED_TYPES = ['Breast feeds', 'Breast milk bottles', 'Formula bottles', 'Other bottles', 'Food'];
  const [feeds, setFeeds] = React.useState(() => Object.fromEntries(FEED_TYPES.map(t => [t, true])));

  // Debounced availability check (server round-trip in the real app)
  React.useEffect(() => {
    if (!slug) { setSlugState('idle'); return; }
    setSlugState('checking');
    const id = setTimeout(() => setSlugState('done'), 550);
    return () => clearTimeout(id);
  }, [slug]);

  function nameChange(v) { setFamName(v); if (!slugTouched) setSlug(slugify(v)); }
  function regen() { const base = slugify(famName) || 'sprout'; setSlug(`${base}-${Math.floor(100 + Math.random() * 900)}`); setSlugTouched(true); }

  // Live login-ID feedback, like the real wizard
  const idErr = ct.id && (!/^\d+$/.test(ct.id) ? 'Digits only.'
    : ct.id === '00' ? <><b>00</b> is reserved for the system.</>
    : cts.some(c => c.id === ct.id) ? <>ID <b>{ct.id}</b> is taken.</> : null);

  function addCt() {
    setCtErr(null);
    if (!/^\d{2}$/.test(ct.id) || idErr) return setCtErr('Pick a free two-digit ID, 01–99.');
    if (!ct.name.trim()) return setCtErr('Give this caretaker a name.');
    if (!/^\d{6,10}$/.test(ct.pin)) return setCtErr('PINs are 6–10 digits.');
    const role = cts.length === 0 ? 'Admin' : ct.role;
    setCts(list => [...list, { ...ct, role }]);
    setCt({ id: '', name: '', type: '', role: 'User', pin: '' });
  }

  const slugCheck = validateSlug(slug);
  const ok1 = famName.trim() && slugState === 'done' && slugCheck.ok;
  const ok2 = mode === 'pin' ? /^\d{6,10}$/.test(pin) && pin === pin2 : cts.length > 0;
  const hhmm = (v) => /^\d{2}:\d{2}$/.test(v);
  const ok3 = baby.first.trim() && baby.last.trim() && baby.dob && baby.gender && hhmm(baby.feed) && hhmm(baby.diaper);
  const setB = (k) => (e) => setBaby(v => ({ ...v, [k]: e.target.value }));

  // Each Next commits to the server - no going back to a saved stage
  function next(to) {
    setBusy(true);
    timer.current = setTimeout(() => { setBusy(false); setStep(to); }, 800);
  }
  function finish() {
    setBusy(true);
    timer.current = setTimeout(() => onDone({ name: famName.trim(), slug, baby: baby.first }), 1200);
  }

  if (step === 1) return (
    <WizFrame step={1} title="Create your family." intro="Your account is planted - now let&rsquo;s make the page everyone will share."
      footer={<><button className="m-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button><button className="m-btn" disabled={!ok1 || busy} onClick={() => next(2)}>{busy ? 'Saving your family…' : 'Next'}</button></>}>
      <div className="f-grid">
        <div><label className="fl" htmlFor="wzName">What&rsquo;s your family&rsquo;s name?</label><input className="fi" id="wzName" placeholder="The Sprout Family" value={famName} onChange={e => nameChange(e.target.value)}/></div>
        <div>
          <label className="fl" htmlFor="wzSlug">Family link</label>
          <div className="slug-row">
            <input className="fi" id="wzSlug" autoCapitalize="none" spellCheck="false" placeholder="family-url" value={slug} onChange={e => { setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); setSlugTouched(true); }}/>
            <button type="button" title="Suggest another" aria-label="Suggest another link" onClick={regen}><Ic id="i-refresh" s={18}/></button>
          </div>
          <p className="fh slug-note">Your family will live at <code>sprout-track.com/{slug || 'your-family-url'}</code> - lowercase letters, numbers, and hyphens.</p>
        </div>
        {slugState === 'checking' && <div className="slug-checking"><span className="dots" style={{ margin: 0 }}><i></i><i></i><i></i></span>Checking if that link is free…</div>}
        {slugState === 'done' && slugCheck.ok && <div className="slug-ok"><Ic id="i-check" s={15}/><span><code>/{slug}</code> is free - it&rsquo;s yours.</span></div>}
        {slugState === 'done' && !slugCheck.ok && <ErrBox>{slugCheck.err}</ErrBox>}
      </div>
    </WizFrame>
  );

  if (step === 2) return (
    <WizFrame step={2} savedNote="Family saved" title="Who can open the book?" intro="Pick how your family signs in. You can change this anytime."
      footer={<button className="m-btn" disabled={!ok2 || busy} onClick={() => next(3)}>{busy ? 'Saving security…' : 'Next'}</button>}>
      <div className="f-grid">
        <label className={'ropt' + (mode === 'pin' ? ' on' : '')}>
          <input type="radio" name="wzMode" checked={mode === 'pin'} onChange={() => setMode('pin')}/>
          <span><b>One shared family PIN</b><small>Simplest - everyone uses the same PIN.</small></span>
        </label>
        <label className={'ropt' + (mode === 'caretakers' ? ' on' : '')}>
          <input type="radio" name="wzMode" checked={mode === 'caretakers'} onChange={() => setMode('caretakers')}/>
          <span><b>Caretakers with their own PINs</b><small>Every entry shows who logged it - better tracking and access control.</small></span>
        </label>
        {mode === 'pin' ? (
          <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><label className="fl" htmlFor="wzPin">Family PIN <small>(6–10 digits)</small></label><input className="fi" id="wzPin" type="password" inputMode="numeric" placeholder="••••••" value={pin} onChange={e => setPin(digits(e.target.value, 10))}/></div>
            <div><label className="fl" htmlFor="wzPin2">Confirm PIN</label><input className="fi" id="wzPin2" type="password" inputMode="numeric" placeholder="Same again" value={pin2} onChange={e => setPin2(digits(e.target.value, 10))}/></div>
          </div>
        ) : (<>
          {cts.map(c => (
            <div className="ct-item" key={c.id}>
              <span className="nm">{c.name}</span>
              <span className={'chip ' + (c.role === 'Admin' ? 'c-teal' : 'c-blue')}>{c.role}</span>
              {c.type && <span className="chip c-apr">{c.type}</span>}
              <span className="meta">ID {c.id}</span>
              <button className="rowbtn x" aria-label={`Remove ${c.name}`} onClick={() => setCts(l => l.filter(x => x.id !== c.id))}><Ic id="i-x" s={14}/></button>
            </div>
          ))}
          <div className="fgroup">
            <b>{cts.length === 0 ? (firstName ? 'Create your profile first' : 'Add yourself first') : 'Add another caretaker'}</b>
            <p className="fh">{cts.length === 0 ? 'The first caretaker is the admin - that\u2019s you. Pick a 2-digit ID and a PIN.' : 'Parents, grandparents, the nanny - anyone who helps.'}</p>
            <div className="f-grid">
              <div className="f-2">
                <div>
                  <label className="fl" htmlFor="wzCtId">Login ID <small>(2 digits)</small></label>
                  <input className="fi" id="wzCtId" inputMode="numeric" placeholder="01" value={ct.id} onChange={e => setCt(v => ({ ...v, id: digits(e.target.value, 2) }))}/>
                  {idErr && <p className="fi-err">{idErr}</p>}
                </div>
                <div><label className="fl" htmlFor="wzCtName">Name</label><input className="fi" id="wzCtName" placeholder="Betty" value={ct.name} onChange={e => setCt(v => ({ ...v, name: e.target.value }))}/></div>
              </div>
              <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><label className="fl" htmlFor="wzCtPin">PIN <small>(6–10 digits)</small></label><input className="fi" id="wzCtPin" type="password" inputMode="numeric" placeholder="••••••" value={ct.pin} onChange={e => setCt(v => ({ ...v, pin: digits(e.target.value, 10) }))}/></div>
                <div><label className="fl" htmlFor="wzCtType">Type <small>(optional)</small></label><input className="fi" id="wzCtType" placeholder="Parent, Nanny…" value={ct.type} onChange={e => setCt(v => ({ ...v, type: e.target.value }))}/></div>
              </div>
              {cts.length > 0 && (
                <div><label className="fl" htmlFor="wzCtRole">Role</label><select className="fi" id="wzCtRole" value={ct.role} onChange={e => setCt(v => ({ ...v, role: e.target.value }))}><option>User</option><option>Admin</option></select><p className="fh">Admins can edit family settings and people.</p></div>
              )}
              {cts.length === 0 && <p className="fh" style={{ margin: 0 }}>The first caretaker is always an admin.</p>}
              {ctErr && <ErrBox>{ctErr}</ErrBox>}
              <button className="m-btn ghost" style={{ borderStyle: 'dashed' }} onClick={addCt}><Ic id="i-plus" s={16}/>{cts.length === 0 ? (firstName ? 'Create my profile' : 'Add caretaker') : 'Add caretaker'}</button>
            </div>
          </div>
        </>)}
      </div>
    </WizFrame>
  );

  return (
    <WizFrame step={3} savedNote="Security saved" title="Add your baby." intro="Now the star of the book. You can change any of this later."
      footer={<button className="m-btn" disabled={!ok3 || busy} onClick={finish}>{busy ? 'Planting your sprout…' : 'Complete setup'}</button>}>
      <div className="f-grid">
        <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div><label className="fl" htmlFor="wzBF">First name</label><input className="fi" id="wzBF" placeholder="Jackson" value={baby.first} onChange={setB('first')}/></div>
          <div><label className="fl" htmlFor="wzBL">Last name</label><input className="fi" id="wzBL" placeholder="Sprout" value={baby.last} onChange={setB('last')}/></div>
        </div>
        <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div><label className="fl" htmlFor="wzDob">Birth date</label><input className="fi" id="wzDob" type="date" value={baby.dob} onChange={setB('dob')}/></div>
          <div><label className="fl" htmlFor="wzGen">Gender</label><select className="fi" id="wzGen" value={baby.gender} onChange={setB('gender')}><option value="">Choose…</option><option>Boy</option><option>Girl</option></select></div>
        </div>
        <div className="fgroup">
          <b>Gentle nudges</b>
          <p className="fh">Sprout Track quietly warns whoever&rsquo;s on duty when it&rsquo;s been this long. Format: hh:mm.</p>
          <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><label className="fl" htmlFor="wzFeed">Since last feed</label><input className="fi" id="wzFeed" placeholder="02:00" value={baby.feed} onChange={setB('feed')}/>{baby.feed && !hhmm(baby.feed) && <p className="fi-err">Use hh:mm, like 02:00.</p>}</div>
            <div><label className="fl" htmlFor="wzDiap">Since last diaper</label><input className="fi" id="wzDiap" placeholder="03:00" value={baby.diaper} onChange={setB('diaper')}/>{baby.diaper && !hhmm(baby.diaper) && <p className="fi-err">Use hh:mm, like 03:00.</p>}</div>
          </div>
        </div>
        <div><label className="fl" htmlFor="wzFrom">Feed timer counts from</label><select className="fi" id="wzFrom" value={baby.from} onChange={setB('from')}><option>Start of feeding</option><option>End of feeding</option></select></div>
        <div>
          <label className="fl">Which feeds reset the timer?</label>
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            {FEED_TYPES.map(t => (
              <label className="fcheck" key={t}><input type="checkbox" checked={feeds[t]} onChange={e => setFeeds(v => ({ ...v, [t]: e.target.checked }))}/><span>{t}</span></label>
            ))}
          </div>
        </div>
      </div>
    </WizFrame>
  );
}

Object.assign(window, { SetupWizard });
