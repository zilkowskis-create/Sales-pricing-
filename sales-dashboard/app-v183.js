(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v181.js?base=2026091711',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.11')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.11','2026.09.17.12');
    (0,eval)(src);

    const euro=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const pctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const n=v=>Number.isFinite(Number(v))?Number(v):0;
    const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();
    const good=v=>n(v)>=0?'good':'bad';
    const signed=(fmt,v)=>(n(v)>=0?'+':'')+fmt.format(n(v));
    let undercar={mtd:0,oe:0,o1:0,forecast:0,plan:0,gap:0};
    let collisionRows=[],collisionPeriod={year:null,month:null};

    function renderUndercar(){
      const box=document.getElementById('undercarOverview'); if(!box)return;
      const attain=undercar.plan?undercar.forecast/undercar.plan:null;
      box.innerHTML=`
        <div class="execKpi"><span>Sales MTD</span><b>${euro.format(undercar.mtd)}</b></div>
        <div class="execKpi"><span>Order Entered</span><b>${euro.format(undercar.oe)}</b></div>
        <div class="execKpi"><span>Backlog Ord1</span><b>${euro.format(undercar.o1)}</b></div>
        <div class="execKpi emphasis"><span>Forecast</span><b>${euro.format(undercar.forecast)}</b></div>
        <div class="execKpi"><span>Monthly Target</span><b>${euro.format(undercar.plan)}</b></div>
        <div class="execKpi"><span>Gap vs Target</span><b class="${good(undercar.gap)}">${signed(euro,undercar.gap)}</b></div>
        <div class="execKpi"><span>Target %</span><b class="${attain!=null&&attain>=1?'good':'bad'}">${attain==null?'—':pctFmt.format(attain)}</b></div>`;
    }

    function headerInfo(rows,required){
      const rowIndex=rows.findIndex(row=>required.every(key=>row.some(v=>norm(v)===norm(key))));
      if(rowIndex<0) throw new Error('Expected Undercar columns not found');
      const map={};rows[rowIndex].forEach((v,i)=>map[norm(v)]=i);return{rowIndex,map};
    }
    function val(row,map,name){const i=map[norm(name)];return i===undefined?'':row[i];}
    function parseUndercarRows(rows){
      const {rowIndex,map}=headerInfo(rows,['Sales Office','Country']);
      const keep=new Set(['Bernardi F','Zilkowski S.','Mindaugas Deikus','Sollano R.']);
      let office='',manager='';const t={mtd:0,oe:0,o1:0,forecast:0,plan:0,gap:0};
      for(let i=rowIndex+1;i<rows.length;i++){
        const r=rows[i];
        if(val(r,map,'Sales Office')) office=String(val(r,map,'Sales Office')).trim();
        if(val(r,map,'Sales Manager')) manager=String(val(r,map,'Sales Manager')).trim();
        const country=String(val(r,map,'Country')).trim();
        if(office!=='Zilkowski S.'||!keep.has(manager)||!country||/^sum$/i.test(country))continue;
        t.oe+=n(val(r,map,'Order_entered'));
        t.mtd+=n(val(r,map,'Sales MTD - invoiced'));
        t.o1+=n(val(r,map,'Backlog - ord1'));
        t.plan+=n(val(r,map,'Plan'));
      }
      t.forecast=t.mtd+t.o1;t.gap=t.forecast-t.plan;return t;
    }
    async function loadUndercarSnapshot(){
      try{
        const r=await fetch('./snapshot.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;
        const j=await r.json(),t={mtd:0,oe:0,o1:0,forecast:0,plan:0,gap:0};
        for(const x of (j.rows||[])){t.mtd+=n(x.mtd);t.oe+=n(x.oe);t.o1+=n(x.o1);t.plan+=n(x.plan);}
        t.forecast=t.mtd+t.o1;t.gap=t.forecast-t.plan;undercar=t;renderUndercar();
        const s=document.getElementById('overviewUndercarSource');if(s)s.textContent='Snapshot · '+(j.snapshotDate||'latest');
      }catch{}
    }
    document.getElementById('file')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        const buf=await file.arrayBuffer();
        const parsed=globalThis.XLSBIFF8?.parseSheetRows(buf,'Totals - Country');
        if(parsed){undercar=parseUndercarRows(parsed.rows);renderUndercar();const s=document.getElementById('overviewUndercarSource');if(s)s.textContent='Loaded · '+file.name;}
      }catch(err){console.error('Overview Undercar parse',err);}
    });

    const BRAND_ORDER=['Josam','Car-O-Liner','BlackHawk'];
    const BALTICS_SOUTH=new Set(['Lithuania','Latvia','Estonia','Greece','Cyprus']);
    const JOSAM_EXCLUDED=new Set(['Austria','Czechia','Slovakia']);
    const brandOf=v=>{const s=String(v||'').trim().toLowerCase();if(s==='josam')return'Josam';if(s==='car-o-liner'||s==='caroliner')return'Car-O-Liner';if(s==='blackhawk'||s==='black hawk')return'BlackHawk';return null};
    function ownerFor(r){
      const b=brandOf(r.Brand),c=String(r.CtyDes||r.Country||'').trim(),d=String(r.Director||'').trim();
      if(!b||!c)return null;if(b==='Josam'&&JOSAM_EXCLUDED.has(c))return null;
      if(d==='Export')return'Ruslan Sollano';if(d!=='Europe East')return null;
      if(c==='Austria')return b==='Josam'?null:'Sergej';if(BALTICS_SOUTH.has(c))return'Mindaugas Deikus';if(c==='Bulgaria')return'Ruslan Sollano';return'Michal Adamiec';
    }
    async function ensureXlsx(){if(globalThis.XLSX)return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=res;s.onerror=()=>rej(new Error('XLSX reader could not be loaded'));document.head.appendChild(s);});}
    function collisionMetric(rows){
      const aop=`${collisionPeriod.year} AOP`,cm=collisionPeriod.month,cy=collisionPeriod.year;let target=0,actual=0,o0=0,o1=0;
      for(const r of rows){if(r.year!==cy||r.month!==cm)continue;if(r.status===aop)target+=r.value;else if(r.status==='Actual')actual+=r.value;else if(r.status==='Ord0')o0+=r.value;else if(r.status==='Ord1')o1+=r.value;}
      const forecast=actual+o0+o1,gap=forecast-target;return{target,actual,o0,o1,forecast,gap,attain:target?forecast/target:null};
    }
    function addMetric(a,b){const x={};for(const k of ['target','actual','o0','o1','forecast','gap'])x[k]=n(a[k])+n(b[k]);x.attain=x.target?x.forecast/x.target:null;return x;}
    function collisionRow(label,x,total=false){return `<tr class="${total?'brandTotal':''}"><td><b>${label}</b></td><td class="num">${usd.format(x.target)}</td><td class="num">${usd.format(x.actual)}</td><td class="num">${usd.format(x.o0)}</td><td class="num">${usd.format(x.o1)}</td><td class="num"><b>${usd.format(x.forecast)}</b></td><td class="num ${good(x.gap)}"><b>${signed(usd,x.gap)}</b></td><td class="num ${x.attain!=null&&x.attain>=1?'good':'bad'}"><b>${x.attain==null?'—':pctFmt.format(x.attain)}</b></td></tr>`;}
    function renderCollision(){
      const total=collisionMetric(collisionRows),box=document.getElementById('collisionOverview');
      if(box)box.innerHTML=`
        <div class="execKpi"><span>Actual</span><b>${usd.format(total.actual)}</b></div>
        <div class="execKpi"><span>Ord0</span><b>${usd.format(total.o0)}</b></div>
        <div class="execKpi"><span>Ord1</span><b>${usd.format(total.o1)}</b></div>
        <div class="execKpi emphasis"><span>Forecast</span><b>${usd.format(total.forecast)}</b></div>
        <div class="execKpi"><span>Monthly AOP</span><b>${usd.format(total.target)}</b></div>
        <div class="execKpi"><span>Gap vs AOP</span><b class="${good(total.gap)}">${signed(usd,total.gap)}</b></div>
        <div class="execKpi"><span>AOP %</span><b class="${total.attain!=null&&total.attain>=1?'good':'bad'}">${total.attain==null?'—':pctFmt.format(total.attain)}</b></div>`;
      const body=document.getElementById('collisionBrandBody');if(body){const bm={};for(const b of BRAND_ORDER)bm[b]=collisionMetric(collisionRows.filter(r=>r.brand===b));body.innerHTML=collisionRow('JOSAM',bm['Josam'])+collisionRow('Car-O-Liner',bm['Car-O-Liner'])+collisionRow('BlackHawk',bm['BlackHawk'])+collisionRow('COL + BlackHawk TOTAL',addMetric(bm['Car-O-Liner'],bm['BlackHawk']),true);}
      const p=document.getElementById('collisionPeriod');if(p&&collisionPeriod.year)p.textContent=['','January','February','March','April','May','June','July','August','September','October','November','December'][collisionPeriod.month]+' '+collisionPeriod.year;
    }
    async function loadCollision(file){
      const s=document.getElementById('overviewCollisionSource');
      try{
        if(s)s.textContent='Reading '+file.name+'…';await ensureXlsx();const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array',dense:true,cellDates:false,sheets:['_002_TableCreation']});const ws=wb.Sheets['_002_TableCreation'];if(!ws)throw new Error('Sheet _002_TableCreation not found');
        const rows=XLSX.utils.sheet_to_json(ws,{defval:null,raw:true});let y=-Infinity,m=-Infinity;
        for(const r of rows){if(String(r['Sales Status']||'')!=='Actual'||!ownerFor(r))continue;const yy=n(r.SnaponYear),mm=n(r.SnaponMonth);if(yy>y||(yy===y&&mm>m)){y=yy;m=mm;}}
        if(!Number.isFinite(y)||!Number.isFinite(m))throw new Error('Current Collision month not found');collisionPeriod={year:y,month:m};
        const aop=`${y} AOP`;collisionRows=[];
        for(const r of rows){const st=String(r['Sales Status']||''),yy=n(r.SnaponYear),mm=n(r.SnaponMonth),b=brandOf(r.Brand),owner=ownerFor(r);if(!b||!owner||![aop,'Actual','Ord0','Ord1'].includes(st))continue;collisionRows.push({brand:b,status:st,year:yy,month:mm,value:n(r['Net Price Extended'])});}
        if(s)s.textContent='Loaded · '+file.name;renderCollision();
      }catch(err){console.error(err);if(s)s.textContent='Load error · '+(err?.message||String(err));}
    }
    document.getElementById('collisionLoad')?.addEventListener('click',()=>document.getElementById('collisionFile')?.click());
    document.getElementById('collisionFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadCollision(f);e.target.value='';});

    renderUndercar();renderCollision();loadUndercarSnapshot();
  }catch(e){
    console.error(e);
    if(status) status.textContent='App load error: '+(e?.message||String(e));
  }
})();
