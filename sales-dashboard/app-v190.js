(async()=>{
  'use strict';
  const status=document.getElementById('status');
  try{
    let wrapper=await fetch('./app-v189.js?hotfix=2026091722&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Dashboard app could not be loaded');return r.text();});

    // v189 contains a fragile exact-version guard. Remove only that guard + replacement
    // and let it execute its stable v188 base directly. All v189 UI/data patches remain active.
    wrapper=wrapper.replace(
      /\s*if\(!src\.includes\('2026\.09\.17\.20'\)\) throw new Error\('Version upgrade point not found'\);\s*src=src\.replace\('2026\.09\.17\.20','2026\.09\.17\.21'\);/,
      ''
    );

    // Fallback for whitespace/minification differences.
    wrapper=wrapper.replace("if(!src.includes('2026.09.17.20')) throw new Error('Version upgrade point not found');",'');
    wrapper=wrapper.replace("src=src.replace('2026.09.17.20','2026.09.17.21');",'');

    await (0,eval)(wrapper);
  }catch(e){
    console.error(e);
    if(status)status.textContent='App load error: '+(e?.message||String(e));
  }
})();
