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
function clear(){try{localStorage.removeItem("asv-login-pkce-v1")}catch{}epoch++;session=null;active=null;pending=null;frame=null;$("lab").replaceChildren();$("lab").hidden=true;$("login").hidden=false;$("logout").hidden=true;document.body.classList.remove("active")}
async function poll(){
 if(!session||busy)return;busy=true;const turn=epoch;
 try{const t=await token();if(turn!==epoch)return;const rows=await api("/rest/v1/asv_releases?select=version,release_number,html&order=release_number.desc&limit=1",{token:t});if(turn!==epoch)return;
 if(!Array.isArray(rows)||!rows.length){clear();status("אין הרשאת גישה למעבדה.");return}
 const r=rows[0];if(!valid(r))throw Error("invalid release");
 if(!active){mount(r)}else if(r.release_number>active.release_number&&(!pending||r.release_number>=pending.release_number)){pending=r;status("עדכון מוכן; יופעל כשהשמע כבוי.")}
 }catch(e){if(turn!==epoch)return;if(!active||e.status===401||e.status===403||session?.expires<=Date.now()){clear();status("הגישה לא אומתה. יש להתחבר מחדש.")}else status("אין חיבור לעדכונים; הגרסה הפעילה נשמרת.")}
 finally{busy=false}
}
const callback="https://mataniar0.github.io/asv-lab-app/";
const verifierKey="asv-login-pkce-v1";
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
$("google").onclick=async()=>{
 if(busy||session)return;
 busy=true;$("google").disabled=true;$("submit").disabled=true;
 try{
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
  localStorage.setItem(verifierKey,JSON.stringify({verifier,expires:Date.now()+900000,sentAt:Date.now()}));
  const u=new URL(API+"/auth/v1/authorize");
  u.search=new URLSearchParams({provider:"google",redirect_to:callback,code_challenge:challenge,code_challenge_method:"s256",scopes:"openid email profile",prompt:"select_account"}).toString();
  location.assign(u.href);
 }catch{status("לא ניתן להתחיל התחברות עם Google.");busy=false;$("google").disabled=false;$("submit").disabled=false}
};
$("login").addEventListener("submit",async e=>{
 e.preventDefault();if(busy||session)return;
 let prior=null;
 try{prior=JSON.parse(localStorage.getItem(verifierKey)||"null")}catch{}
 if(prior?.sentAt&&Date.now()-prior.sentAt<60000){status("כבר נשלח קישור. בדוק את הדוא״ל לפני בקשה חדשה.");return}
 busy=true;const turn=++epoch;$("submit").disabled=true;status("שולח קישור…");
 try{
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
  await api("/auth/v1/otp?redirect_to="+encodeURIComponent(callback),{method:"POST",body:{email:$("email").value.trim(),create_user:false,code_challenge:challenge,code_challenge_method:"s256"}});
  localStorage.setItem(verifierKey,JSON.stringify({verifier,expires:Date.now()+900000,sentAt:Date.now()}));
  if(turn===epoch)status("אם החשבון מורשה, יישלח קישור. פתח אותו באותו דפדפן בתוך 15 דקות.");
 }catch(e){if(turn===epoch)status(e.status===429?"מגבלת שליחת דוא״ל. השתמש בקישור האחרון שקיבלת או נסה שוב לאחר דקה.":"לא ניתן לשלוח קישור כרגע. נסה שוב מאוחר יותר.")}
 finally{busy=false;$("submit").disabled=false}
});
async function completeMagicLink(){
 const u=new URL(location.href),code=u.searchParams.get("code"),error=u.searchParams.get("error")||u.hash.includes("error=");
 if(!code&&!error)return;
 history.replaceState(null,"",location.pathname);busy=true;$("submit").disabled=true;
 try{
  const item=JSON.parse(localStorage.getItem(verifierKey)||"null");localStorage.removeItem(verifierKey);
  if(error||!code||!item||item.expires<=Date.now()||! /^[A-Za-z0-9_-]{43}$/.test(item.verifier))throw Error("invalid callback");
  const sessionData=await api("/auth/v1/token?grant_type=pkce",{method:"POST",body:{auth_code:code,code_verifier:item.verifier}});
  acceptSession(sessionData);
 }catch{clear();status("קישור לא תקף או נפתח בדפדפן אחר. בקש קישור חדש.")}
 finally{busy=false;$("submit").disabled=false}
 if(session)await poll();
}
completeMagicLink();
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
