(() => {
  'use strict';
  const euroToNumber = (text) => {
    let s = String(text || '').replace(/\s/g,'').replace(/€/g,'').replace(/\./g,'').replace(',', '.').replace(/[^0-9+\-.]/g,'');
    const n = Number(s); return Number.isFinite(n) ? n : 0;
  };
  const euro = new Intl.NumberFormat('de-DE', {style:'currency',currency:'EUR',maximumFractionDigits:0});

  function ensureStyle(){
    if(document.getElementById('oeMonthStyle')) return;
    const st=document.createElement('style'); st.id='oeMonthStyle';
    st.textContent=`
      #countryTable .orderEntered{display:table-cell!important;background:#fff8f8;font-weight:750}
      .orderEnteredSummary{margin-left:auto;display:flex;align-items:baseline;gap:6px;padding-left:12px}
      .orderEnteredSummary small{font-size:8px;color:#858a92;text-transform:uppercase;font-weight:850}
      .orderEnteredSummary b{font-size:13px;color:#222}
      .managerMonth{grid-template-columns:48px 1.25fr .9fr .9fr .9fr .9fr!important}
      .managerOE small{display:block;font-size:8px;text-transform:uppercase;color:#858a92;font-weight:800}
      .managerOE b{display:block;font-size:11.5px;white-space:nowrap}
      @media(max-width:700px){.managerMonth{grid-template-columns:42px repeat(2,1fr)!important}}
    `;
    document.head.appendChild(st);
  }

  function sync(){
    const table=document.getElementById('countryTable');
    if(!table) return false;
    ensureStyle();
    const headRow=table.querySelector('thead tr');
    if(!headRow) return false;
    const oeHead=[...headRow.cells].find(c=>c.textContent.trim()==='Order Entered');
    if(oeHead){
      oeHead.classList.add('orderEntered');
      const anchor=headRow.cells[3];
      if(anchor && anchor!==oeHead) headRow.insertBefore(oeHead,anchor);
    }

    table.querySelectorAll('tbody tr').forEach(row=>{
      const oe=row.querySelector('td.more');
      if(!oe) return;
      oe.classList.add('orderEntered');
      const anchor=row.cells[3];
      if(anchor && anchor!==oe) row.insertBefore(oe,anchor);
    });

    const sums={};
    let total=0;
    table.querySelectorAll('tbody tr.mgrRow').forEach(row=>{
      const manager=(row.cells[0]?.textContent||'').trim();
      const oe=row.querySelector('td.orderEntered');
      const value=euroToNumber(oe?.textContent);
      if(manager){sums[manager]=value; total+=value;}
    });

    document.querySelectorAll('.managerGoal').forEach(card=>{
      const manager=(card.querySelector('.managerName b')?.textContent||'').trim();
      const month=card.querySelector('.managerMonth');
      if(!month || !manager) return;
      let box=month.querySelector('.managerOE');
      if(!box){
        box=document.createElement('div'); box.className='managerOE';
        const firstMetric=month.querySelector('div');
        if(firstMetric && firstMetric.nextSibling) month.insertBefore(box, firstMetric.nextSibling); else month.appendChild(box);
      }
      box.innerHTML=`<small>Order Entered</small><b>${euro.format(sums[manager]||0)}</b>`;
    });

    const monthSection=document.querySelector('#kpis .goalSection.monthly .sectionHead');
    if(monthSection){
      let box=monthSection.querySelector('.orderEnteredSummary');
      if(!box){box=document.createElement('div');box.className='orderEnteredSummary';monthSection.appendChild(box);}
      box.innerHTML=`<small>Order Entered</small><b>${euro.format(total)}</b>`;
    }
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++; if(sync() && tries>5) clearInterval(timer); if(tries>80) clearInterval(timer);},250);
  ['manager','file','fullBtn'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{setTimeout(sync,100);setTimeout(sync,700);setTimeout(sync,1800);}));
  document.getElementById('fullBtn')?.addEventListener('click',()=>setTimeout(sync,50));
})();
