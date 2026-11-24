(async()=>{
  'use strict';
  const UI_VERSION='2026.09.17.42';
  const status=document.getElementById('status');
  const nativeFetch=window.fetch.bind(window);

  const pageUrl=new URL(location.href);
  const requestedVersion=pageUrl.searchParams.get('v')||pageUrl.searchParams.get('version');
  if(requestedVersion&&requestedVersion!==UI_VERSION){
    try{
      const r=await nativeFetch('./app-v189.js?force='+encodeURIComponent(requestedVersion)+'&ts='+Date.now(),{cache:'no-store'});
      if(r.ok){
        const fresh=await r.text();
        if(fresh.includes("const UI_VERSION='"+requestedVersion+"'")){
          await (0,eval)(fresh);
          return;
        }
      }
    }catch(e){console.warn('Fresh dashboard bootstrap could not be loaded',e);}
  }

  const realFetch=nativeFetch;

  function patchCompatibility(code){
    let out=String(code||'')
      .replace(/throw new Error\('Version upgrade point not found'\)/g,"console.warn('Version marker mismatch - continuing')");
    out=out.replace(/loadSnapshot\(\);\s*checkUpdate\(\);\s*setInterval\(checkUpdate,\s*300000\);/g,'loadSnapshot();');
    out=out.replace(/checkUpdate\(\);\s*setInterval\(checkUpdate,\s*300000\);/g,'');
    out=out.replace(/if\(!b\|\|!c\)return null;/g,"if(!b||!c)return null;if(/^japan$/i.test(c))return null;");
    return out;
  }

  window.fetch=async function(input,init){
    const res=await realFetch(input,init);
    try{
      const raw=typeof input==='string'?input:(input?.url||'');
      const url=new URL(raw,location.href);
      const isLayer=/\/app-v\d+(?:-core)?\.js$/i.test(url.pathname)||/\/app-v184-base\.js$/i.test(url.pathname)||/\/app\.js$/i.test(url.pathname);
      if(!isLayer)return res;
      const text=patchCompatibility(await res.text());
      return new Response(text,{status:res.status,statusText:res.statusText,headers:res.headers});
    }catch(e){
      console.warn('Compatibility layer skipped',e);
      return res;
    }
  };

  const DB_NAME='east-europe-sales-dashboard',DB_VERSION=1,STORE='files';
  const manualUpload={undercar:false,collision:false};
  function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function saveFile(key,file){
    if(!file)return;
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        const store=tx.objectStore(STORE);
        store.delete(key);
        store.put({blob:file,name:file.name,type:file.type,lastModified:file.lastModified,savedAt:Date.now()},key);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
      db.close();
      try{localStorage.setItem('sales-dashboard-latest-'+key,JSON.stringify({name:file.name,lastModified:file.lastModified,savedAt:Date.now()}));}catch{}
    }catch(e){console.warn(key+' file could not be cached',e);}
  }
  async function getFile(key,fallbackName,type){try{const db=await openDb();const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});db.close();if(!rec?.blob)return null;return new File([rec.blob],rec.name||fallbackName,{type:rec.type||type,lastModified:rec.lastModified||Date.now()});}catch(e){return null;}}
  async function restoreInput(id,key,fallbackName,type){
    if(manualUpload[key])return;
    const input=document.getElementById(id);
    if(!input||input.files?.length)return;
    const file=await getFile(key,fallbackName,type);
    if(!file||manualUpload[key])return;
    try{
      const dt=new DataTransfer();
      dt.items.add(file);
      input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){console.warn(key+' automatic restore not supported',e);}
  }

  try{
    let core=await realFetch('./app-v189-core.js?hotfix=2026112042&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Dashboard core could not be loaded');return r.text();});
    core=patchCompatibility(core);
    await (0,eval)(core);

    // Monthly Overview: use the same KPI labels for both business lines.
    let monthlyLabelScheduled=false;
    function normalizeMonthlyOverviewLabels(){
      const overview=document.getElementById('overview');
      if(!overview)return;
      const replacements=new Map([
        ['actual','Sales MTD'],
        ['orders','Backlog Ord1'],
        ['ord0 + ord1','Backlog Ord1'],
        ['monthly target','Target'],
        ['month target','Target'],
        ['monthly aop','Target'],
        ['month aop','Target'],
        ['aop','Target'],
        ['gap vs aop','Gap vs Target'],
        ['aop %','Target %']
      ]);
      for(const el of overview.querySelectorAll('.execKpi span,.brandMini th,.label,.goalTitle')){
        const txt=(el.textContent||'').trim().toLowerCase();
        const next=replacements.get(txt);
        if(next)el.textContent=next;
      }
    }
    function scheduleMonthlyOverviewLabels(){
      if(monthlyLabelScheduled)return;
      monthlyLabelScheduled=true;
      requestAnimationFrame(()=>{
        monthlyLabelScheduled=false;
        normalizeMonthlyOverviewLabels();
      });
    }
    const overviewPane=document.getElementById('overview');
    if(overviewPane)new MutationObserver(scheduleMonthlyOverviewLabels).observe(overviewPane,{childList:true,subtree:true,characterData:true});
    document.querySelector('.tab[data-tab="overview"]')?.addEventListener('click',()=>setTimeout(scheduleMonthlyOverviewLabels,60));
    setTimeout(scheduleMonthlyOverviewLabels,200);
    setTimeout(scheduleMonthlyOverviewLabels,900);

    // Compact, collapsible Brand Performance below the sales KPIs.
    const brandPerfStyle=document.createElement('style');
    brandPerfStyle.textContent=`
      .brandPerf{border-top:1px solid #edf0f2;background:#fbfcfd}
      .brandPerfHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 13px;cursor:pointer;user-select:none}
      .brandPerfTitle{display:flex;align-items:baseline;gap:8px;min-width:0}
      .brandPerfTitle b{font-size:11px;text-transform:uppercase;letter-spacing:.045em}
      .brandPerfTitle span{font-size:9px;color:#7b8189;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .brandPerfToggle{border:1px solid #d9dde2;background:#fff;border-radius:6px;padding:3px 8px;font-size:9px;font-weight:800;color:#4f555d;cursor:pointer}
      .brandPerfBody{padding:0 13px 10px}
      .brandPerf.collapsed .brandPerfBody{display:none}
      .brandPerfRows{display:grid;gap:5px}
      .brandPerfRow{display:grid;grid-template-columns:minmax(105px,150px) minmax(160px,1fr) 112px 58px;gap:10px;align-items:center;min-height:24px}
      .brandPerfName{font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .brandPerfTrack{height:8px;background:#e8ebee;border-radius:99px;overflow:hidden;display:flex}
      .brandPerfSales{height:100%;background:var(--red)}
      .collisionBlock .brandPerfSales{background:var(--blue)}
      .brandPerfBacklog{height:100%;background:#9ca3ab}
      .brandPerfValue{text-align:right;font-size:10px;font-weight:800;font-variant-numeric:tabular-nums}
      .brandPerfPct{text-align:right;font-size:9.5px;font-weight:850;color:#69717a;font-variant-numeric:tabular-nums}
      .brandPerfLegend{display:flex;justify-content:flex-end;gap:12px;padding-top:6px;font-size:8.5px;color:#7b8189}
      .brandPerfLegend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:-1px}
      .brandPerfLegend .sales i{background:var(--red)}
      .collisionBlock .brandPerfLegend .sales i{background:var(--blue)}
      .brandPerfLegend .backlog i{background:#9ca3ab}
      .brandPerfEmpty{font-size:10px;color:#7b8189;padding:4px 0}
      #overview .brandMini{display:none!important}
      @media(max-width:700px){.brandPerfRow{grid-template-columns:90px 1fr 85px}.brandPerfPct{display:none}.brandPerfTitle span{display:none}}
    `;
    document.head.appendChild(brandPerfStyle);

    const eurBrand=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const usdBrand=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const brandPct=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    let undercarBrandFile=null;
    let undercarBrandKey='';
    let undercarBrandRows=[];
    let undercarBrandLoading=false;

    function brandStateKey(kind){return 'sales-dashboard-brand-performance-'+kind;}
    function brandCollapsed(kind){try{return localStorage.getItem(brandStateKey(kind))!=='open';}catch{return true;}}
    function saveBrandCollapsed(kind,collapsed){try{localStorage.setItem(brandStateKey(kind),collapsed?'closed':'open');}catch{}}

    function createBrandPanel(kind,anchor,subtitle){
      if(!anchor)return null;
      let panel=document.getElementById(kind+'BrandPerformance');
      if(panel)return panel;
      panel=document.createElement('section');
      panel.id=kind+'BrandPerformance';
      panel.className='brandPerf'+(brandCollapsed(kind)?' collapsed':'');
      panel.innerHTML=`<div class="brandPerfHead"><div class="brandPerfTitle"><b>Brand Performance</b><span>${subtitle}</span></div><button type="button" class="brandPerfToggle">${brandCollapsed(kind)?'Show':'Hide'}</button></div><div class="brandPerfBody"><div class="brandPerfEmpty">${kind==='undercar'?'Open to load brand data.':'Load Collision data to show brands.'}</div></div>`;
      anchor.insertAdjacentElement('afterend',panel);
      const toggle=()=>{
        const collapsed=panel.classList.toggle('collapsed');
        panel.querySelector('.brandPerfToggle').textContent=collapsed?'Show':'Hide';
        saveBrandCollapsed(kind,collapsed);
        if(!collapsed){
          if(kind==='undercar')ensureUndercarBrandData();
          else renderCollisionBrandPerformance();
        }
      };
      panel.querySelector('.brandPerfHead')?.addEventListener('click',e=>{if(e.target.closest('.brandPerfToggle'))return;toggle();});
      panel.querySelector('.brandPerfToggle')?.addEventListener('click',toggle);
      return panel;
    }

    function ensureBrandPanels(){
      const u=createBrandPanel('undercar',document.getElementById('undercarOverview'),'Sales MTD + Backlog Ord1 · forecast share');
      const c=createBrandPanel('collision',document.getElementById('collisionOverview'),'Sales MTD + Backlog Ord1 · target attainment');
      if(u&&!u.classList.contains('collapsed'))ensureUndercarBrandData();
      if(c&&!c.classList.contains('collapsed'))renderCollisionBrandPerformance();
    }

    function renderBrandRows(kind,rows,fmt,mode='share'){
      const panel=document.getElementById(kind+'BrandPerformance');
      const body=panel?.querySelector('.brandPerfBody');
      if(!body)return;
      if(!rows?.length){body.innerHTML='<div class="brandPerfEmpty">No brand data available for the current month.</div>';return;}
      const maxForecast=Math.max(...rows.map(r=>Math.max(0,r.forecast)),1);
      const totalForecast=rows.reduce((s,r)=>s+Math.max(0,r.forecast),0)||1;
      body.innerHTML=`<div class="brandPerfRows">${rows.map(r=>{
        const sales=Math.max(0,r.sales||0),backlog=Math.max(0,r.backlog||0),forecast=Math.max(0,r.forecast||0);
        const overall=Math.min(100,forecast/maxForecast*100);
        const salesW=forecast?overall*(sales/forecast):0;
        const backlogW=forecast?overall*(backlog/forecast):0;
        const pct=mode==='target'?(r.target?forecast/r.target:null):forecast/totalForecast;
        const pctText=pct==null?'—':brandPct.format(pct);
        const pctClass=mode==='target'&&pct>=1?'good':(mode==='target'?'bad':'');
        return `<div class="brandPerfRow"><div class="brandPerfName" title="${String(r.name).replace(/"/g,'&quot;')}">${r.name}</div><div class="brandPerfTrack"><div class="brandPerfSales" style="width:${salesW}%"></div><div class="brandPerfBacklog" style="width:${backlogW}%"></div></div><div class="brandPerfValue">${fmt.format(r.forecast)}</div><div class="brandPerfPct ${pctClass}">${pctText}</div></div>`;
      }).join('')}</div><div class="brandPerfLegend"><span class="sales"><i></i>Sales MTD</span><span class="backlog"><i></i>Backlog Ord1</span></div>`;
    }

    function compactTopBrands(rows,limit=5){
      const list=[...rows].filter(r=>r.forecast!==0||r.sales!==0||r.backlog!==0).sort((a,b)=>b.forecast-a.forecast);
      if(list.length<=limit)return list;
      const top=list.slice(0,limit-1),rest=list.slice(limit-1);
      top.push({name:'Other',sales:rest.reduce((s,r)=>s+r.sales,0),backlog:rest.reduce((s,r)=>s+r.backlog,0),forecast:rest.reduce((s,r)=>s+r.forecast,0),target:rest.reduce((s,r)=>s+(r.target||0),0)});
      return top;
    }

    function parseUndercarBrandRows(parsed){
      const rows=parsed?.rows||[];
      const managers=new Set(['Bernardi F','Losi L','Zilkowski S.','Mindaugas Deikus','Sollano R.','Sollano R']);
      const scope=rows.filter(r=>String(r.salesOffice||'').trim()==='Zilkowski S.'&&managers.has(String(r.salesManager||'').trim()));
      let currentYM='';
      for(const r of scope){
        const t=String(r.type||'').trim().toLowerCase();
        const d=String(r.date||'');
        if(t.startsWith('inv')&&/^\d{4}-\d{2}/.test(d)){const ym=d.slice(0,7);if(ym>currentYM)currentYM=ym;}
      }
      const map=new Map();
      const add=(brand,key,value)=>{
        const name=String(brand||'').trim()||'Other';
        if(!map.has(name))map.set(name,{name,sales:0,backlog:0,forecast:0});
        map.get(name)[key]+=Number(value)||0;
      };
      for(const r of scope){
        const type=String(r.type||'').trim().toLowerCase();
        const date=String(r.date||'');
        if(type.startsWith('inv')){
          if(currentYM&&date.slice(0,7)!==currentYM)continue;
          add(r.brand,'sales',r.sales);
        }else if(type==='ord1'){
          add(r.brand,'backlog',r.sales);
        }
      }
      for(const x of map.values())x.forecast=x.sales+x.backlog;
      return compactTopBrands([...map.values()]);
    }

    function idle(fn){if('requestIdleCallback'in window)requestIdleCallback(fn,{timeout:1200});else setTimeout(fn,80);}
    function ensureUndercarBrandData(){
      const panel=document.getElementById('undercarBrandPerformance');
      if(!panel||panel.classList.contains('collapsed')||undercarBrandLoading)return;
      const file=undercarBrandFile||document.getElementById('file')?.files?.[0];
      if(!file){panel.querySelector('.brandPerfBody').innerHTML='<div class="brandPerfEmpty">Load the Undercar file to show Brand Performance.</div>';return;}
      const key=[file.name,file.size,file.lastModified].join('|');
      if(key===undercarBrandKey&&undercarBrandRows.length){renderBrandRows('undercar',undercarBrandRows,eurBrand,'share');return;}
      undercarBrandLoading=true;
      panel.querySelector('.brandPerfBody').innerHTML='<div class="brandPerfEmpty">Loading brand data…</div>';
      idle(async()=>{
        try{
          const buf=await file.arrayBuffer();
          const parsed=globalThis.XLSBIFF8?.parseSalesJournal?.(buf);
          undercarBrandRows=parseUndercarBrandRows(parsed);
          undercarBrandKey=key;
          renderBrandRows('undercar',undercarBrandRows,eurBrand,'share');
        }catch(e){
          console.warn('Undercar Brand Performance could not be loaded',e);
          panel.querySelector('.brandPerfBody').innerHTML='<div class="brandPerfEmpty">Brand data could not be loaded from this file.</div>';
        }finally{undercarBrandLoading=false;}
      });
    }

    const domNumber=text=>{const s=String(text||'').replace(/\s/g,'').replace(/\$/g,'').replace(/€/g,'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};
    function renderCollisionBrandPerformance(){
      const panel=document.getElementById('collisionBrandPerformance');
      if(!panel||panel.classList.contains('collapsed'))return;
      const body=document.getElementById('collisionBrandBody');
      const table=body?.closest('table');
      if(!body||!table){panel.querySelector('.brandPerfBody').innerHTML='<div class="brandPerfEmpty">Load the Collision file to show Brand Performance.</div>';return;}
      const headers=[...table.querySelectorAll('thead tr:last-child th')].map(th=>(th.textContent||'').trim().toLowerCase());
      const idx=(...names)=>{for(const name of names){const i=headers.findIndex(h=>h===name||h.includes(name));if(i>=0)return i;}return-1;};
      const iSales=idx('sales mtd','actual');
      const iBacklog=idx('backlog ord1','orders','ord0 + ord1');
      const iOrd0=idx('ord0');
      const iOrd1=idx('ord1');
      const iForecast=idx('forecast');
      const iTarget=idx('target','aop');
      const rows=[];
      for(const tr of [...body.rows]){
        const name=(tr.cells?.[0]?.textContent||'').trim();
        if(!name||/total/i.test(name)||tr.classList.contains('brandInactive')||getComputedStyle(tr).display==='none')continue;
        const sales=iSales>=0?domNumber(tr.cells[iSales]?.textContent):0;
        let backlog=iBacklog>=0?domNumber(tr.cells[iBacklog]?.textContent):0;
        if(iBacklog<0)backlog=(iOrd0>=0?domNumber(tr.cells[iOrd0]?.textContent):0)+(iOrd1>=0?domNumber(tr.cells[iOrd1]?.textContent):0);
        const forecast=iForecast>=0?domNumber(tr.cells[iForecast]?.textContent):sales+backlog;
        const target=iTarget>=0?domNumber(tr.cells[iTarget]?.textContent):0;
        rows.push({name,sales,backlog,forecast,target});
      }
      renderBrandRows('collision',compactTopBrands(rows,5),usdBrand,'target');
    }

    ensureBrandPanels();
    setTimeout(ensureBrandPanels,700);
    document.querySelector('.tab[data-tab="overview"]')?.addEventListener('click',()=>setTimeout(()=>{ensureBrandPanels();renderCollisionBrandPerformance();},100));
    document.getElementById('file')?.addEventListener('change',e=>{
      const f=e.target.files?.[0];if(!f)return;
      undercarBrandFile=f;undercarBrandKey='';undercarBrandRows=[];
      const p=document.getElementById('undercarBrandPerformance');
      if(p&&!p.classList.contains('collapsed'))ensureUndercarBrandData();
    });
    const collisionBrandBody=document.getElementById('collisionBrandBody');
    if(collisionBrandBody)new MutationObserver(()=>requestAnimationFrame(renderCollisionBrandPerformance)).observe(collisionBrandBody,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});

    const rule=document.querySelector('#collisionDetail .collisionRule');
    if(rule)rule.textContent=rule.textContent.replace('Ruslan = Bulgaria + Export','Ruslan = Bulgaria + Export (excl. Japan)');

    const collisionStyle=document.createElement('style');
    collisionStyle.textContent=`
      #collisionDetailKpis.collisionOverviewGoals{grid-template-columns:1.35fr .85fr!important;gap:10px!important}
      #collisionDetailKpis .collisionMonthGoalRow{grid-template-columns:1fr 1fr}
      #collisionDetailKpis .collisionYtdGoalRow{grid-template-columns:1fr}
      #collisionDetailKpis .goalMain small{font-size:10px;color:#8a8f96}
      #collisionCountryCompactTable.monthOnly{min-width:820px!important}
      @media(max-width:1000px){#collisionDetailKpis.collisionOverviewGoals{grid-template-columns:1fr!important}}
      @media(max-width:700px){#collisionDetailKpis .collisionMonthGoalRow{grid-template-columns:1fr}}
    `;
    document.head.appendChild(collisionStyle);

    const getText=(root,sel)=>root?.querySelector(sel)?.textContent?.trim()||'';
    const cardByLabel=(box,label)=>[...box.children].find(c=>getText(c,'.label').toLowerCase()===label.toLowerCase());
    const money=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};
    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const pctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const signed=v=>(v>=0?'+':'')+usd.format(v);
    const cls=v=>v>=0?'good':'bad';
    function gapFromNote(text){
      const m=String(text||'').match(/([+-]?\$?[\d,]+(?:\.\d+)?)\s*vs\s*AOP/i);
      return m?money(m[1]):0;
    }
    function collisionGoalBox(title,actual,target,gap,sub=''){
      const ratio=target?actual/target:null;
      return `<div class="goalBox"><div class="goalTitle">${title}</div><div class="goalMain"><span>${usd.format(actual)}</span><small>of ${usd.format(target)}</small></div><div class="goalMeta"><b>${ratio==null?'—':pctFmt.format(ratio)}</b><strong class="${cls(gap)}">${signed(gap)}</strong></div>${sub?`<div class="goalSub">${sub}</div>`:''}</div>`;
    }

    function styleCollisionOverviewBar(){
      const box=document.getElementById('collisionDetailKpis');
      if(!box)return;
      if(box.querySelector('.goalSection.monthly')&&box.querySelector('.goalSection.annual'))return;
      const monthAop=cardByLabel(box,'Month AOP');
      const actual=cardByLabel(box,'Actual');
      const orders=cardByLabel(box,'Orders')||cardByLabel(box,'Ord0 + Ord1');
      const forecast=cardByLabel(box,'Month Forecast');
      const ytd=cardByLabel(box,'YTD Forecast');
      if(!monthAop||!actual||!orders||!forecast||!ytd)return;

      const monthTarget=money(getText(monthAop,'.value'));
      const actualValue=money(getText(actual,'.value'));
      const ordersValue=money(getText(orders,'.value'));
      const forecastValue=money(getText(forecast,'.value'));
      const monthActualGap=actualValue-monthTarget;
      const monthForecastGap=forecastValue-monthTarget;

      const ytdForecast=money(getText(ytd,'.value'));
      const ytdGap=gapFromNote(getText(ytd,'.muted'));
      const ytdTarget=ytdForecast-ytdGap;

      box.className='goalsGrid collisionOverviewGoals';
      box.innerHTML=`
        <section class="goalSection monthly">
          <div class="sectionHead"><span>MONTH</span><b>Current month target</b></div>
          <div class="goalRow collisionMonthGoalRow">
            ${collisionGoalBox('Actual',actualValue,monthTarget,monthActualGap,'')}
            ${collisionGoalBox('Forecast incl. Orders',forecastValue,monthTarget,monthForecastGap,`Orders <b>${usd.format(ordersValue)}</b>`)}
          </div>
        </section>
        <section class="goalSection annual">
          <div class="sectionHead"><span>YEAR</span><b>YTD target</b></div>
          <div class="goalRow collisionYtdGoalRow">
            ${collisionGoalBox('YTD Forecast',ytdForecast,ytdTarget,ytdGap,`${ytdGap>=0?'Above YTD AOP':'Missing to YTD AOP'} <b class="${cls(ytdGap)}">${signed(ytdGap)}</b>`)}
          </div>
        </section>`;
    }

    function makeCountryManagerMonthly(){
      const table=document.getElementById('collisionCountryCompactTable');
      if(!table||table.dataset.monthOnly==='1'||!table.tHead||!table.tBodies?.[0])return;
      const rows=[...table.tHead.rows];
      if(rows.length<2)return;
      const labelsRow=rows[rows.length-1];
      const labels=[...labelsRow.cells].map(c=>(c.textContent||'').trim().toLowerCase());
      const ytdStart=labels.findIndex(x=>x.includes('ytd'));
      if(ytdStart<0)return;
      for(const r of [...table.tBodies[0].rows]){
        if(r.cells.length===1&&r.cells[0].colSpan>1){r.cells[0].colSpan=ytdStart;continue;}
        for(let i=r.cells.length-1;i>=ytdStart;i--)r.deleteCell(i);
      }
      for(let i=labelsRow.cells.length-1;i>=ytdStart;i--)labelsRow.deleteCell(i);
      const groupRow=rows[0];
      for(const cell of [...groupRow.cells]){
        const txt=(cell.textContent||'').trim().toLowerCase();
        if(txt.includes('ytd')||cell.classList.contains('year'))cell.remove();
      }
      const monthCell=[...groupRow.cells].find(c=>c.classList.contains('month'));
      if(monthCell)monthCell.colSpan=Math.max(1,ytdStart-1);
      table.classList.add('monthOnly');
      table.dataset.monthOnly='1';
      const panel=table.closest('.card.panel');
      const p=panel?.querySelector('p');
      if(p)p.textContent='Current month · one row per country · values aggregated across the active brands.';
    }

    let collisionUiScheduled=false;
    function syncCollisionUi(){
      if(collisionUiScheduled)return;
      collisionUiScheduled=true;
      requestAnimationFrame(()=>{
        collisionUiScheduled=false;
        styleCollisionOverviewBar();
        makeCountryManagerMonthly();
      });
    }
    const detailPane=document.getElementById('collisionDetail');
    if(detailPane)new MutationObserver(syncCollisionUi).observe(detailPane,{childList:true,subtree:true});
    document.querySelector('.tab[data-tab="collisionDetail"]')?.addEventListener('click',()=>{setTimeout(syncCollisionUi,80);setTimeout(syncCollisionUi,400);});
    document.getElementById('collisionManagerDetail')?.addEventListener('change',()=>setTimeout(syncCollisionUi,120));
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(syncCollisionUi,500);setTimeout(syncCollisionUi,1500);setTimeout(syncCollisionUi,3000);});
    setTimeout(syncCollisionUi,350);setTimeout(syncCollisionUi,1200);

    // Monthly Overview: combined TOTAL in EUR. Collision USD values are converted with the latest ECB-based rate.
    const totalEurFmt=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const totalPctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const FX_FALLBACK_USD_EUR=1/1.1188; // ECB reference 2026-10-26: EUR 1 = USD 1.1188
    let usdToEurRate=FX_FALLBACK_USD_EUR;
    let usdToEurDate='2026-10-26';
    let totalRenderPending=false;

    function parseOverviewMoney(text,currency){
      let s=String(text||'').trim();
      if(!s||s==='—'||s==='-')return null;
      s=s.replace(/[^0-9+\-.,]/g,'');
      if(!s)return null;
      if(currency==='EUR'){
        if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
        else if(s.includes(','))s=s.replace(',','.');
        else if(s.includes('.')){
          const p=s.split('.');
          if(p.length>1&&p.slice(1).every(x=>x.length===3))s=p.join('');
        }
      }else{
        if(s.includes(',')&&s.includes('.'))s=s.replace(/,/g,'');
        else if(s.includes(',')){
          const p=s.split(',');
          if(p.length>1&&p.slice(1).every(x=>x.length===3))s=p.join('');
          else s=s.replace(',','.');
        }
      }
      const n=Number(s);return Number.isFinite(n)?n:null;
    }

    function overviewMetrics(id,currency){
      const box=document.getElementById(id);
      if(!box)return null;
      const out={};
      for(const kpi of box.querySelectorAll('.execKpi')){
        const label=((kpi.querySelector('span,.label,.goalTitle')?.textContent)||'').trim().toLowerCase();
        const value=parseOverviewMoney((kpi.querySelector('b,.value,.goalMain span')?.textContent)||'',currency);
        if(label==='sales mtd'||label==='actual')out.sales=value;
        else if(label==='backlog ord1'||label==='orders'||label==='ord0 + ord1'||label.includes('backlog ord1'))out.backlog=value;
        else if(label==='forecast'||label.includes('forecast'))out.forecast=value;
        else if(label==='target'||label==='monthly target'||label==='month target'||label==='aop'||label==='month aop')out.target=value;
      }
      if(out.backlog==null&&out.forecast!=null&&out.sales!=null)out.backlog=out.forecast-out.sales;
      return out;
    }

    function totalKpi(label,value,extraClass=''){
      return `<div class="execKpi ${extraClass}"><span>${label}</span><b>${value==null?'—':totalEurFmt.format(value)}</b></div>`;
    }

    function ensureTotalOverviewCard(){
      const overview=document.getElementById('overview');
      const undercarOverview=document.getElementById('undercarOverview');
      const undercarCard=undercarOverview?.closest('.businessCard');
      if(!overview||!undercarCard)return null;
      let card=document.getElementById('combinedTotalOverview');
      if(card)return card;
      card=document.createElement('section');
      card.id='combinedTotalOverview';
      card.className='businessCard totalOverviewBlock';
      card.innerHTML=`<div class="businessHead"><div><h3>TOTAL SALES</h3><span id="totalFxNote" class="period">Collision converted to EUR</span></div><span class="currency">EUR €</span></div><div id="combinedTotalGrid" class="execGrid"></div>`;
      undercarCard.insertAdjacentElement('beforebegin',card);
      return card;
    }

    function renderTotalOverview(){
      const card=ensureTotalOverviewCard();
      const grid=document.getElementById('combinedTotalGrid');
      if(!card||!grid)return;
      const u=overviewMetrics('undercarOverview','EUR');
      const c=overviewMetrics('collisionOverview','USD');
      if(!u||!c)return;
      const cv=x=>x==null?null:x*usdToEurRate;
      const sum=(a,b)=>a==null||b==null?null:a+b;
      const sales=sum(u.sales,cv(c.sales));
      const backlog=sum(u.backlog,cv(c.backlog));
      const forecast=sum(u.forecast,cv(c.forecast));
      const target=sum(u.target,cv(c.target));
      const gap=forecast!=null&&target!=null?forecast-target:null;
      const attain=forecast!=null&&target?forecast/target:null;
      grid.innerHTML=
        totalKpi('Sales MTD',sales)+
        totalKpi('Backlog Ord1',backlog)+
        totalKpi('Forecast',forecast,'emphasis')+
        totalKpi('Target',target)+
        totalKpi('Gap vs Target',gap)+
        `<div class="execKpi"><span>Target %</span><b>${attain==null?'—':totalPctFmt.format(attain)}</b></div>`;
      const note=document.getElementById('totalFxNote');
      if(note)note.textContent=`Collision USD → EUR · 1 USD = ${usdToEurRate.toFixed(4)} EUR · ${usdToEurDate}`;
    }

    function scheduleTotalOverview(){
      if(totalRenderPending)return;
      totalRenderPending=true;
      requestAnimationFrame(()=>{totalRenderPending=false;renderTotalOverview();});
    }

    const totalStyle=document.createElement('style');
    totalStyle.textContent=`
      #combinedTotalOverview{border:2px solid #17191d;margin:0 0 12px}
      #combinedTotalOverview .businessHead{background:#17191d;color:#fff}
      #combinedTotalOverview .businessHead .period,#combinedTotalOverview .businessHead .currency{color:#c9cdd3}
      #combinedTotalOverview .execGrid{grid-template-columns:repeat(6,1fr)}
      #combinedTotalOverview .execKpi.emphasis{border-top-color:#17191d;background:#f2f3f4}
      @media(max-width:850px){#combinedTotalOverview .execGrid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:520px){#combinedTotalOverview .execGrid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(totalStyle);

    async function refreshUsdEurRate(){
      try{
        const r=await realFetch('https://api.frankfurter.app/latest?from=USD&to=EUR',{cache:'no-store'});
        if(!r.ok)throw new Error('FX response '+r.status);
        const j=await r.json();
        const rate=Number(j?.rates?.EUR);
        if(!Number.isFinite(rate)||rate<=0)throw new Error('Invalid FX rate');
        usdToEurRate=rate;
        usdToEurDate=String(j.date||'latest');
        try{localStorage.setItem('sales-dashboard-usd-eur',JSON.stringify({rate,date:usdToEurDate}));}catch{}
      }catch(e){
        try{
          const saved=JSON.parse(localStorage.getItem('sales-dashboard-usd-eur')||'null');
          if(Number.isFinite(Number(saved?.rate))&&Number(saved.rate)>0){usdToEurRate=Number(saved.rate);usdToEurDate=String(saved.date||'saved');}
        }catch{}
        console.warn('USD/EUR rate fallback in use',e);
      }
      scheduleTotalOverview();
    }

    ensureTotalOverviewCard();
    if(overviewPane)new MutationObserver(scheduleTotalOverview).observe(overviewPane,{childList:true,subtree:true,characterData:true});
    document.querySelector('.tab[data-tab="overview"]')?.addEventListener('click',()=>setTimeout(scheduleTotalOverview,100));
    document.getElementById('file')?.addEventListener('change',()=>{setTimeout(scheduleTotalOverview,500);setTimeout(scheduleTotalOverview,1600);});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(scheduleTotalOverview,700);setTimeout(scheduleTotalOverview,1800);setTimeout(scheduleTotalOverview,3200);});
    setTimeout(scheduleTotalOverview,350);
    setTimeout(scheduleTotalOverview,1300);
    refreshUsdEurRate();


    // Employee views + printable manager report.
    const employeeProfiles={
      lorenzo:{name:'Lorenzo Losi',undercar:true,collision:false,start:'team'},
      michal:{name:'Michal Adamiec',undercar:false,collision:true,start:'collisionDetail'},
      mindaugas:{name:'Mindaugas Deikus',undercar:true,collision:true,start:'team'},
      ruslan:{name:'Ruslan Sollano',undercar:true,collision:true,start:'team'}
    };
    const employeeKey=null;
    const employeeProfile=null;

    function setSelectValue(id,value,lock=false){
      const el=document.getElementById(id);
      if(!el)return;
      const apply=()=>{
        const opt=[...el.options].find(o=>o.value===value||o.textContent.trim()===value);
        if(opt){
          el.value=opt.value;
          el.dispatchEvent(new Event('change',{bubbles:true}));
          if(lock)el.disabled=true;
          return true;
        }
        return false;
      };
      if(apply())return;
      let tries=0;
      const timer=setInterval(()=>{tries++;if(apply()||tries>20)clearInterval(timer);},150);
    }

    function activateTab(tabId){
      const btn=document.querySelector('.tab[data-tab="'+tabId+'"]');
      if(btn){btn.click();return;}
      document.querySelectorAll('.tab,.tabpane').forEach(x=>x.classList.remove('active'));
      document.getElementById(tabId)?.classList.add('active');
    }

    function applyEmployeeView(){
      if(!employeeProfile)return;
      document.body.classList.add('employeeView');
      document.body.dataset.employee=employeeKey;
      const allowed=new Set(['report']);
      if(employeeProfile.undercar){allowed.add('team');allowed.add('customers');allowed.add('journal');}
      if(employeeProfile.collision)allowed.add('collisionDetail');
      document.querySelectorAll('.tab').forEach(btn=>{
        const id=btn.dataset.tab||'';
        if(!allowed.has(id))btn.style.display='none';
      });
      const undercarLoad=document.querySelector('button[onclick*="getElementById(\'file\')"]');
      if(undercarLoad&&!employeeProfile.undercar)undercarLoad.style.display='none';
      const collisionLoad=document.getElementById('collisionLoad');
      if(collisionLoad&&!employeeProfile.collision)collisionLoad.style.display='none';
      if(!employeeProfile.undercar){
        document.getElementById('file')?.setAttribute('disabled','disabled');
      }
      if(!employeeProfile.collision){
        document.getElementById('collisionFile')?.setAttribute('disabled','disabled');
      }
      if(employeeProfile.undercar){
        setSelectValue('manager',employeeProfile.name,true);
        setSelectValue('customerManager',employeeProfile.name,true);
        setSelectValue('journalManager',employeeProfile.name,true);
      }
      if(employeeProfile.collision)setSelectValue('collisionManagerDetail',employeeProfile.name,true);
      const h1=document.querySelector('header h1');
      if(h1)h1.textContent='East Europe Sales Dashboard · '+employeeProfile.name;
      activateTab(employeeProfile.start);
    }

    function addReportTab(){
      const nav=document.querySelector('nav.tabs');
      const main=document.querySelector('main.wrap');
      if(!nav||!main||document.getElementById('report'))return;
      const btn=document.createElement('button');
      btn.className='tab';
      btn.dataset.tab='report';
      btn.textContent='Manager Report';
      nav.appendChild(btn);

      const section=document.createElement('section');
      section.id='report';
      section.className='tabpane';
      section.innerHTML=`
        <div class="toolbar reportToolbar">
          <div>
            <b>Manager Report</b>
            <div class="muted">Current dashboard data · printable summary</div>
          </div>
          <div class="filters">
            <select id="reportManager"><option>Lorenzo Losi</option><option>Michal Adamiec</option><option>Mindaugas Deikus</option><option>Ruslan Sollano</option></select>
            <button id="buildReportBtn" class="btn">Build report</button>
            <button id="printReportBtn" class="btn red">Print / Save PDF</button>
          </div>
        </div>
        <div id="reportContent" class="reportContent">
          <div class="card panel"><div class="muted">Select a manager and click Build report.</div></div>
        </div>`;
      main.appendChild(section);

      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tab,.tabpane').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        section.classList.add('active');
      });
      document.getElementById('buildReportBtn')?.addEventListener('click',buildManagerReport);
      document.getElementById('printReportBtn')?.addEventListener('click',()=>window.print());
    }

    function addTeamDashboardTab(){
      const nav=document.querySelector('nav.tabs');
      const main=document.querySelector('main.wrap');
      if(!nav||!main||document.getElementById('teamDashboard'))return;

      const btn=document.createElement('button');
      btn.className='tab';
      btn.dataset.tab='teamDashboard';
      btn.textContent='Team Dashboard';
      nav.appendChild(btn);

      const section=document.createElement('section');
      section.id='teamDashboard';
      section.className='tabpane';
      section.innerHTML=`
        <div class="toolbar teamDashboardToolbar">
          <div>
            <b>Team Dashboard</b>
            <div class="muted">Select a person to show the relevant sales areas.</div>
          </div>
          <div class="employeeTabs">
            <button type="button" class="employeeTab active" data-employee="lorenzo">Lorenzo</button>
            <button type="button" class="employeeTab" data-employee="michal">Michal</button>
            <button type="button" class="employeeTab" data-employee="mindaugas">Mindaugas</button>
            <button type="button" class="employeeTab" data-employee="ruslan">Ruslan</button>
          </div>
        </div>
        <div id="teamDashboardContent" class="reportContent">
          <div class="card panel"><div class="muted">Loading Lorenzo…</div></div>
        </div>`;
      main.appendChild(section);

      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tab,.tabpane').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        section.classList.add('active');
        const active=section.querySelector('.employeeTab.active')?.dataset.employee||'lorenzo';
        buildTeamDashboard(active);
      });

      section.querySelectorAll('.employeeTab').forEach(b=>b.addEventListener('click',()=>{
        section.querySelectorAll('.employeeTab').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        buildTeamDashboard(b.dataset.employee);
      }));
    }

    async function buildTeamDashboard(key){
      const profile=employeeProfiles[key];
      const out=document.getElementById('teamDashboardContent');
      if(!profile||!out)return;
      out.innerHTML='<div class="card panel"><div class="muted">Building '+profile.name+' view…</div></div>';
      const parts=[];
      if(profile.undercar)parts.push(await captureUndercarReport(profile.name));
      if(profile.collision)parts.push(await captureCollisionReport(profile.name));
      out.innerHTML=`
        <div class="reportHeader teamPersonHeader">
          <div><h1>${profile.name}</h1><p>${profile.undercar&&profile.collision?'Undercar · Car-O-Liner · Blackhawk · JOSAM':profile.undercar?'Undercar':'Car-O-Liner · Blackhawk · JOSAM'}</p></div>
          <div class="reportDate">${new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())}</div>
        </div>
        ${parts.join('')||'<div class="card panel">No data available.</div>'}`;
    }

    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    function moneyText(el){return el?.textContent?.trim()||'—';}

    function reportMoneyNumber(text){
      const s=String(text||'').replace(/\s/g,'').replace(/[€$]/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
      const n=Number(s);
      return Number.isFinite(n)?n:0;
    }
    function reportPct(actual,target){
      if(!target)return 0;
      return Math.max(0,Math.min(120,(actual/target)*100));
    }
    function reportBar(label,value,target,fmt){
      const pct=reportPct(value,target);
      const displayPct=target?Math.round((value/target)*100):0;
      return `<div class="reportBarRow"><div class="reportBarLabel">${label}</div><div class="reportBarTrack"><div class="reportBarFill ${displayPct>=100?'goodFill':''}" style="width:${Math.min(100,pct)}%"></div></div><div class="reportBarValue">${target?displayPct+'%':'—'}</div><div class="reportBarAmount">${fmt(value)}</div></div>`;
    }
    function reportKpi(label,value,fmt,cls=''){
      return `<div class="reportKpi ${cls}"><div class="reportKpiLabel">${label}</div><div class="reportKpiValue">${fmt(value)}</div></div>`;
    }
    function reportMetricRow(label,value,fmt,cls=''){
      return `<div class="reportMetricRow"><span>${label}</span><b class="${cls}">${fmt(value)}</b></div>`;
    }
    function signedFmt(value,fmt){return (value>=0?'+':'')+fmt(value);}
    function buildUndercarExecutive(manager,vals,gm){
      const fmt=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
      const monthGap=vals.forecast-vals.target;
      const ytdGap=vals.ytd-vals.ytdTarget;
      return `
        <section class="reportSection executiveReportBlock">
          <div class="reportSectionHead"><h2>Undercar</h2><span>EUR · ${gm}</span></div>
          <div class="reportKpiGrid">
            ${reportKpi('Sales MTD',vals.sales,fmt)}
            ${reportKpi('Forecast',vals.forecast,fmt)}
            ${reportKpi('MTD Target',vals.target,fmt)}
            ${reportKpi('Gap',monthGap,fmt,monthGap>=0?'goodText':'badText')}
            ${reportKpi('Sales YTD',vals.ytd,fmt)}
          </div>
          <div class="reportPeriodGrid">
            <div class="reportPeriodCard">
              <div class="reportPeriodHead">MONTH</div>
              <div class="reportMetricList">
                ${reportMetricRow('Sales MTD',vals.sales,fmt)}
                ${reportMetricRow('Backlog Ord1',vals.backlog,fmt)}
                ${reportMetricRow('Forecast',vals.forecast,fmt)}
                ${reportMetricRow('MTD Target',vals.target,fmt)}
                ${reportMetricRow('Gap',monthGap,v=>signedFmt(v,fmt),monthGap>=0?'goodText':'badText')}
              </div>
              <div class="reportBars">
                ${reportBar('Sales MTD',vals.sales,vals.target,fmt)}
              </div>
            </div>
            <div class="reportPeriodCard">
              <div class="reportPeriodHead">YEAR</div>
              <div class="reportMetricList">
                ${reportMetricRow('Sales YTD',vals.ytd,fmt)}
                ${reportMetricRow('YTD Target',vals.ytdTarget,fmt)}
                ${reportMetricRow('YTD Gap',ytdGap,v=>signedFmt(v,fmt),ytdGap>=0?'goodText':'badText')}
              </div>
              <div class="reportBars">
                ${reportBar('Sales YTD',vals.ytd,vals.ytdTarget,fmt)}
              </div>
            </div>
          </div>
        </section>`;
    }
    function buildCollisionExecutive(manager,vals){
      const fmt=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
      return `
        <section class="reportSection executiveReportBlock">
          <div class="reportSectionHead"><h2>Car-O-Liner / Blackhawk / JOSAM</h2><span>USD</span></div>
          <div class="reportKpiGrid">
            ${reportKpi('Actual',vals.actual,fmt)}
            ${reportKpi('Forecast incl. Orders',vals.forecast,fmt)}
            ${reportKpi('Month AOP',vals.monthTarget,fmt)}
            ${reportKpi('Gap vs AOP',vals.monthGap,v=>signedFmt(v,fmt),vals.monthGap>=0?'goodText':'badText')}
            ${reportKpi('YTD Forecast',vals.ytdForecast,fmt)}
          </div>
          <div class="reportPeriodGrid">
            <div class="reportPeriodCard">
              <div class="reportPeriodHead">MONTH</div>
              <div class="reportMetricList">
                ${reportMetricRow('Actual',vals.actual,fmt)}
                ${reportMetricRow('Orders',vals.orders,fmt)}
                ${reportMetricRow('Forecast incl. Orders',vals.forecast,fmt)}
                ${reportMetricRow('Month AOP',vals.monthTarget,fmt)}
                ${reportMetricRow('Gap vs AOP',vals.monthGap,v=>signedFmt(v,fmt),vals.monthGap>=0?'goodText':'badText')}
              </div>
              <div class="reportBars">
                ${reportBar('Actual',vals.actual,vals.monthTarget,fmt)}
                ${reportBar('Forecast incl. Orders',vals.forecast,vals.monthTarget,fmt)}
              </div>
            </div>
            <div class="reportPeriodCard">
              <div class="reportPeriodHead">YEAR</div>
              <div class="reportMetricList">
                ${reportMetricRow('YTD Forecast',vals.ytdForecast,fmt)}
                ${reportMetricRow('YTD AOP',vals.ytdTarget,fmt)}
                ${reportMetricRow('YTD Gap',vals.ytdGap,v=>signedFmt(v,fmt),vals.ytdGap>=0?'goodText':'badText')}
              </div>
              <div class="reportBars">
                ${reportBar('YTD Forecast',vals.ytdForecast,vals.ytdTarget,fmt)}
                ${reportBar('YTD AOP',vals.ytdTarget,vals.ytdTarget,fmt)}
              </div>
            </div>
          </div>
        </section>`;
    }

    async function captureUndercarReport(manager){
      const select=document.getElementById('manager');
      if(!select)return '<div class="card panel"><h2>Undercar</h2><div class="muted">Undercar view not available.</div></div>';
      const old=select.value;
      const option=[...select.options].find(o=>o.value===manager||o.textContent.trim()===manager);
      if(!option)return '<div class="card panel"><h2>Undercar</h2><div class="muted">No Undercar data for '+manager+'.</div></div>';
      select.disabled=false;
      select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await sleep(80);
      const sum=[...document.querySelectorAll('#countryBody tr.mgrRow')].find(tr=>(tr.cells?.[0]?.textContent||'').trim()===manager);
      const gmCard=[...document.querySelectorAll('#cards .managerGoal')].find(x=>(x.querySelector('.managerName b')?.textContent||'').trim()===manager);
      const gm=gmCard?.querySelector('.managerName span')?.textContent||'GM MTD —';
      let html='';
      if(sum&&sum.cells.length>=10){
        const sales=reportMoneyNumber(sum.cells[2]?.textContent);
        const backlog=reportMoneyNumber(sum.cells[3]?.textContent);
        const vals={
          sales,
          backlog,
          forecast:reportMoneyNumber(sum.cells[4]?.textContent),
          target:reportMoneyNumber(sum.cells[5]?.textContent),
          ytd:reportMoneyNumber(sum.cells[7]?.textContent),
          ytdTarget:reportMoneyNumber(sum.cells[8]?.textContent)
        };
        html=buildUndercarExecutive(manager,vals,gm);
      }else{
        html='<div class="card panel"><h2>Undercar</h2><div class="muted">No Undercar data available for '+manager+'.</div></div>';
      }
      const table=document.getElementById('countryTable')?.cloneNode(true);
      if(table)html+=`<div class="card panel reportDetailTable"><h3>Country performance</h3><div class="tableWrap">${table.outerHTML}</div></div>`;
      select.value=old;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return html;
    }

    async function captureUndercarDetailReport(manager){
      const select=document.getElementById('manager');
      if(!select)return '<div class="card panel"><h2>Undercar</h2><div class="muted">Undercar view not available.</div></div>';
      const old=select.value;
      const option=[...select.options].find(o=>o.value===manager||o.textContent.trim()===manager);
      if(!option)return '<div class="card panel"><h2>Undercar</h2><div class="muted">No Undercar data for '+manager+'.</div></div>';
      select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await sleep(80);

      const kpis=document.getElementById('kpis')?.cloneNode(true);
      const cards=document.getElementById('cards')?.cloneNode(true);
      const table=document.getElementById('countryTable')?.cloneNode(true);

      let html='<section class="reportSection undercarDetailReport"><div class="reportSectionHead"><h2>Undercar</h2><span>Same view as Undercar Detail</span></div>';
      if(kpis)html+=kpis.outerHTML;
      if(cards)html+=cards.outerHTML;
      if(table)html+=`<div class="card panel reportDetailTable"><h2>Country performance</h2><p>Monthly target = Plan · Forecast = Sales MTD + Backlog Ord1 · Annual target = Sales PLAN YTD.</p><div class="tableWrap">${table.outerHTML}</div></div>`;
      html+='</section>';

      select.value=old;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return html;
    }

    async function captureCollisionReport(manager){
      const select=document.getElementById('collisionManagerDetail');
      if(!select)return '<div class="card panel"><h2>Collision</h2><div class="muted">Collision view not available.</div></div>';
      const old=select.value;
      const option=[...select.options].find(o=>o.value===manager||o.textContent.trim()===manager);
      if(!option)return '<div class="card panel"><h2>Collision</h2><div class="muted">No Collision data for '+manager+'.</div></div>';
      select.disabled=false;
      select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await sleep(220);

      const box=document.getElementById('collisionDetailKpis');
      const goalBoxes=[...(box?.querySelectorAll('.goalBox')||[])];
      const byTitle=title=>goalBoxes.find(g=>(g.querySelector('.goalTitle')?.textContent||'').trim().toLowerCase()===title.toLowerCase());
      const actualBox=byTitle('Actual');
      const forecastBox=byTitle('Forecast incl. Orders');
      const ytdBox=byTitle('YTD Forecast');

      const mainVal=g=>reportMoneyNumber(g?.querySelector('.goalMain span')?.textContent);
      const targetVal=g=>reportMoneyNumber(g?.querySelector('.goalMain small')?.textContent);
      const strongVal=g=>reportMoneyNumber(g?.querySelector('.goalMeta strong')?.textContent);
      const orders=reportMoneyNumber(forecastBox?.querySelector('.goalSub b')?.textContent);
      const vals={
        actual:mainVal(actualBox),
        forecast:mainVal(forecastBox),
        monthTarget:targetVal(actualBox)||targetVal(forecastBox),
        monthGap:strongVal(forecastBox),
        orders,
        ytdForecast:mainVal(ytdBox),
        ytdTarget:targetVal(ytdBox),
        ytdGap:strongVal(ytdBox)
      };
      let html=buildCollisionExecutive(manager,vals);
      const brand=document.getElementById('collisionDetailBrandTable')?.cloneNode(true);
      const country=document.getElementById('collisionCountryCompactTable')?.cloneNode(true)||document.getElementById('collisionDetailTable')?.cloneNode(true);
      if(brand)html+=`<div class="card panel reportDetailTable"><h3>Brand performance</h3><div class="tableWrap">${brand.outerHTML}</div></div>`;
      if(country)html+=`<div class="card panel reportDetailTable"><h3>Country performance</h3><div class="tableWrap">${country.outerHTML}</div></div>`;
      select.value=old;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return html;
    }

    async function buildManagerReport(){
      const manager=document.getElementById('reportManager')?.value||employeeProfile?.name;
      const out=document.getElementById('reportContent');
      if(!manager||!out)return;
      out.innerHTML='<div class="card panel"><div class="muted">Building report…</div></div>';
      const profile=Object.values(employeeProfiles).find(p=>p.name===manager);
      const parts=[];
      if(profile?.undercar)parts.push(await captureUndercarDetailReport(manager));
      if(profile?.collision)parts.push(await captureCollisionReport(manager));
      out.innerHTML=`
        <div class="reportHeader">
          <div><h1>${manager}</h1><p>East Europe Sales Report</p></div>
          <div class="reportDate">${new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())}</div>
        </div>
        ${parts.join('')||'<div class="card panel">No report data available.</div>'}`;
    }

    const reportStyle=document.createElement('style');
    reportStyle.textContent=`
      .reportContent{display:grid;gap:12px}
      .reportHeader{display:flex;justify-content:space-between;align-items:flex-end;background:#17191d;color:#fff;border-radius:11px;padding:18px 20px}
      .reportHeader h1{margin:0;font-size:24px}.reportHeader p{margin:3px 0 0;color:#c9cdd3}
      .reportDate{font-weight:800}
      .reportSection{display:grid;gap:10px}
      .reportSectionHead{display:flex;justify-content:space-between;align-items:center;padding:2px 2px}
      .reportSectionHead h2{margin:0}.reportSectionHead span{font-size:10px;color:#727780;font-weight:800}
      .employeeTabs{display:flex;gap:6px;flex-wrap:wrap}
      .employeeTab{border:1px solid #d7dade;background:#fff;color:#222;border-radius:7px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer}
      .employeeTab:hover{background:#f4f5f6}
      .employeeTab.active{background:#17191d;color:#fff;border-color:#17191d}
      .teamPersonHeader{margin-bottom:2px}
      .reportKpiGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
      .reportKpi{background:#fff;border:1px solid #dfe3e8;border-radius:10px;padding:13px 14px;min-width:0}
      .reportKpiLabel{font-size:10px;font-weight:850;color:#5f6670;text-transform:uppercase;letter-spacing:.035em}
      .reportKpiValue{font-size:22px;font-weight:900;margin-top:5px;white-space:nowrap}
      .reportPeriodGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .reportPeriodCard{background:#fff;border:1px solid #dfe3e8;border-radius:11px;overflow:hidden}
      .reportPeriodHead{background:#17191d;color:#fff;padding:10px 13px;font-size:12px;font-weight:900;letter-spacing:.055em}
      .reportMetricList{padding:9px 12px 3px}
      .reportMetricRow{display:flex;justify-content:space-between;gap:12px;padding:7px 2px;border-bottom:1px solid #eceff2;font-size:11px}
      .reportMetricRow:last-child{border-bottom:0}
      .reportMetricRow b{font-variant-numeric:tabular-nums}
      .reportBars{padding:9px 12px 13px;display:grid;gap:8px;border-top:1px solid #edf0f2}
      .reportBarRow{display:grid;grid-template-columns:120px minmax(120px,1fr) 42px 105px;align-items:center;gap:8px}
      .reportBarLabel{font-size:10px;font-weight:850}
      .reportBarTrack{height:10px;background:#e8ebee;border-radius:99px;overflow:hidden}
      .reportBarFill{height:100%;background:#52606d;border-radius:99px}
      .reportBarFill.goodFill{background:#1f7a3f}
      .reportBarValue,.reportBarAmount{text-align:right;font-size:10px;font-weight:850;font-variant-numeric:tabular-nums}
      .goodText{color:#138a36!important}.badText{color:#c62828!important}
      .reportDetailTable{margin-top:10px}
      @media(max-width:950px){.reportKpiGrid{grid-template-columns:repeat(2,1fr)}.reportPeriodGrid{grid-template-columns:1fr}}
      @media(max-width:620px){.reportBarRow{grid-template-columns:90px 1fr 38px}.reportBarAmount{display:none}.reportKpiGrid{grid-template-columns:1fr 1fr}.reportKpiValue{font-size:18px}}
      @media print{
        body *{visibility:hidden!important}
        #report,#report *{visibility:visible!important}
        #report{position:absolute;left:0;top:0;width:100%;padding:0!important}
        #report .reportToolbar{display:none!important}
        #report .tabpane{display:block!important}
        #report .card,#report .goalSection{box-shadow:none!important;break-inside:avoid}
        #report .tableWrap{overflow:visible!important}
        #report table{font-size:9px!important;min-width:0!important;width:100%!important}
        @page{size:A4 landscape;margin:10mm}
      }`;
    document.head.appendChild(reportStyle);

    addTeamDashboardTab();
    addReportTab();

    const undercar=document.getElementById('file');
    const collision=document.getElementById('collisionFile');
    undercar?.addEventListener('change',()=>{const f=undercar.files?.[0];if(f){manualUpload.undercar=true;saveFile('undercar',f);}},{capture:true});
    collision?.addEventListener('change',()=>{const f=collision.files?.[0];if(f){manualUpload.collision=true;saveFile('collision',f);}},{capture:true});
    setTimeout(()=>restoreInput('file','undercar','Undercar.xls','application/vnd.ms-excel'),900);

    let latestVersion=UI_VERSION;
    let updateInFlight=false;
    async function syncUpdate(){
      if(updateInFlight)return;
      updateInFlight=true;
      try{
        const r=await realFetch('./version.json?ts='+Date.now(),{cache:'no-store'});
        if(!r.ok)return;
        const j=await r.json();
        latestVersion=j.version||UI_VERSION;
        const b=document.getElementById('updateBtn');
        if(!b)return;
        if(latestVersion!==UI_VERSION){
          b.classList.add('show');
          b.textContent='↻ Update available · '+latestVersion;
          b.title=j.message||('Version '+latestVersion+' available');
        }else{
          b.classList.remove('show');
          b.disabled=false;
          b.textContent='↻ Update available';
          b.title='';
        }
      }catch(e){console.warn('Update check failed',e);}finally{updateInFlight=false;}
    }
    function installUpdateButton(){
      const old=document.getElementById('updateBtn');
      if(!old)return;
      const b=old.cloneNode(true);
      b.id='updateBtn';
      old.replaceWith(b);
      b.addEventListener('click',async()=>{
        if(b.disabled)return;
        b.disabled=true;
        b.classList.add('show');
        b.textContent='Updating…';
        try{
          if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}
          if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}
        }catch(e){console.warn('Cache cleanup failed',e);}
        const u=new URL(location.href);
        u.search='';
        u.searchParams.set('v',latestVersion||UI_VERSION);
        u.searchParams.set('fresh',Date.now().toString());
        location.replace(u.toString());
      });
    }
    installUpdateButton();
    syncUpdate();
    setInterval(syncUpdate,300000);

    setTimeout(()=>{if(status&&/Version upgrade point not found/i.test(status.textContent||''))status.textContent='';},1500);
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
