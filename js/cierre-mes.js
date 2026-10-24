// ═══════════════════════════════════════════
// RESUMEN DEL MES Y CIERRE GUIADO
// ═══════════════════════════════════════════
// Al terminar el mes: (1) un resumen con lo importante (lo que entró, lo que gastaste, en qué se fue, qué subió, cuánto ahorraste)
// y (2) un chequeo de lo que conviene revisar antes de dar el mes por cerrado, con un botón que lleva a cada pantalla. Cerrar el mes es
// solo una marca (no bloquea ni cambia nada): sirve para saber qué meses ya revisaste. Es una preferencia: localStorage llano.

const CIERRE_KEY="fmesescerrados";       // {"2026-09":"2026-10-02T10:00:00Z"}
const CIERRE_AVISO_KEY="fcierreavisado"; // el último mes cuyo aviso se descartó
const CIERRE_DIAS_AVISO=10;              // se avisa durante los primeros 10 días del mes siguiente
const CIERRE_BACKUP_DIAS=7;              // una copia más vieja que esto figura como pendiente

function leerMesesCerrados(){
  try{
    const o=JSON.parse(localStorage.getItem(CIERRE_KEY)||"{}");
    const out={};
    if(o && typeof o==="object" && !Array.isArray(o)) Object.entries(o).forEach(([ym,f])=>{ if(/^\d{4}-\d{2}$/.test(ym) && typeof f==="string") out[ym]=f; });
    return out;
  }catch(e){ return {}; }
}
function guardarMesesCerrados(o){ return guardarPreferencia(CIERRE_KEY, JSON.stringify(o||{})); }
const mesCerrado=(ym, mapa)=>!!(mapa||leerMesesCerrados())[ym];

// El mes que toca cerrar al abrir la app: el anterior, durante los primeros días del mes, si tuvo movimientos y no está cerrado ni
// descartado. null si no hay ninguno. Pura (recibe el mapa de cerrados, el descartado y una función de movimientos del mes).
function mesParaCerrar(hoyISO, mesFn, cerrados, descartado){
  const dia=Number(String(hoyISO).slice(8,10));
  if(dia>CIERRE_DIAS_AVISO) return null;
  const prev=addMonths(String(hoyISO).slice(0,7), -1);
  if((cerrados||{})[prev] || descartado===prev) return null;
  return (mesFn(prev)||[]).length ? prev : null;
}

// ── El resumen ──
const r2cm=x=>Math.round(x*100)/100;
const deltaPct=(actual, base)=> base>0 ? Math.round((actual/base-1)*100) : null;

// `mesFn(ym)`: movimientos del mes con los frecuentes ya expandidos (getMesMov). `ganFn(ym)`: ganancia de inversiones del mes
// (o undefined). `crudos`: la lista de movimientos sin expandir, para detectar gastos fuera de lo normal. Función pura.
function resumenDelMes(ym, mesFn, ganFn, crudos){
  const lista=mesFn(ym)||[];
  const ant=addMonths(ym,-1);
  const r=resumenDePeriodo(lista, ganFn?ganFn(ym):undefined);
  const rAnt=resumenDePeriodo(mesFn(ant)||[], ganFn?ganFn(ant):undefined);
  const porCat=l=>{ const o={}; (l||[]).filter(esConsumo).forEach(m=>{ const v=montoARS(m); if(v>0) o[m.cat||"Sin categoría"]=(o[m.cat||"Sin categoría"]||0)+v; }); return o; };
  const cat=porCat(lista);
  const total=Object.values(cat).reduce((s,x)=>s+x,0);
  const top=Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,monto])=>({cat:c, monto:r2cm(monto), pct:total>0?Math.round(monto/total*100):0}));
  // Qué categorías subieron respecto del promedio de los 3 meses anteriores (los que tuvieron gastos)
  const previos=[1,2,3].map(i=>porCat(mesFn(addMonths(ym,-i))||[])).filter(o=>Object.keys(o).length);
  const subas=[];
  if(previos.length) Object.entries(cat).forEach(([c,monto])=>{
    const prom=previos.reduce((s,o)=>s+(o[c]||0),0)/previos.length;
    if(prom>0 && monto>=prom*1.3 && monto-prom>=Math.max(20000, total*0.03)) subas.push({cat:c, monto:r2cm(monto), promedio:r2cm(prom), pct:Math.round((monto/prom-1)*100), dif:monto-prom});
  });
  subas.sort((a,b)=>b.dif-a.dif);
  const mayor=(lista.filter(esConsumo).filter(m=>montoARS(m)>0).sort((a,b)=>montoARS(b)-montoARS(a))[0]);
  let inusuales=[];
  try{ if(typeof inusualesDelMes==="function") inusuales=inusualesDelMes(crudos||[], ym).slice(0,2).map(i=>({desc:i.mov.nota||i.mov.cat, monto:i.mov.importe, veces:i.veces, cat:i.cat})); }catch(e){ inusuales=[]; }
  return {ym, hayDatos:lista.length>0, cantidad:lista.length,
    ingresos:r.ingresos, gastos:r.gastos, ahorrado:r.ahorrado, aMano:r.retiradoAMano, disponible:r.disponible,
    retirado:r2cm(lista.filter(esRetiroAhorro).reduce((s,m)=>s+montoARS(m),0)),
    dIngresos:deltaPct(r.ingresos, rAnt.ingresos), dGastos:deltaPct(r.gastos, rAnt.gastos), anterior:{ingresos:rAnt.ingresos, gastos:rAnt.gastos},
    top, subas:subas.slice(0,2).map(({dif,...x})=>x), mayor:mayor?{desc:mayor.nota||mayor.cat||"Gasto", monto:r2cm(montoARS(mayor)), fecha:mayor.fecha}:null, inusuales};
}

