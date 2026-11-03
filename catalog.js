'use strict';
window.catalogState={ready:false,loading:false,error:''};
let catalogSuppliers=[],catalogPage=0;
const catalogEscape=v=>escapeHTML(v??'');
const normalizeCatalog=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function catalogPrice(value,currency){
 if(value===null||value===undefined||Number(value)<=0)return 'Consultar';
 return currency==='REF'?'REF '+new Intl.NumberFormat('es-VE',{maximumFractionDigits:2}).format(value):money(value);
}
window.setCatalogState=function(state,prices,suppliers){
 window.catalogState=state;
 materials.splice(0,materials.length,...prices.filter(p=>p.materiales?.activo).map(p=>({
  code:p.materiales.codigo_arquimad,name:p.materiales.descripcion_original,
  detail:p.materiales.formato_medida||'',category:p.materiales.categoria||'Sin categoría',
  supplier:p.proveedores?.nombre||'Sin proveedor',unit:p.unidad_precio,record:p
 })));
 catalogSuppliers=suppliers;catalogPage=0;
 const detail=document.getElementById('materialDetail');if(detail){detail.close();detail.remove();}
 render(location.hash.slice(1)||'home');
};
function catalog(){
 const cats=[...new Set(materials.map(m=>m.category))].sort((a,b)=>a.localeCompare(b,'es'));
 return '<section class="panel"><div class="toolbar"><input type="search" id="search" aria-label="Buscar materiales" placeholder="Buscar nombre, código, marca o proveedor…"><select id="category" aria-label="Filtrar categoría"><option value="">Todas las categorías</option>'+cats.map(c=>'<option>'+catalogEscape(c)+'</option>').join('')+'</select><select id="supplierFilter" aria-label="Filtrar proveedor"><option value="">Todos los proveedores</option>'+catalogSuppliers.map(s=>'<option>'+catalogEscape(s.nombre)+'</option>').join('')+'</select></div><div id="materialRows" aria-live="polite"></div></section>';
}
function catalogMessage(){
 const s=window.catalogState;
 return '<div class="empty"><h2>'+(s.loading?'Cargando catálogo…':s.error?'No se pudo cargar el catálogo':'Inicia sesión para consultar')+'</h2><p>'+catalogEscape(s.error||'Los datos se consultan mediante tu acceso privado.')+'</p>'+(s.error?'<button class="secondary" data-retry-catalog>Reintentar</button>':'')+'</div>';
}
function filterMaterials(event){
 if(event)catalogPage=0;
 const target=document.getElementById('materialRows');if(!target)return;
 if(!window.catalogState.ready){target.innerHTML=catalogMessage();return;}
 const q=normalizeCatalog(document.getElementById('search').value).trim().split(/\s+/).filter(Boolean);
 const cat=document.getElementById('category').value,sup=document.getElementById('supplierFilter').value;
 const rows=materials.filter(m=>{
  const p=m.record,hay=normalizeCatalog([m.name,m.code,m.detail,m.category,m.supplier,p.codigo_proveedor,p.materiales.marca_linea,p.materiales.referencia_comparacion].join(' '));
  return q.every(w=>hay.includes(w))&&(!cat||m.category===cat)&&(!sup||m.supplier===sup);
 });
 const pages=Math.max(1,Math.ceil(rows.length/50));catalogPage=Math.min(catalogPage,pages-1);
 if(!rows.length){target.innerHTML='<div class="empty"><h2>Sin coincidencias</h2><p>Prueba otro nombre, código o filtro.</p></div>';return;}
 const selected=rows.slice(catalogPage*50,catalogPage*50+50);
 target.innerHTML='<div class="panel-head"><span>'+rows.length+' materiales · Página '+(catalogPage+1)+' de '+pages+'</span><div><button class="secondary" data-catalog-step="-1" '+(catalogPage===0?'disabled':'')+'>Anterior</button> <button class="secondary" data-catalog-step="1" '+(catalogPage===pages-1?'disabled':'')+'>Siguiente</button></div></div><div class="table-wrap"><table><thead><tr><th>Material / código</th><th>Proveedor</th><th>REF</th><th>Divisas USD</th><th>Condición</th><th></th></tr></thead><tbody>'+selected.map(m=>'<tr><td style="white-space:normal;min-width:240px;max-width:420px"><strong>'+catalogEscape(m.name)+'</strong><small>'+catalogEscape(m.code+' · '+m.category)+'</small><small>'+catalogEscape(m.detail)+'</small></td><td>'+catalogEscape(m.supplier)+'<small>'+catalogEscape(m.unit)+'</small></td><td>'+catalogPrice(m.record.precio_ref,'REF')+'</td><td>'+catalogPrice(m.record.precio_divisas_usd,'USD')+'</td><td style="white-space:normal;max-width:170px">'+catalogEscape(m.record.estado_validacion)+'<small>'+catalogEscape(m.record.fecha_fuente||'Fecha no indicada')+'</small></td><td><button class="text-link" data-detail="'+catalogEscape(m.code)+'">Ver ficha ↗</button></td></tr>').join('')+'</tbody></table></div>';
}
function supplierCatalog(){
 if(!window.catalogState.ready)return '<section class="panel">'+catalogMessage()+'</section>';
 return '<div class="cards">'+catalogSuppliers.map(s=>'<section class="panel supplier"><h2>'+catalogEscape(s.nombre)+'</h2><p>'+catalogEscape(s.nombre_comercial||'')+'</p><p>'+materials.filter(m=>m.supplier===s.nombre).length+' materiales en el catálogo</p><p>'+catalogEscape(s.observaciones||'Consulta la condición comercial y la fuente en cada material.')+'</p><button class="secondary" data-supplier-catalog="'+catalogEscape(s.nombre)+'">Ver materiales</button></section>').join('')+'</div>';
}
function showMaterialDetail(code){
 const m=materials.find(x=>x.code===code);if(!m)return;
 let dialog=document.getElementById('materialDetail');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='materialDetail';document.body.appendChild(dialog);}
 const p=m.record,mat=p.materiales,f=p.fuentes||{};
 const fields=[
 ['Código ARQUIMAD',m.code],['Proveedor',m.supplier],['Código del proveedor',p.codigo_proveedor],
 ['Categoría',m.category],['Marca / línea',mat.marca_linea],['Formato / medida',mat.formato_medida],['Acabado',mat.acabado],['Unidad de precio',m.unit],
 ['Precio original',p.precio_original==null?'No indicado':p.precio_original+' · '+(p.modalidad_original||'Modalidad no indicada')],
 ['REF de trabajo',catalogPrice(p.precio_ref,'REF')],['Divisas USD',catalogPrice(p.precio_divisas_usd,'USD')],
 ['Divisas confirmadas',p.divisas_confirmadas_usd==null?'No indicadas':catalogPrice(p.divisas_confirmadas_usd,'USD')],
 ['Descuento registrado',p.descuento_divisas==null?'No indicado':new Intl.NumberFormat('es-VE',{style:'percent',maximumFractionDigits:2}).format(p.descuento_divisas)],
 ['Estado',p.estado_validacion],['Uso en presupuestos',mat.uso_presupuesto?'Sí, según el maestro':'No aprobado'],
 ['Fecha de fuente',p.fecha_fuente||'No indicada'],['Fuente',(f.codigo_fuente||'')+' · '+(f.nombre||'No indicada')],
 ['Ubicación en fuente',p.localizador_fuente],['Observaciones',p.observaciones],['Alcance de la fuente',f.observaciones]
 ];
 dialog.setAttribute('aria-labelledby','materialDetailTitle');
 dialog.innerHTML='<div class="dialog-head"><h2 id="materialDetailTitle">'+catalogEscape(m.name)+'</h2><button class="close" aria-label="Cerrar ficha" data-close-material>×</button></div><div style="padding:22px"><p>Precios conservados del maestro. No se aplica un descuento adicional ni se reutilizan tasas históricas.</p><dl>'+fields.map(([k,v])=>'<dt style="font-weight:600;margin-top:14px">'+catalogEscape(k)+'</dt><dd style="margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere">'+catalogEscape(v??'No indicado')+'</dd>').join('')+'</dl></div>';
 dialog.showModal();
}
document.addEventListener('click',e=>{
 const step=e.target.closest('[data-catalog-step]');if(step){catalogPage+=Number(step.dataset.catalogStep);filterMaterials();return;}
 const close=e.target.closest('[data-close-material]');if(close){document.getElementById('materialDetail').close();return;}
 const supplier=e.target.closest('[data-supplier-catalog]');
 if(supplier){history.pushState(null,'','#materials');render('materials');document.getElementById('supplierFilter').value=supplier.dataset.supplierCatalog;filterMaterials({type:'change'});}
});
render(location.hash.slice(1)||'home');

