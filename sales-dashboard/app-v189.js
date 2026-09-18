(async()=>{
  'use strict';
  const UI_VERSION='2026.09.17.27';
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
    let core=await realFetch('./app-v189-core.js?hotfix=2026091727&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Dashboard core could not be loaded');return r.text();});
    core=patchCompatibility(core);
    await (0,eval)(core);

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
      if(!box||box.dataset.undercarStyle==='1')return;
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
      box.dataset.undercarStyle='1';
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
    document.querySelector('.tab[data-tab="collisionDetail"]')?.addEventListener('click',()=>{setTimeout(syncCollisionUi,80);});
    document.getElementById('collisionManagerDetail')?.addEventListener('change',()=>setTimeout(syncCollisionUi,120));
    setTimeout(syncCollisionUi,350);

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
