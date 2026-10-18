const ns='http://www.w3.org/2000/svg';
export const money=(v,compact=false,currency='USD',fractionDigits=0)=>!Number.isFinite(v)?'—':(currency==='TWD'?'NT$':'$')+new Intl.NumberFormat(currency==='TWD'?'zh-TW':'en-US',{notation:compact?'compact':'standard',maximumFractionDigits:compact?1:fractionDigits}).format(v);
export const pct=(v,d=1)=>new Intl.NumberFormat('en-US',{style:'percent',minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svgEl(tag,attrs={}){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function init(el){el.classList.remove('empty');el.replaceChildren();const W=Math.max(280,el.clientWidth),H=el.clientHeight;const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img'});el.append(svg);const tip=document.createElement('div');tip.className='chart-tooltip';tip.hidden=true;el.append(tip);return{svg,tip,W,H,L:72,R:18,top:22,bottom:36};}
function text(svg,x,y,str,attrs={}){const e=svgEl('text',{x,y,fill:'#91a2a6','font-size':12,...attrs});e.textContent=str;svg.append(e);return e;}
function line(svg,x1,y1,x2,y2,attrs={}){svg.append(svgEl('line',{x1,y1,x2,y2,stroke:'#e9eeee','stroke-width':1,...attrs}));}
export function fanChart(el,rows,{tails=false,log=false,initial=1,years=50,spending=false,samples=null,onYear=()=>{},inspect=null,currency='USD'}={}){
  const a=init(el),{svg,tip,W,H,L,R,top,bottom}=a;svg.setAttribute('aria-label',spending?'年度實質生活費百分位數':'年度實質資產百分位數');
  rows=rows.filter(r=>r.year<=years);if(!rows.length)return;
  const xmax=Math.max(1,rows.at(-1).year),xmin=rows[0].year;
  const tr=v=>log?Math.log1p(v):v,inv=v=>log?Math.expm1(v):v;
  const max=Math.max(initial, ...rows.map(r=>r.values[tails?6:5]),...(samples?[...samples.best.assets.slice(0,years+1)]:[]));
  const ymax=tr(max)*1.06||1,x=v=>L+(v-xmin)/Math.max(1,xmax-xmin)*(W-L-R),y=v=>H-bottom-tr(v)/ymax*(H-top-bottom);
  for(let i=0;i<=4;i++){const pos=top+i/4*(H-top-bottom);line(svg,L,pos,W-R,pos);text(svg,L-9,pos+3,money(inv(ymax*(1-i/4)),true,currency),{'text-anchor':'end'});}
  for(let yr=xmin;yr<=xmax;yr+=Math.max(1,Math.ceil((xmax-xmin)/5))){text(svg,x(yr),H-9,`${yr}年`,{'text-anchor':'middle'});}
  const path=(arr,index)=>arr.map((r,i)=>`${i?'L':'M'}${x(r.year)},${y(r.values[index])}`).join(' ');
  function band(lo,hi,fill){const d=path(rows,hi)+' '+[...rows].reverse().map(r=>`L${x(r.year)},${y(r.values[lo])}`).join(' ')+' Z';svg.append(svgEl('path',{d,fill,stroke:'none'}));}
  if(!samples){if(tails)band(0,6,'#f0f4f2');band(1,5,'#e4efeb');band(2,4,'#bcdcd2');if(tails){for(const q of [0,6])svg.append(svgEl('path',{d:path(rows,q),fill:'none',stroke:'#aec7be','stroke-width':1,'stroke-dasharray':'3 4'}));}for(const q of [1,5])svg.append(svgEl('path',{d:path(rows,q),fill:'none',stroke:'#b6d0c6','stroke-width':.8}));}
  else {for(const[key,color]of [['best','#8aa7bd'],['worst','#cc8977']]){const d=samples[key].assets.slice(0,years+1).map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');svg.append(svgEl('path',{d,fill:'none',stroke:color,'stroke-width':2}));}text(svg,L+12,top+7,W<500?'依期末選取最好／最差樣本':'最好樣本（藍）／最差樣本（棕）· 依期末資產選取',{fill:'#80969b','font-size':12});}
  svg.append(svgEl('path',{d:path(rows,3),fill:'none',stroke:'#198574','stroke-width':2}));
  const marker=svgEl('line',{x1:0,x2:0,y1:top,y2:H-bottom,stroke:'#75a69b','stroke-width':1,'stroke-dasharray':'3 3',visibility:'hidden'});svg.append(marker);
  const dot=svgEl('circle',{r:3.5,cx:0,cy:0,fill:'#178372',stroke:'#fff','stroke-width':1.5,visibility:'hidden'});svg.append(dot);
  let pinned=false,current=0;
  const show=yr=>{
    current=Math.max(0,Math.min(rows.length-1,Math.round(yr-xmin)));const row=rows[current],px=x(row.year);marker.setAttribute('x1',px);marker.setAttribute('x2',px);marker.setAttribute('visibility','visible');dot.setAttribute('cx',px);dot.setAttribute('cy',y(row.values[3]));dot.setAttribute('visibility','visible');
    let html=`<b>第 ${row.year} 年 · 實質 ${currency}</b>`;
    if(samples){html+=`<div class="tooltip-row"><em>最好樣本</em><span>${money(samples.best.assets[row.year],false,currency)}</span></div><div class="tooltip-row"><em>最差樣本</em><span>${money(samples.worst.assets[row.year],false,currency)}</span></div>`;}
    for(const q of (tails?[6,5,4,3,2,1,0]:[5,4,3,2,1]))html+=`<div class="tooltip-row"><em>P${[1,5,25,50,75,95,99][q]}</em><span>${money(row.values[q],false,currency)}</span></div>`;
    tip.innerHTML=html;tip.hidden=false;tip.style.left=`${Math.min(W-172,Math.max(0,px>W*.6?px-180:px+12))}px`;
  };
  svg.addEventListener('pointermove',e=>{if(pinned)return;const px=(e.clientX-svg.getBoundingClientRect().left)/svg.getBoundingClientRect().width*W;const yr=xmin+(px-L)/(W-L-R)*(xmax-xmin);show(yr);onYear(rows[current].year);});
  svg.addEventListener('pointerleave',()=>{if(!pinned){tip.hidden=true;marker.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');}});
  svg.addEventListener('click',()=>{pinned=!pinned;});
  el.tabIndex=0;el.setAttribute('aria-label','互動圖表，使用左右方向鍵查看年度值，Escape 關閉提示');el.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(rows[current].year+(e.key==='ArrowRight'?1:-1));onYear(rows[current].year);}if(e.key==='Escape'){tip.hidden=true;pinned=false;}};
  if(inspect!==null)show(inspect);
}
export function barChart(el,bins,{formatX=x=>String(x),formatY=x=>pct(x),N=1,xlabel='',reference=null}={}){
  const{svg,tip,W,H,L,R,top,bottom}=init(el);const ymax=Math.max(.01,...bins.map(b=>b.count/N))*1.1,iw=(W-L-R)/Math.max(1,bins.length);
  svg.setAttribute('aria-label',xlabel||'分布直條圖');
  for(let i=0;i<=3;i++){const yy=top+i/3*(H-top-bottom);line(svg,L,yy,W-R,yy);text(svg,L-9,yy+3,formatY(ymax*(1-i/3)),{'text-anchor':'end'});}
  bins.forEach((b,i)=>{const value=b.count/N,hh=value/ymax*(H-top-bottom);const rect=svgEl('rect',{x:L+i*iw+1,y:H-bottom-hh,width:Math.max(1,iw-2),height:Math.max(value?1:0,hh),rx:1.5,fill:'#8fbaae'});svg.append(rect);rect.addEventListener('pointerenter',()=>{rect.setAttribute('fill','#2c8d79');tip.innerHTML=`<b>${esc(formatX(b.low))}${b.high!==undefined?' – '+esc(formatX(b.high)):''}</b><div>${b.count.toLocaleString()} 條路徑 · ${pct(value,2)}</div>`;tip.hidden=false;tip.style.left=`${Math.min(W-172,L+i*iw)}px`;});rect.addEventListener('pointerleave',()=>{rect.setAttribute('fill','#8fbaae');tip.hidden=true;});if(i%Math.max(1,Math.ceil(bins.length/Math.max(2,Math.floor((W-L-R)/90))))===0)text(svg,L+i*iw+iw/2,H-9,formatX(b.low),{'text-anchor':'middle','font-size':12});});
  if(reference!==null)text(svg,W-R,top,reference,{'text-anchor':'end'});
}
