(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v183.js?base=2026091712',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    const from="src=src.replace('2026.09.17.11','2026.09.17.12');";
    const to="src=src.replace('2026.09.17.11','2026.09.17.13');";
    if(!src.includes(from)) throw new Error('Version upgrade point not found');
    src=src.replace(from,to);
    (0,eval)(src);

    const BRAND_ORDER=['Josam','Car-O-Liner','BlackHawk'];
    const MANAGER_ORDER=['Sergej','Mindaugas Deikus','Ruslan Sollano','Michal Adamiec'];
    const BALTICS_SOUTH=new Set(['Lithuania','Latvia','Estonia','Greece','Cyprus']);
    const JOSAM_EXCLUDED=new Set(['Austria','Czechia','Slovakia']);
    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const pctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const n=v=>Number.isFinite(Number(v))?Number(v):0;
    const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const signed=v=>(n(v)>=0?'+':'')+usd.format(n(v));
    const gapClass=v=>n(v)>=0?'good':'bad';
    const monthName=m=>['','January','February','March','April','May','June','July','August','September','October','November','December'][m]||String(m||'');
    const brandOf=v=>{const s=String(v||'').trim().toLowerCase();if(s==='josam')return'Josam';if(s==='car-o-liner'||s==='caroliner')return'Car-O-Liner';if(s==='blackhawk'||s==='black hawk')return'BlackHawk';return null};
    let detailRows=[],period={year:null,month:null};

    function ownerFor(r){
      const b=brandOf(r.Brand),c=String(r.CtyDes||r.Country||'').trim(),d=String(r.Director||'').trim();
      if(!b||!c)return null;
      if(b==='Josam'&&JOSAM_EXCLUDED.has(c))return null;
      if(d==='Export')return'Ruslan Sollano';
      if(d!=='Europe East')return null;
      if(c==='Austria')return b==='Josam'?null:'Sergej';
      if(BALTICS_SOUTH.has(c))return'Mindaugas Deikus';
      if(c==='Bulgaria')return'Ruslan Sollano';
      return'Michal Adamiec';
    }
    async function ensureXlsx(){
      if(globalThis.XLSX)return;
      const existing=[...document.scripts].find(s=>/xlsx(\.full)?\.min\.js/i.test(s.src||''));
      if(existing){await new Promise((res,rej)=>{if(globalThis.XLSX)return res();existing.addEventListener('load',res,{once:true});existing.addEventListener('error',()=>rej(new Error('XLSX reader could not be loaded')),{once:true});});return;}
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=res;s.onerror=()=>rej(new Error('XLSX reader could not be loaded'));document.head.appendChild(s);});
    }
    function metric(rows){
      const aop=`${period.year} AOP`,act=`${period.year} ACT`,cm=period.month,cy=period.year;
      let aopM=0,actual=0,o0=0,o1=0,aopY=0,closed=0;
      for(const r of rows){
        if(r.year!==cy)continue;
        if(r.status===aop){if(r.month===cm)aopM+=r.value;if(r.month<=cm)aopY+=r.value;}
        else if(r.status===act&&r.month<cm)closed+=r.value;
        else if(r.status==='Actual'&&r.month===cm)actual+=r.value;
        else if(r.status==='Ord0'&&r.month===cm)o0+=r.value;
        else if(r.status==='Ord1'&&r.month===cm)o1+=r.value;
      }
      const forecast=actual+o0+o1,ytdActual=closed+actual,ytdForecast=ytdActual+o0+o1;
      return{aopM,actual,o0,o1,forecast,gapM:forecast-aopM,aopY,ytdActual,ytdForecast,gapY:ytdForecast-aopY};
    }
    function add(a,b){const o={};for(const k of ['aopM','actual','o0','o1','forecast','gapM','aopY','ytdActual','ytdForecast','gapY'])o[k]=n(a[k])+n(b[k]);return o;}
    function row(label,b,x,cls=''){
      return `<tr class="${cls}"><td>${safe(label)}</td><td><span class="tag">${safe(b)}</span></td><td class="num sepM">${usd.format(x.aopM)}</td><td class="num">${usd.format(x.actual)}</td><td class="num">${usd.format(x.o0)}</td><td class="num">${usd.format(x.o1)}</td><td class="num"><b>${usd.format(x.forecast)}</b></td><td class="num ${gapClass(x.gapM)}"><b>${signed(x.gapM)}</b></td><td class="num sepY">${usd.format(x.aopY)}</td><td class="num">${usd.format(x.ytdActual)}</td><td class="num"><b>${usd.format(x.ytdForecast)}</b></td><td class="num ${gapClass(x.gapY)}"><b>${signed(x.gapY)}</b></td></tr>`;
    }
    function head(){
      return `<tr class="collisionGroupHead"><th colspan="2">SCOPE</th><th colspan="6" class="month">${monthName(period.month).toUpperCase()} ${period.year}</th><th colspan="4" class="year">YTD ${period.year}</th></tr><tr><th>Owner / Country</th><th>Brand</th><th class="num sepM">AOP</th><th class="num">Actual</th><th class="num">Ord0</th><th class="num">Ord1</th><th class="num">Forecast</th><th class="num">Gap</th><th class="num sepY">AOP YTD</th><th class="num">Actual YTD</th><th class="num">Forecast YTD</th><th class="num">Gap YTD</th></tr>`;
    }
    function render(){
      if(!detailRows.length)return;
      const mgr=document.getElementById('collisionManagerDetail')?.value||'ALL',br=document.getElementById('collisionBrandDetail')?.value||'ALL';
      const f=detailRows.filter(r=>(mgr==='ALL'||r.manager===mgr)&&(br==='ALL'||r.brand===br));
      const t=metric(f),k=document.getElementById('collisionDetailKpis');
      if(k)k.innerHTML=`<div class="card miniKpi"><div class="label">Month AOP</div><div class="value">${usd.format(t.aopM)}</div></div><div class="card miniKpi"><div class="label">Actual</div><div class="value">${usd.format(t.actual)}</div></div><div class="card miniKpi"><div class="label">Ord0 + Ord1</div><div class="value">${usd.format(t.o0+t.o1)}</div></div><div class="card miniKpi"><div class="label">Month Forecast</div><div class="value">${usd.format(t.forecast)}</div><div class="muted ${gapClass(t.gapM)}">${signed(t.gapM)} vs AOP</div></div><div class="card miniKpi"><div class="label">YTD Forecast</div><div class="value">${usd.format(t.ytdForecast)}</div></div><div class="card miniKpi"><div class="label">YTD Gap</div><div class="value ${gapClass(t.gapY)}">${signed(t.gapY)}</div><div class="muted">vs ${usd.format(t.aopY)} AOP</div></div>`;
      const bt=document.getElementById('collisionDetailBrandTable');
      if(bt){bt.querySelector('thead').innerHTML=head();let bh='',bm={};for(const b of BRAND_ORDER){bm[b]=metric(f.filter(r=>r.brand===b));bh+=row('Europe East',b,bm[b]);}bh+=row('Europe East','COL + BlackHawk',add(bm['Car-O-Liner'],bm['BlackHawk']),'total');bt.querySelector('tbody').innerHTML=bh;}
      const dt=document.getElementById('collisionDetailTable');
      if(dt){dt.querySelector('thead').innerHTML=head();let dh='';for(const m of (mgr==='ALL'?MANAGER_ORDER:[mgr])){const mr=f.filter(r=>r.manager===m);if(!mr.length)continue;dh+=`<tr class="mgr"><td colspan="12">${safe(m)}</td></tr>`;for(const c of [...new Set(mr.map(r=>r.country))].sort()){const cr=mr.filter(r=>r.country===c);for(const b of (br==='ALL'?BRAND_ORDER:[br]).filter(b=>cr.some(r=>r.brand===b)))dh+=row(c,b,metric(cr.filter(r=>r.brand===b)));}dh+=row(m,'TOTAL',metric(mr),'total');}dt.querySelector('tbody').innerHTML=dh||'<tr><td colspan="12">No matching data</td></tr>';}
      const src=document.getElementById('collisionDetailSource');if(src)src.textContent=`${monthName(period.month)} ${period.year} · USD`;
    }
    async function loadDetail(file){
      const src=document.getElementById('collisionDetailSource');
      try{
        if(src)src.textContent='Reading '+file.name+'…';
        await ensureXlsx();const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array',dense:true,cellDates:false,sheets:['_002_TableCreation']});const ws=wb.Sheets['_002_TableCreation'];if(!ws)throw new Error('Sheet _002_TableCreation not found');
        const rows=XLSX.utils.sheet_to_json(ws,{defval:null,raw:true});let y=-Infinity,m=-Infinity;
        for(const r of rows){if(String(r['Sales Status']||'')!=='Actual'||!ownerFor(r))continue;const yy=n(r.SnaponYear),mm=n(r.SnaponMonth);if(yy>y||(yy===y&&mm>m)){y=yy;m=mm;}}
        if(!Number.isFinite(y)||!Number.isFinite(m))throw new Error('Current Collision month not found');period={year:y,month:m};
        const aop=`${y} AOP`,act=`${y} ACT`;detailRows=[];
        for(const r of rows){const st=String(r['Sales Status']||''),yy=n(r.SnaponYear),mm=n(r.SnaponMonth),b=brandOf(r.Brand),manager=ownerFor(r);if(!b||!manager||![aop,act,'Actual','Ord0','Ord1'].includes(st))continue;detailRows.push({manager,country:String(r.CtyDes||r.Country||'').trim(),brand:b,status:st,year:yy,month:mm,value:n(r['Net Price Extended'])});}
        if(src)src.textContent=`Loaded · ${file.name} · ${monthName(m)} ${y}`;render();
      }catch(e){console.error(e);if(src)src.textContent='Load error · '+(e?.message||String(e));}
    }
    const cf=document.getElementById('collisionFile');
    cf?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadDetail(f);},true);
    document.getElementById('collisionManagerDetail')?.addEventListener('change',render);
    document.getElementById('collisionBrandDetail')?.addEventListener('change',render);
  }catch(e){console.error(e);if(status)status.textContent='App load error: '+(e?.message||String(e));}
})();
