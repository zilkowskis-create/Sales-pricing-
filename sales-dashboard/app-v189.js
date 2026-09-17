(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v188.js?base=2026091720&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.20')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.20','2026.09.17.21');
    await (0,eval)(src);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const money=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};
    const norm=text=>String(text||'').trim().toLowerCase().replace(/\s+/g,' ');

    const style=document.createElement('style');
    style.textContent=`
      /* Collision Monthly Overview: show exactly one Orders metric */
      #overview #collisionOverview{display:none!important}
      #overview #collisionOverviewOrders{display:grid!important;grid-template-columns:repeat(6,1fr)}
      #overview .brandMini>table:not(#collisionBrandOrdersTable){display:none!important}
      #overview #collisionBrandOrdersTable{display:table!important;min-width:760px}
      @media(max-width:1200px){#overview #collisionOverviewOrders{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:700px){#overview #collisionOverviewOrders{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);

    function sourceCards(){
      const map=new Map();
      for(const card of document.querySelectorAll('#collisionOverview .execKpi')){
        const label=norm(card.querySelector('span')?.textContent);
        if(label)map.set(label,card);
      }
      return map;
    }
    function cardHtml(label,value,cls='',valueCls=''){
      return `<div class="execKpi ${cls}"><span>${label}</span><b class="${valueCls}">${value}</b></div>`;
    }
    function renderCollisionOverviewOrders(){
      const source=document.getElementById('collisionOverview');
      if(!source||!source.children.length)return;
      const map=sourceCards();
      const actual=map.get('actual');
      const forecast=map.get('forecast');
      const aop=map.get('monthly aop')||map.get('aop');
      const gap=map.get('gap vs aop')||map.get('gap');
      const pct=map.get('aop %');
      if(!actual&&!forecast)return;

      const ordersCard=map.get('orders');
      const o0=map.get('ord0')||map.get('order 0');
      const o1=map.get('ord1')||map.get('order 1');
      const orders=ordersCard?money(ordersCard.querySelector('b')?.textContent):money(o0?.querySelector('b')?.textContent)+money(o1?.querySelector('b')?.textContent);

      let out=document.getElementById('collisionOverviewOrders');
      if(!out){out=document.createElement('div');out.id='collisionOverviewOrders';out.className='execGrid';source.insertAdjacentElement('afterend',out);}
      const copyValue=c=>c?.querySelector('b')?.textContent||'—';
      const copyClass=c=>c?.querySelector('b')?.className||'';
      out.innerHTML=
        cardHtml('Actual',copyValue(actual),'',copyClass(actual))+
        cardHtml('Orders',usd.format(orders))+
        cardHtml('Forecast',copyValue(forecast),'emphasis',copyClass(forecast))+
        cardHtml('Monthly AOP',copyValue(aop),'',copyClass(aop))+
        cardHtml('Gap vs AOP',copyValue(gap),'',copyClass(gap))+
        cardHtml('AOP %',copyValue(pct),'',copyClass(pct));
    }

    function sourceBrandIndexes(table){
      const row=table?.tHead?.rows?.[table.tHead.rows.length-1];
      if(!row)return null;
      const labels=[...row.cells].map(c=>norm(c.textContent));
      const find=(...names)=>labels.findIndex(x=>names.includes(x));
      return {
        brand:find('brand'),aop:find('aop','monthly aop'),actual:find('actual'),
        orders:find('orders'),o0:find('ord0','order 0'),o1:find('ord1','order 1'),
        forecast:find('forecast'),gap:find('gap','gap vs aop'),pct:find('aop %')
      };
    }
    function renderCollisionBrandOrders(){
      const source=document.querySelector('#overview .brandMini>table:first-of-type');
      const body=document.getElementById('collisionBrandBody');
      if(!source||!body)return;
      const ix=sourceBrandIndexes(source);
      if(!ix||ix.brand<0)return;
      let table=document.getElementById('collisionBrandOrdersTable');
      if(!table){table=document.createElement('table');table.id='collisionBrandOrdersTable';source.insertAdjacentElement('afterend',table);}
      table.innerHTML='<thead><tr><th>Brand</th><th class="num">AOP</th><th class="num">Actual</th><th class="num">Orders</th><th class="num">Forecast</th><th class="num">Gap</th><th class="num">AOP %</th></tr></thead><tbody></tbody>';
      let html='';
      for(const r of [...body.rows]){
        if(r.cells.length<5)continue;
        const name=(r.cells[ix.brand]?.textContent||'').trim();
        if(!name||/col\s*\+\s*blackhawk/i.test(name)||r.classList.contains('brandTotal')||r.classList.contains('brandInactive')||r.style.display==='none')continue;
        const orders=ix.orders>=0?money(r.cells[ix.orders]?.textContent):money(r.cells[ix.o0]?.textContent)+money(r.cells[ix.o1]?.textContent);
        const cell=(i)=>i>=0&&r.cells[i]?r.cells[i].innerHTML:'—';
        const cls=(i)=>i>=0&&r.cells[i]?(r.cells[i].classList.contains('good')?'good':r.cells[i].classList.contains('bad')?'bad':''):'';
        html+=`<tr><td>${cell(ix.brand)}</td><td class="num">${cell(ix.aop)}</td><td class="num">${cell(ix.actual)}</td><td class="num"><b>${usd.format(orders)}</b></td><td class="num">${cell(ix.forecast)}</td><td class="num ${cls(ix.gap)}">${cell(ix.gap)}</td><td class="num ${cls(ix.pct)}">${cell(ix.pct)}</td></tr>`;
      }
      table.tBodies[0].innerHTML=html||'<tr><td colspan="7" class="muted">Load Collision .xlsx to show brand totals.</td></tr>';
    }

    // Persist the locally selected Collision workbook in IndexedDB so app updates/reloads can restore it.
    const DB_NAME='east-europe-sales-dashboard';
    const DB_VERSION=1;
    const STORE='files';
    function openDb(){
      return new Promise((resolve,reject)=>{
        const req=indexedDB.open(DB_NAME,DB_VERSION);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
    }
    async function saveCollisionFile(file){
      if(!file)return;
      try{
        const db=await openDb();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(STORE,'readwrite');
          tx.objectStore(STORE).put({blob:file,name:file.name,type:file.type,lastModified:file.lastModified,savedAt:Date.now()},'collision');
          tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        db.close();
      }catch(e){console.warn('Collision file could not be cached',e);}
    }
    async function getSavedCollisionFile(){
      try{
        const db=await openDb();
        const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const rq=tx.objectStore(STORE).get('collision');rq.onsuccess=()=>resolve(rq.result||null);rq.onerror=()=>reject(rq.error);});
        db.close();
        if(!rec?.blob)return null;
        return new File([rec.blob],rec.name||'S&GMJ Collision.xlsx',{type:rec.type||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',lastModified:rec.lastModified||Date.now()});
      }catch(e){console.warn('Saved Collision file could not be restored',e);return null;}
    }
    async function restoreCollisionFile(){
      const input=document.getElementById('collisionFile');
      if(!input||input.files?.length)return;
      const file=await getSavedCollisionFile();
      if(!file)return;
      try{
        const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
        if(status)status.textContent='Restoring saved Collision data…';
        input.dispatchEvent(new Event('change',{bubbles:true}));
        setTimeout(()=>{if(status&&/Restoring saved Collision data/.test(status.textContent||''))status.textContent='';},3500);
      }catch(e){console.warn('Automatic Collision restore is not supported by this browser',e);}
    }

    const collisionInput=document.getElementById('collisionFile');
    if(collisionInput)collisionInput.addEventListener('change',()=>{const f=collisionInput.files?.[0];if(f)saveCollisionFile(f);},{capture:true});

    let scheduled=false;
    function refresh(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderCollisionOverviewOrders();renderCollisionBrandOrders();});}
    const cOverview=document.getElementById('collisionOverview');if(cOverview)new MutationObserver(refresh).observe(cOverview,{childList:true,subtree:true});
    const cBrands=document.getElementById('collisionBrandBody');if(cBrands)new MutationObserver(refresh).observe(cBrands,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    document.getElementById('collisionDetail')?.addEventListener('change',()=>setTimeout(refresh,100));
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTimeout(refresh,80)));
    if(collisionInput)collisionInput.addEventListener('change',()=>{setTimeout(refresh,500);setTimeout(refresh,1500);setTimeout(refresh,3000);});

    setTimeout(refresh,250);setTimeout(refresh,900);setTimeout(refresh,1800);
    setTimeout(restoreCollisionFile,650);
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
