const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const catalog=fs.readFileSync('catalog.js','utf8'),auth=fs.readFileSync('auth.js','utf8');
function setup({role='admin',confirmed=true,fail=false,delay=false}={}){
 const elements=new Map(),classes=new Set(),handlers={},calls=[],timers=[];
 let release;
 function element(id){if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',disabled:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},handlers:{},addEventListener(k,f){this.handlers[k]=f;},setAttribute(){},removeAttribute(){},reset(){},showModal(){this.open=true;},close(){this.open=false;},remove(){elements.delete(id);}});return elements.get(id);}
 const ctx={console,Intl,Number,String,Math,Array,Object,Set,Error,TypeError,AbortSignal,location:{hash:'#materials'},history:{pushState(){}},setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout(){},document:{
 getElementById:id=>id==='materialDetail'&&!elements.has(id)?null:element(id),
 querySelectorAll:()=>[],querySelector:()=>element('date'),addEventListener:(k,f)=>(handlers[k]??=[]).push(f),
 createElement:()=>{const e=element('materialDetail');return e;},body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},appendChild(){}}
 }};
 ctx.window=ctx;ctx.addEventListener=()=>{};
 ctx.fetch=async(url,opts)=>{
 calls.push({url,opts});let data;
 if(url.includes('grant_type=password'))data={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600};
 else if(url.endsWith('/user'))data={email:'test@example.invalid',email_confirmed_at:confirmed?'2026-01-01':null};
 else if(url.endsWith('/portal_session'))data={role};
 else if(url.includes('/proveedores?'))data=[{id:'supplier',nombre:'Proveedor A'}];
 else if(url.includes('/precios?')){
  if(fail)throw new TypeError('Network failure');
  if(delay)await new Promise(r=>release=r);
  const offset=Number(new URL(url).searchParams.get('offset'));
  data=Array.from({length:Math.min(500,801-offset)},(_,i)=>({id:String(i+offset),precio_ref:null,precio_divisas_usd:55,descuento_divisas:null,estado_validacion:'Estimado (supuesto)',unidad_precio:'Par',codigo_proveedor:'TH-'+(i+offset),proveedores:{nombre:'Proveedor A'},fuentes:{codigo_fuente:'F01',nombre:'Original <script>bad</script>'},materiales:{activo:true,codigo_arquimad:'ARQ-'+(i+offset),descripcion_original:'Lámina <img src=x onerror=bad> '+(i+offset),categoria:'Tableros',uso_presupuesto:true}}));
 }else if(url.endsWith('/logout'))data={};else throw Error('Unexpected URL');
 return {ok:true,json:async()=>data};
 };
 vm.createContext(ctx);
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
 vm.runInContext(catalog,ctx);vm.runInContext(auth,ctx);
 element('loginEmail').value='test@example.invalid';element('loginPassword').value='test-only';
 return {ctx,element,classes,calls,handlers,login:()=>element('loginForm').handlers.submit({preventDefault(){}}),release:()=>release?.()};
}
(async()=>{
 const s=setup();await s.login();
 assert(s.classes.has('signed-in'));assert(s.ctx.catalogState.ready);
 assert.match(s.element('liveStatus').textContent,/801 materiales/);
 assert.equal(s.calls.filter(c=>c.url.includes('/precios?')).length,2);
 assert.match(s.element('materialRows').innerHTML,/Página 1 de 17/);
 assert(!s.element('materialRows').innerHTML.includes('<img'));
 s.element('search').value='lamina 800';s.ctx.filterMaterials({});assert.match(s.element('materialRows').innerHTML,/1 materiales/);
 s.element('search').value='TH-800';s.ctx.filterMaterials({});assert.match(s.element('materialRows').innerHTML,/ARQ-800/);
 s.element('supplierFilter').value='Otro';s.ctx.filterMaterials({});assert.match(s.element('materialRows').innerHTML,/Sin coincidencias/);
 s.ctx.showMaterialDetail('ARQ-800');assert(s.element('materialDetail').open);
 assert(!s.element('materialDetail').innerHTML.includes('<script>'));
 assert.equal(s.ctx.catalogPrice(null,'REF'),'Consultar');assert.equal(s.ctx.catalogPrice(0,'USD'),'Consultar');
 await s.element('signOut').handlers.click();assert(!s.classes.has('signed-in'));assert(!s.ctx.catalogState.ready);
 assert.equal(vm.runInContext('materials.length',s.ctx),0);assert(!s.element('materialRows').innerHTML.includes('ARQ-'));
 for(const opts of [{role:null},{confirmed:false}]){const d=setup(opts);await d.login();assert(!d.classes.has('signed-in'));assert(!d.calls.some(c=>c.url.includes('/precios?')));}
 const bad=setup({fail:true});await bad.login();assert(!bad.ctx.catalogState.ready);assert.match(bad.element('materialRows').innerHTML,/Reintentar/);
 const race=setup({delay:true});const pending=race.login();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));await race.element('signOut').handlers.click();race.release();await pending;assert(!race.ctx.catalogState.ready);assert.equal(vm.runInContext('materials.length',race.ctx),0);
 console.log('PASS: 801 rows, pagination, search, filters, escaped details, unknown prices, denied access, network failure, logout and stale response.');
})().catch(e=>{console.error(e);process.exitCode=1});

