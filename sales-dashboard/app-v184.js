(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let base=await fetch('./app-v184-base.js?base=2026091714&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Base app could not be loaded');return r.text();});
    const oldLine="src=src.replace('2026.09.17.11','2026.09.17.13');";
    const newLine="src=src.replace('2026.09.17.11','2026.09.17.14');";
    if(!base.includes(oldLine)) throw new Error('Version upgrade point not found');
    base=base.replace(oldLine,newLine);
    await (0,eval)(base);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const pctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const activeBrands=new Set(['JOSAM','Car-O-Liner','BlackHawk']);

    const style=document.createElement('style');
    style.textContent=`
      #undercarOverview{grid-template-columns:repeat(6,1fr)}
      .brandToggleGroup{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto}
      .brandToggle{display:flex;align-items:center;gap:5px;border:1px solid #d7dade;border-radius:999px;padding:5px 8px;background:#fff;font-size:10px;font-weight:800;cursor:pointer;user-select:none}
      .brandToggle input{accent-color:var(--blue);margin:0}
      .brandToggle.off{opacity:.45;background:#f5f6f7}
      #collisionBrandBody tr.brandInactive td{opacity:.35}
      @media(max-width:900px){.collisionBlock .businessHead{align-items:flex-start;flex-wrap:wrap}.brandToggleGroup{order:3;width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);

    function cleanUndercar(){
      const box=document.getElementById('undercarOverview');
      if(!box)return;
      [...box.children].forEach(kpi=>{
        const label=(kpi.querySelector('span')?.textContent||'').trim().toLowerCase();
        if(label==='order entered'||label==='sales entered')kpi.remove();
      });
    }

    function parseMoney(text){
      const s=String(text||'').replace(/[^0-9+\-.]/g,'');
      const v=Number(s);return Number.isFinite(v)?v:0;
    }
    function findBrandRow(name){
      return [...document.querySelectorAll('#collisionBrandBody tr')].find(r=>(r.cells?.[0]?.textContent||'').trim().toLowerCase()===name.toLowerCase());
    }
    function valuesFromRow(row){
      if(!row||row.cells.length<8)return null;
      return {target:parseMoney(row.cells[1].textContent),actual:parseMoney(row.cells[2].textContent),o0:parseMoney(row.cells[3].textContent),o1:parseMoney(row.cells[4].textContent)};
    }
    function add(a,b){return{target:a.target+b.target,actual:a.actual+b.actual,o0:a.o0+b.o0,o1:a.o1+b.o1};}
    function zero(){return{target:0,actual:0,o0:0,o1:0};}
    function finish(x){x.forecast=x.actual+x.o0+x.o1;x.gap=x.forecast-x.target;x.attain=x.target?x.forecast/x.target:null;return x;}
    function formatSigned(v){return(v>=0?'+':'')+usd.format(v);}
    function gapClass(v){return v>=0?'good':'bad';}

    function refreshBrandRows(){
      const map={'JOSAM':'JOSAM','Car-O-Liner':'Car-O-Liner','BlackHawk':'BlackHawk'};
      for(const [key,label] of Object.entries(map)){
        const row=findBrandRow(label);if(row)row.classList.toggle('brandInactive',!activeBrands.has(key));
      }
      const col=findBrandRow('Car-O-Liner'),bh=findBrandRow('BlackHawk'),total=findBrandRow('COL + BlackHawk TOTAL');
      if(total&&col&&bh){
        let x=zero();
        if(activeBrands.has('Car-O-Liner'))x=add(x,valuesFromRow(col)||zero());
        if(activeBrands.has('BlackHawk'))x=add(x,valuesFromRow(bh)||zero());
        x=finish(x);
        total.cells[1].textContent=usd.format(x.target);
        total.cells[2].textContent=usd.format(x.actual);
        total.cells[3].textContent=usd.format(x.o0);
        total.cells[4].textContent=usd.format(x.o1);
        total.cells[5].innerHTML='<b>'+usd.format(x.forecast)+'</b>';
        total.cells[6].innerHTML='<b>'+formatSigned(x.gap)+'</b>';
        total.cells[6].classList.remove('good','bad');total.cells[6].classList.add(gapClass(x.gap));
        total.cells[7].innerHTML='<b>'+(x.attain==null?'—':pctFmt.format(x.attain))+'</b>';
        total.cells[7].classList.remove('good','bad');if(x.attain!=null)total.cells[7].classList.add(x.attain>=1?'good':'bad');
      }
    }

    function recalcCollisionTotal(){
      const rows={
        'JOSAM':valuesFromRow(findBrandRow('JOSAM')),
        'Car-O-Liner':valuesFromRow(findBrandRow('Car-O-Liner')),
        'BlackHawk':valuesFromRow(findBrandRow('BlackHawk'))
      };
      if(!rows.JOSAM&&!rows['Car-O-Liner']&&!rows.BlackHawk)return;
      let t=zero();
      for(const b of activeBrands){if(rows[b])t=add(t,rows[b]);}
      t=finish(t);
      const box=document.getElementById('collisionOverview');
      if(box)box.innerHTML=`
        <div class="execKpi"><span>Actual</span><b>${usd.format(t.actual)}</b></div>
        <div class="execKpi"><span>Ord0</span><b>${usd.format(t.o0)}</b></div>
        <div class="execKpi"><span>Ord1</span><b>${usd.format(t.o1)}</b></div>
        <div class="execKpi emphasis"><span>Forecast</span><b>${usd.format(t.forecast)}</b></div>
        <div class="execKpi"><span>Monthly AOP</span><b>${usd.format(t.target)}</b></div>
        <div class="execKpi"><span>Gap vs AOP</span><b class="${gapClass(t.gap)}">${formatSigned(t.gap)}</b></div>
        <div class="execKpi"><span>AOP %</span><b class="${t.attain!=null&&t.attain>=1?'good':'bad'}">${t.attain==null?'—':pctFmt.format(t.attain)}</b></div>`;
      refreshBrandRows();
    }

    function installToggles(){
      const head=document.querySelector('#overview .collisionBlock .businessHead');
      if(!head||head.querySelector('.brandToggleGroup'))return;
      const group=document.createElement('div');group.className='brandToggleGroup';
      for(const b of ['JOSAM','Car-O-Liner','BlackHawk']){
        const label=document.createElement('label');label.className='brandToggle';
        const input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.brand=b;
        const txt=document.createElement('span');txt.textContent=b;
        input.addEventListener('change',()=>{if(input.checked)activeBrands.add(b);else activeBrands.delete(b);label.classList.toggle('off',!input.checked);recalcCollisionTotal();});
        label.append(input,txt);group.appendChild(label);
      }
      const currency=head.querySelector('.currency');head.insertBefore(group,currency||null);
    }

    installToggles();cleanUndercar();
    let scheduled=false;
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;cleanUndercar();recalcCollisionTotal();});}
    const u=document.getElementById('undercarOverview');if(u)new MutationObserver(()=>cleanUndercar()).observe(u,{childList:true,subtree:true});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(schedule,300);setTimeout(schedule,1000);setTimeout(schedule,2200);});
    setTimeout(schedule,200);setTimeout(schedule,900);setTimeout(schedule,1800);
  }catch(e){console.error(e);if(status)status.textContent='App load error: '+(e?.message||String(e));}
})();
