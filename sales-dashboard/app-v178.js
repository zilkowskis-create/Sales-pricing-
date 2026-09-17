(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let code=await fetch('./app.js?base=202609176',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Base app could not be loaded');return r.text();});
    const replacements=[
      ["const APP_VERSION = '2026.09.17.6';","const APP_VERSION = '2026.09.17.8';"],
      ["if (x === 'Bernardi F' || x === 'Zilkowski S.') return 'Filippo B. / Sergej';","if (x === 'Bernardi F' || x === 'Zilkowski S.') return 'Filippo Bernardi';"],
      ["const m = managerName(manager), key = `${m}|${country}`;","const m = /^armenia$/i.test(country) ? 'Ruslan Sollano' : managerName(manager), key = `${m}|${country}`;"],
      ["const m = managerName(raw), c = String(val(r,map,'Country')).trim(), code = String(val(r,map,'Codice')).trim(), name = String(val(r,map,'Descrizione')).trim();","const c = String(val(r,map,'Country')).trim(), m = /^armenia$/i.test(c) ? 'Ruslan Sollano' : managerName(raw), code = String(val(r,map,'Codice')).trim(), name = String(val(r,map,'Descrizione')).trim();"],
      ["const key = `${m}|${c}|${code}|${name}`, x = out.get(key) || {m,c,code,name,mtd:0,o1:0,est:0,ytd:0,gm:0,gmp:null,oe:0};","const key = `${m}|${c}|${name.toLowerCase()}`, x = out.get(key) || {m,c,code,name,mtd:0,o1:0,est:0,ytd:0,gm:0,gmp:null,oe:0}; if(code && x.code && !x.code.split(' / ').includes(code)) x.code += ' / ' + code; else if(code && !x.code) x.code = code;"],
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
    (0,eval)(code);
  }catch(e){
    console.error(e);
    if(status) status.textContent='App load error: '+(e?.message||String(e));
  }
})();
