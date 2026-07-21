const {useState,useEffect,useRef,useMemo}=React;

const TWEAK_DEFAULTS=/*EDITMODE-BEGIN*/{
"babyName":"Thomas",
"clock24":false
}/*EDITMODE-END*/;

/* ---- icons ---- */
const ICONS={
bottle:<path d="M10 2.5h4V6l2 2.5V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V8.5L10 6z"/>,
pump:<><circle cx="12" cy="14" r="5"/><path d="M12 9V4M9 4h6"/></>,
diaper:<path d="M4 7h16v4a8 8 0 0 1-8 8 8 8 0 0 1-8-8z"/>,
moon:<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"/>,
image:<><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.5"/><path d="M4 17.5l4.5-4.5 4 4 3-3 5 5"/></>,
star:<path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3-5.6 3 1.2-6.2L3 9.5l6.3-.8z"/>};
function Icon({n,s=24}){return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>}

/* ---- activities ---- */
const ACTS=[
{id:'feed',label:'Feed',icon:'bottle',time:'6:00 am',detail:'Bottle',actions:['Bottle (4.9)','Breast L','Breast R']},
{id:'pump',label:'Pump',icon:'pump',time:'7:11 am',detail:'Stored',actions:['Start Left','Start Right','Start Both']},
{id:'diaper',label:'Diaper',icon:'diaper',time:'7:55 am',detail:'Both',actions:['Wet','Dirty','Both']},
{id:'sleep',label:'Sleep',icon:'moon',time:'9:00 am',detail:'Sleep — 33 min',actions:['Start Sleep']}];

const ICON_SWATCHES=[null,'#f9c9d6','#fbd38d','#a7f3d0','#a5d8ff','#d8b4fe','#ffffff'];

/* ---- background patterns ---- */
const MOTIF={
teddy:"<g fill='none' stroke='C' stroke-width='1.4'><circle cx='14' cy='14' r='3.4'/><circle cx='30' cy='14' r='3.4'/><circle cx='22' cy='23' r='8.5'/><circle cx='22' cy='26' r='3.4'/></g><g fill='C'><circle cx='18.5' cy='21' r='1'/><circle cx='25.5' cy='21' r='1'/><circle cx='22' cy='24.5' r='1.1'/></g>",
cats:"<g fill='none' stroke='C' stroke-width='1.4'><path d='M13 9 18 17 10 16Z'/><path d='M31 9 26 17 34 16Z'/><circle cx='22' cy='23' r='9'/><path d='M13 24h5M13 26h5M26 24h5M26 26h5'/></g><g fill='C'><circle cx='19' cy='22' r='1'/><circle cx='25' cy='22' r='1'/></g>",
dogs:"<g fill='none' stroke='C' stroke-width='1.4'><ellipse cx='12' cy='22' rx='3.4' ry='7'/><ellipse cx='32' cy='22' rx='3.4' ry='7'/><circle cx='22' cy='22' r='8.5'/><ellipse cx='22' cy='26' rx='4' ry='3'/></g><g fill='C'><circle cx='18.5' cy='20' r='1'/><circle cx='25.5' cy='20' r='1'/><circle cx='22' cy='25' r='1.3'/></g>",
rockets:"<g fill='none' stroke='C' stroke-width='1.4'><path d='M22 6C26 6 27.5 13 27.5 20L27.5 28 16.5 28 16.5 20C16.5 13 18 6 22 6Z'/><circle cx='22' cy='16' r='2.6'/><path d='M16.5 24 12 30 16.5 28Z'/><path d='M27.5 24 32 30 27.5 28Z'/><path d='M19 29Q22 34 25 29'/></g>",
paisley:"<g fill='none' stroke='C' stroke-width='1.4'><path d='M15 32C6 26 10 11 22 11 31 11 33 24 23 26 18 27 15 22 18 19'/></g><g fill='C'><circle cx='20' cy='15' r='1.1'/></g>",
nursery:"<g fill='none' stroke='C' stroke-width='1.4'><path d='M13 8l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z'/><path d='M35 27a5 5 0 1 1-4.2-5 3.8 3.8 0 0 0 4.2 5z'/></g><g fill='C'><path d='M20 37c-3-2.2-5.4-3.8-5.4-6 0-1.5 1.2-2.4 2.5-2.4.9 0 1.7.4 2.9 1.5 1.2-1.1 2-1.5 2.9-1.5 1.3 0 2.5.9 2.5 2.4 0 2.2-2.4 3.8-5.4 6z'/></g>"};
const PATTERNS=[['aurora','Aurora'],['waves','Waves'],['bubbles','Bubbles']];
/* paisley + rug scenes: greyscale SVG artwork recolored to the palette */
const PAL={
boys:{base:'#f2e9d8',colors:['#3a6ea5','#5f93c9','#8fb4d9','#b1492f','#d67f65']},
girls:{base:'#f4ebe4',colors:['#4b8a5d','#7bb08a','#aecfb6','#c66d90','#e2a1bd']}};
const BASE_CHIPS={
boys:['#f2e9d8','#e5eef6','#c9dcee','#a6c3e0','#efd6cd','#dfae9f'],
girls:['#f4ebe4','#e7f0e9','#cee3d5','#f2dae3','#eac2d3','#d99bb4']};
const SPRITE_TYPES=[['teddy','Teddy Bears'],['kittens','Kittens'],['puppies','Puppies'],['unicorns','Unicorns'],['butterflies','Butterflies'],['flowers','Flowers'],['rockets','Rockets'],['cars','Cars'],['balls','Sports Balls'],['stars','Stars'],['fairies','Fairies']];
const spriteFile=id=>id?`patterns/sprites/${id}.svg`:null;
const BACKDROPS=[['plain','Plain'],['vstripe','Pinstripe'],['hstripe','Horizontal'],['dstripe','Diagonal'],['zigzag','Chevron'],['dots','Dots'],['checks','Blocks'],['scallops','Scallops']];
const RUG_BACKDROPS=[['rug:paisley-1','Classic Paisley'],['rug:paisley-2','Trailing Paisley'],['rug:paisley-3','Garden Paisley'],['rug:rug-1','Medallion Rug'],['rug:rug-2','Heirloom Rug']];
const rugFile=id=>`patterns/rugs/${id.slice(4)}.svg`;
const isRug=id=>typeof id==='string'&&id.startsWith('rug:');
function backdropStyle(kind,baseHex){
const[h,s,l]=hex2hsl(baseHex);
const tint=hsl2hex(h,Math.min(1,s*1.15),l>0.5?l-0.06:l+0.06);
if(kind==='vstripe')return{background:`repeating-linear-gradient(90deg, ${baseHex} 0 30px, ${tint} 30px 37px)`};
if(kind==='hstripe')return{background:`repeating-linear-gradient(0deg, ${baseHex} 0 30px, ${tint} 30px 37px)`};
if(kind==='dstripe')return{background:`repeating-linear-gradient(45deg, ${baseHex} 0 30px, ${tint} 30px 37px)`};
if(kind==='zigzag')return{backgroundColor:baseHex,backgroundImage:`linear-gradient(135deg, ${tint} 25%, transparent 25%),linear-gradient(225deg, ${tint} 25%, transparent 25%),linear-gradient(315deg, ${tint} 25%, transparent 25%),linear-gradient(45deg, ${tint} 25%, transparent 25%)`,backgroundPosition:'-26px 0,-26px 0,0 0,0 0',backgroundSize:'52px 52px'};
if(kind==='dots')return{backgroundColor:baseHex,backgroundImage:`radial-gradient(${tint} 4px, transparent 5px),radial-gradient(${tint} 4px, transparent 5px)`,backgroundSize:'46px 46px',backgroundPosition:'0 0,23px 23px'};
if(kind==='checks')return{backgroundColor:baseHex,backgroundImage:`repeating-conic-gradient(${tint} 0 25%, transparent 0 50%)`,backgroundSize:'68px 68px'};
if(kind==='scallops')return{backgroundColor:baseHex,backgroundImage:`radial-gradient(circle at 50% 120%, ${tint} 0 14px, transparent 15px 100%),radial-gradient(circle at 50% 120%, ${tint} 0 14px, transparent 15px 100%)`,backgroundSize:'48px 24px',backgroundPosition:'0 0,24px 12px'};
return{background:baseHex};
}
const hex2hsl=hex=>{const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h/=6}return[h,s,l]};
const hsl2hex=(h,s,l)=>{const f=n=>{const k=(n+h*12)%12;const c=l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(c*255).toString(16).padStart(2,'0')};return '#'+f(0)+f(8)+f(4)};
const COLOR_RE=/#[0-9a-fA-F]{6}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;
const parseRGB=c=>c[0]==='#'?[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]:c.match(/\d+/g).map(Number);
const svgTextCache={},svgUrlCache={};
const mapTarget=(p,base,cols)=>p>=0.8?base:cols[Math.min(cols.length-1,Math.floor(p/0.8*cols.length))];
async function recolorRaster(file,base,cols){
const img=await new Promise((ok,err)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=err;im.src=file});
const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
const id=ctx.getImageData(0,0,cv.width,cv.height),d=id.data;
const lut=new Uint8ClampedArray(768);
for(let v=0;v<256;v++){const p=v/255;const[th,ts,tl]=hex2hsl(mapTarget(p,base,cols));const hx=hsl2hex(th,ts,0.55*p+0.45*tl);lut[v*3]=parseInt(hx.slice(1,3),16);lut[v*3+1]=parseInt(hx.slice(3,5),16);lut[v*3+2]=parseInt(hx.slice(5,7),16)}
for(let i=0;i<d.length;i+=4){const v=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]+0.5)|0;d[i]=lut[v*3];d[i+1]=lut[v*3+1];d[i+2]=lut[v*3+2]}
ctx.putImageData(id,0,0);
return new Promise(ok=>cv.toBlob(b=>ok(URL.createObjectURL(b)),'image/png'));
}
async function recolorSvg(file,base,cols){
const key=file+'|'+base+'|'+cols.join();
if(svgUrlCache[key])return svgUrlCache[key];
if(/\.png$/i.test(file)){svgUrlCache[key]=await recolorRaster(file,base,cols);return svgUrlCache[key]}
if(!svgTextCache[file])svgTextCache[file]=await fetch(file).then(r=>r.text());
const text=svgTextCache[file];
const hexes=[...new Set(text.match(COLOR_RE)||[])];
const lum=c=>{const[r,g,b]=parseRGB(c);return (0.299*r+0.587*g+0.114*b)/255};
const sorted=[...hexes].sort((a,b)=>lum(a)-lum(b));
const map={};
sorted.forEach((hx,i)=>{
const p=sorted.length>1?i/(sorted.length-1):1;
const target=mapTarget(p,base,cols);
const[th,ts,tl]=hex2hsl(target);
map[hx]=hsl2hex(th,ts,0.55*lum(hx)+0.45*tl);
});
const out=text.replace(COLOR_RE,m=>map[m]||m);
svgUrlCache[key]=URL.createObjectURL(new Blob([out],{type:'image/svg+xml'}));
return svgUrlCache[key];
}
function useRecolored(file,base,cols){
const key=file?file+'|'+base+'|'+cols.join():null;
const[url,setUrl]=useState(key?svgUrlCache[key]||null:null);
useEffect(()=>{if(!file){setUrl(null);return}let live=true;recolorSvg(file,base,cols).then(u=>{if(live)setUrl(u)});return()=>{live=false}},[key]);
return key?(svgUrlCache[key]||url):null;
}
const coverStyle=url=>({backgroundImage:url?`url(${url})`:'none',backgroundSize:'cover',backgroundPosition:'center',backgroundColor:'#1c1f2b'});
/* sprite-sheet pipeline: rasterize → remove background → detect sprites → recolor */
const sheetCache={};
/* shared: background mask + sprite boxes, with adaptive bg tolerance (handles sheets on tinted panels) */
function analyzeSheet(d,W,H){
const ref=[0,1,2].map(k=>(d[k]+d[(W-1)*4+k]+d[(H-1)*W*4+k]+d[((H-1)*W+W-1)*4+k])/4);
let bg=null,norm=[];
for(const tol of[1200,4200,9500]){
const isBg=p=>{const i=p*4;if(d[i+3]<24)return true;const dr=d[i]-ref[0],dg=d[i+1]-ref[1],db=d[i+2]-ref[2];return (dr*dr+dg*dg+db*db)<tol};
bg=new Uint8Array(W*H);const st=[];
for(let x=0;x<W;x++){st.push(x,(H-1)*W+x)}
for(let y=0;y<H;y++){st.push(y*W,y*W+W-1)}
while(st.length){const p=st.pop();if(bg[p]||!isBg(p))continue;bg[p]=1;const x=p%W,y=(p/W)|0;
if(x>0)st.push(p-1);if(x<W-1)st.push(p+1);if(y>0)st.push(p-W);if(y<H-1)st.push(p+W)}
const S=4,gw=Math.ceil(W/S),gh=Math.ceil(H/S);
const ink=new Uint8Array(gw*gh);
for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
let has=0;
for(let dy=0;dy<S&&!has;dy++)for(let dx=0;dx<S&&!has;dx++){const x=gx*S+dx,y=gy*S+dy;if(x<W&&y<H&&!bg[y*W+x]&&d[(y*W+x)*4+3]>40)has=1}
ink[gy*gw+gx]=has}
const lab=new Int32Array(gw*gh).fill(-1);let boxes=[];
for(let i0=0;i0<gw*gh;i0++){
if(!ink[i0]||lab[i0]>=0)continue;
const q=[i0];lab[i0]=boxes.length;let x0=1e9,y0=1e9,x1=-1,y1=-1,area=0;
while(q.length){const p=q.pop();const x=p%gw,y=(p/gw)|0;
if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;area++;
for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const np=ny*gw+nx;if(ink[np]&&lab[np]<0){lab[np]=lab[i0];q.push(np)}}}
boxes.push({x0,y0,x1,y1,area})}
const near=Math.round(gw*0.012)+1;
let merged=true;
while(merged){merged=false;
for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const A=boxes[a],B=boxes[b];if(!A||!B)continue;
if(A.x0-near<=B.x1&&B.x0-near<=A.x1&&A.y0-near<=B.y1&&B.y0-near<=A.y1){A.x0=Math.min(A.x0,B.x0);A.y0=Math.min(A.y0,B.y0);A.x1=Math.max(A.x1,B.x1);A.y1=Math.max(A.y1,B.y1);A.area+=B.area;boxes[b]=null;merged=true}}
boxes=boxes.filter(Boolean)}
boxes=boxes.filter(b=>b.area>gw*gh*0.003).sort((a,b)=>b.area-a.area).slice(0,10);
const frac=boxes.length?((boxes[0].x1-boxes[0].x0+1)*(boxes[0].y1-boxes[0].y0+1))/(gw*gh):1;
boxes.sort((a,b)=>{const ay=(a.y0+a.y1)/2,by=(b.y0+b.y1)/2;return Math.abs(ay-by)>gh*0.2?ay-by:(a.x0+a.x1)-(b.x0+b.x1)});
norm=boxes.map(b=>{const x=Math.max(0,(b.x0-1)*S)/W,y=Math.max(0,(b.y0-1)*S)/H;return{x,y,w:Math.min(1,(b.x1+2)*S/W)-x,h:Math.min(1,(b.y1+2)*S/H)-y}});
if(boxes.length>=3&&frac<0.45)break;
}
return{bg,norm};
}
async function processSheet(file,base,cols){
const key=file+'|'+base+'|'+cols.join();
if(sheetCache[key])return sheetCache[key];
const img=await new Promise((ok,err)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=err;im.src=file});
const scale=Math.min(1,1600/img.naturalWidth);
const W=Math.round(img.naturalWidth*scale),H=Math.round(img.naturalHeight*scale);
const cv=document.createElement('canvas');cv.width=W;cv.height=H;
const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,W,H);
const id=ctx.getImageData(0,0,W,H),d=id.data;
const{bg,norm}=analyzeSheet(d,W,H);
/* recolor + transparent background */
const lut=new Uint8ClampedArray(768);
for(let v=0;v<256;v++){const p=v/255;const[th,ts,tl]=hex2hsl(mapTarget(p,base,cols));const hx=hsl2hex(th,ts,0.55*p+0.45*tl);lut[v*3]=parseInt(hx.slice(1,3),16);lut[v*3+1]=parseInt(hx.slice(3,5),16);lut[v*3+2]=parseInt(hx.slice(5,7),16)}
for(let p=0;p<W*H;p++){const i=p*4;
if(bg[p]){d[i+3]=0;continue}
const v=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]+0.5)|0;d[i]=lut[v*3];d[i+1]=lut[v*3+1];d[i+2]=lut[v*3+2]}
ctx.putImageData(id,0,0);
const url=await new Promise(ok=>cv.toBlob(b=>ok(URL.createObjectURL(b)),'image/png'));
sheetCache[key]={url,boxes:norm,w:W,h:H};
return sheetCache[key];
}
function useSheet(file,base,cols){
const key=file?file+'|'+base+'|'+cols.join():null;
const[res,setRes]=useState(key?sheetCache[key]||null:null);
useEffect(()=>{if(!file){setRes(null);return}let live=true;processSheet(file,base,cols).then(r=>{if(live)setRes(r)});return()=>{live=false}},[key]);
return key?(sheetCache[key]||res):null;
}
function ScatterLayer({primFile,secFile,base,cols}){
const A=useSheet(primFile,base,cols);
const B=useSheet(secFile,base,cols);
/* dart-throwing: random pos/size, reject collisions — organic but never overlapping.
   All geometry in width-% units; vertical extent = 100/stageAR. */
const items=useMemo(()=>{
if(!A)return[];
const AR=16/9,VH=100/AR;
const placed=[];
const throwDarts=(S,wBase,scMin,scMax,count,sec)=>{
const weights=S.boxes.map(()=>1);
const pickIdx=()=>{const tot=weights.reduce((a,b)=>a+b,0);let t=Math.random()*tot;for(let i=0;i<weights.length;i++){t-=weights[i];if(t<=0)return i}return weights.length-1};
let n=0,tries=0;
while(n<count&&tries<2200){
tries++;
const idx=pickIdx();
const bx=S.boxes[idx];
if(!bx||bx.w<=0||bx.h<=0)continue;
const ar=(bx.w*S.w)/(bx.h*S.h);
let w=wBase*(scMin+Math.random()*(scMax-scMin));
const hw=w/ar;
if(hw>w*1.9)w*=(w*1.9)/hw;
const r=Math.max(w,w/ar)/2*1.08+1.4;
const x=r+Math.random()*(100-2*r);
const y=r+Math.random()*(VH-2*r);
let hit=false;
for(const p of placed){const dx=x-p.x,dy=y-p.y;if(dx*dx+dy*dy<(r+p.r)*(r+p.r)){hit=true;break}}
if(hit)continue;
placed.push({x,y,r,idx,ar,w,rot:Math.round(Math.random()*56-28),sec});
weights[idx]*=0.4;
n++;
}
};
throwDarts(A,8.6,0.62,1.3,17,false);
if(secFile)throwDarts(B||A,4.3,0.6,1.25,16,true);
return placed},[A,B,secFile]);
if(!A)return null;
return <div className="scatter">{items.map((it,i)=>{
const S=it.sec?(B||A):A;
const bx=S.boxes[it.idx];
if(!bx)return null;
return <div key={i} style={{position:'absolute',left:it.x+'%',top:(it.y*16/9).toFixed(2)+'%',width:it.w.toFixed(2)+'%',aspectRatio:String(it.ar.toFixed(3)),transform:`translate(-50%,-50%) rotate(${it.rot}deg)`,backgroundImage:`url(${S.url})`,backgroundSize:`${(100/bx.w).toFixed(2)}% ${(100/bx.h).toFixed(2)}%`,backgroundPosition:`${bx.w<1?(bx.x/(1-bx.w)*100).toFixed(2):0}% ${bx.h<1?(bx.y/(1-bx.h)*100).toFixed(2):0}%`,backgroundRepeat:'no-repeat'}}></div>;
})}</div>;
}
const baseGrad=h=>`linear-gradient(155deg, oklch(0.5 0.12 ${h}), oklch(0.38 0.13 ${(h+35)%360}))`;
const wallpaperUri=(name,h,a=0.16)=>{const c=`hsla(${h},42%,86%,${a})`;const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>${MOTIF[name].replaceAll('C',c)}</svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`};
const wavesUri=h=>{const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M0 50 C22 40 38 60 55 50 S86 40 100 50 L100 100 0 100Z' fill='hsl(${h},40%,44%)'/><path d='M0 63 C22 54 40 74 56 63 S86 54 100 63 L100 100 0 100Z' fill='hsl(${(h+18)%360},42%,38%)'/><path d='M0 77 C24 69 40 88 58 77 S86 69 100 77 L100 100 0 100Z' fill='hsl(${(h+34)%360},44%,31%)'/></svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`};
const motifUri=(name,h)=>{const c=`hsla(${h},45%,86%,.22)`;const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>${MOTIF[name].replaceAll('C',c)}</svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`};
/* outline extraction: greyscale sheet → line-art sprites (edges only, tinted) */
const outlineCache={};
async function processOutline(file,hue){
const key=file+'|'+hue;
if(outlineCache[key])return outlineCache[key];
const img=await new Promise((ok,err)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=err;im.src=file});
const scale=Math.min(1,900/img.naturalWidth);
const W=Math.round(img.naturalWidth*scale),H=Math.round(img.naturalHeight*scale);
const cv=document.createElement('canvas');cv.width=W;cv.height=H;
const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,W,H);
const id=ctx.getImageData(0,0,W,H),d=id.data;
const{bg,norm}=analyzeSheet(d,W,H);
const lum=new Uint8Array(W*H);
for(let p=0;p<W*H;p++)lum[p]=(0.299*d[p*4]+0.587*d[p*4+1]+0.114*d[p*4+2])|0;
const edge=new Uint8Array(W*H);
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=y*W+x;
if(bg[p])continue;
if(bg[p-1]||bg[p+1]||bg[p-W]||bg[p+W]){edge[p]=1;continue}
if(Math.abs(lum[p]-lum[p+1])>24||Math.abs(lum[p]-lum[p+W])>24)edge[p]=1}
const edge2=new Uint8Array(W*H);
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=y*W+x;
if(edge[p]||edge[p-1]||edge[p+1]||edge[p-W]||edge[p+W])edge2[p]=1}
const edge3=new Uint8Array(W*H);
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=y*W+x;
if(edge2[p]||edge2[p-1]||edge2[p+1]||edge2[p-W]||edge2[p+W])edge3[p]=1}
const tint=hsl2hex(((hue%360)+360)%360/360,0.45,0.86);
const tr=parseInt(tint.slice(1,3),16),tg=parseInt(tint.slice(3,5),16),tb=parseInt(tint.slice(5,7),16);
for(let p=0;p<W*H;p++){const i=p*4;
if(edge3[p]&&!bg[p]){d[i]=tr;d[i+1]=tg;d[i+2]=tb;d[i+3]=235}
else d[i+3]=0}
ctx.putImageData(id,0,0);
const url=await new Promise(ok=>cv.toBlob(b=>ok(URL.createObjectURL(b)),'image/png'));
outlineCache[key]={url,boxes:norm,w:W,h:H};
return outlineCache[key];
}
function useOutline(file,hue){
const key=file?file+'|'+hue:null;
const[res,setRes]=useState(key?outlineCache[key]||null:null);
useEffect(()=>{if(!file){setRes(null);return}let live=true;processOutline(file,hue).then(r=>{if(live)setRes(r)});return()=>{live=false}},[key]);
return key?(outlineCache[key]||res):null;
}
function OutlineField({file,hue,rot,move,sizeVar}){
const S=useOutline(file,hue);
/* collision-rejected placement (width-% units, y scaled by stage aspect) */
const items=useMemo(()=>{
if(!S||!S.boxes.length)return[];
const VH=56.25;const placed=[];
let n=0,tries=0;
while(n<26&&tries<1600){
tries++;
const ri=Math.random();
const bx=S.boxes[Math.floor(ri*S.boxes.length)];
if(!bx||bx.w<=0||bx.h<=0)continue;
const r2=Math.random();
const sc=sizeVar<=2?1:1+(r2-0.5)*2*(sizeVar/100)*0.75;
const w=6.4*sc;
const ar=(bx.w*S.w)/(bx.h*S.h);
const r=Math.max(w,w/ar)/2+1.6;
const x=r+Math.random()*(100-2*r);
const y=r+Math.random()*(VH-2*r);
let hit=false;
for(const q of placed){const dx=x-q.x,dy=y-q.y;if(dx*dx+dy*dy<(r+q.r)*(r+q.r)){hit=true;break}}
if(hit)continue;
placed.push({x,y,r,w,ar,ri,r1:Math.random(),dx:Math.random()*120-60,dy:Math.random()*120-60,dur:14+Math.random()*18,d:(-Math.random()*20).toFixed(1),spin:Math.random()*90-45});
n++;
}
return placed},[S,sizeVar]);
if(!S||!S.boxes.length)return null;
const floats=move>0;
return <div className="motifs">{items.map((it,i)=>{
const bx=S.boxes[Math.floor(it.ri*S.boxes.length)];
if(!bx)return null;
const deg=((it.r1-0.5)*2*rot*1.8).toFixed(1);
const mv=0.2+move/100*0.8;
const st={left:it.x+'%',top:(it.y*16/9).toFixed(2)+'%',width:it.w.toFixed(2)+'%',aspectRatio:String(it.ar.toFixed(3)),marginLeft:(-it.w/2).toFixed(2)+'%',marginTop:(-it.w/it.ar/2).toFixed(2)+'%',opacity:.34,backgroundImage:`url(${S.url})`,backgroundSize:`${(100/bx.w).toFixed(2)}% ${(100/bx.h).toFixed(2)}%`,backgroundPosition:`${bx.w<1?(bx.x/(1-bx.w)*100).toFixed(2):0}% ${bx.h<1?(bx.y/(1-bx.h)*100).toFixed(2):0}%`};
if(floats){st['--tr']=deg+'deg';st['--tr2']=(+deg+it.spin*(rot/60)).toFixed(1)+'deg';st['--tx']=(it.dx*mv).toFixed(1)+'vw';st['--ty']=(it.dy*mv).toFixed(1)+'vh';st['--dur']=(it.dur*(1.65-move/100*1.3)).toFixed(1)+'s';st['--d']=it.d+'s'}
else{st.transform=`rotate(${deg}deg)`}
return <i key={i} className={floats?'float':''} style={st}></i>;
})}</div>;
}
function OutlineThumb({id,label,hue,on,onClick}){
const S=useOutline(spriteFile(id),hue);
const pick=useMemo(()=>Math.random(),[id]);
const bx=S&&S.boxes.length?S.boxes[Math.floor(pick*S.boxes.length)]:null;
const ar=bx?(bx.w*S.w)/(bx.h*S.h):1;
return <button className={"patt"+(on?' on':'')} onClick={onClick}><div className="pp" style={{background:baseGrad(hue),display:'grid',placeItems:'center'}}>{bx&&<div style={{height:'80%',aspectRatio:String(ar.toFixed(3)),backgroundImage:`url(${S.url})`,backgroundSize:`${(100/bx.w).toFixed(2)}% ${(100/bx.h).toFixed(2)}%`,backgroundPosition:`${bx.w<1?(bx.x/(1-bx.w)*100).toFixed(2):0}% ${bx.h<1?(bx.y/(1-bx.h)*100).toFixed(2):0}%`,backgroundRepeat:'no-repeat'}}></div>}</div><div className="pl">{label}</div></button>;
}

function patternStyle(pattern,h){
if(pattern==='waves')return {background:`${wavesUri(h)} bottom/cover no-repeat, ${baseGrad(h)}`};
if(pattern==='bubbles')return {background:`radial-gradient(circle at 24% 78%, hsla(${h},60%,88%,.16) 0 26px, transparent 27px), radial-gradient(circle at 62% 40%, hsla(${h},60%,88%,.13) 0 15px, transparent 16px), radial-gradient(circle at 84% 72%, hsla(${h},60%,88%,.15) 0 20px, transparent 21px), ${baseGrad(h)}`};
if(MOTIF[pattern])return {background:`${wallpaperUri(pattern,h)}, ${baseGrad(h)}`,backgroundSize:'82px 82px, cover',backgroundRepeat:'repeat, no-repeat'};
return {background:`radial-gradient(58% 58% at 18% 18%, oklch(0.68 0.16 ${(h+20)%360}/.85), transparent 60%), radial-gradient(60% 60% at 86% 26%, oklch(0.6 0.17 ${(h+70)%360}/.75), transparent 60%), radial-gradient(70% 70% at 55% 108%, oklch(0.58 0.15 ${(h-40+360)%360}/.7), transparent 62%), ${baseGrad(h)}`};
}

/* ---- rotary dial ---- */
function Dial({label,value,onChange,unit='%',fmt}){
const drag=useRef(null);
const a0=-135,a1=135,ang=a0+(value/100)*(a1-a0);
const R=44,cx=52,cy=52;
const rad=d=>(d-90)*Math.PI/180;
const pt=(d,r)=>[cx+r*Math.cos(rad(d)),cy+r*Math.sin(rad(d))];
const arc=(from,to)=>{const[x1,y1]=pt(from,R),[x2,y2]=pt(to,R);const large=(to-from)>180?1:0;return `M${x1} ${y1}A${R} ${R} 0 ${large} 1 ${x2} ${y2}`};
const[hx,hy]=pt(ang,R);
useEffect(()=>{
const move=e=>{if(!drag.current)return;const y=(e.touches?e.touches[0].clientY:e.clientY);const dy=drag.current.y-y;let v=Math.max(0,Math.min(100,drag.current.v+dy*0.6));onChange(Math.round(v))};
const up=()=>{drag.current=null};
window.addEventListener('mousemove',move);window.addEventListener('touchmove',move,{passive:false});
window.addEventListener('mouseup',up);window.addEventListener('touchend',up);
return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('touchmove',move);window.removeEventListener('mouseup',up);window.removeEventListener('touchend',up)}
},[onChange]);
const start=e=>{const y=(e.touches?e.touches[0].clientY:e.clientY);drag.current={y,v:value};e.preventDefault()};
return <div className="dial">
<div className="knob" onMouseDown={start} onTouchStart={start}>
<svg width="104" height="104" viewBox="0 0 104 104">
<path d={arc(a0,a1)} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" strokeLinecap="round"/>
<path d={arc(a0,ang)} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
<circle cx={hx} cy={hy} r="8" fill="#fff"/>
</svg>
<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center'}}><span className="serif dv">{fmt?fmt(value):value+unit}</span></div>
</div>
<span className="dk">{label}</span>
</div>
}

/* ---- clock ---- */
function useClock(h24){
const[now,setNow]=useState(new Date(2026,6,13,10,27,0));
useEffect(()=>{const id=setInterval(()=>setNow(n=>new Date(n.getTime()+1000)),1000);return()=>clearInterval(id)},[]);
let h=now.getHours(),m=now.getMinutes(),ap=h>=12?'pm':'am';
if(!h24){h=h%12||12}
const time=h24?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${h}:${String(m).padStart(2,'0')} ${ap}`;
const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const mos=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const date=`${days[now.getDay()]}, ${mos[now.getMonth()]} ${now.getDate()}`;
return{time,date};
}