// ── El chequeo ──
// Cada ítem: {id, estado:"ok"|"pendiente"|"info", titulo, detalle, accion:{txt}|null, ...datos extra}. Solo aparecen los que aplican.
// ctx = {movs, tcs, mesFn, vencTc, hoy, metas, backupDias, conciliacion:{hayDatos,pendientes}, incompletos:n, ingresosPorCobrar:[…]}
function chequeoDelMes(ym, ctx){
  const out=[];
  const lista=ctx.mesFn(ym)||[];
  // Gastos fijos sin marcar pagados
  const fp=frecuentesPorPagar(lista.filter(m=>m.tipo==="Gasto"));
  if(fp.total) out.push(fp.pendientes
    ? {id:"frecuentes", estado:"pendiente", titulo:`${fp.pendientes} ${fp.pendientes===1?"gasto fijo":"gastos fijos"} sin marcar como pagado`, detalle:`Suman ${fp.ars?fmtTotal(fp.ars):""}${fp.usd?` ${fp.ars?"+ ":""}USD ${fmtNum2(fp.usd)}`:""}. Es solo una ayuda memoria, no cambia tu balance.`, accion:{txt:"Marcar"}}
    : {id:"frecuentes", estado:"ok", titulo:"Todos los gastos fijos están marcados como pagados", detalle:"", accion:null});
  // Resúmenes de tarjeta sin marcar pagados
  const sinPagar=resumenesDelMes(ym, ctx.movs).filter(r=>r.total>0 && r.resta>0 && !resumenMarcadoPagado(datosResumenTc(ctx.vencTc, r.tarjeta, ym), r.moneda, ctx.movs));
  const totRes=resumenesDelMes(ym, ctx.movs).filter(r=>r.total>0).length;
  if(totRes) out.push(sinPagar.length
    ? {id:"tarjetas", estado:"pendiente", titulo:`${sinPagar.length} ${sinPagar.length===1?"resumen de tarjeta":"resúmenes de tarjeta"} sin marcar como pagado`, detalle:sinPagar.map(r=>`${r.tarjeta||"Tarjeta"}${r.moneda==="USD"?" (USD)":""}`).join(", ")+". Marcalo y vinculá el gasto con el que lo pagaste.", accion:{txt:"Ver tarjetas"}}
    : {id:"tarjetas", estado:"ok", titulo:"Los resúmenes de tarjeta están pagados", detalle:"", accion:null});
  // Ingresos frecuentes que todavía no cobraste
  if(ctx.ingresosPorCobrar && ctx.ingresosPorCobrar.length) out.push({id:"cobrar", estado:"pendiente", titulo:`${ctx.ingresosPorCobrar.length} ${ctx.ingresosPorCobrar.length===1?"ingreso":"ingresos"} por cobrar`, detalle:ctx.ingresosPorCobrar.map(v=>v.nombre).join(", "), accion:{txt:"Marcar"}});
  // Movimientos del mes sin cuenta
  const sinCta=(ctx.movs||[]).filter(m=>esMovParaCuenta(m) && !m.frecuente && String(m.fecha||"").slice(0,7)===ym && sinCuentaElegida(m)).length;
  out.push(sinCta
    ? {id:"sincuenta", estado:"pendiente", titulo:`${sinCta} ${sinCta===1?"movimiento":"movimientos"} sin cuenta`, detalle:"Elegirles la cuenta ayuda a saber de qué banco salió cada cosa.", accion:{txt:"Ordenar"}}
    : {id:"sincuenta", estado:"ok", titulo:"Todos los movimientos del mes tienen cuenta", detalle:"", accion:null});
  // Metas atadas a un ahorro con gastos sin marcar
  (ctx.metas||[]).filter(m=>m.fondoCat).forEach(m=>{
    const g=gastosSinMarcarComoAhorro(ctx.movs, m.fondoCat, m.fondoSub).filter(x=>String(x.fecha||"").slice(0,7)===ym);
    if(g.length) out.push({id:"metas", estado:"pendiente", metaId:m.id, titulo:`${g.length} ${g.length===1?"gasto":"gastos"} de "${m.fondoCat}" sin marcar como ahorro`, detalle:`No suman a tu meta "${m.nombre}".`, accion:{txt:"Revisar"}});
  });
  // Vencimientos que pasaron sin marcarse
  if(ctx.vencidos && ctx.vencidos.length) out.push({id:"vencidos", estado:"pendiente", titulo:`${ctx.vencidos.length} ${ctx.vencidos.length===1?"vencimiento":"vencimientos"} sin pagar`, detalle:typeof textoVencidos==="function"?textoVencidos(ctx.vencidos,3):"", accion:{txt:"Ver"}});
  // Datos a los que les falta algo
  if(ctx.incompletos) out.push({id:"datos", estado:"pendiente", titulo:`${ctx.incompletos} ${ctx.incompletos===1?"registro incompleto":"registros incompletos"}`, detalle:"A estos les falta un dato y no se pueden sumar bien.", accion:{txt:"Ver avisos"}});
  // Conciliación con el broker (prueba): solo informa
  if(ctx.conciliacion && ctx.conciliacion.hayDatos && ctx.conciliacion.pendientes) out.push({id:"conciliacion", estado:"info", titulo:`${ctx.conciliacion.pendientes} diferencias con tu broker`, detalle:"Entre tu fondo y tus inversiones (versión de prueba).", accion:{txt:"Ver"}});
  // Copia de seguridad
  out.push(ctx.backupDias>CIERRE_BACKUP_DIAS
    ? {id:"backup", estado:"pendiente", titulo:ctx.backupDias===Infinity?"Todavía no hiciste ninguna copia de seguridad":`Tu última copia de seguridad es de hace ${ctx.backupDias} días`, detalle:"Un cierre de mes es un buen momento para hacer una.", accion:{txt:"Hacer copia"}}
    : {id:"backup", estado:"ok", titulo:"Tenés una copia de seguridad reciente", detalle:"", accion:null});
  return out;
}
const pendientesDelChequeo=items=>items.filter(i=>i.estado==="pendiente").length;

