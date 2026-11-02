const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('auth.js','utf8');
function setup(role='admin',confirmed=true){
const elements=new Map(),classes=new Set(),calls=[];
function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,classList:{toggle(){}},handlers:{},addEventListener(k,f){this.handlers[k]=f}});return elements.get(id)}
let revoked=false;
const context={document:{getElementById:el,body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},window:{addEventListener(){}},AbortSignal,setTimeout:()=>1,clearTimeout(){},fetch:async(url,opts)=>{
calls.push({url,opts});let data;
if(url.includes('grant_type=password'))data={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600};
else if(url.endsWith('/user'))data={email:'admin@example.invalid',email_confirmed_at:confirmed?'2026-01-01':null};
else if(url.endsWith('/portal_session'))data={role};
else if(url.includes('/proveedores?'))data=Array.from({length:7},(_,i)=>({id:i}));
else if(url.endsWith('/logout')){revoked=true;data={}}
else throw new Error('unexpected URL');
return {ok:true,json:async()=>data};
}};
vm.runInNewContext(code,context);el('loginEmail').value=' Admin@Example.Invalid ';el('loginPassword').value='sample-password';
return {el,classes,calls,get revoked(){return revoked}};
}
(async()=>{
const good=setup();await good.el('loginForm').handlers.submit({preventDefault(){}});
assert(good.classes.has('signed-in'));assert.match(good.el('liveStatus').textContent,/7 proveedores/);
assert.equal(good.el('loginPassword').value,'');
const body=JSON.parse(good.calls[0].opts.body);assert.equal(body.email,'admin@example.invalid');
await good.el('signOut').handlers.click();assert(!good.classes.has('signed-in'));assert(good.revoked);
const denied=setup(null);await denied.el('loginForm').handlers.submit({preventDefault(){}});
assert(!denied.classes.has('signed-in'));assert(!denied.calls.some(c=>c.url.includes('/proveedores?')));
const unverified=setup('admin',false);await unverified.el('loginForm').handlers.submit({preventDefault(){}});
assert(!unverified.classes.has('signed-in'));assert(!unverified.calls.some(c=>c.url.includes('/proveedores?')));
console.log('PASS: authorized login, provider read, password clearing, logout, unauthorized and unverified denial');
})().catch(e=>{console.error(e);process.exitCode=1});
