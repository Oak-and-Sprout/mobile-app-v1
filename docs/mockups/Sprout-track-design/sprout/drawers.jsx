function Drawer({title,sub,onClose,onBack,footer,children,label}){
return <div data-screen-label={label||title}>
<div className="dw-ovl" onClick={onClose}></div>
<aside className="dw" role="dialog" aria-label={title}>
<header className="dw-h">
<div className="dw-hl">{onBack&&<button className="iconbtn" onClick={onBack} title="Back"><Icon n="chevL" s={20}/></button>}
<div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div></div>
<button className="iconbtn" onClick={onClose} title="Close"><Icon n="x" s={20}/></button>
</header>
<div className="dw-b">{children}</div>
{footer&&<footer className="dw-f">{footer}</footer>}
</aside>
</div>}
function PhotoDrawer({ctx,onClose,onBack,init}){
const[tab,setTab]=useState(init.tab||'add');
const[h,setH]=useState(init.h!=null?init.h:null);
const[cap,setCap]=useState(init.cap||'');
const[ms,setMs]=useState(init.ms||'');
const[q,setQ]=useState('');
const save=()=>{ctx.addPhoto({cap,ms,h});onClose()};
const f=ctx.photos.filter(p=>!p.trash&&(!q||(p.cap+' '+(p.ms||'')+' '+TYPES[p.type].l).toLowerCase().includes(q.toLowerCase())));
const dates=[...new Set(f.map(p=>p.d))];
return <Drawer title="Photo Tracker" onClose={onClose} onBack={onBack} label="Photo Tracker"
footer={tab==='add'?<><span className="sp"></span><button className="btn btn-g" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={h==null} onClick={save}>Save Photo</button></>:null}>
<div className="tabs">
<button className={'tab'+(tab==='add'?' on':'')} onClick={()=>setTab('add')}><Icon n="cam" s={17}/>Add Photo</button>
<button className={'tab'+(tab==='lib'?' on':'')} onClick={()=>setTab('lib')}><Icon n="grid" s={17}/>Photo Library</button>
</div>
<QuotaMeter/>
{tab==='add'?<>
<label className="fl first">Photo</label>
{h==null?
<button className="drop" onClick={()=>setH(Math.floor(Math.random()*360))}><Icon n="cam" s={30}/><b>Tap to add a photo</b><span>or drag &amp; drop • HEIC, JPG, PNG</span><code>[placeholder — taps insert a sample tile]</code></button>
:<div className="prev" style={{background:grad(h)}}><Icon n="image" s={44}/><button className="prev-x" onClick={()=>setH(null)} title="Remove"><Icon n="x" s={16}/></button></div>}
<label className="fl">Taken — Date &amp; Time</label>
<div className="chiprow"><button className="fchip"><Icon n="cal" s={17}/>Jul 13, 2026</button><button className="fchip"><Icon n="clock" s={17}/>8:15 AM</button></div>
<label className="fl">Caption</label>
<input className="in" placeholder="What’s happening in this photo?" value={cap} onChange={e=>setCap(e.target.value)}/>
<label className="fl">Tag a Milestone</label>
<select className="in" value={ms} onChange={e=>setMs(e.target.value)}>
<option value="">No milestone</option>
{MS.map(m=><option key={m} value={m}>{m}</option>)}
</select>
<p className="hint">Photos save to this day’s log and to the Photos gallery.</p>
</>:<>
<div className="srch"><Icon n="search" s={18}/><input className="in" placeholder="Search captions, milestones, types…" value={q} onChange={e=>setQ(e.target.value)}/></div>
<p className="hint">{f.length} photo{f.length===1?'':'s'} • <a href="#" onClick={e=>{e.preventDefault();ctx.setPage('photos');onClose()}}>Open Photos gallery</a></p>
{dates.map(d=><div key={d}>
<div className="lib-d">{fmtD(d)}</div>
{f.filter(p=>p.d===d).map(p=><div key={p.id} className="librow" onClick={()=>ctx.push({kind:'detail',id:p.id})} role="button" tabIndex={0}>
<PThumb p={p} cls="lth" ic={20}/>
<span className="ltx"><b>{p.cap}</b><i>{p.t} • {TYPES[p.type].l}{p.ms?' • '+p.ms:''}</i></span>
<button className={'hbtn'+(p.fav?' on':'')} onClick={e=>{e.stopPropagation();ctx.toggleFav(p.id)}} title="Favorite"><Icon n="heart" s={18} f={p.fav}/></button>
<span style={{color:'#94a3b8'}}><Icon n="chevR" s={16}/></span>
</div>)}
</div>)}
{!f.length&&<div className="empty"><Icon n="cam" s={34}/>No photos match your search</div>}
</>}
</Drawer>}
function FeedDrawer({ctx,onClose,onBack,itemId}){
const item=itemId?ctx.timeline.find(i=>i.id===itemId):null;
const[type,setType]=useState('solids');
const[amt,setAmt]=useState(15);
const[unit,setUnit]=useState('tbsp');
const[food,setFood]=useState(item?'Avocado':'');
const[notes,setNotes]=useState('');
const[ph,setPh]=useState(item&&item.ph?item.ph.filter(id=>{const p=ctx.byId(id);return p&&!p.trash}):[]);
const TT=[{id:'breast',l:'Breast',ic:'baby'},{id:'bottle',l:'Bottle',ic:'bottle'},{id:'solids',l:'Solids',ic:'spoon'}];
const save=()=>{
if(item)ctx.updateItem(item.id,{ph,sub:`${amt} ${unit} • ${food||'Feeding'}`});
else ctx.addFeed({type,amt,unit,food,ph});
onClose()};
return <Drawer title="Log Feeding" sub="Record what and when your baby ate" onClose={onClose} onBack={onBack}
footer={<><span className="sp"></span><button className="btn btn-g" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={save}>Save</button></>}>
<label className="fl first">Time</label>
<div className="chiprow"><button className="fchip"><Icon n="cal" s={17}/>Jul 13, 2026</button><button className="fchip"><Icon n="clock" s={17}/>8:15 AM</button></div>
<label className="fl">Type</label>
<div className="typerow">
{TT.map(t=><button key={t.id} className={'typ'+(type===t.id?' on':'')} onClick={()=>setType(t.id)}>
<span className="c"><Icon n={t.ic} s={30}/></span>{type===t.id&&<span className="ck"><Icon n="check" s={12}/></span>}{t.l}
</button>)}
</div>
<label className="fl">Amount ({unit}.)</label>
<div className="step">
<button className="pm" onClick={()=>setAmt(Math.max(0,amt-1))}><Icon n="x" s={0}/><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14"/></svg></button>
<span className="val">{amt}</span>
<button className="pm" onClick={()=>setAmt(amt+1)}><Icon n="plus" s={20}/></button>
</div>
<div className="seg2"><button className={unit==='tbsp'?'on':''} onClick={()=>setUnit('tbsp')}>tbsp</button><button className={unit==='g'?'on':''} onClick={()=>setUnit('g')}>g</button></div>
<label className="fl">Food</label>
<input className="in" placeholder="Enter food" value={food} onChange={e=>setFood(e.target.value)}/>
<label className="fl">Photos</label>
<div className="attach">
{ph.map(id=>{const p=ctx.byId(id);return p?<span key={id} style={{position:'relative'}}><PThumb p={p} cls="a-th" ic={24}/><button className="a-x" onClick={()=>setPh(ph.filter(x=>x!==id))} title="Remove"><Icon n="x" s={12}/></button></span>:null})}
{ph.length<4&&<button className="a-add" onClick={()=>setPh([...ph,ctx.mkPlaceholder(food?food+' feeding':'Feeding photo')])} title="Add photo"><Icon n="plus" s={22}/></button>}
</div>
<p className="hint">Attach up to 4 photos — they’ll show on the timeline and in the gallery.</p>
<label className="fl">Notes</label>
<textarea className="in" placeholder="Enter any notes about the feeding" value={notes} onChange={e=>setNotes(e.target.value)}></textarea>
</Drawer>}
function RecFooter({onDel,onEdit,onClose}){
return <><button className="btn btn-d" onClick={onDel}><Icon n="trash" s={16}/>Delete</button><button className="btn btn-g" onClick={onEdit}><Icon n="edit" s={16}/>Edit</button><span className="sp"></span><button className="btn btn-g" onClick={onClose}>Close</button></>}
function FeedRecordDrawer({ctx,onClose,onBack,itemId}){
const item=ctx.timeline.find(i=>i.id===itemId);
if(!item)return null;
const ph=(item.ph||[]).filter(id=>{const p=ctx.byId(id);return p&&!p.trash});
return <Drawer title="Feed Record" onClose={onClose} onBack={onBack}
footer={<RecFooter onDel={()=>{ctx.removeItem(item.id);onClose()}} onEdit={()=>ctx.push({kind:'feed',itemId:item.id})} onClose={onClose}/>}>
{Object.entries(item.rec).map(([k,v])=><div key={k} className="rrow"><span className="k">{k}:</span><span className="v">{v}</span></div>)}
<label className="fl">Photos ({ph.length})</label>
<div className="attach">
{ph.map(id=>{const p=ctx.byId(id);return p?<PThumb key={id} p={p} cls="a-th" ic={24} onClick={()=>ctx.push({kind:'detail',id})}/>:null})}
<button className="a-add" onClick={()=>ctx.attachTo(item.id)} title="Add photo"><Icon n="plus" s={22}/></button>
</div>
{!ph.length&&<p className="hint">No photos attached to this feeding yet.</p>}
</Drawer>}
function PhotoRecordDrawer({ctx,onClose,onBack,itemId}){
const item=ctx.timeline.find(i=>i.id===itemId);
if(!item)return null;
const ph=(item.ph||[]).filter(id=>{const p=ctx.byId(id);return p&&!p.trash});
const first=ph.length?ctx.byId(ph[0]):null;
return <Drawer title="Photo Record" onClose={onClose} onBack={onBack}
footer={<RecFooter onDel={()=>{ctx.removeItem(item.id);onClose()}} onEdit={()=>ctx.push({kind:'photo',tab:'add',cap:item.sub,h:first?first.h:null})} onClose={onClose}/>}>
{Object.entries(item.rec||{Time:'Today '+item.time,Caption:item.sub,Caretaker:'Betty'}).map(([k,v])=><div key={k} className="rrow"><span className="k">{k}:</span><span className="v">{v}</span></div>)}
{first&&first.ms&&<div className="rrow"><span className="k">Milestone:</span><span className="v"><span className="mschip"><Icon n="star" s={14}/>{first.ms}</span></span></div>}
<label className="fl">Photos ({ph.length})</label>
<div className="attach">
{ph.map(id=>{const p=ctx.byId(id);return p?<PThumb key={id} p={p} cls="a-th" ic={24} onClick={()=>ctx.push({kind:'detail',id})}/>:null})}
</div>
<p className="hint">Tap a photo to view or manage it.</p>
</Drawer>}
function PhotoDetailDrawer({ctx,onClose,onBack,id}){
const p=ctx.byId(id);
const[ed,setEd]=useState(false);
const[v,setV]=useState(p?p.cap:'');
if(!p)return null;
const it=ctx.timeline.find(i=>(i.ph||[]).includes(id));
const T=TYPES[p.type];
const saveCap=()=>{ctx.updateCap(id,v||'Untitled photo');setEd(false)};
return <Drawer title="Photo" onClose={onClose} onBack={onBack} label="Photo Detail"
footer={<><span className="sp"></span><button className="btn btn-g" onClick={onClose}>Close</button></>}>
<div className="dprev" style={{background:grad(p.h)}}><Icon n="image" s={52}/>
<button className={'dfav'+(p.fav?' on':'')} onClick={()=>ctx.toggleFav(id)} title="Favorite"><Icon n="heart" s={20} f={p.fav}/></button>
</div>
<div className="dcap">
{ed?<input className="in" autoFocus value={v} onChange={e=>setV(e.target.value)} onBlur={saveCap} onKeyDown={e=>e.key==='Enter'&&saveCap()}/>:<h3>{p.cap}</h3>}
{!ed&&<button className="iconbtn" onClick={()=>{setV(p.cap);setEd(true)}} title="Edit caption"><Icon n="edit" s={17}/></button>}
</div>
<div className="rrow"><span className="k">Taken:</span><span className="v">{fmtD(p.d)} • {p.t}</span></div>
<div className="rrow"><span className="k">Type:</span><span className="v"><span className="typechip" style={{background:T.bg==='#0f766e'?'#ccfbf1':T.bg,color:T.fg==='#fff'?'#0f766e':T.fg}}><Icon n={T.ic} s={14}/>{T.l}</span></span></div>
{p.ms&&<div className="rrow"><span className="k">Milestone:</span><span className="v"><span className="mschip"><Icon n="star" s={14}/>{p.ms}</span></span></div>}
<div className="rrow"><span className="k">Linked activity:</span><span className="v">{it?`${it.title} \u2022 ${it.time}`:'\u2014'}</span></div>
<div className="actrow">
<button className={'btn btn-g'} style={p.fav?{color:'#e11d48',borderColor:'#fecdd3'}:null} onClick={()=>ctx.toggleFav(id)}><Icon n="heart" s={16} f={p.fav}/>{p.fav?'Favorited':'Favorite'}</button>
<button className="btn btn-g" title="Prototype — no real file"><Icon n="download" s={16}/>Download</button>
<button className="btn btn-dg" onClick={()=>{ctx.delPhotos([id]);ctx.pop()}}><Icon n="trash" s={16}/>Delete</button>
</div>
<p className="hint">Deleted photos move to Trash and auto-delete after 30 days.</p>
</Drawer>}
function DrawerHost({ctx}){
const top=ctx.stack[ctx.stack.length-1];
if(!top)return null;
const common={ctx,onClose:ctx.closeAll,onBack:ctx.stack.length>1?ctx.pop:null};
if(top.kind==='photo')return <PhotoDrawer {...common} init={top}/>;
if(top.kind==='feed')return <FeedDrawer {...common} itemId={top.itemId}/>;
if(top.kind==='feedRec')return <FeedRecordDrawer {...common} itemId={top.itemId}/>;
if(top.kind==='photoRec')return <PhotoRecordDrawer {...common} itemId={top.itemId}/>;
if(top.kind==='detail')return <PhotoDetailDrawer {...common} id={top.id}/>;
return null}
Object.assign(window,{DrawerHost});
