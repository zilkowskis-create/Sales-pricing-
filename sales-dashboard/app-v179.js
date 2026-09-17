(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let code=await fetch('./app.js?base=202609176',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Base app could not be loaded');return r.text();});
    const replacements=[
      ["const APP_VERSION = '2026.09.17.6';","const APP_VERSION = '2026.09.17.9';"],
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
    const helper = anchor + `

  function normalizeSnapshotRows(rows){
    const map=new Map();
    for(const r0 of rows){
      const r={...r0};
      r.m=/^armenia$/i.test(String(r.c||''))?'Ruslan Sollano':((r.m==='Filippo B. / Sergej'||r.m==='Filippo B/Sergej')?'Filippo Bernardi':r.m);
      const key=String(r.m)+'|'+String(r.c);
      const x=map.get(key)||{m:r.m,c:r.c,oe:0,mtd:0,o1:0,est:0,plan:0,next:0,o2:0,ytd:0,pytd:0};
      for(const k of ['oe','mtd','o1','plan','next','o2','ytd','pytd']) x[k]+=num(r[k]);
      x.est=x.mtd+x.o1; map.set(key,x);
    }
    return [...map.values()].sort((a,b)=>String(a.m).localeCompare(String(b.m))||String(a.c).localeCompare(String(b.c)));
  }
  function normalizeSnapshotGM(g){
    const o={...(g||{})};
    if(o['Filippo B. / Sergej']!=null){o['Filippo Bernardi']=o['Filippo B. / Sergej'];delete o['Filippo B. / Sergej'];}
    if(o['Filippo B/Sergej']!=null){o['Filippo Bernardi']=o['Filippo B/Sergej'];delete o['Filippo B/Sergej'];}
    return o;
  }`;
    if(!code.includes(anchor)) throw new Error('Helper injection point not found');
    code=code.replace(anchor,helper);

    function replaceBefore(src,startToken,nextToken,newCode){
      const start=src.indexOf(startToken);
      if(start<0) throw new Error('Function not found: '+startToken);
      const end=src.indexOf(nextToken,start+startToken.length);
      if(end<0) throw new Error('Next function not found: '+nextToken);
      return src.slice(0,start)+newCode+'\n\n  '+src.slice(end);
    }

    const parseCustomersNew=`function parseCustomers(rows) {
    const { rowIndex, map } = headerInfo(rows, ['Sales Office', 'Descrizione', 'Country']);
    const keep = new Set(['Bernardi F', 'Mindaugas Deikus', 'Sollano R.']); const out = new Map();
    for (let i = rowIndex + 1; i < rows.length; i++) {
      const r = rows[i], office = String(val(r,map,'Sales Office')).trim(), raw = String(val(r,map,'Sales Manager')).trim();
      if (office !== 'Zilkowski S.' || !keep.has(raw)) continue;
      const c = String(val(r,map,'Country')).trim(), m = /^armenia$/i.test(c) ? 'Ruslan Sollano' : managerName(raw), code = String(val(r,map,'Codice')).trim(), name = String(val(r,map,'Descrizione')).trim();
      if (!c || !name || /^sum$/i.test(name)) continue;
      const key = \`${'${m}|${c}|${name.toLowerCase()}'}\`, x = out.get(key) || {m,c,code:'',name,mtd:0,o1:0,est:0,plan:0,ytd:0,pytd:0,gm:0,gmp:null,oe:0};
      if(code && !x.code.split(' / ').includes(code)) x.code += (x.code?' / ':'') + code;
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
  }`;

    const renderCustomersNew=`function renderCustomers(){
    fillManagerSelect('customerManager');
    const mgr=$('customerManager')?.value||'ALL', q=($('customerSearch')?.value||'').trim().toLowerCase();
    const countries=[...new Set(customers.filter(x=>mgr==='ALL'||x.m===mgr).map(x=>x.c))].sort(), cc=$('customerCountry'), old=cc?.value||'ALL';
    if(cc){cc.innerHTML='<option value="ALL">All countries</option>'+countries.map(c=>\`<option value="\${safe(c)}">\${safe(c)}</option>\`).join('');cc.value=countries.includes(old)?old:'ALL';}
    const country=cc?.value||'ALL';
    const rows=customers.filter(x=>(mgr==='ALL'||x.m===mgr)&&(country==='ALL'||x.c===country)&&(!q||(x.name+' '+x.code).toLowerCase().includes(q)));
    const s=rows.reduce((a,x)=>{a.mtd+=x.mtd;a.o1+=x.o1;a.est+=x.est;a.plan+=x.plan;a.ytd+=x.ytd;a.gm+=x.gm;return a;},{mtd:0,o1:0,est:0,plan:0,ytd:0,gm:0});
    const teamGap=s.est-s.plan, missing=Math.max(0,s.plan-s.est);
    if($('customerKpis'))$('customerKpis').innerHTML=\`
      <div class="card miniKpi"><div class="label">Customers</div><div class="value">\${rows.length}</div></div>
      <div class="card miniKpi"><div class="label">Sales MTD</div><div class="value">\${euro.format(s.mtd)}</div></div>
      <div class="card miniKpi"><div class="label">Backlog Ord1</div><div class="value">\${euro.format(s.o1)}</div></div>
      <div class="card miniKpi"><div class="label">Forecast</div><div class="value">\${euro.format(s.est)}</div></div>
      <div class="card miniKpi"><div class="label">Monthly Target</div><div class="value">\${euro.format(s.plan)}</div></div>
      <div class="card miniKpi"><div class="label">Still Missing</div><div class="value \${teamGap>=0?'good':'bad'}">\${teamGap>=0?'+'+euro.format(teamGap):euro.format(missing)}</div></div>\`;
    const head=document.querySelector('#customers table thead');
    if(head)head.innerHTML=\`<tr class="customerGroupHead"><th colspan="4">CUSTOMER</th><th colspan="5" class="monthGroup">MONTH</th><th colspan="2" class="yearGroup">YEAR</th><th>GM</th></tr><tr><th>Manager</th><th>Country</th><th>Customer</th><th>Code</th><th class="num monthSep">Sales MTD</th><th class="num">Backlog</th><th class="num">Forecast</th><th class="num">Target</th><th class="num">Missing / +</th><th class="num yearSep">Sales YTD</th><th class="num">Order Entered</th><th class="num">GM %</th></tr>\`;
    let html='',lm='',lc='';
    for(const x of rows.slice(0,LIMIT)){
      if(x.m!==lm){html+=\`<tr class="groupRow"><td colspan="12">\${safe(x.m)}</td></tr>\`;lm=x.m;lc='';}
      if(x.c!==lc){html+=\`<tr class="countryGroup"><td></td><td colspan="11">\${safe(x.c)}</td></tr>\`;lc=x.c;}
      const gap=x.est-x.plan, rem=x.plan-x.est;
      const gapText=x.plan?(gap>=0?'+'+euro.format(gap):euro.format(Math.max(0,rem))):'—';
      html+=\`<tr class="customerRow"><td class="custManager">\${safe(x.m)}</td><td class="custCountry">\${safe(x.c)}</td><td class="custName"><b>\${safe(x.name)}</b></td><td class="custCode">\${safe(x.code)}</td><td class="num monthSep">\${euro.format(x.mtd)}</td><td class="num">\${euro.format(x.o1)}</td><td class="num strongNum">\${euro.format(x.est)}</td><td class="num targetNum">\${x.plan?euro.format(x.plan):'—'}</td><td class="num gapNum \${x.plan?(gap>=0?'good':'bad'):''}">\${gapText}</td><td class="num yearSep">\${euro.format(x.ytd)}</td><td class="num">\${euro.format(x.oe)}</td><td class="num">\${x.gmp==null?'—':pct(x.gmp)}</td></tr>\`;
    }
    if(rows.length>LIMIT)html+=\`<tr><td colspan="12" class="muted">Showing first \${LIMIT} of \${rows.length}. Use filters/search.</td></tr>\`;
    if($('customerBody'))$('customerBody').innerHTML=html||'<tr><td colspan="12">No matching customers</td></tr>';
  }`;

    code=replaceBefore(code,'function parseCustomers(rows) {','function parseJournal(records) {',parseCustomersNew);
    code=replaceBefore(code,'function renderCustomers(){','function renderJournal(){',renderCustomersNew);

    const styleAnchor="const style=document.createElement('style');style.textContent=`";
    if(code.includes(styleAnchor)){
      code=code.replace(styleAnchor,styleAnchor+`.customerGroupHead th{position:sticky;top:0;background:#eceff3;text-align:center;font-size:9px;letter-spacing:.08em;color:#5f6670}.customerGroupHead .monthGroup{background:#fff0f1;color:#a51d22}.customerGroupHead .yearGroup{background:#eef4fb;color:#2b62a7}.customerRow .custManager{width:118px;max-width:118px;overflow:hidden;text-overflow:ellipsis;color:#60666f;font-size:10.5px}.customerRow .custCountry{width:90px;max-width:90px;overflow:hidden;text-overflow:ellipsis}.customerRow .custName{min-width:220px;max-width:300px;overflow:hidden;text-overflow:ellipsis}.customerRow .custCode{width:92px;max-width:120px;color:#777;font-size:10.5px}.monthSep{border-left:3px solid #f0b8bb!important}.yearSep{border-left:3px solid #c5d7eb!important}.strongNum{font-weight:850;background:#fafafa}.targetNum{font-weight:750;background:#fff8f8}.gapNum{font-weight:900}.customerRow td{padding-top:7px;padding-bottom:7px}#customerKpis{grid-template-columns:repeat(6,1fr)}@media(max-width:1200px){#customerKpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){#customerKpis{grid-template-columns:repeat(2,1fr)}}`);
    }
    (0,eval)(code);
  }catch(e){
    console.error(e);
    if(status) status.textContent='App load error: '+(e?.message||String(e));
  }
})();