/* ---- layered vector waves: seamless scroll + roll breathing + rocking ---- */
function WavesField({hue,motion,rock,vari}){
const cvsRef=useRef(null),wrapRef=useRef(null);
const st=useRef({x:[0,0,0,0,0],last:null});
const cfg=useRef({hue,motion,rock,vari}); cfg.current={hue,motion,rock,vari};
useEffect(()=>{
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU=Math.PI*2,STEP=6;
const LAY=[
{af:0.022,lam:300,sp:9, bd:12, bp:0,  tp:0.20},
{af:0.032,lam:350,sp:16,bd:10, bp:1.7,tp:0.35},
{af:0.042,lam:400,sp:26,bd:8.6,bp:3.1,tp:0.50},
{af:0.052,lam:470,sp:38,bd:7.4,bp:4.6,tp:0.65},
{af:0.062,lam:560,sp:52,bd:6.4,bp:0.9,tp:0.80}];
let raf;
const step=ts=>{
const cvs=cvsRef.current,wrap=wrapRef.current,s=st.current,c=cfg.current;
if(!cvs){raf=requestAnimationFrame(step);return}
const dt=s.last==null?0:Math.min(0.05,(ts-s.last)/1000); s.last=ts;
const time=reduced?0:ts/1000;
const spMul=reduced?0:c.motion/40, vAmp=c.vari/100*0.5, rk=reduced?0:c.rock/100;
const dpr=Math.min(2,window.devicePixelRatio||1);
const W=cvs.clientWidth,H=cvs.clientHeight;
if(W===0){raf=requestAnimationFrame(step);return}
if(cvs.width!==Math.round(W*dpr)||cvs.height!==Math.round(H*dpr)){cvs.width=Math.round(W*dpr);cvs.height=Math.round(H*dpr)}
const ctx=cvs.getContext('2d');
ctx.setTransform(dpr,0,0,dpr,0,0);
ctx.clearRect(0,0,W,H);
const N=Math.ceil(W/STEP);
const h=((c.hue%360)+360)%360;
LAY.forEach((L,li)=>{
s.x[li]+=L.sp*spMul*dt;
const A=L.af*H;
const scale=1+vAmp*Math.sin(time*TAU/L.bd+L.bp);
const topY=L.tp*H;
const a1=A*0.55*scale,a2=A*0.30*scale,a3=A*0.15*scale;
const l1=L.lam,l2=L.lam/2.35,l3=L.lam/4.3;
const o1=s.x[li],o2=s.x[li]*1.3,o3=s.x[li]*1.7;
const li9=(h+li*9)%360,lit=52-li*7;
ctx.beginPath();
let first=0;
for(let i=0;i<=N;i++){
const x=i*STEP;
let y=a1*Math.sin(TAU*(x-o1)/l1+li*1.7);
y+=a2*Math.sin(TAU*(x-o2)/l2+li*3.1);
y+=a3*Math.sin(TAU*(x-o3)/l3+li*5.3);
y=topY-y;
if(i===0){ctx.moveTo(x,y);first=y}else ctx.lineTo(x,y);
}
ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
ctx.fillStyle=`hsl(${li9},${38+li*2}%,${lit+8}%)`;ctx.fill();
/* body fill a few px lower leaves a lighter rim along each crest */
ctx.save();ctx.translate(0,4.5);ctx.fillStyle=`hsl(${li9},${38+li*2}%,${lit}%)`;ctx.fill();ctx.restore();
});
if(wrap)wrap.style.transform=`rotate(${(rk*1.6*Math.sin(time*TAU/16)).toFixed(3)}deg) translateY(${(rk*12*Math.sin(time*TAU/11+1)).toFixed(2)}px)`;
raf=requestAnimationFrame(step);
};
raf=requestAnimationFrame(step);
return()=>cancelAnimationFrame(raf);
},[]);
return <div className="waves-canvas" ref={wrapRef}><canvas ref={cvsRef}></canvas></div>;
}

