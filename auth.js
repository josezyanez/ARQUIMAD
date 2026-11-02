'use strict';
(()=>{
const API="https://wcmpbbtsihlpsauutnca.supabase.co";
const PUBLIC_KEY="sb_publishable_ATrj1NDeaeVSGVbz9_6Lqg_KTWQg9Ua";
let session=null,refreshTimer=null,epoch=0;
const $=id=>document.getElementById(id);
const message=(s,error=false)=>{$('authMessage').textContent=s;$('authMessage').classList.toggle('error',error)};
async function request(path,{method='GET',body,token}={}){
 const headers={apikey:PUBLIC_KEY,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
 let data;try{data=await response.json()}catch{data=null}
 if(!response.ok){const error=new Error(data?.msg||data?.message||data?.error_description||'No se pudo completar la solicitud');error.status=response.status;error.code=data?.error_code||data?.code;throw error}
 return data;
}
function lock(text=''){
 epoch++;clearTimeout(refreshTimer);session=null;
 document.body.classList.remove('signed-in');
 $('accountIdentity').textContent='';$('liveStatus').textContent='';
 $('loginPassword').value='';message(text,Boolean(text));
}
async function validate(access){
 const user=await request('/auth/v1/user',{token:access});
 if(!user.email_confirmed_at)throw new Error('Debes confirmar tu correo antes de entrar.');
 const permission=await request('/rest/v1/rpc/portal_session',{method:'POST',body:{},token:access});
 if(permission?.role!=='admin')throw new Error('Esta cuenta no tiene acceso autorizado a ARQUIMAD.');
 return user;
}
async function establish(data,version){
 if(!data?.access_token||!data?.refresh_token)throw new Error('No se recibió una sesión válida.');
 const user=await validate(data.access_token);
 if(version!==epoch)return;
 session={access:data.access_token,refresh:data.refresh_token};
 $('accountIdentity').textContent=user.email+' · Administrador';
 document.body.classList.add('signed-in');message('');
 $('loginPassword').value='';
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(async()=>{
  if(!session)return;const token=session.refresh,current=epoch;
  try{await establish(await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token}}),current)}
  catch{if(current===epoch)lock('Tu sesión terminó. Inicia sesión nuevamente.')}
 },Math.max(10000,((data.expires_in||3600)-90)*1000));
 $('liveStatus').textContent='Comprobando conexión con proveedores…';
 try{
  const rows=await request('/rest/v1/proveedores?select=id',{token:session.access});
  if(version===epoch)$('liveStatus').textContent='Conexión real activa · '+rows.length+' proveedores registrados. Catálogo pendiente de importar.';
 }catch{if(version===epoch)$('liveStatus').textContent='Acceso autorizado. No se pudo consultar el catálogo; vuelve a entrar para reintentar.'}
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('loginSubmit');button.disabled=true;message('Verificando tu acceso…');
 const version=++epoch;
 try{
 const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
 const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 $('loginPassword').value='';
 await establish(data,version);
 }catch(error){
 if(version!==epoch)return;
 lock(error.status===400||error.status===401?'No se pudo iniciar sesión. Revisa tu correo y contraseña y comprueba que tu cuenta esté activada.':error.name==='TimeoutError'||error instanceof TypeError?'No se pudo conectar. Comprueba tu conexión e inténtalo nuevamente.':error.message);
 }finally{button.disabled=false}
});
$('signOut').addEventListener('click',async()=>{
 const access=session?.access;lock();
 if(access){try{await request('/auth/v1/logout',{method:'POST',token:access})}catch{message('La sesión se cerró en esta página. No se pudo confirmar la revocación remota.',true)}}
});
window.addEventListener('pagehide',()=>{clearTimeout(refreshTimer);session=null});
window.addEventListener('pageshow',e=>{if(e.persisted)lock('Vuelve a iniciar sesión para continuar.')});
})();
