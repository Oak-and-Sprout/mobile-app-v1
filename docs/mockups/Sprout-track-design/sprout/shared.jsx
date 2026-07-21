const {useState,useEffect,useMemo,useRef}=React;
const grad=h=>`linear-gradient(135deg, oklch(0.93 0.05 ${h}), oklch(0.8 0.09 ${(h+55)%360}))`;
const ICONS={
image:<><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.5"/><path d="M4 17.5l4.5-4.5 4 4 3-3 5 5"/></>,
cam:<><path d="M3 8h3.5L9 5h6l2.5 3H21v11H3z"/><circle cx="12" cy="13" r="3.2"/></>,
heart:<path d="M12 20s-7-4.5-9-9c-1.2-2.8.8-6 4-6 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.2 0 5.2 3.2 4 6-2 4.5-9 9-9 9z"/>,
search:<><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></>,
x:<path d="M6 6l12 12M18 6L6 18"/>,
chevL:<path d="M14 5l-7 7 7 7"/>,
chevR:<path d="M10 5l7 7-7 7"/>,
chevD:<path d="M6 9l6 6 6-6"/>,
chevU:<path d="M6 15l6-6 6 6"/>,
trash:<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/></>,
download:<><path d="M12 4v10m0 0l-4-4m4 4l4-4"/><path d="M4 18v2h16v-2"/></>,
edit:<path d="M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20z"/>,
cal:<><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v5M16 3v5"/></>,
clock:<><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
plus:<path d="M12 5v14M5 12h14"/>,
check:<path d="M5 13l4 4L19 7"/>,
star:<path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3-5.6 3 1.2-6.2L3 9.5l6.3-.8z"/>,
moon:<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"/>,
sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/></>,
bottle:<path d="M10 2.5h4V6l2 2.5V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V8.5L10 6z"/>,
drop:<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>,
diaper:<path d="M4 7h16v4a8 8 0 0 1-8 8 8 8 0 0 1-8-8z"/>,
note:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
pump:<><circle cx="12" cy="14" r="5"/><path d="M12 9V4M9 4h6"/></>,
baby:<><circle cx="12" cy="7" r="3.5"/><path d="M5 21c1-4.5 3.5-7 7-7s6 2.5 7 7"/></>,
ruler:<><rect x="3" y="9" width="18" height="6" rx="1.5"/><path d="M7 9v3M11 9v3M15 9v3"/></>,
pill:<><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M8.6 14.4l6.8-4.8"/></>,
shield:<><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 9v6M9 12h6"/></>,
gear:<><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></>,
logout:<><path d="M14 4H6v16h8"/><path d="M11 12h9m0 0l-3-3m3 3l-3 3"/></>,
chat:<path d="M4 5h16v11H9l-5 4z"/>,
list:<path d="M4 6h16M4 12h16M4 18h16"/>,
chart:<path d="M5 20v-6M11 20V8M17 20V10M3 20h18"/>,
sprout:<><path d="M12 21v-8"/><path d="M12 13c0-4 3-6.5 7-6.5-.3 4-3 6.5-7 6.5z"/><path d="M12 13c0-4-3-6.5-7-6.5.3 4 3 6.5 7 6.5z"/></>,
spoon:<><circle cx="12" cy="5.5" r="3"/><path d="M12 8.5V21"/></>,
grid:<><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>};
function Icon({n,s=20,f}){return <svg width={s} height={s} viewBox="0 0 24 24" fill={f?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>}
function PThumb({p,cls="thumb",ic=18,onClick,title,children}){const T=onClick?'button':'div';return <T className={cls} style={{background:grad(p.h)}} onClick={onClick} title={title||p.cap}><Icon n="image" s={ic}/>{children}</T>}
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MOF=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtD=d=>{const[y,m,dd]=d.split('-');return `${MO[+m-1]} ${+dd}, ${y}`};
const fmtMon=d=>`${MOF[+d.slice(5,7)-1]} ${d.slice(0,4)}`;
function useWinW(){const[w,setW]=useState(window.innerWidth);useEffect(()=>{const f=()=>setW(window.innerWidth);window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f)},[]);return w}
const TYPES={photo:{l:'Photo',ic:'cam',bg:'#ffe4e6',fg:'#e11d48'},feed:{l:'Feed',ic:'bottle',bg:'#dbeafe',fg:'#2563eb'},bath:{l:'Bath',ic:'drop',bg:'#cffafe',fg:'#0891b2'},milestone:{l:'Milestone',ic:'star',bg:'#fef3c7',fg:'#d97706'},diaper:{l:'Diaper',ic:'diaper',bg:'#0f766e',fg:'#fff'},pump:{l:'Pump',ic:'pump',bg:'#ede9fe',fg:'#7c3aed'},med:{l:'Medicine',ic:'pill',bg:'#22c55e',fg:'#fff'}};
const MS=['First Solids','Rolling Over','First Smile'];
let _i=0;const mk=(d,t,cap,type,ms,fav,h)=>({id:++_i,d,t,cap,type,ms,fav:!!fav,h});
const PHOTOS0=[
mk('2026-07-13','7:45 AM','Morning giggles','photo',null,1,340),
mk('2026-07-13','7:44 AM','Almost a laugh','photo',null,0,200),
mk('2026-07-13','7:43 AM','Tummy time smiles','photo',null,0,150),
mk('2026-07-13','7:02 AM','First taste of avocado','feed','First Solids',1,120),
mk('2026-07-13','7:01 AM','Not so sure about this…','feed',null,0,80),
mk('2026-07-13','7:05 AM','First Solids!','milestone','First Solids',1,45),
mk('2026-07-10','6:30 PM','Splash zone','bath',null,0,210),
mk('2026-07-08','9:15 AM','Nap escape artist','photo',null,0,260),
mk('2026-07-06','4:20 PM','Matching hats with Dad','photo',null,1,25),
mk('2026-07-02','11:00 AM','Park picnic','photo',null,0,95),
mk('2026-06-28','3:10 PM','Rolled over!','milestone','Rolling Over',1,300),
mk('2026-06-27','8:00 AM','Wind-up before the roll','photo','Rolling Over',0,190),
mk('2026-06-20','7:30 PM','Bubble beard','bath',null,0,180),
mk('2026-06-15','12:40 PM','Post-bottle milk drunk','feed',null,0,60),
mk('2026-06-12','9:05 AM','Grandma visit','photo',null,1,330),
mk('2026-06-08','5:45 PM','Stroller snooze','photo',null,0,230),
mk('2026-06-03','10:20 AM','Grabby hands','photo',null,0,140),
mk('2026-06-01','7:55 AM','Sun hat Sunday','photo',null,0,40),
mk('2026-05-25','8:30 PM','Bath time zen','bath',null,0,195),
mk('2026-05-19','2:15 PM','First giggle fit','photo',null,1,350),
mk('2026-05-14','6:50 AM','Tiny fists','photo',null,0,270),
mk('2026-05-10','9:40 AM','Mother\u2019s Day snuggles','photo',null,1,15),
mk('2026-05-05','7:20 AM','Bottle pro','feed',null,0,70),
mk('2026-05-01','8:10 AM','Three months old','photo',null,0,100),
mk('2026-04-22','7:00 AM','First smile!','milestone','First Smile',1,320),
mk('2026-04-20','6:40 AM','Almost smiling','photo','First Smile',0,205),
mk('2026-04-12','8:25 AM','Bright eyes','photo',null,0,245),
mk('2026-04-05','9:00 AM','Six weeks','photo',null,0,55)];
const _tr=mk('2026-07-09','6:31 PM','Blurry splash shot','bath',null,0,215);_tr.trash=18;PHOTOS0.push(_tr);
const QUOTA={usedGB:2.4,totalGB:5};
function QuotaMeter({dark}){const pct=Math.round(QUOTA.usedGB/QUOTA.totalGB*100);
return <div className={'quota'+(dark?' qdark':'')} title="Storage quota is set per family in Family Manager settings"><span className="qbar"><span className="qfill" style={{width:pct+'%',background:pct>80?'#f59e0b':undefined}}></span></span><span>{QUOTA.usedGB} GB of {QUOTA.totalGB} GB used • {pct}%</span></div>}
const TIMELINE0=[
{id:'t1',k:'photo',title:'Photo',sub:'Morning giggles',time:'7:45 AM',ph:[1,2,3],rec:{Time:'Today 7:45 AM',Caption:'Morning giggles',Caretaker:'Betty'}},
{id:'t2',k:'milestone',title:'First Solids',sub:'Milestone reached',time:'7:05 AM',ph:[6]},
{id:'t3',k:'feed',title:'Solid Food',sub:'15 tbsp \u2022 Avocado',time:'7:00 AM',ph:[4,5],rec:{Time:'Today 7:00 AM',Type:'Solid Food',Amount:'15 TBSP',Caretaker:'Betty'}},
{id:'t4',k:'diaper',title:'Wet and Dirty',sub:'Diaper',time:'7:00 AM'},
{id:'t5',k:'pump',title:'Breast Pumping',sub:'3.5 oz \u2022 L: 2 oz \u2022 R: 1.5 oz \u2022 17m',time:'6:32 AM - 6:49 AM'},
{id:'t6',k:'med',title:'Vitamin D Drops',sub:'Vitamin D Drops - 1 ml',time:'6:21 AM'},
{id:'t7',k:'med',title:'Vitamin D Drops',sub:'Vitamin D Drops - 1 ml',time:'6:14 AM'},
{id:'t8',k:'feed',title:'Bottle',sub:'5.5 oz',time:'6:05 AM',rec:{Time:'Today 6:05 AM',Type:'Bottle',Amount:'5.5 OZ',Caretaker:'Betty'}},
{id:'t9',k:'diaper',title:'Wet',sub:'Diaper',time:'6:00 AM'}];
const ACTS=[
{id:'sleep',l:'Sleep',ic:'moon',bg:'#e0e7ff',fg:'#4f46e5',chip:['2:25','#fef3c7','#b45309']},
{id:'feed',l:'Feed',ic:'bottle',bg:'#fef9c3',fg:'#ca8a04',chip:['1:13','#dcfce7','#15803d']},
{id:'diaper',l:'Diaper',ic:'diaper',bg:'#ccfbf1',fg:'#0d9488',chip:['1:13','#dcfce7','#15803d']},
{id:'note',l:'Note',ic:'note',bg:'#fce7f3',fg:'#db2777'},
{id:'photo',l:'Photo',ic:'image',bg:'#ffe4e6',fg:'#e11d48',isNew:true},
{id:'bath',l:'Bath',ic:'drop',bg:'#cffafe',fg:'#0891b2'},
{id:'pump',l:'Pump',ic:'pump',bg:'#ede9fe',fg:'#7c3aed'},
{id:'activity',l:'Activity',ic:'baby',bg:'#ffedd5',fg:'#ea580c'},
{id:'measure',l:'Measurement',ic:'ruler',bg:'#fee2e2',fg:'#dc2626'},
{id:'milestone',l:'Milestone',ic:'star',bg:'#fef3c7',fg:'#d97706'},
{id:'medicine',l:'Medicine',ic:'pill',bg:'#dcfce7',fg:'#16a34a'},
{id:'vaccines',l:'Vaccines',ic:'shield',bg:'#e2e8f0',fg:'#475569'}];
Object.assign(window,{Icon,PThumb,grad,fmtD,fmtMon,useWinW,TYPES,MS,PHOTOS0,TIMELINE0,ACTS,QUOTA,QuotaMeter});