// ── Pantalla ──
let cierreYM=null;

function ctxDelChequeo(){
  const hoy=hoyLocal();
  let incompletos=0; try{ incompletos=registrosIncompletos(movs, tcs).length; }catch(e){ incompletos=0; }
  let conc={hayDatos:false, pendientes:0}; try{ conc=resumenConciliacion(conciliarCedears(movs)); }catch(e){ /* sin conciliación */ }
  return {movs, tcs, mesFn:getMesMov, vencTc:leerVencTc(), hoy, metas, backupDias:diasDesde(localStorage.getItem("fultimobackup")),
          conciliacion:conc, incompletos, vencidos:vencidosSinPagar(hoy, movs, leerVencTc()), ingresosPorCobrar:ingresosFrecPorCobrar(currentYM(), hoy)};
}
const pctFlecha=p=>p===null ? "" : `<span class="cierre-delta ${p>0?"sube":p<0?"baja":""}">${p>0?"▲":p<0?"▼":"="} ${Math.abs(p)}%</span>`;

function resumenMesHTML(r){
  if(!r.hayDatos) return `<p class="txt-sm txt-muted" style="margin:12px 0">No hay movimientos en ${escapeHtml(mesLbl(r.ym))}.</p>`;
  const col=r.disponible>=0 ? "var(--save)" : "var(--danger)";
  const cats=r.top.map(c=>`<div class="cierre-cat"><div class="cierre-cat-top"><span>${getIcon(c.cat,"📦")} ${escapeHtml(c.cat)}</span><span><strong>${fmtTotal(c.monto)}</strong> <span class="txt-muted">${c.pct}%</span></span></div><div class="cierre-barra"><div style="width:${c.pct}%"></div></div></div>`).join("");
  const notas=[];
  r.subas.forEach(s=>notas.push(`📈 <strong>${escapeHtml(s.cat)}</strong> subió ${s.pct}% respecto de tu promedio de los últimos meses (${fmtTotal(s.monto)} vs ${fmtTotal(s.promedio)}).`));
  r.inusuales.forEach(i=>notas.push(`⚠️ ${escapeHtml(i.desc)}: ${fmtTotal(i.monto)}, ${i.veces}× lo habitual en ${escapeHtml(i.cat)}.`));
  if(r.mayor) notas.push(`💸 Tu gasto más grande fue <strong>${escapeHtml(r.mayor.desc)}</strong>: ${fmtTotal(r.mayor.monto)}.`);
  if(r.aMano>0) notas.push(`💸 Sacaste ${fmtTotal(r.aMano)} de tus ahorros que quedaron a mano: están sumados a lo disponible.`);
  if(r.ahorrado>0 || r.retirado>0) notas.push(`🏦 Ahorraste ${fmtTotal(r.ahorrado)}${r.retirado>0?` y usaste ${fmtTotal(r.retirado)} de tus ahorros`:""}.`);
  return `<div class="cierre-hero"><div class="txt-xs txt-muted">Te quedó disponible</div><div class="cierre-hero-num" style="color:${col}">${fmtTotal(r.disponible)}</div></div>
    <div class="cierre-fila3">
      <div><span class="txt-xs txt-muted">Ingresos</span><strong style="color:var(--success)">${fmtTotal(r.ingresos)}</strong>${pctFlecha(r.dIngresos)}</div>
      <div><span class="txt-xs txt-muted">Gastos</span><strong style="color:var(--danger)">${fmtTotal(r.gastos)}</strong>${pctFlecha(r.dGastos)}</div>
      <div><span class="txt-xs txt-muted">Ahorrado</span><strong style="color:var(--save)">${fmtTotal(r.ahorrado)}</strong></div>
    </div>
    <p class="txt-xs txt-muted" style="margin:4px 0 10px">Los porcentajes comparan con el mes anterior.</p>
    ${cats?`<div class="cierre-sec">En qué se fue la plata</div>${cats}`:""}
    ${notas.length?`<div class="cierre-sec">Para mirar</div>${notas.map(n=>`<p class="cierre-nota">${n}</p>`).join("")}`:""}`;
}
function chequeoHTML(items, ym){
  const ico={ok:"✅", pendiente:"⚠️", info:"ℹ️"};
  return items.map((i,n)=>`<div class="cierre-item ${i.estado}"><span class="cierre-ico">${ico[i.estado]}</span>
    <div class="cierre-mid"><div class="cierre-tit">${escapeHtml(i.titulo)}</div>${i.detalle?`<div class="cierre-det">${escapeHtml(i.detalle)}</div>`:""}</div>
    ${i.accion?`<button type="button" class="btn-sm" onclick="accionCierre(${n})">${escapeHtml(i.accion.txt)}</button>`:""}</div>`).join("");
}

