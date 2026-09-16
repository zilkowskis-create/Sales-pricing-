(()=>{
const UI_VERSION='2026.09.17.4';
let latestVersion=UI_VERSION;
const getBtn=()=>document.getElementById('updateBtn');
async function syncUpdate(){
  try{
    const r=await fetch('./version.json?ts='+Date.now(),{cache:'no-store'});
    const j=await r.json();
    latestVersion=j.version||UI_VERSION;
    const b=getBtn();
    if(!b)return;
    if(latestVersion!==UI_VERSION){
      b.classList.add('show');
      b.textContent='↻ Update available · '+latestVersion;
      b.title=j.message||('Version '+latestVersion+' available');
    }else{
      b.classList.remove('show');
      b.textContent='↻ Update available';
      b.title='';
    }
  }catch(e){}
}
function replaceButton(){
  const old=getBtn();
  if(!old||old.dataset.fixed==='1')return;
  const b=old.cloneNode(true);
  b.dataset.fixed='1';
  old.replaceWith(b);
  b.addEventListener('click',()=>{
    const u=new URL(location.href);
    u.search='';
    u.searchParams.set('v',latestVersion||Date.now());
    u.searchParams.set('refresh',Date.now());
    location.replace(u.toString());
  });
  const mo=new MutationObserver(()=>{
    if(latestVersion===UI_VERSION&&b.classList.contains('show')) b.classList.remove('show');
  });
  mo.observe(b,{attributes:true,attributeFilter:['class']});
}
replaceButton();
syncUpdate();
setInterval(syncUpdate,60000);
})();