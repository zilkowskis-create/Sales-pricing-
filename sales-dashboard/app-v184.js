(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let base=await fetch('./app-v184-base.js?base=2026091715&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Base app could not be loaded');return r.text();});
    const oldLine="src=src.replace('2026.09.17.11','2026.09.17.13');";
    const newLine="src=src.replace('2026.09.17.11','2026.09.17.15');";
    if(!base.includes(oldLine)) throw new Error('Version upgrade point not found');
    base=base.replace(oldLine,newLine);
    await (0,eval)(base);

    const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const pctFmt=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
    const MANAGER_ORDER=['Sergej','Mindaugas Deikus','Ruslan Sollano','Michal Adamiec'];
    const overviewBrands=new Set(['JOSAM','Car-O-Liner','BlackHawk']);
    const detailBrands=new Set(['JOSAM','Car-O-Liner','BlackHawk']);

    const style=document.createElement('style');
    style.textContent=`
      #undercarOverview{grid-template-columns:repeat(6,1fr)}
      .brandToggleGroup,.detailBrandToggleGroup{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto}
      .brandToggle,.detailBrandToggle{display:flex;align-items:center;gap:5px;border:1px solid #d7dade;border-radius:999px;padding:5px 8px;background:#fff;font-size:10px;font-weight:800;cursor:pointer;user-select:none}
      .brandToggle input,.detailBrandToggle input{accent-color:var(--blue);margin:0}
      .brandToggle.off,.detailBrandToggle.off{opacity:.45;background:#f5f6f7}
      #collisionBrandBody tr.brandInactive td{opacity:.35}
      #collisionBrandDetail{display:none!important}
      .collisionManagerOverview{margin:0 0 10px}
      .collisionManagerOverviewTitle{display:flex;justify-content:space-between;align-items:center;margin:0 0 5px;padding:0 2px}.collisionManagerOverviewTitle b{font-size:14px}.collisionManagerOverviewTitle span{font-size:10px;color:var(--muted)}
      .collisionMgrRow{display:grid;grid-template-columns:175px 1.65fr 1fr;background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:5px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.035)}
      .collisionMgrName{padding:8px 10px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #e6e9ec}.collisionMgrName b{font-size:13px}.collisionMgrName span{font-size:9px;color:#7f848c}
      .collisionMgrMonth,.collisionMgrYear{display:grid;align-items:center;gap:9px;padding:6px 10px}.collisionMgrMonth{grid-template-columns:44px 1.15fr .8fr .8fr 1fr 1fr;border-right:2px solid #dfe3e7}.collisionMgrYear{grid-template-columns:40px 1.25fr 1.2fr 1fr}
      .collisionMgrMonth small,.collisionMgrYear small{display:block;font-size:8px;text-transform:uppercase;color:#858a92;font-weight:800}.collisionMgrMonth b,.collisionMgrYear b{display:block;font-size:11.5px;white-space:nowrap}
      .collisionMiniTitle{font-size:8px;font-weight:900;letter-spacing:.08em;color:#fff;border-radius:4px;padding:3px 5px;text-align:center}.collisionMgrMonth .collisionMiniTitle{background:var(--red)}.collisionMgrYear .collisionMiniTitle{background:var(--blue)}
      .collisionGrandTotal td{background:#17191d!important;color:#fff!important;font-weight:900;border-top:3px solid var(--blue)}
      .collisionRevenueTotal{display:flex;justify-content:flex-end;gap:18px;align-items:baseline;margin:0 0 7px;padding:7px 10px;background:#f6f7f8;border:1px solid #e3e6e9;border-radius:8px;font-size:10px;color:var(--muted)}.collisionRevenueTotal b{font-size:15px;color:var(--ink)}
      .collisionBrandPanelHead{display:flex;justify-content:space-between;gap:10px;align-items:center}.collisionCollapseBtn{border:1px solid #d7dade;background:#fff;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer}.collisionBrandCollapsed{display:none!important}
      @media(max-width:1050px){.collisionMgrRow{grid-template-columns:150px 1fr}.collisionMgrYear{grid-column:2;border-top:1px solid #edf0f2}.collisionMgrName{grid-row:1/3}.collisionMgrMonth{border-right:0}}
      @media(max-width:760px){.collisionBlock .businessHead{align-items:flex-start;flex-wrap:wrap}.brandToggleGroup{order:3;width:100%;margin-left:0}.collisionMgrRow{display:block}.collisionMgrMonth,.collisionMgrYear{grid-template-columns:40px repeat(2,1fr)}.collisionMgrName{border-right:0;border-bottom:1px solid #e6e9ec}.collisionRevenueTotal{justify-content:flex-start;flex-wrap:wrap}}
    `;
    document.head.appendChild(style);

    const parseMoney=text=>{const s=String(text||'').replace(/,/g,'').replace(/[^0-9+\-.]/g,'');const v=Number(s);return Number.isFinite(v)?v:0;};
    const signed=v=>(v>=0?'+':'')+usd.format(v);
    const good=v=>v>=0?'good':'bad';
    const zero=()=>({aopM:0,actual:0,o0:0,o1:0,forecast:0,gapM:0,aopY:0,ytdActual:0,ytdForecast:0,gapY:0});
    const add=(a,b)=>{const x=zero();for(const k of Object.keys(x))x[k]=(a[k]||0)+(b[k]||0);return x;};
    const finish=x=>{x.forecast=x.actual+x.o0+x.o1;x.gapM=x.forecast-x.aopM;x.ytdForecast=x.ytdActual+x.o0+x.o1;x.gapY=x.ytdForecast-x.aopY;return x;};
    const brandKey=v=>{const s=String(v||'').trim().toLowerCase();if(s==='josam')return'JOSAM';if(s==='car-o-liner')return'Car-O-Liner';if(s==='blackhawk')return'BlackHawk';return null;};

    function cleanUndercar(){
      const box=document.getElementById('undercarOverview');if(!box)return;
      [...box.children].forEach(kpi=>{const label=(kpi.querySelector('span')?.textContent||'').trim().toLowerCase();if(label==='order entered'||label==='sales entered')kpi.remove();});
    }

    function findOverviewBrandRow(name){return [...document.querySelectorAll('#collisionBrandBody tr')].find(r=>(r.cells?.[0]?.textContent||'').trim().toLowerCase()===name.toLowerCase());}
    function overviewValues(row){if(!row||row.cells.length<8)return null;return{target:parseMoney(row.cells[1].textContent),actual:parseMoney(row.cells[2].textContent),o0:parseMoney(row.cells[3].textContent),o1:parseMoney(row.cells[4].textContent)};}
    function overviewAdd(a,b){return{target:a.target+b.target,actual:a.actual+b.actual,o0:a.o0+b.o0,o1:a.o1+b.o1};}
    function overviewFinish(x){x.forecast=x.actual+x.o0+x.o1;x.gap=x.forecast-x.target;x.attain=x.target?x.forecast/x.target:null;return x;}
    function overviewZero(){return{target:0,actual:0,o0:0,o1:0};}

    function refreshOverviewBrands(){
      for(const b of ['JOSAM','Car-O-Liner','BlackHawk']){const r=findOverviewBrandRow(b);if(r)r.classList.toggle('brandInactive',!overviewBrands.has(b));}
      const col=findOverviewBrandRow('Car-O-Liner'),bh=findOverviewBrandRow('BlackHawk'),total=findOverviewBrandRow('COL + BlackHawk TOTAL');
      if(total&&col&&bh){let x=overviewZero();if(overviewBrands.has('Car-O-Liner'))x=overviewAdd(x,overviewValues(col)||overviewZero());if(overviewBrands.has('BlackHawk'))x=overviewAdd(x,overviewValues(bh)||overviewZero());x=overviewFinish(x);total.cells[1].textContent=usd.format(x.target);total.cells[2].textContent=usd.format(x.actual);total.cells[3].textContent=usd.format(x.o0);total.cells[4].textContent=usd.format(x.o1);total.cells[5].innerHTML='<b>'+usd.format(x.forecast)+'</b>';total.cells[6].innerHTML='<b>'+signed(x.gap)+'</b>';total.cells[6].classList.remove('good','bad');total.cells[6].classList.add(good(x.gap));total.cells[7].innerHTML='<b>'+(x.attain==null?'—':pctFmt.format(x.attain))+'</b>';total.cells[7].classList.remove('good','bad');if(x.attain!=null)total.cells[7].classList.add(x.attain>=1?'good':'bad');}
    }
    function recalcOverviewCollision(){
      const rows={'JOSAM':overviewValues(findOverviewBrandRow('JOSAM')),'Car-O-Liner':overviewValues(findOverviewBrandRow('Car-O-Liner')),'BlackHawk':overviewValues(findOverviewBrandRow('BlackHawk'))};
      if(!rows.JOSAM&&!rows['Car-O-Liner']&&!rows.BlackHawk)return;
      let t=overviewZero();for(const b of overviewBrands){if(rows[b])t=overviewAdd(t,rows[b]);}t=overviewFinish(t);
      const box=document.getElementById('collisionOverview');if(box)box.innerHTML=`<div class="execKpi"><span>Actual</span><b>${usd.format(t.actual)}</b></div><div class="execKpi"><span>Ord0</span><b>${usd.format(t.o0)}</b></div><div class="execKpi"><span>Ord1</span><b>${usd.format(t.o1)}</b></div><div class="execKpi emphasis"><span>Forecast</span><b>${usd.format(t.forecast)}</b></div><div class="execKpi"><span>Monthly AOP</span><b>${usd.format(t.target)}</b></div><div class="execKpi"><span>Gap vs AOP</span><b class="${good(t.gap)}">${signed(t.gap)}</b></div><div class="execKpi"><span>AOP %</span><b class="${t.attain!=null&&t.attain>=1?'good':'bad'}">${t.attain==null?'—':pctFmt.format(t.attain)}</b></div>`;
      refreshOverviewBrands();
    }
    function installOverviewToggles(){
      const head=document.querySelector('#overview .collisionBlock .businessHead');if(!head||head.querySelector('.brandToggleGroup'))return;
      const group=document.createElement('div');group.className='brandToggleGroup';
      for(const b of ['JOSAM','Car-O-Liner','BlackHawk']){const label=document.createElement('label');label.className='brandToggle';const input=document.createElement('input');input.type='checkbox';input.checked=true;const txt=document.createElement('span');txt.textContent=b;input.addEventListener('change',()=>{if(input.checked)overviewBrands.add(b);else overviewBrands.delete(b);label.classList.toggle('off',!input.checked);recalcOverviewCollision();});label.append(input,txt);group.appendChild(label);}const currency=head.querySelector('.currency');head.insertBefore(group,currency||null);
    }

    function rowMetric(row){
      if(!row||row.cells.length<12)return null;
      return finish({aopM:parseMoney(row.cells[2].textContent),actual:parseMoney(row.cells[3].textContent),o0:parseMoney(row.cells[4].textContent),o1:parseMoney(row.cells[5].textContent),forecast:0,gapM:0,aopY:parseMoney(row.cells[8].textContent),ytdActual:parseMoney(row.cells[9].textContent),ytdForecast:0,gapY:0});
    }
    function writeMetricRow(row,label,brand,x){
      if(!row||row.cells.length<12)return;
      row.cells[0].textContent=label;row.cells[1].innerHTML='<span class="tag">'+brand+'</span>';row.cells[2].textContent=usd.format(x.aopM);row.cells[3].textContent=usd.format(x.actual);row.cells[4].textContent=usd.format(x.o0);row.cells[5].textContent=usd.format(x.o1);row.cells[6].innerHTML='<b>'+usd.format(x.forecast)+'</b>';row.cells[7].innerHTML='<b>'+signed(x.gapM)+'</b>';row.cells[7].classList.remove('good','bad');row.cells[7].classList.add(good(x.gapM));row.cells[8].textContent=usd.format(x.aopY);row.cells[9].textContent=usd.format(x.ytdActual);row.cells[10].innerHTML='<b>'+usd.format(x.ytdForecast)+'</b>';row.cells[11].innerHTML='<b>'+signed(x.gapY)+'</b>';row.cells[11].classList.remove('good','bad');row.cells[11].classList.add(good(x.gapY));
    }
    function managerCard(name,x){
      const attain=x.aopM?x.forecast/x.aopM:null;
      return `<div class="collisionMgrRow"><div class="collisionMgrName"><b>${name}</b><span>Forecast ${usd.format(x.forecast)} · ${attain==null?'—':pctFmt.format(attain)} AOP</span></div><div class="collisionMgrMonth"><span class="collisionMiniTitle">MONTH</span><div><small>Actual / AOP</small><b>${usd.format(x.actual)} / ${usd.format(x.aopM)}</b></div><div><small>Ord0</small><b>${usd.format(x.o0)}</b></div><div><small>Ord1</small><b>${usd.format(x.o1)}</b></div><div><small>Forecast</small><b>${usd.format(x.forecast)}</b></div><div><small>Gap</small><b class="${good(x.gapM)}">${signed(x.gapM)}</b></div></div><div class="collisionMgrYear"><span class="collisionMiniTitle">YEAR</span><div><small>YTD Actual / AOP</small><b>${usd.format(x.ytdActual)} / ${usd.format(x.aopY)}</b></div><div><small>YTD Forecast</small><b>${usd.format(x.ytdForecast)}</b></div><div><small>YTD Gap</small><b class="${good(x.gapY)}">${signed(x.gapY)}</b></div></div></div>`;
    }

    let detailObserver=null,enhancing=false;
    function installDetailControls(){
      const pane=document.getElementById('collisionDetail');if(!pane)return;
      const select=document.getElementById('collisionBrandDetail');if(select)select.value='ALL';
      const filters=pane.querySelector('.toolbar .filters');
      if(filters&&!filters.querySelector('.detailBrandToggleGroup')){const group=document.createElement('div');group.className='detailBrandToggleGroup';for(const b of ['JOSAM','Car-O-Liner','BlackHawk']){const label=document.createElement('label');label.className='detailBrandToggle';const input=document.createElement('input');input.type='checkbox';input.checked=true;const txt=document.createElement('span');txt.textContent=b;input.addEventListener('change',()=>{if(input.checked)detailBrands.add(b);else detailBrands.delete(b);label.classList.toggle('off',!input.checked);enhanceDetail();});label.append(input,txt);group.appendChild(label);}filters.appendChild(group);}
      const kpis=document.getElementById('collisionDetailKpis');if(kpis&&!document.getElementById('collisionManagerOverview')){const wrap=document.createElement('section');wrap.id='collisionManagerOverview';wrap.className='collisionManagerOverview';wrap.innerHTML='<div class="collisionManagerOverviewTitle"><b>Manager Overview</b><span>Active brands · Month + YTD</span></div><div id="collisionManagerRows"></div>';kpis.insertAdjacentElement('afterend',wrap);}
      const brandTable=document.getElementById('collisionDetailBrandTable');const panel=brandTable?.closest('.card.panel');
      if(panel&&!panel.querySelector('.collisionCollapseBtn')){const h2=panel.querySelector('h2');if(h2){const head=document.createElement('div');head.className='collisionBrandPanelHead';h2.replaceWith(head);head.appendChild(h2);const btn=document.createElement('button');btn.type='button';btn.className='collisionCollapseBtn';btn.textContent='Show Brand Performance';head.appendChild(btn);const wrap=panel.querySelector('.tableWrap');if(wrap)wrap.classList.add('collisionBrandCollapsed');btn.addEventListener('click',()=>{if(!wrap)return;const hidden=wrap.classList.toggle('collisionBrandCollapsed');btn.textContent=hidden?'Show Brand Performance':'Hide Brand Performance';});}}
      const detailTable=document.getElementById('collisionDetailTable');const detailPanel=detailTable?.closest('.card.panel');if(detailPanel&&!document.getElementById('collisionRevenueTotal')){const p=detailPanel.querySelector('p');const total=document.createElement('div');total.id='collisionRevenueTotal';total.className='collisionRevenueTotal';total.innerHTML='<span>Total Revenue</span><b>—</b>';if(p)p.insertAdjacentElement('afterend',total);else detailPanel.insertBefore(total,detailPanel.querySelector('.tableWrap'));}
    }

    function enhanceBrandPerformance(){
      const body=document.querySelector('#collisionDetailBrandTable tbody');if(!body)return;
      let col=null,bh=null;
      for(const r of [...body.rows]){const key=brandKey(r.cells?.[1]?.textContent);if(key){r.style.display=detailBrands.has(key)?'':'none';if(key==='Car-O-Liner')col=r;if(key==='BlackHawk')bh=r;}}
      const combined=[...body.rows].find(r=>(r.cells?.[1]?.textContent||'').trim().toLowerCase()==='col + blackhawk');
      if(combined){let x=zero();if(detailBrands.has('Car-O-Liner')&&col)x=add(x,rowMetric(col)||zero());if(detailBrands.has('BlackHawk')&&bh)x=add(x,rowMetric(bh)||zero());writeMetricRow(combined,'Europe East','COL + BlackHawk',x);combined.style.display=(detailBrands.has('Car-O-Liner')||detailBrands.has('BlackHawk'))?'':'none';}
    }

    function enhanceDetail(){
      if(enhancing)return;enhancing=true;
      try{
        installDetailControls();
        const body=document.querySelector('#collisionDetailTable tbody');if(!body){enhancing=false;return;}
        if(detailObserver)detailObserver.disconnect();
        body.querySelectorAll('.collisionGrandTotal').forEach(r=>r.remove());
        const managerSums={};const managerTotalRows={};let current='';
        for(const row of [...body.rows]){
          if(row.classList.contains('mgr')){current=(row.cells?.[0]?.textContent||'').trim();continue;}
          const btxt=(row.cells?.[1]?.textContent||'').trim();const key=brandKey(btxt);
          if(key){const active=detailBrands.has(key);row.style.display=active?'':'none';if(active&&current){managerSums[current]=add(managerSums[current]||zero(),rowMetric(row)||zero());}continue;}
          if(row.classList.contains('total')&&btxt.toUpperCase()==='TOTAL'&&current){managerTotalRows[current]=row;}
        }
        let grand=zero();
        const cards=[];
        for(const name of MANAGER_ORDER){const x=managerSums[name];if(!x)continue;grand=add(grand,x);cards.push(managerCard(name,x));if(managerTotalRows[name])writeMetricRow(managerTotalRows[name],name,'TOTAL',x);}
        const cardsBox=document.getElementById('collisionManagerRows');if(cardsBox)cardsBox.innerHTML=cards.join('')||'<div class="muted">No matching data</div>';
        const rev=document.getElementById('collisionRevenueTotal');if(rev)rev.innerHTML=`<span>TOTAL REVENUE · Active brands</span><b>${usd.format(grand.forecast)}</b><span>Forecast</span><b>${usd.format(grand.actual)}</b><span>Actual</span>`;
        const k=document.getElementById('collisionDetailKpis');if(k){const attain=grand.aopM?grand.forecast/grand.aopM:null;k.innerHTML=`<div class="card miniKpi"><div class="label">Month AOP</div><div class="value">${usd.format(grand.aopM)}</div></div><div class="card miniKpi"><div class="label">Actual</div><div class="value">${usd.format(grand.actual)}</div></div><div class="card miniKpi"><div class="label">Ord0 + Ord1</div><div class="value">${usd.format(grand.o0+grand.o1)}</div></div><div class="card miniKpi"><div class="label">Month Forecast</div><div class="value">${usd.format(grand.forecast)}</div><div class="muted ${good(grand.gapM)}">${signed(grand.gapM)} vs AOP</div></div><div class="card miniKpi"><div class="label">AOP %</div><div class="value ${attain!=null&&attain>=1?'good':'bad'}">${attain==null?'—':pctFmt.format(attain)}</div></div><div class="card miniKpi"><div class="label">YTD Forecast</div><div class="value">${usd.format(grand.ytdForecast)}</div><div class="muted ${good(grand.gapY)}">${signed(grand.gapY)} vs AOP</div></div>`;}
        if(body.rows.length&&cards.length){const tr=document.createElement('tr');tr.className='collisionGrandTotal';for(let i=0;i<12;i++)tr.appendChild(document.createElement('td'));body.appendChild(tr);writeMetricRow(tr,'TOTAL EUROPE EAST','ACTIVE BRANDS',grand);}
        enhanceBrandPerformance();
      }finally{
        if(detailObserver){const b=document.querySelector('#collisionDetailTable tbody');const bb=document.querySelector('#collisionDetailBrandTable tbody');if(b)detailObserver.observe(b,{childList:true,subtree:true});if(bb)detailObserver.observe(bb,{childList:true,subtree:true});}
        enhancing=false;
      }
    }

    function installDetailObserver(){
      installDetailControls();
      detailObserver=new MutationObserver(()=>{if(!enhancing)requestAnimationFrame(enhanceDetail);});
      const b=document.querySelector('#collisionDetailTable tbody'),bb=document.querySelector('#collisionDetailBrandTable tbody');if(b)detailObserver.observe(b,{childList:true,subtree:true});if(bb)detailObserver.observe(bb,{childList:true,subtree:true});
      document.getElementById('collisionManagerDetail')?.addEventListener('change',()=>setTimeout(enhanceDetail,50));
      document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(enhanceDetail,500);setTimeout(enhanceDetail,1500);setTimeout(enhanceDetail,3000);});
      setTimeout(enhanceDetail,300);
    }

    installOverviewToggles();cleanUndercar();installDetailObserver();
    const u=document.getElementById('undercarOverview');if(u)new MutationObserver(()=>cleanUndercar()).observe(u,{childList:true,subtree:true});
    document.getElementById('collisionFile')?.addEventListener('change',()=>{setTimeout(recalcOverviewCollision,400);setTimeout(recalcOverviewCollision,1200);setTimeout(recalcOverviewCollision,2500);});
    setTimeout(recalcOverviewCollision,300);setTimeout(recalcOverviewCollision,1000);
  }catch(e){console.error(e);if(status)status.textContent='App load error: '+(e?.message||String(e));}
})();
