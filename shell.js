(() => {
"use strict";
const API="https://tlumbslsoggcyihtolfv.supabase.co";
const KEY="sb_publishable_lnD-sKF6zScvi-5zJlSFbw_nEZTu8r6";
const $=id=>document.getElementById(id), status=t=>$("status").textContent=t;
let session=null, epoch=0, busy=false, active=null, pending=null, frame=null, requestId=0;
const prefKey="asv-lab-public-shell-preferences-v1";
const prefs=()=>{try{return JSON.parse(localStorage.getItem(prefKey)||"{}")}catch{return {}}};
const api=async(path,{method="GET",body,token}={})=>{
 const r=await fetch(API+path,{method,headers:{apikey:KEY,...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",credentials:"omit",redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!r.ok){const e=new Error("request failed");e.status=r.status;throw e}return r.status===204?null:r.json();
};
function acceptSession(s){if(typeof s?.access_token!=="string"||typeof s?.refresh_token!=="string"||!Number.isFinite(s.expires_in))throw Error("invalid session");session={access:s.access_token,refresh:s.refresh_token,expires:Date.now()+s.expires_in*1000}}
async function token(){if(!session)throw Error("signed out");if(session.expires-Date.now()<120000){const old=session, turn=epoch;const s=await api("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:old.refresh}});if(turn!==epoch||session!==old)throw Error("stale session");acceptSession(s)}return session.access}
function valid(r){return r&&typeof r.html==="string"&&r.html.length>0&&r.html.length<2097152&&/^\d+\.\d+\.\d+$/.test(r.version)&&Number.isSafeInteger(r.release_number)&&r.release_number>0}
function childSource(){
 return function bridge(){
  const $=id=>document.getElementById(id);
  const ids=["scene","mode","phase","spatial","n","range","hf","vf","fps","yaw","pitch","shift","low","high"];
  let last=0,locked=false;
  for(const id of ["play","single","testAudio","testMedia"])$(id)?.addEventListener("click",()=>{last=Date.now()},true);
  const send=(type,extra={})=>parent.postMessage({type,...extra},"*");
  const snapshot=()=>Object.fromEntries(ids.filter(id=>$(id)).map(id=>[id,$(id).value]));
  for(const id of ids)$(id)?.addEventListener("change",()=>send("asv-prefs",{values:snapshot()}));
  $("reset")?.addEventListener("click",()=>send("asv-prefs",{values:snapshot()}));
  for(const id of ["install","pwaCheck","pwaStatus"]){if($(id))$(id).hidden=true}
  addEventListener("message",e=>{
    if(e.source!==parent||e.origin!==PARENT_ORIGIN||!e.data)return;
    if(e.data.type==="asv-init"){for(const id of ids){const el=$(id),v=e.data.values?.[id];if(!el||typeof v!=="string"||v.length>40)continue;if(el.type==="range"&&Number.isFinite(Number(v)))el.value=v;else if(el.tagName==="SELECT"&&[...el.options].some(o=>o.value===v))el.value=v}if(typeof update==="function")update()}
    if(e.data.type==="asv-lock"&&!locked&&$("stop")?.disabled&&Date.now()-last>3000){
      locked=true;window.stopLabAudio?.();for(const id of ["play","single","testAudio","testMedia"])if($(id))$(id).disabled=true;send("asv-locked",{id:e.data.id});
    }
  });
  send("asv-ready");
 }
}
function mount(r){
 const next=document.createElement("iframe");next.title="מעבדת ASV";next.setAttribute("sandbox","allow-scripts");
 const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';
 let html=r.html.replace(/<!doctype html>/i,m=>m+csp);
 const injected="<scr"+"ipt>const PARENT_ORIGIN="+JSON.stringify(location.origin)+";("+childSource().toString()+")();</scr"+"ipt>";
 html=html.replace(/<\/html>\s*$/i,injected+"</html>");
 next.srcdoc=html;frame=next;requestId++;active={version:r.version,release_number:r.release_number};pending=null;$("lab").replaceChildren(next);$("lab").hidden=false;$("login").hidden=true;$("logout").hidden=false;document.body.classList.add("active");status("גרסה "+r.version);
}
function clear(){epoch++;session=null;active=null;pending=null;frame=null;$("lab").replaceChildren();$("lab").hidden=true;$("login").hidden=false;$("logout").hidden=true;document.body.classList.remove("active")}
async function poll(){
 if(!session||busy)return;busy=true;const turn=epoch;
 try{const t=await token();if(turn!==epoch)return;const rows=await api("/rest/v1/asv_releases?select=version,release_number,html&order=release_number.desc&limit=1",{token:t});if(turn!==epoch)return;
 if(!Array.isArray(rows)||!rows.length){clear();status("אין הרשאת גישה למעבדה.");return}
 const r=rows[0];if(!valid(r))throw Error("invalid release");
 if(!active){mount(r)}else if(r.release_number>active.release_number&&(!pending||r.release_number>=pending.release_number)){pending=r;status("עדכון מוכן; יופעל כשהשמע כבוי.")}
 }catch(e){if(turn!==epoch)return;if(!active||e.status===401||e.status===403||session?.expires<=Date.now()){clear();status("הגישה לא אומתה. יש להתחבר מחדש.")}else status("אין חיבור לעדכונים; הגרסה הפעילה נשמרת.")}
 finally{busy=false}
}
$("login").addEventListener("submit",async e=>{
 e.preventDefault();if(busy||session)return;busy=true;const turn=++epoch;$("submit").disabled=true;const email=$("email").value.trim(),password=$("password").value;$("password").value="";status("מתחבר…");
 try{const s=await api("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password}});if(turn!==epoch)return;acceptSession(s)}
 catch{if(turn===epoch){clear();status("לא ניתן להתחבר. בדוק פרטים ונסה שוב.")}}
 finally{busy=false;$("submit").disabled=false}
 if(session)await poll()
});
$("logout").onclick=()=>{const t=session?.access;clear();status("נותקת.");if(t)api("/auth/v1/logout",{method:"POST",token:t}).catch(()=>{})};
addEventListener("message",e=>{
 if(!frame||e.source!==frame.contentWindow||e.origin!=="null"||!e.data)return;
 if(e.data.type==="asv-ready")frame.contentWindow.postMessage({type:"asv-init",values:prefs()},"*");
 if(e.data.type==="asv-prefs"){const values=e.data.values;if(values&&typeof values==="object"&&JSON.stringify(values).length<2048){try{localStorage.setItem(prefKey,JSON.stringify(values))}catch{}}}
 if(e.data.type==="asv-locked"&&pending&&e.data.id===requestId)mount(pending)
});
setInterval(poll,60000);
setInterval(()=>{if(pending&&frame&&!document.hidden){frame.contentWindow.postMessage({type:"asv-lock",id:requestId},"*")}},1000);
addEventListener("online",poll);document.addEventListener("visibilitychange",()=>{if(!document.hidden)poll()});
if("serviceWorker" in navigator&&isSecureContext)navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{});
})();
