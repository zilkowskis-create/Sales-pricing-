(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v187.js?base=2026091719&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.19')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.19','2026.09.17.20');
    await (0,eval)(src);

    const css=document.createElement('style');
    css.textContent=`
      #team:not(.undercarFullOE) .undercarOrderEntered{display:none!important}
      #team:not(.undercarFullOE) .managerOrderEntered{display:none!important}
      #team:not(.undercarFullOE) .topOrderEntered{display:none!important}
      #team.undercarFullOE th.undercarOrderEntered,
      #team.undercarFullOE td.undercarOrderEntered{display:table-cell!important}
    `;
    document.head.appendChild(css);

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
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
