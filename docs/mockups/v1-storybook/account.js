/* Account flows prototype — vanilla state + tweak bridge */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let T={surface:'drawer',authSurface:'centered',overlay:'dim',art:true,signedIn:false,subscription:'trial',tone:'warm'};
let stack=[]; // open pane id stack (sub-forms push)
window.applyTweaks=function(t){T={...T,...t};
  document.body.dataset.overlay=T.overlay;
  document.body.dataset.tone=T.tone||'warm';
  document.body.dataset.art=T.art?'on':'off';
  syncNav();renderStatus();
  stack.forEach(id=>place($('#pane-'+id)));
};
function setSigned(v){if(window.__setTweak)window.__setTweak('signedIn',v);else{T.signedIn=v;syncNav();}}
function syncNav(){$('#nav-out').style.display=T.signedIn?'none':'inline-flex';$('#acct-wrap').hidden=!T.signedIn;if(!T.signedIn)closeMenu();}
/* ---------- overlay / panes ---------- */
function modeFor(pane){const auth=pane.classList.contains('auth');const m=auth?(T.authSurface==='drawer'?'drawer':'modal'):(T.surface==='modal'?'modal':'drawer');return 'as-'+m;}
function place(pane){pane.classList.remove('as-modal','as-drawer');pane.classList.add(modeFor(pane));}
function openPane(id,push){const ovl=$('#ovl');ovl.classList.add('open');
  if(!push){stack.forEach(p=>$('#pane-'+p).classList.remove('on'));stack=[];}
  else if(stack.length){$('#pane-'+stack[stack.length-1]).classList.remove('on');}
  stack.push(id);const pane=$('#pane-'+id);place(pane);pane.classList.add('on');
  const f=pane.querySelector('input,textarea,select');if(f&&window.innerWidth>700)setTimeout(()=>f.focus(),60);
}
function popPane(){if(!stack.length)return;const cur=stack.pop();$('#pane-'+cur).classList.remove('on');
  if(stack.length){const pane=$('#pane-'+stack[stack.length-1]);place(pane);pane.classList.add('on');}
  else $('#ovl').classList.remove('open');
}
function closeAll(){stack.forEach(p=>$('#pane-'+p).classList.remove('on'));stack=[];$('#ovl').classList.remove('open');}
$('#ovl-bg').addEventListener('click',()=>stack.length>1?popPane():closeAll());
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(stack.length>1)popPane();else closeAll();closeMenu();}});
$$('[data-open]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();closeMenu();openPane(el.dataset.open,el.hasAttribute('data-push'));}));
$$('[data-close]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();closeAll();}));
$$('[data-back]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();popPane();}));
/* ---------- dropdown ---------- */
const wrap=$('#acct-wrap');
function closeMenu(){wrap.classList.remove('open');$('#acctMenu').hidden=true;}
$('#acctBtn').addEventListener('click',e=>{e.stopPropagation();const open=wrap.classList.toggle('open');$('#acctMenu').hidden=!open;});
document.addEventListener('click',e=>{if(!wrap.contains(e.target))closeMenu();});
/* ---------- tabs ---------- */
$$('.tab').forEach(t=>t.addEventListener('click',()=>{
  $$('.tab').forEach(x=>x.classList.toggle('on',x===t));
  $('#tab-account').hidden=t.dataset.tab!=='account';
  $('#tab-family').hidden=t.dataset.tab!=='family';
}));
/* ---------- subscription status card ---------- */
function renderStatus(){const el=$('#statusBody');if(!el)return;const s=T.subscription;
  if(s==='trial')el.innerHTML='<div class="status-line"><i></i>Free trial — 9 days left</div><p class="status-sub">Your trial ends July 26, 2026. After that it&rsquo;s $2.99/month, cancel anytime.</p><button class="btn ghost sm" onclick="toast(\'Billing would open here — $2.99/month.\')">Start my subscription</button>';
  else if(s==='active')el.innerHTML='<div class="status-line"><i></i>Active</div><p class="status-sub">Renews August 11, 2026 · $2.99/month.</p><button class="btn ghost sm" onclick="toast(\'Billing portal would open here.\')">Manage billing</button>';
  else el.innerHTML='<div class="status-line"><i class="bad"></i>Expired</div><p class="status-sub">Your subscription ended December 11, 2025.</p><div class="alertbox"><b>Logging is paused — your data is safe.</b><p>Everything your family tracked is still here. Renew to pick up right where you left off.</p><button class="btn sm" onclick="toast(\'Renewed! Welcome back.\');window.__setTweak&&window.__setTweak(\'subscription\',\'active\')">Renew for $2.99/month</button></div>';
}
/* ---------- inline edit (account + family info) ---------- */
$$('[data-edit]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.edit).classList.add('editing')));
$$('[data-canceledit]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.canceledit).classList.remove('editing')));
$$('[data-saveedit]').forEach(b=>b.addEventListener('click',()=>{$('#'+b.dataset.saveedit).classList.remove('editing');toast('Saved.');}));
/* ---------- close account confirm ---------- */
$('#closeBtn').addEventListener('click',()=>{$('#closeBtn').hidden=true;$('#closeConfirm').hidden=false;});
$('#closeKeep').addEventListener('click',()=>{$('#closeBtn').hidden=false;$('#closeConfirm').hidden=true;});
$('#closeYes').addEventListener('click',()=>{closeAll();setSigned(false);toast('Your account is closed. The porch light is off.');});
/* ---------- auth forms ---------- */
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();setSigned(true);closeAll();toast('Welcome back, Sprout.');});
$('#signupForm').addEventListener('submit',e=>{e.preventDefault();setSigned(true);closeAll();toast('Account created — your 14 days start now.');});
$('#resetForm').addEventListener('submit',e=>{e.preventDefault();closeAll();toast('Reset link sent. It works for one hour.');});
/* ---------- messages & chat ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let threads=[{id:1,subject:'Night mode idea',unread:false,msgs:[
 {me:true,text:'Any chance of a dimmer night mode? The white screen at the 3 am feeding is blinding.',day:'Jul 12',time:'3:14 AM'},
 {me:false,text:'Ha \u2014 heard. A true dark theme is on the list for the next release. I\u2019ll reply here when it ships.',day:'Jul 12',time:'8:04 AM'},
 {me:true,text:'Amazing. While I have you \u2014 could it kick in automatically at night?',day:'Jul 12',time:'8:31 AM'},
 {me:false,text:'That\u2019s the plan: follow the system setting by default, with a manual override in settings for phones that live in dark mode all day.',day:'Jul 13',time:'9:47 AM'},
 {me:true,text:'Perfect. My wife\u2019s phone is permanently in dark mode so the override matters.',day:'Jul 13',time:'12:02 PM'},
 {me:false,text:'Noted \u2014 that\u2019s exactly the case I\u2019m testing with. Shipping it with the next release, likely early August.',day:'Jul 15',time:'7:22 AM'},
 {me:true,text:'You\u2019re the best. This app has saved our sanity, genuinely.',day:'Jul 15',time:'7:40 AM'},
 {me:false,text:'That\u2019s why I build it. Give Jackson a high five from me.',day:'Jul 16',time:'8:04 AM'}]}];
let curThread=null,replyIdx=0,pend=null;
const canned=['Thanks \u2014 got it. I read every one of these myself and I\u2019ll get back to you right here.','Good catch \u2014 looking into it now. I\u2019ll follow up in this thread.'];
const fmtNow=()=>new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function renderThreads(){const el=$('#thrList');if(!el)return;
 if(!threads.length){el.innerHTML='<div class="empty"><svg width="30" height="30"><use href="#i-chat"/></svg><b>No messages yet</b>Start one below \u2014 a bug, an idea, a thank-you.</div>';return;}
 el.innerHTML=threads.map(t=>{const l=t.msgs[t.msgs.length-1];return '<div class="thr" data-thr="'+t.id+'">'+(t.unread?'<span class="dot"></span>':'')+'<div class="tinfo"><b>'+esc(t.subject)+'</b><span class="snip">'+(l.me?'You: ':'')+esc(l.text||'Photo')+'</span></div><time>'+esc(l.day)+'</time></div>';}).join('');
 $$('#thrList .thr').forEach(r=>r.addEventListener('click',()=>openChat(+r.dataset.thr)));}
function renderChat(){const t=threads.find(x=>x.id===curThread);if(!t)return;
 $('#chatTitle').textContent=t.subject;$('#chatCount').textContent=t.msgs.length+(t.msgs.length===1?' message':' messages');
 let day='';$('#chatBody').innerHTML='<div class="chat">'+t.msgs.map(m=>{let h='';if(m.day!==day){day=m.day;h+='<div class="day">'+esc(m.day)+'</div>';}
 h+='<div class="msg '+(m.me?'me':'them')+'">'+(m.me?'':'<span class="who"><img src="logo.png" alt="">Sprout Track</span>')+'<div class="bub">'+(m.img?'<img src="'+m.img+'" alt="">':'')+(m.text?esc(m.text):'')+'</div><time>'+esc(m.time)+'</time></div>';return h;}).join('')+(t.typing?'<div class="msg them"><span class="who"><img src="logo.png" alt="">Sprout Track</span><div class="bub typing"><i></i><i></i><i></i></div></div>':'')+'</div>';
 const b=$('#chatBody');b.scrollTop=b.scrollHeight;}
function openChat(id){curThread=id;const t=threads.find(x=>x.id===id);t.unread=false;renderChat();renderThreads();openPane('chat',true);}
function scheduleReply(id){setTimeout(()=>{const t=threads.find(x=>x.id===id);if(!t)return;t.typing=true;if(curThread===id&&stack[stack.length-1]==='chat')renderChat();},1100);
 setTimeout(()=>{const t=threads.find(x=>x.id===id);if(!t)return;t.typing=false;t.msgs.push({me:false,text:canned[replyIdx++%canned.length],day:'Today',time:fmtNow()});
 if(curThread===id&&stack[stack.length-1]==='chat')renderChat();else t.unread=true;renderThreads();},3200);}
let nmAtts=[];
$('#nmImgBtn').addEventListener('click',()=>$('#nmImgIn').click());
$('#nmImgIn').addEventListener('change',()=>{[...$('#nmImgIn').files].forEach(f=>{const r=new FileReader();r.onload=()=>{nmAtts.push(r.result);renderNmAtts();};r.readAsDataURL(f);});$('#nmImgIn').value='';});
function renderNmAtts(){$('#nmAtts').innerHTML=nmAtts.map((s,i)=>'<span class="att"><img src="'+s+'" alt=""><button type="button" data-rm="'+i+'" aria-label="Remove photo">×</button></span>').join('');
 $$('#nmAtts [data-rm]').forEach(b=>b.addEventListener('click',()=>{nmAtts.splice(+b.dataset.rm,1);renderNmAtts();}));}
$('#newMsgBtn').addEventListener('click',()=>openPane('newmsg',true));
$('#newMsgForm').addEventListener('submit',e=>{e.preventDefault();const s=$('#nmSubject').value.trim(),b=$('#nmBody').value.trim();if(!s||!b)return;
 const id=Date.now();const msgs=[{me:true,text:b,day:'Today',time:fmtNow()}];nmAtts.forEach(img=>msgs.push({me:true,img,day:'Today',time:fmtNow()}));threads.unshift({id,subject:s,unread:false,msgs});
 $('#nmSubject').value='';$('#nmBody').value='';nmAtts=[];renderNmAtts();popPane();renderThreads();openChat(id);scheduleReply(id);});
$('#composer').addEventListener('submit',e=>{e.preventDefault();const t=threads.find(x=>x.id===curThread);if(!t)return;const txt=$('#chatIn').value.trim();
 if(!txt&&!pend)return;t.msgs.push({me:true,text:txt,img:pend,day:'Today',time:fmtNow()});$('#chatIn').value='';clearPend();renderChat();renderThreads();scheduleReply(t.id);});
$('#imgBtn').addEventListener('click',()=>$('#imgIn').click());
$('#imgIn').addEventListener('change',()=>{const f=$('#imgIn').files[0];if(!f)return;const r=new FileReader();r.onload=()=>{pend=r.result;$('#pendImg').src=pend;$('#pendWrap').hidden=false;};r.readAsDataURL(f);$('#imgIn').value='';});
function clearPend(){pend=null;$('#pendWrap').hidden=true;}
$('#pendX').addEventListener('click',clearPend);
renderThreads();
$('#logoutLink').addEventListener('click',e=>{e.preventDefault();closeMenu();setSigned(false);toast('Signed out. See you at the next nap.');});
$('#dashLink').addEventListener('click',e=>{e.preventDefault();closeMenu();toast('This would open your family\u2019s dashboard.');});
/* password checklist */
const pw=$('#suPw');
if(pw){const rules={r8:v=>v.length>=8,rlo:v=>/[a-z]/.test(v),rup:v=>/[A-Z]/.test(v),rnum:v=>/\d/.test(v),rsym:v=>/[^A-Za-z0-9]/.test(v)};
pw.addEventListener('input',()=>{const v=pw.value;for(const k in rules){const el=$('#'+k);el.classList.toggle('ok',rules[k](v));el.querySelector('i').textContent=rules[k](v)?'✓':'';}});}
/* ---------- sub-form saves ---------- */
$('#babyForm').addEventListener('submit',e=>{e.preventDefault();popPane();toast('Saved. Jackson\u2019s page is up to date.');});
$('#ctForm').addEventListener('submit',e=>{e.preventDefault();popPane();toast('Caretaker saved.');});
$('#contactForm').addEventListener('submit',e=>{e.preventDefault();popPane();toast('Contact saved.');});
/* baby / caretaker prefills */
const babyData={jackson:{title:'Edit Jackson',first:'Jackson',last:'Sprout',dob:'2024-11-14',gender:'boy',feed:'03:00',diaper:'02:00'}};
const ctData={rachael:{title:'Edit Rachael',name:'Rachael',rel:'',role:'user',id:'11'},sprout:{title:'Edit Sprout',name:'Sprout',rel:'Parent',role:'admin',id:'64'}};
$$('[data-baby]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const d=babyData[a.dataset.baby];
  $('#babyTitle').textContent=d?d.title:'Add a baby';$('#babySub').hidden=!!d;$('#babySave').textContent=d?'Save changes':'Add baby';
  $('#bFirst').value=d?d.first:'';$('#bLast').value=d?d.last:'';$('#bDob').value=d?d.dob:'';$('#bGender').value=d?d.gender:'';$('#bFeed').value=d?d.feed:'03:00';$('#bDiaper').value=d?d.diaper:'02:00';
  openPane('baby',true);}));
$$('[data-ct]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const d=ctData[a.dataset.ct];
  $('#ctTitle').textContent=d?d.title:'Add a caretaker';$('#ctSave').textContent=d?'Save changes':'Add caretaker';
  $('#cName').value=d?d.name:'';$('#cRel').value=d?d.rel:'';$('#cRole').value=d?d.role:'user';$('#cId').value=d?d.id:'';$('#cPin').value='';$('#cPin2').value='';
  openPane('caretaker',true);}));
/* ---------- toast ---------- */
let toastTimer=null,toastEl=null;
window.toast=function(msg){if(toastEl)toastEl.remove();toastEl=document.createElement('div');toastEl.className='toast';toastEl.textContent=msg;document.body.appendChild(toastEl);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastEl.remove();toastEl=null;},3400);}
syncNav();renderStatus();
