(() => {
  'use strict';
  const APP_VERSION = '2026.09.17.6';
  const $ = (id) => document.getElementById(id);
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });
  const LIMIT = 800;
  let teamRows = [], gmByManager = {}, customers = [], journal = [], currentFile = null;
  let customerLoaded = false, journalLoaded = false, latestVersion = APP_VERSION;

  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v ?? '').trim().replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(',', '.');
    const x = Number(s); return Number.isFinite(x) ? x : 0;
  };
  const pct = (v) => Number.isFinite(v) ? percent.format(v) : '—';
  const colorClass = (v) => v >= 0 ? 'good' : 'bad';
  const signedEuro = (v) => `${v >= 0 ? '+' : ''}${euro.format(v)}`;
  const managerName = (v) => {
    const x = String(v ?? '').trim();
    if (x === 'Bernardi F' || x === 'Zilkowski S.') return 'Filippo B. / Sergej';
    if (x === 'Sollano R.' || x === 'Sollano R') return 'Ruslan Sollano';
    return x;
  };
  const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function headerInfo(rows, required) {
    const rowIndex = rows.findIndex(row => required.every(key => row.some(v => norm(v) === norm(key))));
    if (rowIndex < 0) throw new Error(`Expected columns not found: ${required.join(', ')}`);
    const map = {}; rows[rowIndex].forEach((v, i) => { map[norm(v)] = i; });
    return { rowIndex, map };
  }
  function val(row, map, name) { const i = map[norm(name)]; return i === undefined ? '' : row[i]; }

  function parseCountries(rows) {
    const { rowIndex, map } = headerInfo(rows, ['Sales Office', 'Country']);
    const keep = new Set(['Bernardi F', 'Zilkowski S.', 'Mindaugas Deikus', 'Sollano R.']);
    const out = new Map(); let office = '', manager = '';
    for (let i = rowIndex + 1; i < rows.length; i++) {
      const r = rows[i];
      if (val(r, map, 'Sales Office')) office = String(val(r, map, 'Sales Office')).trim();
      if (val(r, map, 'Sales Manager')) manager = String(val(r, map, 'Sales Manager')).trim();
      const country = String(val(r, map, 'Country')).trim();
      if (office !== 'Zilkowski S.' || !keep.has(manager) || !country || /^sum$/i.test(country)) continue;
      const m = managerName(manager), key = `${m}|${country}`;
      const x = out.get(key) || {m, c: country, oe:0, mtd:0, o1:0, est:0, plan:0, next:0, o2:0, ytd:0, pytd:0};
      const fields = {oe:'Order_entered',mtd:'Sales MTD - invoiced',o1:'Backlog - ord1',plan:'Plan',next:'Sales PLAN Next Month',o2:'Backlog next month - ord 2',ytd:'Somma di Sales YTD €',pytd:'Sales PLAN YTD'};
      for (const [k, name] of Object.entries(fields)) x[k] += num(val(r, map, name));
      x.est = x.mtd + x.o1; out.set(key, x);
    }
    return [...out.values()].sort((a,b) => a.m.localeCompare(b.m) || a.c.localeCompare(b.c));
  }

  function parseGM(rows) {
    const { rowIndex, map } = headerInfo(rows, ['Sales Office', 'Descrizione', 'Sales MTD €']);
    const keep = new Set(['Bernardi F', 'Mindaugas Deikus', 'Sollano R.']);
    const sums = {};
    for (let i = rowIndex + 1; i < rows.length; i++) {
      const r = rows[i]; if (String(val(r,map,'Sales Office')).trim() !== 'Zilkowski S.') continue;
      const raw = String(val(r,map,'Descrizione')).trim(); if (!keep.has(raw)) continue;
      const m = managerName(raw); if (!sums[m]) sums[m] = {sales:0, gm:0};
      sums[m].sales += num(val(r,map,'Sales MTD €')); sums[m].gm += num(val(r,map,'GM MTD €'));
    }
    const result = {}; for (const [m,x] of Object.entries(sums)) result[m] = x.sales ? x.gm / x.sales : 0; return result;
  }

  function parseCustomers(rows) {
    const { rowIndex, map } = headerInfo(rows, ['Sales Office', 'Descrizione', 'Country']);
    const keep = new Set(['Bernardi F', 'Mindaugas Deikus', 'Sollano R.']); const out = new Map();
    for (let i = rowIndex + 1; i < rows.length; i++) {
      const r = rows[i], office = String(val(r,map,'Sales Office')).trim(), raw = String(val(r,map,'Sales Manager')).trim();
      if (office !== 'Zilkowski S.' || !keep.has(raw)) continue;
      const m = managerName(raw), c = String(val(r,map,'Country')).trim(), code = String(val(r,map,'Codice')).trim(), name = String(val(r,map,'Descrizione')).trim();
      if (!c || !name || /^sum$/i.test(name)) continue;
      const key = `${m}|${c}|${code}|${name}`, x = out.get(key) || {m,c,code,name,mtd:0,o1:0,est:0,ytd:0,gm:0,gmp:null,oe:0};
      x.mtd += num(val(r,map,'Sales MTD €')); x.o1 += num(val(r,map,'Backlog TME €')); x.est += num(val(r,map,'Sales Estimate Month €'));
      x.ytd += num(val(r,map,'Sales YTD €')); x.gm += num(val(r,map,'GM MTD €')); x.oe += num(val(r,map,'Order entered €')); x.gmp = x.mtd ? x.gm/x.mtd : null; out.set(key,x);
    }
    return [...out.values()].sort((a,b)=>a.m.localeCompare(b.m)||a.c.localeCompare(b.c)||a.name.localeCompare(b.name));
  }

  function parseJournal(records) {
    const keep = new Set(['Bernardi F', 'Mindaugas Deikus', 'Sollano R.']);
    return records.filter(r=>r.salesOffice==='Zilkowski S.'&&keep.has(r.salesManager)).map(r=>({m:managerName(r.salesManager),c:r.country||'',customer:r.customer||'',type:r.type||'',date:r.date||'',part:r.partNo||'',desc:r.description||'',sales:num(r.sales),gm:num(r.gm),gmp:num(r.gmPct)}));
  }

  function agg(rows) { return rows.reduce((a,r)=>{for(const k of ['oe','mtd','o1','est','plan','next','o2','ytd','pytd']) a[k]+=num(r[k]);return a;},{oe:0,mtd:0,o1:0,est:0,plan:0,next:0,o2:0,ytd:0,pytd:0}); }
  function managerList(){ return [...new Set(teamRows.map(r=>r.m))]; }
  function fillManagerSelect(id){ const el=$(id); if(!el)return; const old=el.value||'ALL',ms=managerList(); el.innerHTML='<option value="ALL">All managers</option>'+ms.map(m=>`<option value="${safe(m)}">${safe(m)}</option>`).join(''); el.value=ms.includes(old)?old:'ALL'; }
  function goalBox(title,actual,target,gap,extra=''){ return `<div class="goalBox"><div class="goalTitle">${title}</div><div class="goalMain"><span>${euro.format(actual)}</span><small>of ${euro.format(target)}</small></div><div class="goalMeta"><b>${target?pct(actual/target):'—'}</b><strong class="${colorClass(gap)}">${signedEuro(gap)}</strong></div>${extra}</div>`; }

  function renderTeam(){
    fillManagerSelect('manager'); const sel=$('manager')?.value||'ALL', rows=sel==='ALL'?teamRows:teamRows.filter(r=>r.m===sel), a=agg(rows), monthGap=a.mtd-a.plan, forecastGap=a.est-a.plan, yearGap=a.ytd-a.pytd;
    if($('kpis')){ $('kpis').className='goalsGrid'; $('kpis').innerHTML=`<section class="goalSection monthly"><div class="sectionHead"><span>MONTH</span><b>Current month target</b></div><div class="goalRow">${goalBox('Sales MTD',a.mtd,a.plan,monthGap,`<div class="goalSub">Backlog Ord1 <b>${euro.format(a.o1)}</b></div>`)}${goalBox('Forecast incl. Backlog',a.est,a.plan,forecastGap,`<div class="goalSub">${forecastGap>=0?'Above target':'Missing after backlog'} <b class="${colorClass(forecastGap)}">${signedEuro(forecastGap)}</b></div>`)}</div></section><section class="goalSection annual"><div class="sectionHead"><span>YEAR</span><b>YTD target</b></div><div class="goalRow one">${goalBox('Sales YTD',a.ytd,a.pytd,yearGap,`<div class="goalSub">${yearGap>=0?'Above annual plan':'Missing to annual plan'} <b class="${colorClass(yearGap)}">${signedEuro(yearGap)}</b></div>`)}</div></section>`; }
    const shown=managerList().filter(m=>rows.some(r=>r.m===m));
    if($('cards')) $('cards').innerHTML=shown.map(m=>{const x=agg(teamRows.filter(r=>r.m===m)),fg=x.est-x.plan,yg=x.ytd-x.pytd;return `<div class="card managerGoal"><div class="managerName"><b>${safe(m)}</b><span>GM MTD ${gmByManager[m]==null?'—':pct(gmByManager[m])}</span></div><div class="managerMonth"><span class="miniTitle">MONTH</span><div><small>MTD / Target</small><b>${euro.format(x.mtd)} / ${euro.format(x.plan)}</b></div><div><small>Backlog</small><b>${euro.format(x.o1)}</b></div><div><small>Forecast</small><b>${euro.format(x.est)}</b></div><div><small>Gap</small><b class="${colorClass(fg)}">${signedEuro(fg)}</b></div></div><div class="managerYear"><span class="miniTitle">YEAR</span><div><small>YTD / Target</small><b>${euro.format(x.ytd)} / ${euro.format(x.pytd)}</b></div><div><small>YTD %</small><b>${x.pytd?pct(x.ytd/x.pytd):'—'}</b></div><div><small>YTD Gap</small><b class="${colorClass(yg)}">${signedEuro(yg)}</b></div></div></div>`}).join('');
    let html='';
    for(const m of shown){const rr=teamRows.filter(r=>r.m===m);rr.forEach((r,i)=>{const fg=r.est-r.plan,yg=r.ytd-r.pytd;html+=`<tr><td>${i?'':safe(m)}</td><td class="country">${safe(r.c)}</td><td class="num">${euro.format(r.mtd)}</td><td class="num"><b>${euro.format(r.o1)}</b></td><td class="num focus">${euro.format(r.est)}</td><td class="num focus">${euro.format(r.plan)}</td><td class="num focus ${colorClass(fg)}">${r.plan?signedEuro(fg):'—'}</td><td class="num yearSep">${euro.format(r.ytd)}</td><td class="num">${euro.format(r.pytd)}</td><td class="num ${colorClass(yg)}">${r.pytd?signedEuro(yg):'—'}</td><td class="num">${euro.format(r.o2)}</td><td class="num more">${euro.format(r.oe)}</td><td class="num more">${euro.format(r.next)}</td></tr>`});const s=agg(rr),fg=s.est-s.plan,yg=s.ytd-s.pytd;html+=`<tr class="mgrRow"><td>${safe(m)}</td><td>SUM</td><td class="num">${euro.format(s.mtd)}</td><td class="num">${euro.format(s.o1)}</td><td class="num">${euro.format(s.est)}</td><td class="num">${euro.format(s.plan)}</td><td class="num ${colorClass(fg)}">${signedEuro(fg)}</td><td class="num yearSep">${euro.format(s.ytd)}</td><td class="num">${euro.format(s.pytd)}</td><td class="num ${colorClass(yg)}">${signedEuro(yg)}</td><td class="num">${euro.format(s.o2)}</td><td class="num more">${euro.format(s.oe)}</td><td class="num more">${euro.format(s.next)}</td></tr>`;}
    if(sel==='ALL'){const t=agg(teamRows),fg=t.est-t.plan,yg=t.ytd-t.pytd;html+=`<tr class="teamRow"><td>TOTAL TEAM</td><td>SUM</td><td class="num">${euro.format(t.mtd)}</td><td class="num">${euro.format(t.o1)}</td><td class="num">${euro.format(t.est)}</td><td class="num">${euro.format(t.plan)}</td><td class="num ${colorClass(fg)}">${signedEuro(fg)}</td><td class="num yearSep">${euro.format(t.ytd)}</td><td class="num">${euro.format(t.pytd)}</td><td class="num ${colorClass(yg)}">${signedEuro(yg)}</td><td class="num">${euro.format(t.o2)}</td><td class="num more">${euro.format(t.oe)}</td><td class="num more">${euro.format(t.next)}</td></tr>`;}
    if($('countryBody')) $('countryBody').innerHTML=html||'<tr><td colspan="13">No data</td></tr>';
  }

  function showCustomerPlaceholder(){if($('customerKpis'))$('customerKpis').innerHTML='<div class="card miniKpi"><div class="label">Customers</div><div class="value">Open tab</div><div class="muted">Loads from selected XLS</div></div>';if($('customerBody'))$('customerBody').innerHTML='<tr><td colspan="11" class="muted">Load a .xls file, then open Customers.</td></tr>';}
  function showJournalPlaceholder(){if($('journalKpis'))$('journalKpis').innerHTML='<div class="card miniKpi"><div class="label">Journal</div><div class="value">Open tab</div><div class="muted">Loads from selected XLS</div></div>';if($('journalBody'))$('journalBody').innerHTML='<tr><td colspan="10" class="muted">Load a .xls file, then open Sales Gross Margin Journal.</td></tr>';}

  function renderCustomers(){
    fillManagerSelect('customerManager'); const mgr=$('customerManager')?.value||'ALL',q=($('customerSearch')?.value||'').trim().toLowerCase(),countries=[...new Set(customers.filter(x=>mgr==='ALL'||x.m===mgr).map(x=>x.c))].sort(),cc=$('customerCountry'),old=cc?.value||'ALL';
    if(cc){cc.innerHTML='<option value="ALL">All countries</option>'+countries.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join('');cc.value=countries.includes(old)?old:'ALL';}
    const country=cc?.value||'ALL',rows=customers.filter(x=>(mgr==='ALL'||x.m===mgr)&&(country==='ALL'||x.c===country)&&(!q||(x.name+' '+x.code).toLowerCase().includes(q))),s=rows.reduce((a,x)=>{a.mtd+=x.mtd;a.o1+=x.o1;a.gm+=x.gm;return a;},{mtd:0,o1:0,gm:0});
    if($('customerKpis'))$('customerKpis').innerHTML=`<div class="card miniKpi"><div class="label">Customers</div><div class="value">${rows.length}</div></div><div class="card miniKpi"><div class="label">Sales MTD</div><div class="value">${euro.format(s.mtd)}</div></div><div class="card miniKpi"><div class="label">Backlog Ord1</div><div class="value">${euro.format(s.o1)}</div></div><div class="card miniKpi"><div class="label">GM MTD %</div><div class="value">${s.mtd?pct(s.gm/s.mtd):'—'}</div></div>`;
    let html='',lm='',lc='';for(const x of rows.slice(0,LIMIT)){if(x.m!==lm){html+=`<tr class="groupRow"><td colspan="11">${safe(x.m)}</td></tr>`;lm=x.m;lc='';}if(x.c!==lc){html+=`<tr class="countryGroup"><td></td><td colspan="10">${safe(x.c)}</td></tr>`;lc=x.c;}html+=`<tr><td></td><td></td><td><b>${safe(x.name)}</b></td><td>${safe(x.code)}</td><td class="num">${euro.format(x.mtd)}</td><td class="num">${euro.format(x.o1)}</td><td class="num">${euro.format(x.est||x.mtd+x.o1)}</td><td class="num">${euro.format(x.ytd)}</td><td class="num">${euro.format(x.gm)}</td><td class="num">${x.gmp==null?'—':pct(x.gmp)}</td><td class="num">${euro.format(x.oe)}</td></tr>`;}if(rows.length>LIMIT)html+=`<tr><td colspan="11" class="muted">Showing first ${LIMIT} of ${rows.length}. Use filters/search.</td></tr>`;if($('customerBody'))$('customerBody').innerHTML=html||'<tr><td colspan="11">No matching customers</td></tr>';
  }

  function renderJournal(){
    fillManagerSelect('journalManager');const mgr=$('journalManager')?.value||'ALL',type=$('journalType')?.value||'ALL',q=($('journalSearch')?.value||'').trim().toLowerCase(),rows=journal.filter(x=>(mgr==='ALL'||x.m===mgr)&&(type==='ALL'||x.type===type)&&(!q||(x.customer+' '+x.part+' '+x.desc+' '+x.c).toLowerCase().includes(q))),s=rows.reduce((a,x)=>{a.sales+=x.sales;a.gm+=x.gm;return a;},{sales:0,gm:0});
    if($('journalKpis'))$('journalKpis').innerHTML=`<div class="card miniKpi"><div class="label">Transactions</div><div class="value">${rows.length}</div></div><div class="card miniKpi"><div class="label">Sales</div><div class="value">${euro.format(s.sales)}</div></div><div class="card miniKpi"><div class="label">Gross Margin</div><div class="value">${euro.format(s.gm)}</div></div><div class="card miniKpi"><div class="label">GM % weighted</div><div class="value">${s.sales?pct(s.gm/s.sales):'—'}</div></div>`;
    let html=rows.slice(0,LIMIT).map(x=>`<tr><td>${safe(x.m)}</td><td>${safe(x.c)}</td><td><b>${safe(x.customer)}</b></td><td>${safe(x.type)}</td><td>${safe(x.date)}</td><td>${safe(x.part)}</td><td>${safe(x.desc)}</td><td class="num">${euro.format(x.sales)}</td><td class="num ${x.gm<0?'bad':''}">${euro.format(x.gm)}</td><td class="num ${x.gmp<0?'bad':''}">${pct(x.gmp)}</td></tr>`).join('');if(rows.length>LIMIT)html+=`<tr><td colspan="10" class="muted">Showing first ${LIMIT} of ${rows.length}. Use filters/search.</td></tr>`;if($('journalBody'))$('journalBody').innerHTML=html||'<tr><td colspan="10">No matching transactions</td></tr>';
  }

  async function loadCustomersFromFile(){if(customerLoaded)return renderCustomers();if(!currentFile){showCustomerPlaceholder();$('status').textContent='Load a .xls file first';return;}try{$('status').textContent='Loading customers…';await nextPaint();customers=parseCustomers(XLSBIFF8.parseSheetRows(currentFile.buffer,'Totals - Customer').rows);customerLoaded=true;renderCustomers();$('status').textContent='Customers loaded ✓';}catch(e){console.error(e);$('status').textContent='Customer load error: '+e.message;}}
  async function loadJournalFromFile(){if(journalLoaded)return renderJournal();if(!currentFile){showJournalPlaceholder();$('status').textContent='Load a .xls file first';return;}try{$('status').textContent='Loading journal…';await nextPaint();journal=parseJournal(XLSBIFF8.parseSalesJournal(currentFile.buffer).rows);journalLoaded=true;renderJournal();$('status').textContent='Journal loaded ✓';}catch(e){console.error(e);$('status').textContent='Journal load error: '+e.message;}}

  async function handleFile(file){
    if(!file)return;if(!/\.xls$/i.test(file.name)){$('status').textContent='Please select the original .xls file';return;}
    try{$('status').textContent='Reading file…';await nextPaint();const buffer=await file.arrayBuffer();currentFile={name:file.name,buffer};$('status').textContent='Reading team data…';await nextPaint();if(!globalThis.XLSBIFF8)throw new Error('XLS reader did not load');const country=XLSBIFF8.parseSheetRows(buffer,'Totals - Country').rows,gm=XLSBIFF8.parseSheetRows(buffer,'Totals - Sales Manager').rows;teamRows=parseCountries(country);gmByManager=parseGM(gm);customers=[];journal=[];customerLoaded=false;journalLoaded=false;$('source').textContent=`Loaded · ${file.name}`;renderTeam();showCustomerPlaceholder();showJournalPlaceholder();$('status').textContent=`Updated ✓ · ${teamRows.length} country rows`;}catch(e){console.error(e);$('status').textContent='Load error: '+(e?.message||String(e));}
  }

  async function loadSnapshot(){try{const r=await fetch('./snapshot.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('snapshot');const j=await r.json();teamRows=j.rows||[];gmByManager=j.gm||{};$('source').textContent='Snapshot · '+(j.snapshotDate||'latest');renderTeam();showCustomerPlaceholder();showJournalPlaceholder();}catch{$('source').textContent='Load latest .xls to start';}}
  async function checkUpdate(){try{const r=await fetch('./version.json?ts='+Date.now(),{cache:'no-store'}),j=await r.json();latestVersion=j.version||APP_VERSION;const b=$('updateBtn');if(!b)return;const newer=latestVersion!==APP_VERSION;b.classList.toggle('show',newer);b.textContent=newer?`↻ Update available · ${latestVersion}`:'↻ Update available';b.title=newer?(j.message||'New version available'):'';}catch{}}

  $('file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];await handleFile(file);e.target.value='';});
  $('manager')?.addEventListener('change',renderTeam);
  $('fullBtn')?.addEventListener('click',()=>{const t=$('countryTable');if(!t)return;t.classList.toggle('full');$('fullBtn').textContent=t.classList.contains('full')?'Compact view':'Full view';});
  for(const id of ['customerManager','customerCountry','customerSearch'])$(id)?.addEventListener(id==='customerSearch'?'input':'change',()=>customerLoaded&&renderCustomers());
  for(const id of ['journalManager','journalType','journalSearch'])$(id)?.addEventListener(id==='journalSearch'?'input':'change',()=>journalLoaded&&renderJournal());
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab,.tabpane').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.tab)?.classList.add('active');if(btn.dataset.tab==='customers')loadCustomersFromFile();if(btn.dataset.tab==='journal')loadJournalFromFile();}));
  $('updateBtn')?.addEventListener('click',()=>{const u=new URL(location.href);u.search='';u.searchParams.set('v',latestVersion);u.searchParams.set('refresh',Date.now());location.replace(u.toString());});

  const style=document.createElement('style');style.textContent=`.goalsGrid{display:grid;grid-template-columns:1.35fr .85fr;gap:10px;margin-bottom:10px}.goalSection{background:#fff;border:1px solid var(--line);border-radius:11px;overflow:hidden;box-shadow:0 4px 14px rgba(16,24,40,.045)}.goalSection.monthly{border-top:3px solid var(--red)}.goalSection.annual{border-top:3px solid var(--blue)}.sectionHead{display:flex;align-items:center;gap:8px;padding:8px 11px 5px;border-bottom:1px solid #edf0f2}.sectionHead span{font-size:9px;font-weight:900;letter-spacing:.08em;color:#fff;padding:3px 6px;border-radius:4px}.monthly .sectionHead span{background:var(--red)}.annual .sectionHead span{background:var(--blue)}.sectionHead b{font-size:12px}.goalRow{display:grid;grid-template-columns:1fr 1fr}.goalRow.one{grid-template-columns:1fr}.goalBox{padding:9px 12px}.goalBox+.goalBox{border-left:1px solid #edf0f2}.goalTitle{font-size:9px;text-transform:uppercase;font-weight:850;color:#777d85}.goalMain{display:flex;align-items:baseline;gap:5px;margin-top:3px}.goalMain span{font-size:22px;font-weight:900}.goalMain small{font-size:10px;color:#8a8f96}.goalMeta{display:flex;justify-content:space-between;gap:8px;margin-top:3px}.goalMeta strong{font-size:13px}.goalSub{margin-top:4px;font-size:10px;color:#7d828a}.managerGoal{display:grid;grid-template-columns:180px 1.45fr 1fr;align-items:stretch;min-height:62px;overflow:hidden}.managerName{padding:8px 10px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #e6e9ec}.managerName b{font-size:13px}.managerName span{font-size:9px;color:#7f848c}.managerMonth,.managerYear{display:grid;align-items:center;gap:10px;padding:6px 10px}.managerMonth{grid-template-columns:48px 1.35fr 1fr 1fr 1fr;border-right:2px solid #dfe3e7}.managerYear{grid-template-columns:42px 1.5fr .7fr 1fr}.miniTitle{font-size:8px;font-weight:900;letter-spacing:.08em;color:#fff;border-radius:4px;padding:3px 5px;text-align:center}.managerMonth .miniTitle{background:var(--red)}.managerYear .miniTitle{background:var(--blue)}.managerMonth small,.managerYear small{display:block;font-size:8px;text-transform:uppercase;color:#858a92;font-weight:800}.managerMonth b,.managerYear b{display:block;font-size:11.5px;white-space:nowrap}.yearSep{border-left:3px solid #dde3e9!important}@media(max-width:1000px){.goalsGrid{grid-template-columns:1fr}.managerGoal{grid-template-columns:150px 1fr}.managerYear{grid-column:2;border-top:1px solid #edf0f2}.managerName{grid-row:1/3}.managerMonth{border-right:0}}@media(max-width:700px){.goalRow{grid-template-columns:1fr}.goalBox+.goalBox{border-left:0;border-top:1px solid #edf0f2}.managerGoal{display:block}.managerMonth{grid-template-columns:42px repeat(2,1fr)}.managerYear{grid-template-columns:42px repeat(2,1fr)}}`;document.head.appendChild(style);
  loadSnapshot();checkUpdate();setInterval(checkUpdate,300000);
})();