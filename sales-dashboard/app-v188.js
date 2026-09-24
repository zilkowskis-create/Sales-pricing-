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