/* ---- background ---- */
function Background({scene,pattern,aura,hue,dim,sat,paisleyBase,paisleyColors,backdrop,primObj,secObj,starCount,bubbleCount,bubMin,bubMax,auroraRange,waveMotion,waveRock,waveVar,motifRot,motifMove,motifSize}){
const filter=`brightness(${(0.32+dim/100*0.78).toFixed(2)}) saturate(${(sat/100*1.9).toFixed(2)})`;
const rugUrl=useRecolored(scene==='tapestry'&&isRug(backdrop)?rugFile(backdrop):null,paisleyBase,paisleyColors);
const bubbles=useMemo(()=>{const lo=Math.min(bubMin,bubMax),hi=Math.max(bubMin,bubMax);return Array.from({length:bubbleCount},()=>({x:Math.random()*100,s:Math.round(lo+Math.random()*(hi-lo)),dur:(9+Math.random()*16).toFixed(1),d:(-Math.random()*24).toFixed(1),dx:Math.round((Math.random()-0.5)*160),o:(0.35+Math.random()*0.45).toFixed(2),sy:Math.round(Math.random()*100)}))},[bubbleCount,bubMin,bubMax]);
const stars=useMemo(()=>Array.from({length:starCount},()=>{const o=+(0.16+Math.random()*0.84).toFixed(2);const spark=o>0.82;return{x:Math.random()*100,y:Math.random()*100,s:+(Math.random()*1.7+0.5+(spark?1:0)).toFixed(2),o,d:(Math.random()*9).toFixed(2),dur:(3.5+Math.random()*6).toFixed(2),spark}}),[starCount]);
if(scene==='photo'){
return <div className="bg" style={{filter}}>
<div style={{position:'absolute',inset:0}}><image-slot id="nurserybg" shape="rect" placeholder="Drop a nursery photo"></image-slot></div>
<div className="scrim" style={{background:`linear-gradient(180deg,oklch(0.15 0.04 ${hue}/.55),oklch(0.1 0.05 ${hue}/.78))`}}></div>
</div>;
}
if(scene==='tapestry'){
return <div className="bg" style={{filter}}>
<div className="pattern-layer" style={isRug(backdrop)?coverStyle(rugUrl):backdropStyle(backdrop,paisleyBase)}></div>
<ScatterLayer primFile={spriteFile(primObj)} secFile={spriteFile(secObj)} base={paisleyBase} cols={paisleyColors}/>
<div className="scrim" style={{background:`radial-gradient(125% 95% at 50% 42%, rgba(28,20,10,.14), rgba(14,10,16,.5))`}}></div>
</div>;
}
if(scene==='starlit'){
return <div className="bg" style={{filter}}>
<div className="bg-grad" style={{background:`radial-gradient(120% 90% at 50% 12%, oklch(0.32 0.09 ${hue}), oklch(0.14 0.06 ${(hue+20)%360}) 70%, oklch(0.08 0.04 ${(hue+20)%360}))`}}></div>
<div className="stars">{stars.map((st,i)=><i key={i} className={st.spark?'spark':''} style={{left:st.x+'%',top:st.y+'%',width:st.s+'px',height:st.s+'px',opacity:st.o,"--d":st.d+'s',"--dur":st.dur+'s'}}/>)}</div>
{aura?<div className="aura">
<div className="ab a1" style={{background:`radial-gradient(60% 100% at 28% 0%, oklch(0.74 0.2 ${hue}/.72), transparent 68%)`}}></div>
<div className="ab a2" style={{background:`radial-gradient(52% 100% at 68% 0%, oklch(0.76 0.19 ${(hue+65)%360}/.66), transparent 68%)`}}></div>
<div className="ab a3" style={{background:`radial-gradient(70% 96% at 50% 6%, oklch(0.7 0.2 ${(hue-45+360)%360}/.5), transparent 72%)`}}></div>
</div>:<div className="scrim" style={{background:`radial-gradient(70% 55% at 50% 42%, oklch(0.4 0.1 ${hue}/.3), transparent)`}}></div>}
</div>;
}
if(pattern==='aurora'){
const f=0.3+auroraRange/100*1.9;
const o=d=>(((hue+d*f)%360)+360)%360;
return <div className="bg" style={{filter}}>
<div className="bg-grad" style={{background:baseGrad(hue)}}></div>
<div className="blob b1" style={{width:'55vw',height:'55vw',left:'-10vw',top:'-15vh',background:`radial-gradient(circle, oklch(0.68 0.16 ${o(20)}), transparent 62%)`}}></div>
<div className="blob b2" style={{width:'50vw',height:'50vw',right:'-12vw',top:'8vh',background:`radial-gradient(circle, oklch(0.6 0.17 ${o(70)}), transparent 62%)`}}></div>
<div className="blob b3" style={{width:'48vw',height:'48vw',left:'28vw',bottom:'-22vh',background:`radial-gradient(circle, oklch(0.58 0.15 ${o(-40)}), transparent 62%)`}}></div>
</div>;
}
return <div className="bg" style={{filter}}><div className="pattern-layer" style={(pattern==='waves'||pattern.startsWith('sprite:'))?{background:baseGrad(hue)}:patternStyle(pattern,hue)}></div>
{pattern==='waves'&&<WavesField hue={hue} motion={waveMotion} rock={waveRock} vari={waveVar}/>}
{pattern.startsWith('sprite:')&&<OutlineField file={spriteFile(pattern.slice(7))} hue={hue} rot={motifRot} move={motifMove} sizeVar={motifSize}/>}
{pattern==='bubbles'&&<div className="bubbles">{bubbles.map((b,i)=><i key={i} style={{left:b.x+'%',width:b.s+'px',height:b.s+'px',"--dur":b.dur+'s',"--d":b.d+'s',"--dx":b.dx+'px',"--o":b.o,"--sy":b.sy+'%'}}/>)}</div>}
</div>;
}

