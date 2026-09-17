(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v180.js?base=2026091710',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    const from="const APP_VERSION = '2026.09.17.10';";
    const to="const APP_VERSION = '2026.09.17.11';";
    if(!src.includes(from)) throw new Error('Version upgrade point not found');
    src=src.replace(from,to);
    (0,eval)(src);

    let scheduled=false;
    function euroFromCell(text){
      return String(text||'').trim();
    }
    function schedulePatch(){
      if(scheduled) return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;applyOverviewPatch();});
    }
    function applyOverviewPatch(){
      const table=document.getElementById('countryTable');
      const body=document.getElementById('countryBody');
      if(!table||!body) return;

      const headRow=table.querySelector('thead tr');
      if(headRow && headRow.dataset.oeMoved!=='1'){
        const cells=[...headRow.children];
        const oe=cells.find(c=>/order entered/i.test(c.textContent||''));
        const backlog=cells.find(c=>/backlog ord1/i.test(c.textContent||''));
        if(oe&&backlog){
          oe.classList.remove('more');
          oe.classList.add('orderEnteredMonth');
          headRow.insertBefore(oe,backlog);
          headRow.dataset.oeMoved='1';
        }
      }

      for(const row of body.querySelectorAll('tr')){
        if(row.dataset.oeMoved==='1') continue;
        const cells=[...row.children];
        if(cells.length>=13){
          const oe=cells[11];
          const backlog=cells[3];
          oe.classList.remove('more');
          oe.classList.add('orderEnteredMonth');
          row.insertBefore(oe,backlog);
        }
        row.dataset.oeMoved='1';
      }

      const managerRows=[...body.querySelectorAll('tr.mgrRow')];
      const managerOE=new Map();
      for(const row of managerRows){
        const cells=[...row.children];
        const name=(cells[0]?.textContent||'').trim();
        const oe=(cells[3]?.textContent||'').trim();
        if(name&&oe) managerOE.set(name,oe);
      }
      const totalRow=body.querySelector('tr.teamRow');
      const totalOE=totalRow && totalRow.children[3] ? euroFromCell(totalRow.children[3].textContent) : '';

      document.querySelectorAll('#cards .managerGoal').forEach(card=>{
        if(card.querySelector('.managerOrderEntered')) return;
        const name=(card.querySelector('.managerName b')?.textContent||'').trim();
        const month=card.querySelector('.managerMonth');
        const value=managerOE.get(name);
        if(month&&value){
          const box=document.createElement('div');
          box.className='managerOrderEntered';
          box.innerHTML='<small>Order Entered</small><b>'+value+'</b>';
          const firstMetric=month.querySelector('div');
          if(firstMetric&&firstMetric.nextSibling) month.insertBefore(box,firstMetric.nextSibling);
          else month.appendChild(box);
        }
      });

      const monthSection=document.querySelector('#kpis .goalSection.monthly');
      if(monthSection && totalOE && !monthSection.querySelector('.topOrderEntered')){
        const box=monthSection.querySelector('.goalBox');
        if(box){
          const line=document.createElement('div');
          line.className='goalSub topOrderEntered';
          line.innerHTML='Order Entered <b>'+totalOE+'</b>';
          box.appendChild(line);
        }
      }
    }

    const css=document.createElement('style');
    css.textContent=`
      #countryTable th.orderEnteredMonth,#countryTable td.orderEnteredMonth{display:table-cell!important;background:#fff7f7;font-weight:800;border-left:3px solid #efb7ba!important}
      #countryTable th.orderEnteredMonth{color:#a51d22}
      .managerMonth{grid-template-columns:48px 1.3fr 1fr 1fr 1fr 1fr!important}
      .managerOrderEntered small{display:block;font-size:8px;text-transform:uppercase;color:#858a92;font-weight:800}
      .managerOrderEntered b{display:block;font-size:11.5px;white-space:nowrap}
      .topOrderEntered{margin-top:3px;padding-top:3px;border-top:1px solid #f2d5d6}
      @media(max-width:700px){.managerMonth{grid-template-columns:42px repeat(2,1fr)!important}}
    `;
    document.head.appendChild(css);

    const observer=new MutationObserver(schedulePatch);
    const team=document.getElementById('team');
    if(team) observer.observe(team,{childList:true,subtree:true});
    setTimeout(schedulePatch,150);
    setTimeout(schedulePatch,600);
    setTimeout(schedulePatch,1500);
  }catch(e){
    console.error(e);
    if(status) status.textContent='App load error: '+(e?.message||String(e));
  }
})();
