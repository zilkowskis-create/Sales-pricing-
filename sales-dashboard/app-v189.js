(async()=>{
  'use strict';
  const UI_VERSION='2026.09.17.30';
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
    let core=await realFetch('./app-v189-core.js?hotfix=2026091730&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Dashboard core could not be loaded');return r.text();});
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
      const managers=new Set(['Bernardi F','Zilkowski S.','Mindaugas Deikus','Sollano R.','Sollano R']);
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
