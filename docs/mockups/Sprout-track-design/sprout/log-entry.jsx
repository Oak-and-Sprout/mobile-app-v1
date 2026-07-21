function ThumbRow({ids,ctx}){
const w=useWinW();const max=w<640?2:3;
const live=ids.filter(id=>{const p=ctx.byId(id);return p&&!p.trash});
if(!live.length)return null;
const vis=live.length<=max?live:live.slice(0,max-1);
const extra=live.length-vis.length;
return <span className="throw">
{vis.map(id=>{const p=ctx.byId(id);return p?<PThumb key={id} p={p} onClick={e=>{e.stopPropagation();ctx.push({kind:'detail',id})}}/>:null})}
{extra>0&&<span className="thumb more">+{extra}</span>}
</span>}
function TimelineItem({it,ctx}){
const m=TYPES[it.k]||TYPES.photo;
const open=()=>{
if(it.k==='feed'&&it.rec)ctx.push({kind:'feedRec',itemId:it.id});
else if(it.k==='photo')ctx.push({kind:'photoRec',itemId:it.id});
else if(it.k==='milestone'&&it.ph&&it.ph.length)ctx.push({kind:'detail',id:it.ph[0]});
};
return <div className="tli" onClick={open} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&open()}>
<span className="dot" style={{background:m.fg==='#fff'?'#0f766e':m.fg}}></span>
<span className="tl-ic" style={{background:m.bg,color:m.fg}}><Icon n={m.ic} s={22}/></span>
<span className="tl-tx"><b>{it.title}</b><i>{it.sub}</i></span>
<span className="tl-r">{it.ph&&it.ph.length>0&&<ThumbRow ids={it.ph} ctx={ctx}/>}<time>{it.time}</time></span>
</div>}
function LogEntryPage({ctx}){
const nToday=ctx.photos.filter(p=>p.d==='2026-07-13'&&!p.trash).length;
const onAct=id=>{if(id==='feed')ctx.push({kind:'feed'});if(id==='photo')ctx.push({kind:'photo'})};
const stats=[
{ic:'sun',fg:'#f59e0b',v:'2h 25min',l:'Awake Time'},
{ic:'moon',fg:'#64748b',v:'5h 48min',l:'Total Sleep'},
{ic:'bottle',fg:'#0284c7',v:'2',l:'5.5 oz \u2022 15 tbsp'},
{ic:'diaper',fg:'#0d9488',v:'2',l:'Wet Diapers'},
{ic:'cam',fg:'#e11d48',v:String(nToday),l:'Photos Today',go:'photos'}];
return <div className="page" data-screen-label="Log Entry">
<header className="hero">
<div className="hero-top">
<div><div className="hi">Hi, Betty</div><h1>Moore Family (Demo) - Log Entry</h1></div>
<button className="babypill"><span><b>Joshua</b><i>20 weeks</i></span><Icon n="chevD" s={16}/></button>
</div>
<div className="iconrow">
{ACTS.map(a=><button key={a.id} className="act" onClick={()=>onAct(a.id)} title={a.id==='photo'?'Log a photo':a.l}>
{a.chip&&<span className="act-chip" style={{background:a.chip[1],color:a.chip[2]}}>{a.chip[0]}</span>}
{a.isNew&&<span className="act-new"></span>}
<span className="act-c" style={{background:a.bg,color:a.fg}}><Icon n={a.ic} s={26}/></span>
<span>{a.l}</span>
</button>)}
</div>
</header>
<div className="content">
<div className="datebar"><button className="iconbtn"><Icon n="chevL" s={18}/></button>Jul 13, 2026<button className="iconbtn"><Icon n="chevR" s={18}/></button></div>
<button className="sum-h">Daily Summary <Icon n="chevU" s={16}/></button>
<div className="stats">
{stats.map((s,i)=><button key={i} className="stat" style={{cursor:s.go?'pointer':'default'}} onClick={()=>s.go&&ctx.setPage(s.go)}>
<span style={{color:s.fg}}><Icon n={s.ic} s={20}/></span>
<span><b>{s.v}</b>{s.l}</span>
</button>)}
</div>
<h4 className="tgroup">Morning</h4>
<div className="tl">
{ctx.timeline.map(it=><TimelineItem key={it.id} it={it} ctx={ctx}/>)}
</div>
</div>
</div>}
Object.assign(window,{LogEntryPage,ThumbRow});
