function GalleryPage({ctx}){
const t=ctx.tw;
const[q,setQ]=useState('');
const[typ,setTyp]=useState('all');
const[fav,setFav]=useState(false);
const[grp,setGrp]=useState('month');
const[sel,setSel]=useState(false);
const[picked,setPicked]=useState(()=>new Set());
const[lb,setLb]=useState(null);
const[trashView,setTrashView]=useState(false);
const f=ctx.photos.filter(p=>!p.trash&&(typ==='all'||p.type===typ)&&(!fav||p.fav)&&(!q||(p.cap+' '+(p.ms||'')).toLowerCase().includes(q.toLowerCase())));
const trashed=ctx.photos.filter(p=>p.trash);
const total=ctx.photos.filter(p=>!p.trash).length;
let groups;
if(grp==='month'){const ms=[...new Set(f.map(p=>p.d.slice(0,7)))];groups=ms.map(m=>({key:m,label:fmtMon(m+'-01'),items:f.filter(p=>p.d.slice(0,7)===m)}))}
else if(grp==='ms'){groups=MS.map(m=>({key:m,label:m,star:true,items:f.filter(p=>p.ms===m)})).filter(g=>g.items.length);const none=f.filter(p=>!p.ms);if(none.length)groups.push({key:'none',label:'No milestone',items:none})}
else groups=[{key:'all',label:'All photos',items:f}];
const flat=groups.flatMap(g=>g.items);
const nav=d=>{const i=flat.findIndex(p=>p.id===lb);if(i<0)return;const n=flat[(i+d+flat.length)%flat.length];if(n)setLb(n.id)};
useEffect(()=>{if(lb==null)return;const fn=e=>{if(e.key==='Escape')setLb(null);if(e.key==='ArrowRight')nav(1);if(e.key==='ArrowLeft')nav(-1)};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)});
const toggle=id=>{const s=new Set(picked);s.has(id)?s.delete(id):s.add(id);setPicked(s)};
const lp=lb!=null?ctx.byId(lb):null;
if(lb!=null&&!lp)setLb(null);
const lit=lp?ctx.timeline.find(i=>(i.ph||[]).includes(lp.id)):null;
const CH=[['all','All'],['photo','Photos'],['feed','Feeds'],['bath','Bath'],['milestone','Milestones']];
const favCount=ctx.photos.filter(p=>p.fav&&!p.trash).length;
if(trashView){
const rp=()=>{ctx.restorePhotos([...picked]);setPicked(new Set())};
const pp=()=>{ctx.purgePhotos([...picked]);setPicked(new Set())};
return <div className="page" data-screen-label="Photos Trash">
<header className="ghero">
<div><div className="hi">Moore Family (Demo) - Photos</div><h1>Trash</h1><div className="hi" style={{marginTop:6}}>Deleted photos stay here for 30 days, then auto-delete</div></div>
<button className="btn" style={{background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.4)',color:'#fff'}} onClick={()=>{setTrashView(false);setPicked(new Set())}}><Icon n="chevL" s={16}/>Back to Photos</button>
</header>
<div className="gwrap">
{trashed.length?<>
<div className="ghead" style={{marginTop:20}}><h3>Deleted photos</h3><span>{trashed.length} item{trashed.length===1?'':'s'} {'•'} tap to select</span></div>
<div className="grid">
{trashed.map(p=><div key={p.id}>
<div className={'gtile'+(picked.has(p.id)?' seld':'')} style={{background:grad(p.h),opacity:.9}} role="button" tabIndex={0} onClick={()=>toggle(p.id)} title={p.cap}>
<Icon n="image" s={30}/>
<span className={'gsel'+(picked.has(p.id)?' on':'')}>{picked.has(p.id)&&<Icon n="check" s={13}/>}</span>
<span className="dleft">{p.trash}d left</span>
</div>
{t.caps&&<div className="gcap"><b>{p.cap}</b><i>{fmtD(p.d)}</i></div>}
</div>)}
</div></>
:<div className="empty"><Icon n="trash" s={36}/><b>Trash is empty</b><span>Deleted photos stay here for 30 days.</span></div>}
</div>
{picked.size>0&&<div className="selbar" data-screen-label="Trash bulk bar">
<b>{picked.size} selected</b>
<button className="btn btn-g" onClick={rp}><Icon n="chevU" s={15}/>Restore</button>
<button className="btn btn-d" onClick={pp}><Icon n="trash" s={15}/>Delete Forever</button>
</div>}
</div>}
return <div className="page" data-screen-label="Photos Gallery">
<header className="ghero">
<div><div className="hi">Hi, Betty</div><h1>Moore Family (Demo) - Photos</h1><div className="hi" style={{marginTop:6}}>{total} photos {'\u2022'} {favCount} favorites {'\u2022'} {MS.length} milestones</div><QuotaMeter dark/></div>
<button className="babypill"><span><b>Joshua</b><i>20 weeks</i></span><Icon n="chevD" s={16}/></button>
</header>
<div className="toolbar">
<div className="srch" style={{flex:'1 1 220px',maxWidth:340}}><Icon n="search" s={18}/><input className="in" placeholder="Search photos, milestones…" value={q} onChange={e=>setQ(e.target.value)}/></div>
<div className="seg">
<button className={grp==='month'?'on':''} onClick={()=>setGrp('month')}>Month</button>
<button className={grp==='ms'?'on':''} onClick={()=>setGrp('ms')}>Milestone</button>
<button className={grp==='all'?'on':''} onClick={()=>setGrp('all')}>All</button>
</div>
<span className="sp"></span>
<button className="btn btn-g" onClick={()=>{setSel(!sel);setPicked(new Set())}}>{sel?'Done':<><Icon n="check" s={16}/>Select</>}</button>
<button className="btn btn-g" onClick={()=>{setTrashView(true);setSel(false);setPicked(new Set())}}><Icon n="trash" s={16}/>Trash{trashed.length?` (${trashed.length})`:''}</button>
<button className="btn btn-p" onClick={()=>ctx.push({kind:'photo',tab:'add'})}><Icon n="plus" s={16}/>Add Photos</button>
</div>
<div className="toolbar" style={{paddingTop:8}}>
<div className="chips">
{CH.map(([k,l])=><button key={k} className={'chip'+(typ===k?' on':'')} onClick={()=>setTyp(k)}>{l}</button>)}
<button className={'chip'+(fav?' on':'')} onClick={()=>setFav(!fav)}><Icon n="heart" s={14} f={fav}/>My Favorites</button>
</div>
</div>
<div className="gwrap">
{groups.map(g=><section key={g.key}>
<div className="ghead">{g.star&&<span style={{color:'#d97706'}}><Icon n="star" s={18}/></span>}<h3>{g.label}</h3><span>{g.items.length} photo{g.items.length===1?'':'s'}</span></div>
<div className="grid">
{g.items.map(p=><div key={p.id}>
<div className={'gtile'+(picked.has(p.id)?' seld':'')} style={{background:grad(p.h)}} role="button" tabIndex={0}
onClick={()=>sel?toggle(p.id):setLb(p.id)} onKeyDown={e=>e.key==='Enter'&&(sel?toggle(p.id):setLb(p.id))} title={p.cap}>
<Icon n="image" s={30}/>
{sel?<span className={'gsel'+(picked.has(p.id)?' on':'')}>{picked.has(p.id)&&<Icon n="check" s={13}/>}</span>
:<button className={'ghov'+(p.fav?' on':'')} onClick={e=>{e.stopPropagation();ctx.toggleFav(p.id)}} title="Favorite"><Icon n="heart" s={16} f={p.fav}/></button>}
</div>
{t.caps&&<div className="gcap"><b>{p.cap}</b><i>{fmtD(p.d)}</i></div>}
</div>)}
</div>
</section>)}
{!flat.length&&<div className="empty"><Icon n="cam" s={36}/><b>No photos match</b><span>Try clearing the search or filters.</span></div>}
</div>
{sel&&picked.size>0&&<div className="selbar" data-screen-label="Bulk select bar">
<b>{picked.size} selected</b>
<button className="btn btn-g" title="Prototype — no real files"><Icon n="download" s={15}/>Download</button>
<button className="btn btn-d" onClick={()=>{ctx.delPhotos([...picked]);setPicked(new Set())}}><Icon n="trash" s={15}/>Delete</button>
<button className="btn btn-g" onClick={()=>{setSel(false);setPicked(new Set())}}>Cancel</button>
</div>}
{lp&&<div className="lb" data-screen-label="Lightbox" onClick={e=>{if(e.target===e.currentTarget)setLb(null)}}>
<button className="lb-x" onClick={()=>setLb(null)} title="Close"><Icon n="x" s={20}/></button>
<button className="lb-ar" style={{left:18}} onClick={()=>nav(-1)} title="Previous"><Icon n="chevL" s={22}/></button>
<button className="lb-ar" style={{right:18}} onClick={()=>nav(1)} title="Next"><Icon n="chevR" s={22}/></button>
<div className="lb-card">
<div className="lb-img" style={{background:grad(lp.h)}}><Icon n="image" s={64}/></div>
<div className="lb-side">
<h3>{lp.cap}</h3>
<div className="lb-meta">{fmtD(lp.d)} {'\u2022'} {lp.t}</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'6px 0'}}>
<span className="typechip" style={{background:TYPES[lp.type].bg==='#0f766e'?'#ccfbf1':TYPES[lp.type].bg,color:TYPES[lp.type].fg==='#fff'?'#0f766e':TYPES[lp.type].fg}}><Icon n={TYPES[lp.type].ic} s={14}/>{TYPES[lp.type].l}</span>
{lp.ms&&<span className="mschip"><Icon n="star" s={14}/>{lp.ms}</span>}
</div>
{lit&&<div className="lb-meta">Linked activity: <b style={{color:'#1e293b'}}>{lit.title} {'\u2022'} {lit.time}</b></div>}
<span className="sp"></span>
<div className="actrow" style={{marginTop:10}}>
<button className="btn btn-g" style={lp.fav?{color:'#e11d48',borderColor:'#fecdd3'}:null} onClick={()=>ctx.toggleFav(lp.id)}><Icon n="heart" s={16} f={lp.fav}/>{lp.fav?'Favorited':'Favorite'}</button>
<button className="btn btn-g" title="Prototype — no real file"><Icon n="download" s={16}/></button>
<button className="btn btn-dg" onClick={()=>{ctx.delPhotos([lp.id]);setLb(null)}}><Icon n="trash" s={16}/></button>
</div>
</div>
</div>
</div>}
</div>}
Object.assign(window,{GalleryPage});
