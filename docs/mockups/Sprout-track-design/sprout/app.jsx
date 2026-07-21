const TWEAK_DEFAULTS=/*EDITMODE-BEGIN*/{
"tile":156,
"caps":true,
"thumb":"Regular"
}/*EDITMODE-END*/;
function App(){
const[page,setPage]=useState('log');
const[photos,setPhotos]=useState(PHOTOS0);
const[timeline,setTimeline]=useState(TIMELINE0);
const[stack,setStack]=useState([]);
const[t,setTweak]=useTweaks(TWEAK_DEFAULTS);
const nid=useRef(100);
const byId=id=>photos.find(p=>p.id===id);
const push=d=>setStack(s=>[...s,d]);
const pop=()=>setStack(s=>s.slice(0,-1));
const closeAll=()=>setStack([]);
const toggleFav=id=>setPhotos(ps=>ps.map(p=>p.id===id?{...p,fav:!p.fav}:p));
const updateCap=(id,cap)=>setPhotos(ps=>ps.map(p=>p.id===id?{...p,cap}:p));
const delPhotos=ids=>{const S=new Set(ids);setPhotos(ps=>ps.map(p=>S.has(p.id)?{...p,trash:30}:p))};
const restorePhotos=ids=>{const S=new Set(ids);setPhotos(ps=>ps.map(p=>{if(!S.has(p.id))return p;const q={...p};delete q.trash;return q}))};
const purgePhotos=ids=>{const S=new Set(ids);
setPhotos(ps=>ps.filter(p=>!S.has(p.id)));
setTimeline(ts=>ts.map(x=>x.ph?{...x,ph:x.ph.filter(i=>!S.has(i))}:x).filter(x=>!(x.k==='photo'&&x.ph&&!x.ph.length)))};
const mkPlaceholder=cap=>{const id=nid.current++;
setPhotos(ps=>[{id,d:'2026-07-13',t:'8:15 AM',cap,type:'feed',ms:null,fav:false,h:Math.floor(Math.random()*360)},...ps]);
return id};
const addPhoto=({cap,ms,h})=>{const id=nid.current++;
const p={id,d:'2026-07-13',t:'8:15 AM',cap:cap||'Untitled photo',type:'photo',ms:ms||null,fav:false,h:h!=null?h:Math.floor(Math.random()*360)};
setPhotos(ps=>[p,...ps]);
setTimeline(ts=>[{id:'t'+id,k:'photo',title:'Photo',sub:p.cap,time:'8:15 AM',ph:[id],rec:{Time:'Today 8:15 AM',Caption:p.cap,Caretaker:'Betty'}},...ts])};
const addFeed=({type,amt,unit,food,ph})=>{const title=type==='solids'?'Solid Food':type==='bottle'?'Bottle':'Breast Feeding';
const sub=`${amt} ${unit}${food?' \u2022 '+food:''}`;
setTimeline(ts=>[{id:'t'+nid.current++,k:'feed',title,sub,time:'8:15 AM',ph,rec:{Time:'Today 8:15 AM',Type:title,Amount:`${amt} ${unit.toUpperCase()}`,Caretaker:'Betty'}},...ts])};
const updateItem=(id,patch)=>setTimeline(ts=>ts.map(x=>x.id===id?{...x,...patch}:x));
const removeItem=id=>setTimeline(ts=>ts.filter(x=>x.id!==id));
const attachTo=id=>{const pid=mkPlaceholder('Feeding photo');setTimeline(ts=>ts.map(x=>x.id===id?{...x,ph:[...(x.ph||[]),pid]}:x))};
const ctx={photos,timeline,stack,byId,push,pop,closeAll,toggleFav,updateCap,delPhotos,restorePhotos,purgePhotos,mkPlaceholder,addPhoto,addFeed,updateItem,removeItem,attachTo,setPage,tw:t};
const NAV=[['log','Log Entry','note'],['full','Full Log','list'],['photos','Photos','image',true],['cal','Calendar','cal'],['reports','Reports','chart'],['nursery','Nursery Mode','moon']];
const BNAV=[['log','Log','note'],['full','Full Log','list'],['photos','Photos','image'],['reports','Reports','chart'],['set','Settings','gear']];
const go=k=>{if(k==='log'||k==='photos'){setPage(k);closeAll()}};
return <div className="shell" style={{'--tile':t.tile+'px','--th':t.thumb==='Compact'?'36px':'44px'}}>
<aside className="sidebar">
<div className="side-logo"><span className="logo-c"><Icon n="sprout" s={24}/></span><span><b>Sprout Track</b><i>Moore Family (Demo)</i></span></div>
<nav className="snav">
{NAV.map(([k,l,ic,isNew])=><button key={k} className={'nitem'+(page===k?' on':'')} onClick={()=>go(k)}><Icon n={ic} s={19}/>{l}{isNew&&<span className="newpill">NEW</span>}</button>)}
</nav>
<div className="side-foot">
<div className="vline"><span className="vbadge">New Updates: v1.5.0</span>{'\u2022'}<span>EN</span></div>
<button className="nitem"><Icon n="sun" s={19}/>light<span style={{marginLeft:'auto',fontSize:12.5,color:'#94a3b8',fontWeight:400}}>Switch to dark</span></button>
<button className="nitem"><Icon n="gear" s={19}/>Settings</button>
<button className="nitem"><Icon n="logout" s={19}/>Logout</button>
</div>
</aside>
<main className="main">
{page==='photos'?<GalleryPage ctx={ctx}/>:<LogEntryPage ctx={ctx}/>}
</main>
<nav className="bnav">
{BNAV.map(([k,l,ic])=><button key={k} className={page===k?'on':''} onClick={()=>go(k)}><Icon n={ic} s={21}/>{l}</button>)}
</nav>
<DrawerHost ctx={ctx}/>
<TweaksPanel>
<TweakSection label="Gallery"/>
<TweakSlider label="Tile size" value={t.tile} min={110} max={230} step={2} unit="px" onChange={v=>setTweak('tile',v)}/>
<TweakToggle label="Tile captions" value={t.caps} onChange={v=>setTweak('caps',v)}/>
<TweakSection label="Timeline"/>
<TweakRadio label="Thumbnails" value={t.thumb} options={['Compact','Regular']} onChange={v=>setTweak('thumb',v)}/>
</TweaksPanel>
</div>}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
