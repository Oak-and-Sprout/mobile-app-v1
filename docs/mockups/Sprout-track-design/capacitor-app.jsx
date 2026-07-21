// State machine + tweaks for the Sprout Track mobile shell mockup
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "signin": "ID + PIN",
  "find": "found",
  "login": "works",
  "online": true,
  "acctFamily": true,
  "bioKind": "Face ID",
  "returning": true,
  "art": true
}/*EDITMODE-END*/;

const SEED = [
  { id: 1, name: 'Smith Family', host: 'track.smithhome.net', slug: 'smith-family', hosted: false, bio: true, def: true, last: 'today, 2:14 pm' },
  { id: 2, name: 'Sprout Test', host: 'sprout-track.com', slug: 'sprout-test', hosted: true, bio: false, def: false, last: 'Tuesday' },
];

function Splash({ onDone }) {
  const [out, setOut] = React.useState(false);
  const cb = React.useRef(onDone); cb.current = onDone;
  React.useEffect(() => {
    const a = setTimeout(() => setOut(true), 2150);
    const b = setTimeout(() => cb.current(), 2720);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="bg"></div><div className="grad"></div>
      <div className="ct">
        <img src="v1-storybook/logo.png" alt=""/>
        <div className="wm">Sprout Track</div>
        <div className="tag">The shareable baby tracker</div>
      </div>
    </div>
  );
}

function CapApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState({ name: 'splash' });
  const [families, setFamilies] = React.useState(SEED);
  const [bioPhase, setBioPhase] = React.useState(null); // null | 'scan' | 'ok'
  const [bioFam, setBioFam] = React.useState(null);
  const [autoOpen, setAutoOpen] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const timers = React.useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  React.useEffect(() => { document.body.dataset.art = t.art ? 'on' : 'off'; }, [t.art]);
  const restart = React.useCallback((returning) => {
    clearTimers(); setBioPhase(null); setToast(null);
    setFamilies(returning ? SEED : []);
    setScreen({ name: 'splash' });
  }, []);
  React.useEffect(() => { restart(t.returning); }, [t.returning, restart]);
  React.useEffect(() => () => clearTimers(), []);

  function say(msg) { setToast(msg); later(() => setToast(null), 2600); }

  function connect(fam) {
    if (!t.online) { setBioFam(fam); setScreen({ name: 'offline' }); return; }
    setFamilies(fs => fs.map(f => f.id === fam.id ? { ...f, last: 'just now' } : f));
    if (fam.bio) {
      setBioFam(fam); setBioPhase('scan');
      later(() => setBioPhase('ok'), 1100);
      later(() => { setBioPhase(null); setScreen({ name: 'connecting', fam }); }, 1650);
      later(() => setScreen({ name: 'webview', fam }), 2950);
    } else {
      setScreen({ name: 'connecting', fam });
      later(() => setScreen({ name: 'webview', fam }), 1300);
    }
  }

  function splashDone() {
    if (families.length) {
      setScreen({ name: 'families' });
      const d = families.find(f => f.def);
      if (autoOpen && d) later(() => connect(d), 350);
    } else setScreen({ name: 'fork' });
  }

  function saved(loc, quiet) {
    const fam = { id: Date.now(), name: loc.name, host: loc.host, slug: loc.slug, hosted: loc.hosted, bio: loc.bio, def: families.length === 0, last: 'just now' };
    setFamilies(fs => [fam, ...fs]);
    setScreen({ name: 'families' });
    say(quiet || `Saved - ${fam.name} is on this phone now.`);
  }

  function acctDone({ bio, first, isNew }) {
    if (isNew || !t.acctFamily) { setScreen({ name: 'wizard', bio, first }); return; }
    saved({ name: 'Sprout Test', host: 'sprout-track.com', slug: 'sprout-test', hosted: true, bio });
  }

  function remove(fam) {
    setFamilies(fs => {
      const rest = fs.filter(f => f.id !== fam.id);
      if (fam.def && rest.length) rest[0] = { ...rest[0], def: true };
      return rest;
    });
    say(`${fam.name} was removed from this phone.`);
  }

  function makeDefault(fam) { setFamilies(fs => fs.map(f => ({ ...f, def: f.id === fam.id }))); }

  function clearAll() { setFamilies([]); setScreen({ name: 'fork' }); say('Everything\u2019s been cleared from this phone.'); }

  const home = () => setScreen(families.length ? { name: 'families' } : { name: 'fork' });
  const defFam = families.find(f => f.def);
  const s = screen;
  return (
    <React.Fragment>
      <IOSDevice width={402} height={874} dark={s.name === 'webview'}>
        <div className="m-root">
          {s.name === 'splash' && <Splash onDone={splashDone}/>}
          {s.name === 'fork' && <Fork onAccount={() => setScreen({ name: 'acct-in' })} onCaretaker={() => setScreen({ name: 'add' })}/>}
          {s.name === 'acct-in' && <AcctSignIn loginResult={t.login} bioKind={t.bioKind} onBack={home}
            onDone={({ bio }) => acctDone({ bio })} onSignup={() => setScreen({ name: 'acct-up' })} onReset={() => setScreen({ name: 'acct-reset' })}/>}
          {s.name === 'acct-up' && <AcctSignUp bioKind={t.bioKind} onBack={() => setScreen({ name: 'acct-in' })}
            onDone={({ bio, first }) => acctDone({ bio, first, isNew: true })} onSignin={() => setScreen({ name: 'acct-in' })}/>}
          {s.name === 'acct-reset' && <AcctReset onBack={() => setScreen({ name: 'acct-in' })}
            onSent={(email) => { setScreen({ name: 'acct-in' }); say(`Reset link sent to ${email} - it works for one hour.`); }}/>}
          {s.name === 'wizard' && <SetupWizard firstName={s.first}
            onCancel={() => { home(); say('Setup paused - sign back in anytime to finish.'); }}
            onDone={({ name, slug }) => saved({ name, host: 'sprout-track.com', slug, hosted: true, bio: s.bio !== false }, `Welcome home - ${name} is set up and saved to this phone.`)}/>}
          {s.name === 'add' && <AddFamily prefill={''} signin={t.signin} findResult={t.find} loginResult={t.login} bioKind={t.bioKind}
            onBack={home} onSaved={saved}/>}
          {s.name === 'families' && <Families families={families} onOpen={connect} onRemove={remove} onDefault={makeDefault}
            onAdd={() => setScreen({ name: 'fork' })} onSettings={() => setScreen({ name: 'settings' })}/>}
          {s.name === 'settings' && <Settings autoOpen={autoOpen} setAutoOpen={setAutoOpen} defName={defFam && defFam.name}
            onBack={home} onClearAll={clearAll}/>}
          {s.name === 'offline' && <Offline family={bioFam} onRetry={() => { if (t.online && bioFam) connect(bioFam); else say('Still nothing. We\u2019ll keep the porch light on.'); }}
            onSwitch={() => setScreen({ name: 'families' })}/>}
          {s.name === 'connecting' && <Connecting family={s.fam}/>}
          {s.name === 'webview' && <Webview family={s.fam} onExit={() => setScreen({ name: 'families' })} onToast={say}/>}
          {bioPhase && bioFam && <BioSheet phase={bioPhase} kind={t.bioKind} family={bioFam}/>}
          {toast && <div className="m-toast">{toast}</div>}
        </div>
      </IOSDevice>
      <TweaksPanel>
        <TweakSection label="Scenario"/>
        <TweakRadio label="Caretaker sign-in" value={t.signin} options={['ID + PIN', 'PIN']} onChange={(v) => setTweak('signin', v)}/>
        <TweakSelect label="Find-family result" value={t.find} options={['found', 'family not found', 'not a Sprout server', 'unreachable']} onChange={(v) => setTweak('find', v)}/>
        <TweakRadio label="Credential check" value={t.login} options={['works', 'wrong PIN', 'locked']} onChange={(v) => setTweak('login', v)}/>
        <TweakToggle label="Account already has a family" value={t.acctFamily} onChange={(v) => setTweak('acctFamily', v)}/>
        <TweakToggle label="Server reachable" value={t.online} onChange={(v) => setTweak('online', v)}/>
        <TweakSection label="Presentation"/>
        <TweakRadio label="Biometrics" value={t.bioKind} options={['Face ID', 'Touch ID']} onChange={(v) => setTweak('bioKind', v)}/>
        <TweakToggle label="Returning user" value={t.returning} onChange={(v) => setTweak('returning', v)}/>
        <TweakToggle label="Storybook art" value={t.art} onChange={(v) => setTweak('art', v)}/>
        <TweakButton label="Restart demo" onClick={() => restart(t.returning)}/>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<CapApp/>);
