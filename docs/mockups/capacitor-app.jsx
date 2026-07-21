// State machine + tweaks for the Sprout Track mobile shell mockup
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "signin": "ID + PIN",
  "find": "found",
  "login": "works",
  "online": true,
  "bioKind": "Face ID",
  "returning": true,
  "art": true
}/*EDITMODE-END*/;

const SEED = [
  { id: 1, name: 'Smith Family', host: 'track.smithhome.net', slug: 'smith-family', hosted: false, bio: true, def: true, last: 'today, 2:14 pm' },
  { id: 2, name: 'Sprout Test', host: 'sprout-track.com', slug: 'sprout-test', hosted: true, bio: false, def: false, last: 'Tuesday' },
];

function CapApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState({ name: 'families' });
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
    setScreen(returning ? { name: 'families' } : { name: 'welcome' });
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

  function saved(loc) {
    const fam = { id: Date.now(), name: loc.name, host: loc.host, slug: loc.slug, hosted: loc.hosted, bio: loc.bio, def: families.length === 0, last: 'just now' };
    setFamilies(fs => [fam, ...fs]);
    setScreen({ name: 'families' });
    say(`Saved — ${fam.name} is on this phone now.`);
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

  function clearAll() { setFamilies([]); setScreen({ name: 'welcome' }); say('Everything\u2019s been cleared from this phone.'); }

  const defFam = families.find(f => f.def);
  const s = screen;
  return (
    <React.Fragment>
      <IOSDevice width={402} height={874} dark={s.name === 'webview'}>
        <div className="m-root">
          {s.name === 'welcome' && <Welcome go={Object.assign((prefill) => setScreen({ name: 'add', prefill }), { account: () => setScreen({ name: 'account' }) })}/>}
          {s.name === 'account' && <AccountSignIn loginResult={t.login} bioKind={t.bioKind} onBack={() => setScreen(families.length ? { name: 'families' } : { name: 'welcome' })} onSaved={saved}/>}
          {s.name === 'add' && <AddFamily prefill={s.prefill ?? ''} signin={t.signin} findResult={t.find} loginResult={t.login} bioKind={t.bioKind}
            onBack={() => setScreen(families.length ? { name: 'families' } : { name: 'welcome' })} onSaved={saved}/>}
          {s.name === 'families' && <Families families={families} onOpen={connect} onRemove={remove} onDefault={makeDefault}
            onAdd={() => setScreen({ name: 'add', prefill: '' })} onSettings={() => setScreen({ name: 'settings' })}/>}
          {s.name === 'settings' && <Settings autoOpen={autoOpen} setAutoOpen={setAutoOpen} defName={defFam && defFam.name}
            onBack={() => setScreen(families.length ? { name: 'families' } : { name: 'welcome' })} onClearAll={clearAll}/>}
          {s.name === 'offline' && <Offline family={bioFam} onRetry={() => { if (t.online && bioFam) connect(bioFam); else say('Still nothing. We\u2019ll keep the porch light on.'); }}
            onSwitch={() => setScreen({ name: 'families' })}/>}
          {s.name === 'connecting' && <Connecting family={s.fam}/>}
          {s.name === 'webview' && <Webview family={s.fam} onExit={() => setScreen({ name: 'families' })}/>}
          {bioPhase && bioFam && <BioSheet phase={bioPhase} kind={t.bioKind} family={bioFam}/>}
          {toast && <div className="m-toast">{toast}</div>}
        </div>
      </IOSDevice>
      <TweaksPanel>
        <TweakSection label="Scenario"/>
        <TweakRadio label="Sign in with" value={t.signin} options={['PIN', 'ID + PIN', 'email']} onChange={(v) => setTweak('signin', v)}/>
        <TweakSelect label="Find-family result" value={t.find} options={['found', 'family not found', 'not a Sprout server', 'unreachable']} onChange={(v) => setTweak('find', v)}/>
        <TweakRadio label="PIN check" value={t.login} options={['works', 'wrong PIN', 'locked']} onChange={(v) => setTweak('login', v)}/>
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
