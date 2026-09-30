(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v187.js?base=2026091719&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.19')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.19','2026.09.17.20');
    await (0,eval)(src);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const style=document.createElement('style');
    style.textContent=`
      #team:not(.undercarFullOE) .undercarOrderEntered{display:none!important}
      #team:not(.undercarFullOE) .managerOrderEntered{display:none!important}
      #team:not(.undercarFullOE) .topOrderEntered{display:none!important}
      #team.undercarFullOE th.undercarOrderEntered,
      #team.undercarFullOE td.undercarOrderEntered{display:table-cell!important}

      /* Order Entered should use the same font weight as the surrounding columns. */
      #countryTable th.orderEnteredMonth,
      #countryTable th.undercarOrderEntered{font-weight:700!important}
      #countryTable tbody tr:not(.mgrRow):not(.teamRow) td.orderEnteredMonth,
      #countryTable tbody tr:not(.mgrRow):not(.teamRow) td.undercarOrderEntered{font-weight:400!important}

      /* Click-to-highlight country rows in both detail views. */
      #countryTable tbody tr.countrySelected td{background:#fff0f1!important}
      #countryTable tbody tr.countrySelected td:first-child{box-shadow:inset 4px 0 0 var(--red)}
      #collisionCountryCompactTable tbody tr.countrySelected td,
      #collisionDetailTable tbody tr.countrySelected td{background:#eef5ff!important}
      #collisionCountryCompactTable tbody tr.countrySelected td:first-child,
      #collisionDetailTable tbody tr.countrySelected td:first-child{box-shadow:inset 4px 0 0 var(--blue)}
      #countryTable tbody tr.countrySelectable,
      #collisionCountryCompactTable tbody tr.countrySelectable,
      #collisionDetailTable tbody tr.countrySelectable{cursor:pointer}
      #countryTable tbody tr.countrySelectable:hover td{background:#fff8f8}
      #collisionCountryCompactTable tbody tr.countrySelectable:hover td,
      #collisionDetailTable tbody tr.countrySelectable:hover td{background:#f6f9ff}
    `;
    document.head.appendChild(style);

    function markOrderEnteredColumn(){
      const team=document.getElementById('team');
      const table=document.getElementById('countryTable');
      if(!team||!table)return;
      const headRow=table.querySelector('thead tr:last-child')||table.querySelector('thead tr');
      if(!headRow)return;
      const heads=[...headRow.cells];
      const idx=heads.findIndex(c=>/order\s*entered/i.test(c.textContent||''));
      if(idx>=0){
        heads[idx].classList.add('undercarOrderEntered');
        for(const row of table.querySelectorAll('tbody tr')){
          if(row.cells[idx])row.cells[idx].classList.add('undercarOrderEntered');
        }
      }
      table.querySelectorAll('.orderEnteredMonth').forEach(el=>el.classList.add('undercarOrderEntered'));
    }

    function syncFullState(){
      const team=document.getElementById('team');
      const table=document.getElementById('countryTable');
      if(!team||!table)return;
      markOrderEnteredColumn();
      team.classList.toggle('undercarFullOE',table.classList.contains('full'));
    }

    const table=document.getElementById('countryTable');
    if(table){
      new MutationObserver(()=>requestAnimationFrame(syncFullState)).observe(table,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    const cards=document.getElementById('cards');
    if(cards)new MutationObserver(()=>requestAnimationFrame(syncFullState)).observe(cards,{childList:true,subtree:true});
    const kpis=document.getElementById('kpis');
    if(kpis)new MutationObserver(()=>requestAnimationFrame(syncFullState)).observe(kpis,{childList:true,subtree:true});
    document.getElementById('fullBtn')?.addEventListener('click',()=>{setTimeout(syncFullState,0);setTimeout(syncFullState,80);});
    document.getElementById('file')?.addEventListener('change',()=>{setTimeout(syncFullState,400);setTimeout(syncFullState,1200);setTimeout(syncFullState,2400);});
    setTimeout(syncFullState,150);setTimeout(syncFullState,700);setTimeout(syncFullState,1600);

    function isUndercarCountryRow(row){
      if(!row||row.parentElement?.tagName!=='TBODY')return false;
      if(row.classList.contains('mgrRow')||row.classList.contains('teamRow')||row.classList.contains('groupRow'))return false;
      if(row.cells.length<2)return false;
      const country=(row.cells[1]?.textContent||'').trim();
      return !!country&&!/\btotal\b/i.test(country);
    }

    function isCollisionCountryRow(row,compact){
      if(!row||row.parentElement?.tagName!=='TBODY')return false;
      if(row.classList.contains('compactMgr')||row.classList.contains('compactTotal')||row.classList.contains('compactGrand')||row.classList.contains('mgr')||row.classList.contains('total')||row.classList.contains('collisionGrandTotal'))return false;
      const idx=compact?0:0;
      const country=(row.cells[idx]?.textContent||'').trim();
      if(!country||/\btotal\b/i.test(country))return false;
      return row.cells.length>1;
    }

    function installCountrySelection(tableId,kind){
      const t=document.getElementById(tableId);
      if(!t)return;
      const compact=tableId==='collisionCountryCompactTable';
      for(const row of t.querySelectorAll('tbody tr')){
        const ok=kind==='undercar'?isUndercarCountryRow(row):isCollisionCountryRow(row,compact);
        row.classList.toggle('countrySelectable',ok);
        if(!ok)row.classList.remove('countrySelected');
      }
      if(t.dataset.countrySelectionInstalled==='1')return;
      t.dataset.countrySelectionInstalled='1';
      t.addEventListener('click',e=>{
        const row=e.target.closest('tbody tr');
        if(!row||!t.contains(row))return;
        const ok=kind==='undercar'?isUndercarCountryRow(row):isCollisionCountryRow(row,compact);
        if(!ok)return;
        const wasSelected=row.classList.contains('countrySelected');
        t.querySelectorAll('tbody tr.countrySelected').forEach(r=>r.classList.remove('countrySelected'));
        if(!wasSelected)row.classList.add('countrySelected');
      });
    }

    let countrySelectionPending=false;
    function syncCountrySelection(){
      if(countrySelectionPending)return;
      countrySelectionPending=true;
      requestAnimationFrame(()=>{
        countrySelectionPending=false;
        installCountrySelection('countryTable','undercar');
        installCountrySelection('collisionCountryCompactTable','collision');
        installCountrySelection('collisionDetailTable','collision');
      });
    }
    new MutationObserver(syncCountrySelection).observe(document.body,{childList:true,subtree:true});
    document.querySelector('.tab[data-tab="team"]')?.addEventListener('click',()=>setTimeout(syncCountrySelection,80));
    document.querySelector('.tab[data-tab="collisionDetail"]')?.addEventListener('click',()=>setTimeout(syncCountrySelection,80));
    document.getElementById('file')?.addEventListener('change',()=>{setTimeout(syncCountrySelection,500);setTimeout(syncCountrySelection,1600);});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(syncCountrySelection,700);setTimeout(syncCountrySelection,1800);setTimeout(syncCountrySelection,3200);});
    setTimeout(syncCountrySelection,250);setTimeout(syncCountrySelection,1200);

    // Monthly Overview: keep Undercar Brand Performance executive-level.
    // John Bean and Cartec remain separate; every other Undercar brand is included in Hofmann.
    const eur=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const pct=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    function euroNumber(text){
      let s=String(text||'').replace(/\s/g,'').replace(/€/g,'').replace(/[^0-9+\-.,]/g,'');
      if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
      else if(s.includes(','))s=s.replace(',','.');
      else if(s.includes('.')){
        const parts=s.split('.');
        if(parts.length>1&&parts.slice(1).every(p=>p.length===3))s=parts.join('');
      }
      const v=Number(s);return Number.isFinite(v)?v:0;
    }
    function undercarBrandGroup(name){
      const s=String(name||'').trim().toLowerCase();
      if(/john\s*bean|johnbean|\bjbc\b/.test(s))return'John Bean';
      if(/cartec/.test(s))return'Cartec';
      return'Hofmann';
    }
    function mergeUndercarBrandRows(){
      const panel=document.getElementById('undercarBrandPerformance');
      const rowsBox=panel?.querySelector('.brandPerfRows');
      if(!rowsBox||rowsBox.dataset.execGrouped==='1')return;
      const rows=[...rowsBox.querySelectorAll('.brandPerfRow')];
      if(!rows.length)return;
      const groups=new Map([
        ['Hofmann',{name:'Hofmann',sales:0,backlog:0,forecast:0}],
        ['John Bean',{name:'John Bean',sales:0,backlog:0,forecast:0}],
        ['Cartec',{name:'Cartec',sales:0,backlog:0,forecast:0}]
      ]);
      for(const row of rows){
        const name=row.querySelector('.brandPerfName')?.textContent||'';
        const forecast=euroNumber(row.querySelector('.brandPerfValue')?.textContent);
        const salesW=parseFloat(row.querySelector('.brandPerfSales')?.style.width)||0;
        const backlogW=parseFloat(row.querySelector('.brandPerfBacklog')?.style.width)||0;
        const totalW=salesW+backlogW;
        const sales=totalW>0?forecast*(salesW/totalW):forecast;
        const backlog=totalW>0?forecast*(backlogW/totalW):0;
        const g=groups.get(undercarBrandGroup(name));
        g.sales+=sales;g.backlog+=backlog;g.forecast+=forecast;
      }
      const list=['Hofmann','John Bean','Cartec'].map(name=>groups.get(name));
      const maxForecast=Math.max(...list.map(x=>Math.max(0,x.forecast)),1);
      const totalForecast=list.reduce((s,x)=>s+Math.max(0,x.forecast),0)||1;
      rowsBox.innerHTML=list.map(x=>{
        const forecast=Math.max(0,x.forecast),sales=Math.max(0,x.sales),backlog=Math.max(0,x.backlog);
        const overall=Math.min(100,forecast/maxForecast*100);
        const salesW=forecast?overall*(sales/forecast):0;
        const backlogW=forecast?overall*(backlog/forecast):0;
        const share=forecast/totalForecast;
        const title=x.name==='Hofmann'?'Hofmann · includes Other':x.name;
        return `<div class="brandPerfRow"><div class="brandPerfName" title="${title}">${x.name}</div><div class="brandPerfTrack"><div class="brandPerfSales" style="width:${salesW}%"></div><div class="brandPerfBacklog" style="width:${backlogW}%"></div></div><div class="brandPerfValue">${eur.format(x.forecast)}</div><div class="brandPerfPct">${pct.format(share)}</div></div>`;
      }).join('');
      rowsBox.dataset.execGrouped='1';
    }
    let brandPatchPending=false;
    function scheduleBrandPatch(){
      if(brandPatchPending)return;
      brandPatchPending=true;
      requestAnimationFrame(()=>{brandPatchPending=false;mergeUndercarBrandRows();});
    }
    new MutationObserver(scheduleBrandPatch).observe(document.body,{childList:true,subtree:true});
    document.querySelector('.tab[data-tab="overview"]')?.addEventListener('click',()=>setTimeout(scheduleBrandPatch,120));
    document.getElementById('file')?.addEventListener('change',()=>{setTimeout(scheduleBrandPatch,700);setTimeout(scheduleBrandPatch,1800);});
    setTimeout(scheduleBrandPatch,500);setTimeout(scheduleBrandPatch,1500);
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();