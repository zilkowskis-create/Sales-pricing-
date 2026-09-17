(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v186.js?base=2026091718&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.18')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.18','2026.09.17.19');
    await (0,eval)(src);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const money=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};

    const style=document.createElement('style');
    style.textContent=`
      #collisionDetail .collisionMgrMonth{grid-template-columns:44px 1.3fr 1fr 1fr 1fr!important}
      #collisionDetail #collisionCountryCompactTable{min-width:1120px!important}
      #collisionDetail #collisionDetailBrandCombinedTable{min-width:1180px!important}
      @media(max-width:760px){#collisionDetail .collisionMgrMonth{grid-template-columns:40px repeat(2,1fr)!important}}
    `;
    document.head.appendChild(style);

    function mergeManagerOverview(){
      for(const row of document.querySelectorAll('#collisionDetail .collisionMgrMonth')){
        const blocks=[...row.children].filter(el=>el.querySelector?.('small'));
        const o0=blocks.find(el=>/^ord0$/i.test((el.querySelector('small')?.textContent||'').trim()));
        const o1=blocks.find(el=>/^ord1$/i.test((el.querySelector('small')?.textContent||'').trim()));
        const orders=blocks.find(el=>/^orders$/i.test((el.querySelector('small')?.textContent||'').trim()));
        if(orders&&o1){o1.remove();continue;}
        if(!o0||!o1)continue;
        const total=money(o0.querySelector('b')?.textContent)+money(o1.querySelector('b')?.textContent);
        const label=o0.querySelector('small');if(label)label.textContent='Orders';
        const value=o0.querySelector('b');if(value)value.textContent=usd.format(total);
        o1.remove();
      }
    }

    function mergeKpis(){
      const box=document.getElementById('collisionDetailKpis');if(!box)return;
      const cards=[...box.children];
      const labelOf=c=>(c.querySelector('.label')?.textContent||'').trim();
      const existing=cards.find(c=>/^orders$/i.test(labelOf(c))||/^ord0\s*\+\s*ord1$/i.test(labelOf(c)));
      if(existing){const l=existing.querySelector('.label');if(l)l.textContent='Orders';return;}
      const o0=cards.find(c=>/^ord0$/i.test(labelOf(c))),o1=cards.find(c=>/^ord1$/i.test(labelOf(c)));
      if(!o0||!o1)return;
      const total=money(o0.querySelector('.value')?.textContent)+money(o1.querySelector('.value')?.textContent);
      const l=o0.querySelector('.label');if(l)l.textContent='Orders';
      const v=o0.querySelector('.value');if(v)v.textContent=usd.format(total);
      o1.remove();
    }

    function mergeTable(table){
      if(!table||!table.tHead||!table.tBodies?.[0])return;
      const header=[...table.tHead.rows].reverse().find(r=>[...r.cells].some(c=>/^ord0$/i.test((c.textContent||'').trim()))&&[...r.cells].some(c=>/^ord1$/i.test((c.textContent||'').trim())));
      if(!header)return;
      const cells=[...header.cells];
      const i0=cells.findIndex(c=>/^ord0$/i.test((c.textContent||'').trim()));
      const i1=cells.findIndex(c=>/^ord1$/i.test((c.textContent||'').trim()));
      if(i0<0||i1<0||i1!==i0+1)return;
      header.cells[i0].textContent='Orders';
      header.deleteCell(i1);
      for(const row of [...table.tBodies[0].rows]){
        if(row.cells.length<=i1)continue;
        const total=money(row.cells[i0].textContent)+money(row.cells[i1].textContent);
        row.cells[i0].innerHTML='<b>'+usd.format(total)+'</b>';
        row.deleteCell(i1);
      }
      for(const top of [...table.tHead.rows]){
        if(top===header)continue;
        for(const c of [...top.cells]){
          const txt=(c.textContent||'').trim().toUpperCase();
          if((txt.includes('MONTH')||txt.includes('2026'))&&c.colSpan>=6)c.colSpan=Math.max(1,c.colSpan-1);
        }
      }
    }

    function refreshDetail(){
      mergeManagerOverview();
      mergeKpis();
      mergeTable(document.getElementById('collisionCountryCompactTable'));
      mergeTable(document.getElementById('collisionDetailBrandCombinedTable'));
    }

    let scheduled=false;
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refreshDetail();});}
    const pane=document.getElementById('collisionDetail');
    if(pane)new MutationObserver(schedule).observe(pane,{childList:true,subtree:true});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(refreshDetail,500);setTimeout(refreshDetail,1500);setTimeout(refreshDetail,3000);});
    document.querySelector('.tab[data-tab="collisionDetail"]')?.addEventListener('click',()=>{setTimeout(refreshDetail,80);setTimeout(refreshDetail,400);});
    setTimeout(refreshDetail,250);setTimeout(refreshDetail,900);setTimeout(refreshDetail,1800);
  }catch(e){console.error(e);if(status)status.textContent='App load error: '+(e?.message||String(e));}
})();