/* ---- badge ---- */
function Badge({icon,shape,ifg,size,pad}){
return <div className={"badge "+shape} style={{"--ifg":ifg,width:size,height:size,background:`color-mix(in srgb, ${ifg} 20%, transparent)`,border:`1.5px solid color-mix(in srgb, ${ifg} 45%, transparent)`}}><Icon n={icon} s={pad}/></div>;
}

function App(){
const[t,setTweak]=useTweaks(TWEAK_DEFAULTS);
const[open,setOpen]=useState(false);
const[scene,setScene]=useState('ambient');
const[layout,setLayout]=useState('cards');
const[pattern,setPattern]=useState('aurora');
const[palette,setPalette]=useState('boys');
const[paisleyBase,setPaisleyBase]=useState(PAL.boys.base);
const[paisleyColors,setPaisleyColors]=useState(PAL.boys.colors);
const applyPalette=name=>{setPalette(name);setPaisleyBase(PAL[name].base);setPaisleyColors(PAL[name].colors)};
const[backdrop,setBackdrop]=useState('vstripe');
const[primObj,setPrimObj]=useState('teddy');
const[secObj,setSecObj]=useState('stars');
const[starCount,setStarCount]=useState(200);
const[bubbleCount,setBubbleCount]=useState(24);
const[bubMin,setBubMin]=useState(10);
const[bubMax,setBubMax]=useState(48);
const[auroraRange,setAuroraRange]=useState(50);
const[waveMotion,setWaveMotion]=useState(40);
const[waveRock,setWaveRock]=useState(30);
const[waveVar,setWaveVar]=useState(60);
const[motifRot,setMotifRot]=useState(20);
const[motifMove,setMotifMove]=useState(0);
const[motifSize,setMotifSize]=useState(40);
const[aura,setAura]=useState(true);
const[wake,setWake]=useState(true);
const[full,setFull]=useState(false);
const[hue,setHue]=useState(248);
const[dim,setDim]=useState(46);
const[sat,setSat]=useState(38);
const[trans,setTrans]=useState(58);
const[shape,setShape]=useState('square');
const[iconColor,setIconColor]=useState(null);
const[tiles,setTiles]=useState({feed:true,pump:true,diaper:true,sleep:true});
const{time,date}=useClock(t.clock24);
const on=ACTS.filter(a=>tiles[a.id]);

const isTile=layout==='tiles';
const autoFg=`oklch(0.9 0.11 ${(hue+150)%360})`;
const ifg=iconColor||autoFg;
const cardBg=(0.16-trans/100*0.15).toFixed(3);
const btnBg=(0.2-trans/100*0.16).toFixed(3);
const line=(0.24-trans/100*0.16).toFixed(3);
const stageVars={"--cardbg":cardBg,"--btnbg":btnBg,"--cardline":line,"--btnline":line};

return <div className="stage" style={stageVars}>
<Background scene={scene} pattern={pattern} aura={aura} hue={hue} dim={dim} sat={sat} paisleyBase={paisleyBase} paisleyColors={paisleyColors} backdrop={backdrop} primObj={primObj} secObj={secObj} starCount={starCount} bubbleCount={bubbleCount} bubMin={bubMin} bubMax={bubMax} auroraRange={auroraRange} waveMotion={waveMotion} waveRock={waveRock} waveVar={waveVar} motifRot={motifRot} motifMove={motifMove} motifSize={motifSize}/>
<div className="fg">
<div className="topbar">
<button className="ghost" onClick={()=>setOpen(true)}>Settings</button>
<button className="ghost">Exit</button>
</div>
<div className="center">
<div className="clockwrap">
<div className="clock"><span className="serif time">{time}</span><span className="serif name">{t.babyName}</span></div>
<div className="date">{date}</div>
</div>

{isTile ? (
<div className="tilegrid">
{on.map(a=><button key={a.id} className={"tile "+shape}>
<span className="tico"><Badge icon={a.icon} shape={shape} ifg={ifg} size={82} pad={36}/></span>
<span className="tlabel">{a.label}</span>
<span className="tmeta">{a.time}</span>
</button>)}
</div>
) : (
<div className="grid">
{on.map(a=><div key={a.id} className="card">
<div className="card-h">
<div className="lhs"><Badge icon={a.icon} shape={shape} ifg={ifg} size={54} pad={26}/><h3>{a.label}</h3></div>
<div className="card-meta"><div className="serif t">{a.time}</div><div className="d">{a.detail}</div></div>
</div>
<div className="card-actions">
{a.actions.map(b=><button key={b} className={"abtn"+(a.actions.length===1?' wide':'')}>{b}</button>)}
</div>
</div>)}
</div>
)}
</div>
</div>
<div className="footer">
<div className="m">NURSERY MODE</div>
<div className="l"><span className="dotlock"></span>SCREEN LOCK ACTIVE</div>
</div>

{open&&<Settings {...{setOpen,scene,setScene,layout,setLayout,pattern,setPattern,palette,applyPalette,paisleyBase,setPaisleyBase,paisleyColors,setPaisleyColors,backdrop,setBackdrop,primObj,setPrimObj,secObj,setSecObj,starCount,setStarCount,bubbleCount,setBubbleCount,bubMin,setBubMin,bubMax,setBubMax,auroraRange,setAuroraRange,waveMotion,setWaveMotion,waveRock,setWaveRock,waveVar,setWaveVar,motifRot,setMotifRot,motifMove,setMotifMove,motifSize,setMotifSize,aura,setAura,wake,setWake,full,setFull,hue,setHue,dim,setDim,sat,setSat,trans,setTrans,shape,setShape,iconColor,setIconColor,tiles,setTiles}}/>}

<TweaksPanel>
<TweakSection label="Nursery mode"/>
<TweakText label="Baby name" value={t.babyName} onChange={v=>setTweak('babyName',v)}/>
<TweakToggle label="24-hour clock" value={t.clock24} onChange={v=>setTweak('clock24',v)}/>
<TweakSection label="Tip"/>
<div style={{fontSize:13,lineHeight:1.5,color:'rgba(255,255,255,.6)',padding:'0 2px'}}>Tap <b style={{color:'#fff'}}>Settings</b> on screen to choose a scene &amp; background, tune the dials, and style the icons.</div>
</TweaksPanel>
</div>;
}