let cierreItems=[];
function renderCierreMes(){
  const ym=cierreYM;
  const cuerpo=document.getElementById("cierre-cuerpo"), tit=document.getElementById("cierre-titulo"), btn=document.getElementById("cierre-btn");
  if(!cuerpo || !ym) return;
  const mapa=leerMesesCerrados();
  if(tit) tit.textContent=mesLbl(ym);
  const r=resumenDelMes(ym, getMesMov, e=>gananciaInvDelMes(e, movs), movs);
  cierreItems=chequeoDelMes(ym, ctxDelChequeo());
  const pend=pendientesDelChequeo(cierreItems);
  const cerrado=mapa[ym];
  cuerpo.innerHTML=`${cerrado?`<div class="cierre-cerrado">✓ Mes cerrado el ${escapeHtml(fmtDiaMes(cerrado.slice(0,10)))}</div>`:""}
    ${resumenMesHTML(r)}
    <div class="cierre-sec">Antes de cerrar${pend?` · ${pend} por revisar`:" · todo en orden"}</div>${chequeoHTML(cierreItems, ym)}`;
  if(btn){ btn.textContent=cerrado ? "Reabrir el mes" : "Cerrar el mes"; btn.classList.toggle("reabrir", !!cerrado); }
  const comp=document.getElementById("cierre-compartir"); if(comp) comp.style.display=r.hayDatos?"":"none";
}
// Abre el cierre del mes `ym` (por defecto el que toca: el anterior durante los primeros días del mes, el actual después).
function abrirCierreMes(ym){
  if(!document.getElementById("cierre-cuerpo")) return;
  const hoy=hoyLocal();
  cierreYM=ym || (Number(hoy.slice(8,10))<=CIERRE_DIAS_AVISO ? addMonths(hoy.slice(0,7),-1) : hoy.slice(0,7));
  renderCierreMes();
  document.getElementById("modal-cierre").classList.add("open");
}
function cerrarCierreMes(){
  const m=document.getElementById("modal-cierre");
  if(m) m.classList.remove("open");
  if(typeof pintarAvisoCierre==="function") pintarAvisoCierre();
}
function cierreMesCambiar(d){
  if(!cierreYM) return;
  const nuevo=addMonths(cierreYM,d);
  if(nuevo>currentYM()) return;   // no se cierra un mes que no empezó
  cierreYM=nuevo;
  renderCierreMes();
}
// El botón de abajo: cierra el mes (con aviso si quedan pendientes) o lo reabre.
async function alternarCierreMes(){
  const ym=cierreYM; if(!ym) return;
  const mapa=leerMesesCerrados();
  if(mapa[ym]){
    delete mapa[ym]; guardarMesesCerrados(mapa);
    showToast(`${mesLbl(ym)} reabierto`);
  } else {
    const pend=pendientesDelChequeo(cierreItems);
    if(pend && !await mostrarConfirm(`Quedan ${pend} ${pend===1?"cosa":"cosas"} por revisar en ${mesLbl(ym)}. ¿Cerrar el mes igual?`, {titulo:"Cerrar el mes", textoOk:"Cerrar igual", textoCancelar:"Seguir revisando"})) return;
    mapa[ym]=new Date().toISOString(); guardarMesesCerrados(mapa);
    showToast(`✓ ${mesLbl(ym)} cerrado`);
  }
  renderCierreMes();
}
// Cada botón del chequeo lleva a la pantalla que lo resuelve.
function accionCierre(n){
  const it=cierreItems[n]; if(!it) return;
  const ym=cierreYM;
  cerrarCierreMes();
  const irMov=()=>{ mesActual=ym; filtroFecha=null; filtro="Todos"; filtroCategoria=""; filtroTarjeta=""; showPage('mov', document.querySelector('.nav-btn[onclick*="\'mov\'"]')); renderMovs(); };
  switch(it.id){
    case "frecuentes": case "cobrar": irMov(); break;
    case "tarjetas": mesTc=ym; showPage('tc', document.querySelector('.nav-btn[onclick*="\'tc\'"]')); renderTarjetas(); break;
    case "sincuenta": abrirSinCuenta(); break;
    case "metas": showPage('ahorro', document.querySelector('.nav-btn[onclick*="\'ahorro\'"]')); if(typeof openEditMetaModal==="function") openEditMetaModal(it.metaId); break;
    case "vencidos": if(typeof irAMovimientos==="function") irAMovimientos(); break;
    case "backup": if(typeof compartirBackup==="function") compartirBackup(); break;
    case "datos": showPage('dash', document.querySelector('.nav-btn[onclick*="\'dash\'"]')); break;
    case "conciliacion": showPage('ahorro', document.querySelector('.nav-btn[onclick*="\'ahorro\'"]')); if(typeof abrirConciliacion==="function") abrirConciliacion(); break;
  }
}

