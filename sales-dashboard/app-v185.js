(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v184.js?base=2026091715&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.15')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.15','2026.09.17.16');
    await (0,eval)(src);

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

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const ok=installBrandNav();
      cleanOverviewBrands();
      syncBrandNavVisibility();
      syncUndercarFull();
      if(ok&&tries>5)clearInterval(timer);
      if(tries>50)clearInterval(timer);
    },200);

    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>setTimeout(syncBrandNavVisibility,0)));
    document.getElementById('fullBtn')?.addEventListener('click',()=>setTimeout(syncUndercarFull,0));
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(cleanOverviewBrands,500);setTimeout(cleanOverviewBrands,1500);setTimeout(cleanOverviewBrands,3000);});

    const brandBody=document.getElementById('collisionBrandBody');
    if(brandBody)new MutationObserver(()=>requestAnimationFrame(cleanOverviewBrands)).observe(brandBody,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