const SCENES=[['ambient','Ambient'],['starlit','Starlit'],['tapestry','Tapestry'],['photo','Photo']];
function scenePrev(m,hue){
if(m==='ambient')return patternStyle('aurora',hue);
if(m==='starlit')return {background:`radial-gradient(1px 1px at 22% 34%,#fff,transparent),radial-gradient(1px 1px at 62% 22%,#fff,transparent),radial-gradient(1.4px 1.4px at 78% 60%,#fff,transparent),radial-gradient(1px 1px at 40% 70%,#fff,transparent),radial-gradient(120% 90% at 50% 10%, oklch(0.3 0.09 ${hue}), oklch(0.1 0.05 ${hue}))`};
return {background:`linear-gradient(180deg,oklch(0.3 0.05 ${hue}),oklch(0.16 0.05 ${hue}))`};
}

function RugPrev({file,base,cols,cls}){const url=useRecolored(file,base,cols);return <div className={cls} style={coverStyle(url)}></div>}

function ObjThumb({id,label,base,cols,on,onClick}){
const S=useSheet(spriteFile(id),base,cols);
const pick=useMemo(()=>Math.random(),[id]);
const bx=S&&S.boxes.length?S.boxes[Math.floor(pick*S.boxes.length)]:null;
const ar=bx?(bx.w*S.w)/(bx.h*S.h):1;
return <button className={"patt"+(on?' on':'')} onClick={onClick}><div className="pp" style={{backgroundColor:base,display:'grid',placeItems:'center'}}>{bx&&<div style={{height:'82%',aspectRatio:String(ar.toFixed(3)),backgroundImage:`url(${S.url})`,backgroundSize:`${(100/bx.w).toFixed(2)}% ${(100/bx.h).toFixed(2)}%`,backgroundPosition:`${bx.w<1?(bx.x/(1-bx.w)*100).toFixed(2):0}% ${bx.h<1?(bx.y/(1-bx.h)*100).toFixed(2):0}%`,backgroundRepeat:'no-repeat'}}></div>}</div><div className="pl">{label}</div></button>;
}

