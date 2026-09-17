(async()=>{
  'use strict';
  const status=document.getElementById('status');
  const realFetch=window.fetch.bind(window);

  function patchCompatibility(code){
    let out=String(code||'')
      .replace(/throw new Error\('Version upgrade point not found'\)/g,"console.warn('Version marker mismatch - continuing')");

    // Collision Europe East scope: Japan must never be assigned to Ruslan/Export
    // or included in Collision totals. Patch both overview and detail ownerFor layers.
    out=out.replace(/if\(!b\|\|!c\)return null;/g,"if(!b||!c)return null;if(/^japan$/i.test(c))return null;");
    return out;
  }

  window.fetch=async function(input,init){
    const res=await realFetch(input,init);
    try{
      const raw=typeof input==='string'?input:(input?.url||'');
      const url=new URL(raw,location.href);
      const isLayer=/\/app-v\d+(?:-core)?\.js$/i.test(url.pathname)||/\/app-v184-base\.js$/i.test(url.pathname);
      if(!isLayer)return res;
      const text=patchCompatibility(await res.text());
      return new Response(text,{status:res.status,statusText:res.statusText,headers:res.headers});
    }catch(e){
      console.warn('Compatibility layer skipped',e);
      return res;
    }
  };

  const DB_NAME='east-europe-sales-dashboard',DB_VERSION=1,STORE='files';
  function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function saveFile(key,file){if(!file)return;try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({blob:file,name:file.name,type:file.type,lastModified:file.lastModified,savedAt:Date.now()},key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();}catch(e){console.warn(key+' file could not be cached',e);}}
  async function getFile(key,fallbackName,type){try{const db=await openDb();const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});db.close();if(!rec?.blob)return null;return new File([rec.blob],rec.name||fallbackName,{type:rec.type||type,lastModified:rec.lastModified||Date.now()});}catch(e){return null;}}
  async function restoreInput(id,key,fallbackName,type){const input=document.getElementById(id);if(!input||input.files?.length)return;const file=await getFile(key,fallbackName,type);if(!file)return;try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){console.warn(key+' automatic restore not supported',e);}}

  try{
    let core=await realFetch('./app-v189-core.js?hotfix=2026091722&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Dashboard core could not be loaded');return r.text();});
    core=patchCompatibility(core);
    await (0,eval)(core);

    const rule=document.querySelector('#collisionDetail .collisionRule');
    if(rule)rule.textContent=rule.textContent.replace('Ruslan = Bulgaria + Export','Ruslan = Bulgaria + Export (excl. Japan)');

    const undercar=document.getElementById('file');
    const collision=document.getElementById('collisionFile');
    undercar?.addEventListener('change',()=>{const f=undercar.files?.[0];if(f)saveFile('undercar',f);},{capture:true});
    collision?.addEventListener('change',()=>{const f=collision.files?.[0];if(f)saveFile('collision',f);},{capture:true});
    setTimeout(()=>restoreInput('file','undercar','Undercar.xls','application/vnd.ms-excel'),900);

    setTimeout(()=>{if(status&&/Version upgrade point not found/i.test(status.textContent||''))status.textContent='';},1500);
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