// ── Aviso al empezar el mes ──
function pintarAvisoCierre(){
  const el=document.getElementById("mov-cierre-aviso");
  if(!el) return;
  const ym=mesParaCerrar(hoyLocal(), getMesMov, leerMesesCerrados(), localStorage.getItem(CIERRE_AVISO_KEY));
  if(!ym || filtro!=="Todos" || mesActual!==currentYM()){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block";
  el.innerHTML=`<div class="cierre-aviso"><span>🗓 Cerrá <strong>${escapeHtml(mesLbl(ym))}</strong>: revisá el resumen y lo pendiente.</span>
    <button type="button" class="btn-sm" onclick="abrirCierreMes(${attrJS(ym)})">Ver</button>
    <button type="button" class="cierre-x" aria-label="Descartar el aviso" onclick="descartarAvisoCierre(${attrJS(ym)})">×</button></div>`;
}
function descartarAvisoCierre(ym){
  guardarPreferencia(CIERRE_AVISO_KEY, ym);
  pintarAvisoCierre();
}

// ── Compartir el resumen como imagen ──
// Se dibuja en un canvas (sin librerías): un PNG de 1080 px de ancho, listo para mandar por WhatsApp.
function dibujarResumenMes(canvas, r){
  const W=1080, pad=64, ctx=canvas.getContext("2d");
  const filas=Math.min(r.top.length,5);
  const notas=[];
  r.subas.forEach(s=>notas.push(`${s.cat} subió ${s.pct}% vs tu promedio`));
  if(r.mayor) notas.push(`Gasto más grande: ${r.mayor.desc} (${fmtTotal(r.mayor.monto)})`);
  const H=430+filas*92+(notas.length?70+notas.length*52:0)+80;
  canvas.width=W; canvas.height=H;
  ctx.fillStyle="#f7f6f2"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#1f6e68"; ctx.fillRect(0,0,W,16);
  const txt=(t,x,y,size,color,peso,align)=>{ ctx.font=`${peso||500} ${size}px system-ui,-apple-system,sans-serif`; ctx.fillStyle=color; ctx.textAlign=align||"left"; ctx.fillText(t,x,y); };
  txt("Enola · "+mesLbl(r.ym), pad, 110, 52, "#1a1a18", 700);
  txt("Te quedó disponible", pad, 190, 30, "#6e6d65");
  txt(fmtTotal(r.disponible), pad, 270, 84, r.disponible>=0?"#1f6e68":"#a32d2d", 700);
  const col=(i,etq,val,color)=>{ const x=pad+i*((W-2*pad)/3); txt(etq, x, 350, 26, "#6e6d65"); txt(val, x, 396, 38, color, 700); };
  col(0,"Ingresos",fmtTotal(r.ingresos),"#2d7a3a"); col(1,"Gastos",fmtTotal(r.gastos),"#a32d2d"); col(2,"Ahorrado",fmtTotal(r.ahorrado),"#1f6e68");
  let y=470;
  r.top.slice(0,5).forEach(c=>{
    txt(c.cat, pad, y, 32, "#1a1a18", 600); txt(`${fmtTotal(c.monto)}  ·  ${c.pct}%`, W-pad, y, 30, "#6e6d65", 500, "right");
    ctx.fillStyle="#e8e5df"; ctx.fillRect(pad, y+16, W-2*pad, 14);
    ctx.fillStyle="#1f6e68"; ctx.fillRect(pad, y+16, (W-2*pad)*Math.min(c.pct,100)/100, 14);
    y+=92;
  });
  if(notas.length){ y+=20; txt("Para mirar", pad, y, 30, "#6e6d65", 700); y+=52; notas.forEach(n=>{ txt("• "+n, pad, y, 28, "#1a1a18"); y+=52; }); }
  txt("Hecho con Enola", W/2, H-36, 24, "#9a998f", 500, "center");
  return canvas;
}
async function compartirResumenMes(){
  const ym=cierreYM; if(!ym) return;
  const r=resumenDelMes(ym, getMesMov, e=>gananciaInvDelMes(e, movs), movs);
  if(!r.hayDatos){ showToast("No hay movimientos para compartir"); return; }
  const canvas=dibujarResumenMes(document.createElement("canvas"), r);
  const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
  if(!blob){ showToast("No se pudo armar la imagen"); return; }
  const nombre=`enola-resumen-${ym}.png`;
  let archivo=null; try{ archivo=new File([blob], nombre, {type:"image/png"}); }catch(e){ archivo=null; }
  if(archivo && typeof navigator.canShare==="function" && navigator.canShare({files:[archivo]})){
    try{ await navigator.share({files:[archivo], title:`Resumen de ${mesLbl(ym)}`}); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast("Imagen descargada ✓");
}