function Settings(p){
const setTile=id=>p.setTiles(s=>({...s,[id]:!s[id]}));
const patternMode=p.scene==='ambient';
return <>
<div className="ovl" onClick={()=>p.setOpen(false)}></div>
<div className="drawer">
<div className="dw-h"><h2>Settings</h2><button className="close" onClick={()=>p.setOpen(false)}>Close</button></div>
<div className="dw-b">

<div className="sect">
<div className="slabel">Scene</div>
<div className="scenes">
{SCENES.map(([m,l])=><button key={m} className={"scene"+(p.scene===m?' on':'')} onClick={()=>p.setScene(m)}>
{(m==='tapestry')?(isRug(p.backdrop)?<RugPrev file={rugFile(p.backdrop)} base={p.paisleyBase} cols={p.paisleyColors} cls="prev"/>:<div className="prev" style={backdropStyle(p.backdrop,p.paisleyBase)}></div>):<div className="prev" style={scenePrev(m,p.hue)}>{m==='photo'&&<Icon n="image" s={22}/>}</div>}
<div className="nm">{l}</div>
</button>)}
</div>
</div>

<div className="sect">
<div className="slabel">Layout</div>
<div className="seg">
{[['cards','Cards'],['tiles','Big Tiles']].map(([v,l])=><button key={v} className={p.layout===v?'on':''} onClick={()=>p.setLayout(v)}>{l}</button>)}
</div>
</div>

{patternMode&&<div className="sect">
<div className="slabel">Background</div>
<div className="patts">
{PATTERNS.map(([v,l])=><button key={v} className={"patt"+(p.pattern===v?' on':'')} onClick={()=>p.setPattern(v)}>
<div className="pp" style={patternStyle(v,p.hue)}></div>
<div className="pl">{l}</div>
</button>)}
{SPRITE_TYPES.map(([v,l])=><OutlineThumb key={v} id={v} label={l} hue={p.hue} on={p.pattern==='sprite:'+v} onClick={()=>p.setPattern('sprite:'+v)}/>)}
</div>
{p.pattern==='aurora'&&<>
<div className="slabel" style={{marginTop:18}}>Color range</div>
<input className="srange" style={{background:`linear-gradient(90deg, oklch(0.6 0.15 ${p.hue}), oklch(0.65 0.17 ${(p.hue+60)%360}), oklch(0.65 0.17 ${(p.hue+140)%360}))`}} type="range" min="0" max="100" value={p.auroraRange} onChange={e=>p.setAuroraRange(+e.target.value)}/>
<div className="sval">{p.auroraRange<15?'Subtle':p.auroraRange>80?'Full spectrum':p.auroraRange+'%'}</div>
</>}
{p.pattern==='waves'&&<>
<div className="slabel" style={{marginTop:18}}>Motion</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.waveMotion} onChange={e=>p.setWaveMotion(+e.target.value)}/>
<div className="sval">{p.waveMotion===0?'Still':p.waveMotion+'%'}</div>
<div className="slabel" style={{marginTop:14}}>Rocking</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.waveRock} onChange={e=>p.setWaveRock(+e.target.value)}/>
<div className="sval">{p.waveRock===0?'Steady':p.waveRock+'%'}</div>
<div className="slabel" style={{marginTop:14}}>Wave height variance</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.waveVar} onChange={e=>p.setWaveVar(+e.target.value)}/>
<div className="sval">{p.waveVar===0?'Even rolls':p.waveVar+'%'}</div>
</>}
{p.pattern.startsWith('sprite:')&&<>
<div className="slabel" style={{marginTop:18}}>Rotation</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.motifRot} onChange={e=>p.setMotifRot(+e.target.value)}/>
<div className="sval">{p.motifRot===0?'Upright':p.motifRot+'%'}</div>
<div className="slabel" style={{marginTop:14}}>Movement</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.motifMove} onChange={e=>p.setMotifMove(+e.target.value)}/>
<div className="sval">{p.motifMove===0?'Pattern — static':'Free float '+p.motifMove+'%'}</div>
<div className="slabel" style={{marginTop:14}}>Icon size</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="0" max="100" value={p.motifSize} onChange={e=>p.setMotifSize(+e.target.value)}/>
<div className="sval">{p.motifSize<=2?'Fixed size':'Varied '+p.motifSize+'%'}</div>
</>}
{p.pattern==='bubbles'&&<>
<div className="slabel" style={{marginTop:18}}>Bubbles</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="4" max="80" value={p.bubbleCount} onChange={e=>p.setBubbleCount(+e.target.value)}/>
<div className="sval">{p.bubbleCount} bubbles</div>
<div className="slabel" style={{marginTop:14}}>Min size</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="4" max="80" value={p.bubMin} onChange={e=>p.setBubMin(+e.target.value)}/>
<div className="sval">{p.bubMin}px</div>
<div className="slabel" style={{marginTop:14}}>Max size</div>
<input className="srange" style={{background:'linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.45))'}} type="range" min="10" max="160" value={p.bubMax} onChange={e=>p.setBubMax(+e.target.value)}/>
<div className="sval">{p.bubMax}px</div>
</>}
</div>}

