(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v184.js?base=2026091715&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.15')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.15','2026.09.17.17');
    await (0,eval)(src);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const style=document.createElement('style');
    style.textContent=`
      .tabs{align-items:center}
      .overviewBrandNav{margin-left:auto;display:flex;align-items:center;gap:7px;padding:0 2px 0 14px;white-space:nowrap}
      .overviewBrandNav>span{font-size:9px;font-weight:850;color:#777d85;text-transform:uppercase;letter-spacing:.04em}
      .overviewBrandNav .brandToggleGroup{margin-left:0!important;width:auto!important;order:0!important;flex-wrap:nowrap}
      #collisionBrandBody tr.brandInactive{display:none!important}
      #collisionBrandBody tr.brandTotal{display:none!important}
      #countryTable th.orderEnteredMonth,#countryTable td.orderEnteredMonth{display:none!important}
      #countryTable.full th.orderEnteredMonth,#countryTable.full td.orderEnteredMonth{display:table-cell!important}
      #team:not(.undercarFull) .managerOrderEntered,#team:not(.undercarFull) .topOrderEntered{display:none!important}
      #team:not(.undercarFull) .managerMonth{grid-template-columns:48px 1.3fr 1fr 1fr 1fr!important}
      #team.undercarFull .managerMonth{grid-template-columns:48px 1.3fr 1fr 1fr 1fr 1fr!important}
      #collisionCountryCompactTable{min-width:1260px!important}
      #collisionCountryCompactTable .compactMgr td{background:#17191d!important;color:#fff;font-weight:900}
      #collisionCountryCompactTable .compactTotal td{background:#eef1f4;font-weight:900;border-top:1px solid #d7dce1}
      #collisionCountryCompactTable .compactGrand td{background:#17191d!important;color:#fff!important;font-weight:900;border-top:3px solid var(--blue)}
      #collisionCountryCompactTable td:first-child{font-weight:750}
      @media(max-width:900px){.overviewBrandNav{margin-left:8px;padding-left:8px}.overviewBrandNav>span{display:none}.overviewBrandNav .brandToggle{padding:4px 6px;font-size:9px}}
      @media(max-width:700px){#team:not(.undercarFull) .managerMonth,#team.undercarFull .managerMonth{grid-template-columns:42px repeat(2,1fr)!important}}
    `;
    document.head.appendChild(style);

    function installBrandNav(){
      const nav=document.querySelector('nav.tabs');
      const group=document.querySelector('#overview .brandToggleGroup')||document.querySelector('.brandToggleGroup');
      if(!nav||!group)return false;
      let wrap=document.getElementById('overviewBrandNav');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.id='overviewBrandNav';
        wrap.className='overviewBrandNav';
        const label=document.createElement('span');
        label.textContent='Collision Brands';
        wrap.appendChild(label);
        nav.appendChild(wrap);
      }
      if(group.parentElement!==wrap)wrap.appendChild(group);
      return true;
    }

    function cleanOverviewBrands(){
      const body=document.getElementById('collisionBrandBody');
      if(!body)return;
      for(const row of [...body.rows]){
        const name=(row.cells?.[0]?.textContent||'').trim().toLowerCase();
        if(name==='col + blackhawk total'||name==='col + blackhawk')row.style.display='none';
        if(row.classList.contains('brandInactive'))row.style.display='none';
        else if(name!=='col + blackhawk total'&&name!=='col + blackhawk')row.style.display='';
      }
      const note=document.querySelector('#overview .collisionBlock .execNote');
      if(note)note.textContent='Only active brands are included in the Collision totals.';
    }

    function syncBrandNavVisibility(){
      const wrap=document.getElementById('overviewBrandNav');
      if(!wrap)return;
      const active=document.querySelector('.tab[data-tab="overview"]')?.classList.contains('active');
      wrap.style.display=active?'flex':'none';
    }

    function syncUndercarFull(){
      const table=document.getElementById('countryTable');
      const team=document.getElementById('team');
      if(!table||!team)return;
      team.classList.toggle('undercarFull',table.classList.contains('full'));
    }

    const num=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};
    const metricZero=()=>({aopM:0,actual:0,o0:0,o1:0,forecast:0,gapM:0,aopY:0,ytdActual:0,ytdForecast:0,gapY:0});
    function metricFromRow(row){
      if(!row||row.cells.length<12)return null;
      return {aopM:num(row.cells[2].textContent),actual:num(row.cells[3].textContent),o0:num(row.cells[4].textContent),o1:num(row.cells[5].textContent),forecast:num(row.cells[6].textContent),gapM:num(row.cells[7].textContent),aopY:num(row.cells[8].textContent),ytdActual:num(row.cells[9].textContent),ytdForecast:num(row.cells[10].textContent),gapY:num(row.cells[11].textContent)};
    }
    function metricAdd(a,b){for(const k of Object.keys(a))a[k]+=Number(b?.[k]||0);return a;}
    function brandName(v){const s=String(v||'').trim().toLowerCase();return ['josam','car-o-liner','blackhawk'].includes(s)?s:null;}
    function signed(v){return(v>=0?'+':'')+usd.format(v);}
    function color(v){return v>=0?'good':'bad';}
    function compactRow(country,x,cls=''){
      return `<tr class="${cls}"><td>${country}</td><td class="num sepM">${usd.format(x.aopM)}</td><td class="num">${usd.format(x.actual)}</td><td class="num">${usd.format(x.o0)}</td><td class="num">${usd.format(x.o1)}</td><td class="num"><b>${usd.format(x.forecast)}</b></td><td class="num ${color(x.gapM)}"><b>${signed(x.gapM)}</b></td><td class="num sepY">${usd.format(x.aopY)}</td><td class="num">${usd.format(x.ytdActual)}</td><td class="num"><b>${usd.format(x.ytdForecast)}</b></td><td class="num ${color(x.gapY)}"><b>${signed(x.gapY)}</b></td></tr>`;
    }

    function renderCompactCountries(){
      const source=document.getElementById('collisionDetailTable');
      const body=source?.querySelector('tbody');
      const panel=source?.closest('.card.panel');
      const sourceWrap=source?.closest('.tableWrap');
      if(!source||!body||!panel||!sourceWrap)return false;
      if(body.rows.length===1&&body.rows[0].cells.length===1)return false;

      let wrap=document.getElementById('collisionCountryCompactWrap');
      if(!wrap){
        wrap=document.createElement('div');wrap.id='collisionCountryCompactWrap';wrap.className='tableWrap';
        const table=document.createElement('table');table.id='collisionCountryCompactTable';
        table.innerHTML='<thead></thead><tbody></tbody>';wrap.appendChild(table);
        sourceWrap.insertAdjacentElement('beforebegin',wrap);
      }
      sourceWrap.style.display='none';
      const table=document.getElementById('collisionCountryCompactTable');
      const monthTitle=(source.tHead?.rows?.[0]?.cells?.[2]?.textContent||'MONTH').trim();
      const yearTitle=(source.tHead?.rows?.[0]?.cells?.[3]?.textContent||'YTD').trim();
      table.tHead.innerHTML=`<tr class="collisionGroupHead"><th>COUNTRY</th><th colspan="6" class="month">${monthTitle}</th><th colspan="4" class="year">${yearTitle}</th></tr><tr><th>Country</th><th class="num sepM">AOP</th><th class="num">Actual</th><th class="num">Ord0</th><th class="num">Ord1</th><th class="num">Forecast</th><th class="num">Gap</th><th class="num sepY">AOP YTD</th><th class="num">Actual YTD</th><th class="num">Forecast YTD</th><th class="num">Gap YTD</th></tr>`;

      const managers=[];let current=null;
      for(const row of [...body.rows]){
        if(row.classList.contains('mgr')){
          current={name:(row.cells?.[0]?.textContent||'').trim(),countries:new Map(),total:metricZero()};
          managers.push(current);continue;
        }
        if(!current||row.classList.contains('total')||row.classList.contains('collisionGrandTotal'))continue;
        const brand=brandName(row.cells?.[1]?.textContent);if(!brand||row.style.display==='none')continue;
        const country=(row.cells?.[0]?.textContent||'').trim();if(!country)continue;
        const m=metricFromRow(row);if(!m)continue;
        if(!current.countries.has(country))current.countries.set(country,metricZero());
        metricAdd(current.countries.get(country),m);metricAdd(current.total,m);
      }

      let html='',grand=metricZero();
      for(const manager of managers){
        if(!manager.countries.size)continue;
        html+=`<tr class="compactMgr"><td colspan="11">${manager.name}</td></tr>`;
        for(const [country,x] of [...manager.countries.entries()].sort((a,b)=>a[0].localeCompare(b[0])))html+=compactRow(country,x);
        html+=compactRow(manager.name+' TOTAL',manager.total,'compactTotal');
        metricAdd(grand,manager.total);
      }
      if(managers.some(m=>m.countries.size))html+=compactRow('TOTAL EUROPE EAST',grand,'compactGrand');
      table.tBodies[0].innerHTML=html||'<tr><td colspan="11">No matching data</td></tr>';
      const p=panel.querySelector('p');if(p)p.textContent='One row per country · values aggregated across the active brands.';
      return true;
    }

    let compactTimer=null;
    function scheduleCompact(delay=80){clearTimeout(compactTimer);compactTimer=setTimeout(renderCompactCountries,delay);}

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const ok=installBrandNav();
      cleanOverviewBrands();
      syncBrandNavVisibility();
      syncUndercarFull();
      renderCompactCountries();
      if(ok&&tries>5)clearInterval(timer);
      if(tries>50)clearInterval(timer);
    },200);

    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{setTimeout(syncBrandNavVisibility,0);if(btn.dataset.tab==='collisionDetail')scheduleCompact(100);}));
    document.getElementById('fullBtn')?.addEventListener('click',()=>setTimeout(syncUndercarFull,0));
    document.getElementById('collisionManagerDetail')?.addEventListener('change',()=>scheduleCompact(150));
    document.getElementById('collisionDetail')?.addEventListener('change',e=>{if(e.target.matches('.detailBrandToggle input'))scheduleCompact(150);});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(cleanOverviewBrands,500);setTimeout(cleanOverviewBrands,1500);setTimeout(cleanOverviewBrands,3000);scheduleCompact(700);setTimeout(renderCompactCountries,1700);setTimeout(renderCompactCountries,3200);});

    const brandBody=document.getElementById('collisionBrandBody');
    if(brandBody)new MutationObserver(()=>requestAnimationFrame(cleanOverviewBrands)).observe(brandBody,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    const detailBody=document.querySelector('#collisionDetailTable tbody');
    if(detailBody)new MutationObserver(()=>scheduleCompact(100)).observe(detailBody,{childList:true,subtree:true});
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
