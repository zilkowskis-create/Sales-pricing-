(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let code=await fetch('./app.js?base=202609176',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Base app could not be loaded');return r.text();});

    const replacements=[
      ["const APP_VERSION = '2026.09.17.6';","const APP_VERSION = '2026.09.17.10';"],
      ["if (x === 'Bernardi F' || x === 'Zilkowski S.') return 'Filippo B. / Sergej';","if (x === 'Bernardi F' || x === 'Zilkowski S.') return 'Filippo Bernardi';"],
      ["const m = managerName(manager), key = `${m}|${country}`;","const m = /^armenia$/i.test(country) ? 'Ruslan Sollano' : managerName(manager), key = `${m}|${country}`;"],
      ["m:managerName(r.salesManager),c:r.country||''","m:/^armenia$/i.test(r.country||'')?'Ruslan Sollano':managerName(r.salesManager),c:r.country||''"],
      ["teamRows=j.rows||[];gmByManager=j.gm||{};","teamRows=normalizeSnapshotRows(j.rows||[]);gmByManager=normalizeSnapshotGM(j.gm||{});"]
    ];
    for(const [from,to] of replacements){
      if(!code.includes(from)) throw new Error('Version patch failed: '+from.slice(0,55));
      code=code.replace(from,to);
    }

    const anchor="const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));";
    const helper = anchor + `\n\n  function normalizeSnapshotRows(rows){\n    const map=new Map();\n    for(const r0 of rows){\n      const r={...r0};\n      r.m=/^armenia$/i.test(String(r.c||''))?'Ruslan Sollano':((r.m==='Filippo B. / Sergej'||r.m==='Filippo B/Sergej')?'Filippo Bernardi':r.m);\n      const key=String(r.m)+'|'+String(r.c);\n      const x=map.get(key)||{m:r.m,c:r.c,oe:0,mtd:0,o1:0,est:0,plan:0,next:0,o2:0,ytd:0,pytd:0};\n      for(const k of ['oe','mtd','o1','plan','next','o2','ytd','pytd']) x[k]+=num(r[k]);\n      x.est=x.mtd+x.o1; map.set(key,x);\n    }\n    return [...map.values()].sort((a,b)=>String(a.m).localeCompare(String(b.m))||String(a.c).localeCompare(String(b.c)));\n  }\n  function normalizeSnapshotGM(g){\n    const o={...(g||{})};\n    if(o['Filippo B. / Sergej']!=null){o['Filippo Bernardi']=o['Filippo B. / Sergej'];delete o['Filippo B. / Sergej'];}\n    if(o['Filippo B/Sergej']!=null){o['Filippo Bernardi']=o['Filippo B/Sergej'];delete o['Filippo B/Sergej'];}\n    return o;\n  }`;
    if(!code.includes(anchor)) throw new Error('Helper injection point not found');
    code=code.replace(anchor,helper);

    function patchedParseCustomers(rows) {
      const { rowIndex, map } = headerInfo(rows, ['Sales Office', 'Descrizione', 'Country']);
      const keep = new Set(['Bernardi F', 'Mindaugas Deikus', 'Sollano R.', 'Zilkowski S.']);
      const out = new Map();
      for (let i = rowIndex + 1; i < rows.length; i++) {
        const r = rows[i], office = String(val(r,map,'Sales Office')).trim(), raw = String(val(r,map,'Sales Manager')).trim();
        if (office !== 'Zilkowski S.' || !keep.has(raw)) continue;
        const c = String(val(r,map,'Country')).trim(), codeVal = String(val(r,map,'Codice')).trim(), name = String(val(r,map,'Descrizione')).trim();
        if (!c || !name || /^sum$/i.test(name)) continue;
        const m = /^armenia$/i.test(c) ? 'Ruslan Sollano' : managerName(raw);
        const fallback = String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        const identity = codeVal ? 'CODE:'+codeVal : 'NAME:'+fallback;
        const key = m+'|'+c+'|'+identity;
        let x = out.get(key);
        if(!x) x={m,c,code:codeVal,name,mtd:0,o1:0,est:0,plan:0,ytd:0,pytd:0,gm:0,gmp:null,oe:0};
        else {
          if(codeVal && !x.code) x.code=codeVal;
          const oldBad=(String(x.name).match(/[ß�]/g)||[]).length;
          const newBad=(String(name).match(/[ß�]/g)||[]).length;
          if(newBad<oldBad) x.name=name;
        }
        x.mtd += num(val(r,map,'Sales MTD €'));
        x.o1 += num(val(r,map,'Backlog TME €'));
        x.est += num(val(r,map,'Sales Estimate Month €'));
        x.plan += num(val(r,map,'Sales PLAN Month €'));
        x.ytd += num(val(r,map,'Sales YTD €'));
        x.pytd += num(val(r,map,'Sales PLAN YTD €'));
        x.gm += num(val(r,map,'GM MTD €'));
        x.oe += num(val(r,map,'Order entered €'));
        x.gmp = x.mtd ? x.gm/x.mtd : null;
        out.set(key,x);
      }
      return [...out.values()].sort((a,b)=>a.m.localeCompare(b.m)||a.c.localeCompare(b.c)||a.name.localeCompare(b.name));
    }

    function patchedRenderCustomers(){
      fillManagerSelect('customerManager');
      const mgr=$('customerManager')?.value||'ALL', q=($('customerSearch')?.value||'').trim().toLowerCase();
      const countries=[...new Set(customers.filter(x=>mgr==='ALL'||x.m===mgr).map(x=>x.c))].sort(), cc=$('customerCountry'), old=cc?.value||'ALL';
      if(cc){cc.innerHTML='<option value="ALL">All countries</option>'+countries.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join('');cc.value=countries.includes(old)?old:'ALL';}
      const country=cc?.value||'ALL';
      const rows=customers.filter(x=>(mgr==='ALL'||x.m===mgr)&&(country==='ALL'||x.c===country)&&(!q||(x.name+' '+x.code).toLowerCase().includes(q)));
      const s=rows.reduce((a,x)=>{a.mtd+=x.mtd;a.o1+=x.o1;a.est+=x.est;a.plan+=x.plan;a.ytd+=x.ytd;a.pytd+=x.pytd;a.gm+=x.gm;return a;},{mtd:0,o1:0,est:0,plan:0,ytd:0,pytd:0,gm:0});
      const monthGap=s.est-s.plan, ytdGap=s.ytd-s.pytd;
      if($('customerKpis')) $('customerKpis').innerHTML=`<div class="card miniKpi"><div class="label">Customers</div><div class="value">${rows.length}</div></div><div class="card miniKpi"><div class="label">Forecast</div><div class="value">${euro.format(s.est)}</div></div><div class="card miniKpi"><div class="label">Month Target</div><div class="value">${euro.format(s.plan)}</div><div class="muted ${colorClass(monthGap)}">${s.plan?signedEuro(monthGap):'No customer target'}</div></div><div class="card miniKpi"><div class="label">YTD / Plan YTD</div><div class="value">${euro.format(s.ytd)}</div><div class="muted ${s.pytd?colorClass(ytdGap):''}">${s.pytd?('Plan '+euro.format(s.pytd)+' · '+signedEuro(ytdGap)):'Plan YTD not populated'}</div></div>`;
      let html='',lm='',lc='';
      for(const x of rows.slice(0,LIMIT)){
        if(x.m!==lm){html+=`<tr class="groupRow"><td colspan="13">${safe(x.m)}</td></tr>`;lm=x.m;lc='';}
        if(x.c!==lc){html+=`<tr class="countryGroup"><td></td><td colspan="12">${safe(x.c)}</td></tr>`;lc=x.c;}
        const mg=x.est-x.plan, yg=x.ytd-x.pytd;
        html+=`<tr><td></td><td></td><td class="custName"><b>${safe(x.name)}</b><small>${safe(x.code||'')}</small></td><td class="num monthSep">${euro.format(x.mtd)}</td><td class="num">${euro.format(x.o1)}</td><td class="num"><b>${euro.format(x.est)}</b></td><td class="num">${x.plan?euro.format(x.plan):'—'}</td><td class="num ${x.plan?colorClass(mg):''}"><b>${x.plan?signedEuro(mg):'—'}</b></td><td class="num yearSep">${euro.format(x.ytd)}</td><td class="num">${x.pytd?euro.format(x.pytd):'—'}</td><td class="num ${x.pytd?colorClass(yg):''}"><b>${x.pytd?signedEuro(yg):'—'}</b></td><td class="num">${x.gmp==null?'—':pct(x.gmp)}</td><td class="num">${euro.format(x.oe)}</td></tr>`;
      }
      if(rows.length>LIMIT) html+=`<tr><td colspan="13" class="muted">Showing first ${LIMIT} of ${rows.length}. Use filters/search.</td></tr>`;
      if($('customerBody')) $('customerBody').innerHTML=html||'<tr><td colspan="13">No matching customers</td></tr>';
    }

    const pStart=code.indexOf('  function parseCustomers(rows) {');
    const pEnd=code.indexOf('\n\n  function parseJournal(records) {',pStart);
    if(pStart<0||pEnd<0) throw new Error('Customer parser block not found');
    code=code.slice(0,pStart)+'  '+patchedParseCustomers.toString().replace('patchedParseCustomers','parseCustomers')+code.slice(pEnd);

    const rStart=code.indexOf('  function renderCustomers(){');
    const rEnd=code.indexOf('\n\n  function renderJournal(){',rStart);
    if(rStart<0||rEnd<0) throw new Error('Customer renderer block not found');
    code=code.slice(0,rStart)+'  '+patchedRenderCustomers.toString().replace('patchedRenderCustomers','renderCustomers')+code.slice(rEnd);

    const customerHead=document.querySelector('#customers table thead');
    if(customerHead) customerHead.innerHTML=`<tr class="customerGroupHead"><th colspan="3">CUSTOMER</th><th colspan="5" class="monthGroup">MONTH</th><th colspan="3" class="yearGroup">YEAR</th><th colspan="2">MARGIN / ORDERS</th></tr><tr><th>Manager</th><th>Country</th><th>Customer · Code</th><th class="num monthSep">Sales MTD</th><th class="num">Backlog</th><th class="num">Forecast</th><th class="num">Target</th><th class="num">vs Target</th><th class="num yearSep">Sales YTD</th><th class="num">Plan YTD</th><th class="num">YTD Gap</th><th class="num">GM %</th><th class="num">Order Entered</th></tr>`;
    const note=document.querySelector('#customers .toolbar .muted');
    if(note) note.textContent='Customer Code is the primary ID · Month target from Sales PLAN Month € · Plan YTD shown when populated in source';
    const style=document.createElement('style');
    style.textContent=`#customers table{min-width:1450px}.customerGroupHead th{background:#eceff2;font-size:9px;font-weight:900;text-align:center;letter-spacing:.08em}.customerGroupHead .monthGroup{color:var(--red);border-left:3px solid #f0c7c9}.customerGroupHead .yearGroup{color:var(--blue);border-left:3px solid #cfdced}.custName{min-width:250px}.custName b{display:block;font-size:12.5px}.custName small{display:block;color:#8a8f96;font-size:9px;margin-top:1px}.monthSep{border-left:3px solid #f0c7c9!important}.yearSep{border-left:3px solid #cfdced!important}`;
    document.head.appendChild(style);

    (0,eval)(code);
  }catch(e){
    console.error(e);
    if(status) status.textContent='App load error: '+(e?.message||String(e));
  }
})();
