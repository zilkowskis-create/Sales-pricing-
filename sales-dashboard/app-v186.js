(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let src=await fetch('./app-v185.js?base=2026091717&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Previous app version could not be loaded');return r.text();});
    if(!src.includes('2026.09.17.17')) throw new Error('Version upgrade point not found');
    src=src.replace('2026.09.17.17','2026.09.17.18');
    await (0,eval)(src);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const money=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};

    const style=document.createElement('style');
    style.textContent=`
      #collisionOverview{display:none!important}
      #collisionOverviewCombined{grid-template-columns:repeat(6,1fr)}
      #overview .brandMini>table:first-of-type{display:none!important}
      #collisionBrandCompactTable{display:table!important;min-width:800px}
      #collisionDetailBrandTable{display:none!important}
      #collisionDetailBrandCombinedTable{display:table!important;min-width:1300px}
      .collisionMgrMonth{grid-template-columns:44px 1.25fr 1fr 1fr 1fr!important}
      @media(max-width:760px){.collisionMgrMonth{grid-template-columns:40px repeat(2,1fr)!important}}
    `;
    document.head.appendChild(style);

    function cardMap(){
      const map=new Map();
      for(const card of document.querySelectorAll('#collisionOverview .execKpi')){
        const label=(card.querySelector('span')?.textContent||'').trim();
        map.set(label,card);
      }
      return map;
    }
    function renderOverview(){
      const source=document.getElementById('collisionOverview');if(!source||!source.children.length)return;
      const map=cardMap(),o0=map.get('Ord0'),o1=map.get('Ord1');
      if(!o0&&!o1)return;
      let out=document.getElementById('collisionOverviewCombined');
      if(!out){out=document.createElement('div');out.id='collisionOverviewCombined';out.className='execGrid';source.insertAdjacentElement('afterend',out);}
      const copy=(name,cls='')=>{const c=map.get(name);if(!c)return'';const b=c.querySelector('b');return `<div class="execKpi ${cls}"><span>${name}</span><b class="${b?.className||''}">${b?.textContent||'—'}</b></div>`;};
      const orders=money(o0?.querySelector('b')?.textContent)+money(o1?.querySelector('b')?.textContent);
      out.innerHTML=copy('Actual')+`<div class="execKpi"><span>Orders</span><b>${usd.format(orders)}</b></div>`+copy('Forecast','emphasis')+copy('Monthly AOP')+copy('Gap vs AOP')+copy('AOP %');
    }

    function renderOverviewBrands(){
      const src=document.querySelector('#overview .brandMini>table:first-of-type');
      const body=document.getElementById('collisionBrandBody');if(!src||!body)return;
      let table=document.getElementById('collisionBrandCompactTable');
      if(!table){table=document.createElement('table');table.id='collisionBrandCompactTable';src.insertAdjacentElement('afterend',table);}
      table.innerHTML='<thead><tr><th>Brand</th><th class="num">AOP</th><th class="num">Actual</th><th class="num">Orders</th><th class="num">Forecast</th><th class="num">Gap</th><th class="num">AOP %</th></tr></thead><tbody></tbody>';
      let html='';
      for(const r of [...body.rows]){
        if(r.cells.length<8)continue;
        const name=(r.cells[0].textContent||'').trim();
        if(/COL\s*\+\s*BlackHawk/i.test(name)||r.classList.contains('brandTotal')||r.classList.contains('brandInactive')||r.style.display==='none')continue;
        const orders=money(r.cells[3].textContent)+money(r.cells[4].textContent);
        html+=`<tr><td>${r.cells[0].innerHTML}</td><td class="num">${r.cells[1].innerHTML}</td><td class="num">${r.cells[2].innerHTML}</td><td class="num"><b>${usd.format(orders)}</b></td><td class="num">${r.cells[5].innerHTML}</td><td class="num ${r.cells[6].classList.contains('good')?'good':r.cells[6].classList.contains('bad')?'bad':''}">${r.cells[6].innerHTML}</td><td class="num ${r.cells[7].classList.contains('good')?'good':r.cells[7].classList.contains('bad')?'bad':''}">${r.cells[7].innerHTML}</td></tr>`;
      }
      table.tBodies[0].innerHTML=html||'<tr><td colspan="7" class="muted">Load Collision .xlsx to show brand totals.</td></tr>';
    }

    function mergeManagerCards(){
      for(const row of document.querySelectorAll('.collisionMgrMonth')){
        const metrics=[...row.querySelectorAll('div')];
        const o0=metrics.find(d=>(d.querySelector('small')?.textContent||'').trim()==='Ord0');
        const o1=metrics.find(d=>(d.querySelector('small')?.textContent||'').trim()==='Ord1');
        if(!o0||!o1)continue;
        o0.querySelector('small').textContent='Orders';
        const b=o0.querySelector('b');if(b)b.textContent=usd.format(money(b.textContent)+money(o1.querySelector('b')?.textContent));
        o1.style.display='none';
      }
      for(const label of document.querySelectorAll('#collisionDetailKpis .label'))if((label.textContent||'').trim()==='Ord0 + Ord1')label.textContent='Orders';
    }

    function mergeCompactCountries(){
      const table=document.getElementById('collisionCountryCompactTable');if(!table)return;
      const h1=table.tHead?.rows?.[0],h2=table.tHead?.rows?.[1];
      if(h1&&h1.cells.length>=3&&h1.cells[1].colSpan===6)h1.cells[1].colSpan=5;
      if(h2&&h2.cells.length===11){h2.cells[3].textContent='Orders';h2.deleteCell(4);}
      for(const r of [...table.tBodies?.[0]?.rows||[]]){
        if(r.cells.length!==11)continue;
        const orders=money(r.cells[3].textContent)+money(r.cells[4].textContent);
        r.cells[3].innerHTML='<b>'+usd.format(orders)+'</b>';
        r.deleteCell(4);
      }
    }

    function renderBrandDetail(){
      const src=document.getElementById('collisionDetailBrandTable');if(!src||!src.tHead||!src.tBodies?.[0])return;
      if(src.tBodies[0].rows.length===1&&src.tBodies[0].rows[0].cells.length===1)return;
      let clone=document.getElementById('collisionDetailBrandCombinedTable');
      if(clone)clone.remove();
      clone=src.cloneNode(true);clone.id='collisionDetailBrandCombinedTable';
      const h1=clone.tHead?.rows?.[0],h2=clone.tHead?.rows?.[1];
      if(h1&&h1.cells.length>=3&&h1.cells[2].colSpan===6)h1.cells[2].colSpan=5;
      if(h2&&h2.cells.length===12){h2.cells[4].textContent='Orders';h2.deleteCell(5);}
      for(const r of [...clone.tBodies[0].rows]){
        if(r.cells.length!==12)continue;
        const orders=money(r.cells[4].textContent)+money(r.cells[5].textContent);
        r.cells[4].innerHTML='<b>'+usd.format(orders)+'</b>';
        r.deleteCell(5);
      }
      src.insertAdjacentElement('afterend',clone);
    }

    let scheduled=false;
    function refresh(){
      if(scheduled)return;scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;renderOverview();renderOverviewBrands();mergeManagerCards();mergeCompactCountries();renderBrandDetail();});
    }

    const targets=['collisionOverview','collisionBrandBody','collisionManagerRows','collisionCountryCompactWrap','collisionDetailBrandTable'];
    for(const id of targets){const el=document.getElementById(id);if(el)new MutationObserver(refresh).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});}
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(refresh,500);setTimeout(refresh,1500);setTimeout(refresh,3000);});
    document.getElementById('collisionDetail')?.addEventListener('change',()=>setTimeout(refresh,120));
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTimeout(refresh,80)));
    setTimeout(refresh,250);setTimeout(refresh,900);setTimeout(refresh,1800);
  }catch(e){console.error(e);if(status)status.textContent='App load error: '+(e?.message||String(e));}
})();