{p.scene==='tapestry'&&<div className="sect">
<div className="slabel">Backdrop</div>
<div className="patts">
{BACKDROPS.map(([v,l])=><button key={v} className={"patt"+(p.backdrop===v?' on':'')} onClick={()=>{p.setBackdrop(v);if(p.primObj===null&&p.secObj===null){p.setPrimObj('teddy');p.setSecObj('stars')}}}>
<div className="pp" style={backdropStyle(v,p.paisleyBase)}></div>
<div className="pl">{l}</div>
</button>)}
{RUG_BACKDROPS.map(([v,l])=><button key={v} className={"patt"+(p.backdrop===v?' on':'')} onClick={()=>{p.setBackdrop(v);p.setPrimObj(null);p.setSecObj(null)}}>
<RugPrev file={rugFile(v)} base={p.paisleyBase} cols={p.paisleyColors} cls="pp"/>
<div className="pl">{l}</div>
</button>)}
</div>
<div className="slabel" style={{marginTop:18}}>Primary object</div>
<div className="patts">
<button className={"patt"+(p.primObj===null?' on':'')} onClick={()=>p.setPrimObj(null)}><div className="pp" style={{background:p.paisleyBase,display:'grid',placeItems:'center',color:'rgba(0,0,0,.45)',fontSize:12,fontWeight:700}}>NONE</div><div className="pl">None</div></button>
{SPRITE_TYPES.map(([v,l])=><ObjThumb key={v} id={v} label={l} base={p.paisleyBase} cols={p.paisleyColors} on={p.primObj===v} onClick={()=>p.setPrimObj(v)}/>)}
</div>
<div className="slabel" style={{marginTop:18}}>Accent object</div>
<div className="patts">
<button className={"patt"+(p.secObj===null?' on':'')} onClick={()=>p.setSecObj(null)}><div className="pp" style={{background:p.paisleyBase,display:'grid',placeItems:'center',color:'rgba(0,0,0,.45)',fontSize:12,fontWeight:700}}>NONE</div><div className="pl">None</div></button>
{SPRITE_TYPES.map(([v,l])=><ObjThumb key={v} id={v} label={l} base={p.paisleyBase} cols={p.paisleyColors} on={p.secObj===v} onClick={()=>p.setSecObj(v)}/>)}
</div>
<div className="slabel" style={{marginTop:18}}>Palette</div>
<div className="seg">
{[['boys','Boys'],['girls','Girls']].map(([v,l])=><button key={v} className={p.palette===v?'on':''} onClick={()=>p.applyPalette(v)}>{l}</button>)}
</div>
<div className="slabel" style={{marginTop:18}}>Base color</div>
<div className="chips">
{BASE_CHIPS[p.palette].map(c=><button key={c} className={"chip"+(p.paisleyBase===c?' on':'')} style={{background:c}} onClick={()=>p.setPaisleyBase(c)}></button>)}
<label className="cwell" style={{background:p.paisleyBase}} title="Custom base"><input type="color" value={p.paisleyBase} onChange={e=>p.setPaisleyBase(e.target.value)}/></label>
</div>
<div className="slabel" style={{marginTop:18}}>Pattern colors</div>
<div className="chips">
{p.paisleyColors.map((c,i)=><label key={i} className="cwell" style={{background:c}}><input type="color" value={c} onChange={e=>{const n=[...p.paisleyColors];n[i]=e.target.value;p.setPaisleyColors(n)}}/></label>)}
</div>
<div style={{fontSize:12.5,color:'rgba(255,255,255,.5)',marginTop:12,lineHeight:1.5}}>Tap a swatch to recolor it — every color is adjustable.</div>
</div>}

{p.scene==='starlit'&&<div className="sect">
<div className="slabel">Starfield</div>
<div className="trow">
<span className="tn"><Icon n="star" s={20}/>Aura</span>
<span style={{display:'flex',alignItems:'center',gap:12}}>
<span className={"tstate"+(p.aura?' on':'')}>{p.aura?'ON':'OFF'}</span>
<button className={"sw-toggle"+(p.aura?' on':'')} onClick={()=>p.setAura(!p.aura)}></button>
</span>
</div>
<div style={{fontSize:12.5,color:'rgba(255,255,255,.5)',marginTop:9,lineHeight:1.5}}>Renders a glowing aurora curtain across the night sky.</div>
<div className="slabel" style={{marginTop:18}}>Star density</div>
<input className="srange" style={{background:`linear-gradient(90deg,#1a2035,#c7d2fe)`}} type="range" min="30" max="400" value={p.starCount} onChange={e=>p.setStarCount(+e.target.value)}/>
<div className="sval">{p.starCount} stars</div>
</div>}

{p.scene==='photo'&&<div className="sect">
<div className="slabel">Photo</div>
<button className="upl uplbtn" style={{marginTop:0}}>
<div className="uplhint"><Icon n="image" s={22}/><span>Drop your photo on the screen</span><code>icons auto-tint to suit it</code></div>
</button>
</div>}

<div className="sect">
<button className={"togcard"+(p.wake?' on':'')} onClick={()=>p.setWake(!p.wake)}>
<div className="k">Screen wake lock</div>
<div className="v">{p.wake?'Active — screen will stay on':'Off — screen may sleep'}</div>
</button>
<button className={"togcard"+(p.full?' on':'')} onClick={()=>p.setFull(!p.full)}>
<div className="k">Fullscreen</div>
<div className="v">{p.full?'Active — immersive':'Inactive — tap to enter'}</div>
</button>
</div>

<div className="sect">
<div className="slabel">Background hue</div>
<input className="srange hue-track" type="range" min="0" max="360" value={p.hue} onChange={e=>p.setHue(+e.target.value)}/>
<div className="sval">{p.hue}°</div>
</div>
<div className="sect">
<div className="slabel">Dim</div>
<input className="srange" style={{background:`linear-gradient(90deg,#0b0d16,oklch(0.7 0.12 ${p.hue}))`}} type="range" min="0" max="100" value={p.dim} onChange={e=>p.setDim(+e.target.value)}/>
<div className="sval">{p.dim}%</div>
</div>
<div className="sect">
<div className="slabel">Saturation</div>
<input className="srange" style={{background:`linear-gradient(90deg,#6b7280,oklch(0.6 0.2 ${p.hue}))`}} type="range" min="0" max="100" value={p.sat} onChange={e=>p.setSat(+e.target.value)}/>
<div className="sval">{p.sat}%</div>
</div>

<div className="sect">
<div className="slabel">Button transparency</div>
<input className="srange" style={{background:`linear-gradient(90deg, oklch(0.7 0.1 ${p.hue}), rgba(255,255,255,.12))`}} type="range" min="0" max="100" value={p.trans} onChange={e=>p.setTrans(+e.target.value)}/>
<div className="sval">{p.trans}%</div>
</div>

<div className="sect">
<div className="slabel">Icon shape</div>
<div className="seg">
{[['circle','Circle'],['square','Square']].map(([v,l])=><button key={v} className={p.shape===v?'on':''} onClick={()=>p.setShape(v)}>{l}</button>)}
</div>
<div className="slabel" style={{marginTop:16}}>Icon color</div>
<div className="swatches">
{ICON_SWATCHES.map((c,i)=>c===null
?<button key="a" className={"sw auto"+(p.iconColor===null?' on':'')} onClick={()=>p.setIconColor(null)}>AUTO</button>
:<button key={i} className={"sw"+(p.iconColor===c?' on':'')} style={{background:c}} onClick={()=>p.setIconColor(c)}/>)}
</div>
</div>

<div className="sect">
<div className="slabel">Activity tiles</div>
{ACTS.map(a=><div key={a.id} className="trow">
<span className="tn"><Icon n={a.icon} s={20}/>{a.label}</span>
<span style={{display:'flex',alignItems:'center',gap:12}}>
<span className={"tstate"+(p.tiles[a.id]?' on':'')}>{p.tiles[a.id]?'ON':'OFF'}</span>
<button className={"sw-toggle"+(p.tiles[a.id]?' on':'')} onClick={()=>setTile(a.id)}></button>
</span>
</div>)}
</div>
</div>
</div>
</>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
