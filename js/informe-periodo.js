// ═══════════════════════════════════════════
// INFORME DE UN PERÍODO
// ═══════════════════════════════════════════
// Un análisis de cualquier rango de meses (por ejemplo, lo que cargaste de antes de empezar a usar la app): mes a mes, lo que entró y lo que se
// gastó, en qué se fue la plata (con cuánto cambió contra el mismo período del año anterior), tus mayores gastos, ahorro e inversión, y una lista
// de hallazgos en palabras (cuánto del déficit se cubrió con créditos o vendiendo inversiones, si tu sueldo o un gasto fijo cambiaron, calidad de los
// datos). Usa la misma cuenta que el Balance del mes (resumenDePeriodo) para el "disponible", así los números coinciden con Movimientos.
//
// "Ingresos de trabajo" y "gastos operativos" dejan afuera lo FINANCIERO: créditos, préstamos, inversiones y operaciones MEP (una venta de CEDEARs no
// es un sueldo). La diferencia entre el disponible y el resultado operativo es justamente lo que se financió con deuda o vendiendo ahorros.

// Categorías financieras: el nombre ENTERO es inversiones, crédito o préstamo(s) ("Tarjeta de crédito" no lo es: es un gasto) o la subcategoría es MEP.
const INFORME_FINANCIERO=/^\s*(inversi[oó]n(es)?|cr[eé]ditos?|pr[eé]stamos?)\s*$/i;
const esMovFinanciero=m=>INFORME_FINANCIERO.test(String(m.cat||"")) || /^\s*mep\s*$/i.test(String(m.subcat||""));

// Pura. "2023-01" → "Ene ’23": corto pero con el año, para tablas y textos donde el rango cruza varios años.
function mesCortoInforme(ym){
  const x=/^(\d{4})-(\d{2})$/.exec(String(ym||"")); if(!x) return "";
  return MESES[Number(x[2])-1].slice(0,3)+" ’"+x[1].slice(2);
}

// Pura. Los meses de desde a hasta ("YYYY-MM"), ambos incluidos. [] si el rango no es válido.
function mesesDelRango(desde, hasta){
  if(!/^\d{4}-\d{2}$/.test(desde||"") || !/^\d{4}-\d{2}$/.test(hasta||"") || desde>hasta) return [];
  const out=[]; let ym=desde, guard=0;
  while(ym<=hasta && guard++<240){ out.push(ym); ym=addMonths(ym,1); }
  return out;
}

// Pura. Lo calculado de cada mes y del conjunto: sin hallazgos ni comparación. mesFn(ym) = movimientos del mes (fijos ya expandidos).
function agregarPeriodo(desde, hasta, mesFn, ganFn){
  const meses=[], cat={}, subs={}, fuentes={};
  const gastosGrandes=[];
  let sinCuenta=0, sinNota=0, nGastos=0, invCompras=0, invVentas=0;
  mesesDelRango(desde, hasta).forEach(ym=>{
    const lista=mesFn(ym)||[], g=ganFn ? ganFn(ym) : undefined;
    const r=resumenDePeriodo(lista, g), t=totalesDePlata(lista, g);
    let ingOp=0, ingFin=0, gasOp=0, gasFin=0;
    lista.forEach(m=>{
      const v=montoARS(m);
      if(m.tipo==="Ingreso"){ if(esMovFinanciero(m)) ingFin+=v; else { ingOp+=v; const k=m.cat||"Sin categoría"; fuentes[k]=(fuentes[k]||0)+v; } }
      else if(esConsumo(m) && v>0){
        if(esMovFinanciero(m)) gasFin+=v;
        else{
          gasOp+=v; const c=m.cat||"Sin categoría"; cat[c]=(cat[c]||0)+v;
          const k=c+"\u0001"+(m.subcat||""); (subs[k]=subs[k]||{cat:c, sub:m.subcat||"", total:0, porMes:{}}); subs[k].total+=v; subs[k].porMes[ym]=(subs[k].porMes[ym]||0)+v;
          gastosGrandes.push({desc:m.nota||m.subcat||m.cat||"Gasto", cat:c, sub:m.subcat||"", monto:v, fecha:m.fecha, cuenta:m.cuenta||""});
        }
        nGastos++;
        if(!m.cuenta || m.cuenta===CUENTA_SIN_ELEGIR) sinCuenta++;
        if(!String(m.nota||"").trim()) sinNota++;
      }
      else if(m.tipo==="Inversion"){ if(isInvSalida(m)) invVentas+=(m.importe||0); else invCompras+=(m.importe||0); }
    });
    meses.push({ym, hayDatos:lista.length>0, ingresos:r.ingresos, gastos:r.gastos, ahorrado:r.ahorrado, disponible:r.disponible, aMano:r.retiradoAMano,
      ingOp:r2cm(ingOp), ingFin:r2cm(ingFin), gasOp:r2cm(gasOp), gasFin:r2cm(gasFin), netoOp:r2cm(ingOp-gasOp), depositos:t.depositos, retiros:t.retiros});
  });
  const con=meses.filter(x=>x.hayDatos);
  const suma=k=>r2cm(con.reduce((s,x)=>s+x[k],0));
  const totalCat=Object.values(cat).reduce((s,x)=>s+x,0);
  const categorias=Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([c,monto])=>({cat:c, monto:r2cm(monto), pct:totalCat>0?Math.round(monto/totalCat*1000)/10:0,
    subs:Object.values(subs).filter(s=>s.cat===c).sort((a,b)=>b.total-a.total).slice(0,3).map(s=>({sub:s.sub, monto:r2cm(s.total)}))}));
  return {desde, hasta, hayDatos:con.length>0, mesesConDatos:con.length, meses,
    ingresos:suma("ingresos"), gastos:suma("gastos"), ahorrado:suma("ahorrado"), disponible:suma("disponible"),
    ingOp:suma("ingOp"), ingFin:suma("ingFin"), gasOp:suma("gasOp"), gasFin:suma("gasFin"), netoOp:suma("netoOp"),
    depositos:suma("depositos"), retiros:suma("retiros"), invCompras:r2cm(invCompras), invVentas:r2cm(invVentas),
    categorias, subs:Object.values(subs), fuentes:Object.entries(fuentes).sort((a,b)=>b[1]-a[1]).map(([c,monto])=>({cat:c, monto:r2cm(monto)})),
    gastosGrandes:gastosGrandes.sort((a,b)=>b.monto-a.monto).slice(0,5),
    calidad:{gastos:nGastos, sinCuenta, sinNota}};
}

// Pura. Los hallazgos en palabras: [{icono, texto}]. `inf` = agregarPeriodo(); `ant` = el mismo período un año antes (o null).
function hallazgosDelPeriodo(inf, ant){
  const out=[], F=fmtTotal, pct=x=>Math.round(x*100);
  if(!inf.hayDatos) return out;
  if(inf.mesesConDatos>1){
    const con=inf.meses.filter(x=>x.hayDatos);
    const peor=con.reduce((a,b)=>b.disponible<a.disponible?b:a), mejor=con.reduce((a,b)=>b.disponible>a.disponible?b:a);
    out.push({icono:"📅", texto:`El mes más holgado fue ${mesCortoInforme(mejor.ym)} (${F(mejor.disponible)} disponibles) y el más ajustado, ${mesCortoInforme(peor.ym)} (${peor.disponible<0?"−":""}${F(Math.abs(peor.disponible))}).`});
    const deficit=con.filter(x=>x.netoOp<0);
    if(deficit.length) out.push({icono:"⚠️", texto:`En ${deficit.length} de ${con.length} meses gastaste más de lo que entró por trabajo, alquileres y similares: ${deficit.map(x=>mesCortoInforme(x.ym)).join(", ")}.`});
  }
  if(inf.netoOp<0){
    const fin=inf.ingFin;
    out.push({icono:"🔎", texto:`Sin contar créditos ni inversiones, ${inf.mesesConDatos>1?"el período":"el mes"} cerró con un déficit de ${F(-inf.netoOp)} (${pct(-inf.netoOp/Math.max(inf.ingOp,1))}% de tus ingresos).`
      +(fin>0 ? ` Entraron ${F(fin)} por créditos, ventas de inversiones u operaciones MEP${fin>=-inf.netoOp?": eso cubrió el déficit":""}. Por eso el disponible (${F(inf.disponible)}) se ve mejor que la realidad.` : "")});
  } else if(inf.ingOp>0){
    out.push({icono:"✅", texto:`Sin contar créditos ni inversiones, ${inf.mesesConDatos>1?"el período":"el mes"} cerró con ${F(inf.netoOp)} a favor (${pct(inf.netoOp/inf.ingOp)}% de tus ingresos).`});
  }
  // Un ingreso que cambia mes a mes (sueldo): de primer a último mes con datos.
  const serie=inf.serieFuentes||{};
  Object.entries(serie).forEach(([c,vals])=>{
    const v=vals.filter(x=>x>0);
    if(v.reduce((a,b)=>a+b,0)<inf.ingOp*0.10) return;   // solo las fuentes que pesan (un ingreso suelto cambia 200% sin que importe)
    if(v.length>=3 && v[0]>0){ const d=v[v.length-1]/v[0]-1; if(Math.abs(d)>=0.05) out.push({icono:d<0?"📉":"📈", texto:`Tus ingresos de “${c}” ${d<0?"bajaron":"subieron"} ${pct(Math.abs(d))}% entre ${mesCortoInforme(vals.firstYm)} y ${mesCortoInforme(vals.lastYm)} (${F(v[0])} → ${F(v[v.length-1])} por mes).`}); }
  });
  // Un gasto que se repite todos los meses y cambió de precio
  const totalGas=inf.gasOp||1;
  inf.subs.filter(s=>Object.keys(s.porMes).length>=3 && s.total/totalGas>=0.05).sort((a,b)=>b.total-a.total).slice(0,3).forEach(s=>{
    const ks=Object.keys(s.porMes).sort(), a=s.porMes[ks[0]], b=s.porMes[ks[ks.length-1]];
    if(a>0 && Math.abs(b/a-1)>=0.06) out.push({icono:b>a?"📈":"📉", texto:`${s.sub||s.cat} (${s.cat}) pasó de ${F(a)} en ${mesCortoInforme(ks[0])} a ${F(b)} en ${mesCortoInforme(ks[ks.length-1])} (${b>a?"+":"−"}${pct(Math.abs(b/a-1))}%).`});
  });
  const tarj=inf.categorias.find(c=>/tarjeta/i.test(c.cat));
  if(tarj && tarj.pct>=15) out.push({icono:"💳", texto:`${Math.round(tarj.pct)}% de tus gastos (${F(tarj.monto)}) son pagos de tarjeta de crédito: no se ve qué compraste. Cargar el detalle de la tarjeta te diría en qué se fue de verdad.`});
  const ahorroPct=inf.ingOp>0 ? inf.depositos/inf.ingOp : 0;
  out.push({icono:"🏦", texto: inf.depositos>0 ? `Ahorraste ${F(inf.depositos)} en los fondos: el ${Math.round(ahorroPct*1000)/10}% de tus ingresos.` : "No hiciste depósitos a tus fondos de ahorro en este período."});
  if(inf.invCompras>0 || inf.invVentas>0) out.push({icono:"📊", texto:`En inversiones pusiste ${F(inf.invCompras)} y recuperaste ${F(inf.invVentas)}.`});
  if(ant && ant.hayDatos && ant.ingOp>0){
    const dI=Math.round((inf.ingOp/ant.ingOp-1)*100), dG=ant.gasOp>0 ? Math.round((inf.gasOp/ant.gasOp-1)*100) : null;
    out.push({icono:"🗓", texto:`Contra el mismo período del año anterior: ingresos de trabajo ${dI>=0?"+":""}${dI}%${dG!==null?` y gastos ${dG>=0?"+":""}${dG}%`:""}${ant.mesesConDatos<inf.mesesConDatos?`. Ojo: el año anterior tiene menos meses cargados (${ant.mesesConDatos} de ${inf.mesesConDatos}), la comparación no es pareja`:""}.`});
  }
  const q=inf.calidad;
  if(q.gastos>=10){
    const sc=Math.round(q.sinCuenta/q.gastos*100), sn=Math.round(q.sinNota/q.gastos*100);
    if(sc>=30 || sn>=50) out.push({icono:"🧹", texto:`Calidad de los datos: ${sc}% de los gastos no tiene cuenta y ${sn}% no tiene nota. Con eso es difícil saber de qué banco salió o qué fue cada uno.`});
  }
  return out;
}

// Pura. El informe completo de desde a hasta, con la comparación contra el mismo rango un año antes.
function informeDePeriodo(desde, hasta, mesFn, ganFn){
  const inf=agregarPeriodo(desde, hasta, mesFn, ganFn);
  // Serie mensual de cada fuente de ingreso (para ver si, por ejemplo, el sueldo bajó)
  const serie={};
  mesesDelRango(desde, hasta).forEach(ym=>{
    (mesFn(ym)||[]).filter(m=>m.tipo==="Ingreso" && !esMovFinanciero(m)).forEach(m=>{ const c=m.cat||"Sin categoría"; (serie[c]=serie[c]||{})[ym]=(serie[c][ym]||0)+montoARS(m); });
  });
  inf.serieFuentes={};
  Object.entries(serie).forEach(([c,porMes])=>{ const ks=Object.keys(porMes).sort(); const vals=ks.map(k=>r2cm(porMes[k])); vals.firstYm=ks[0]; vals.lastYm=ks[ks.length-1]; inf.serieFuentes[c]=vals; });
  const ant=agregarPeriodo(addMonths(desde,-12), addMonths(hasta,-12), mesFn, ganFn);
  // La comparación por categoría contra el año anterior
  const antCat=Object.fromEntries(ant.categorias.map(c=>[c.cat,c.monto]));
  inf.categorias.forEach(c=>{ c.antes=antCat[c.cat]||0; c.delta= ant.hayDatos && c.antes>0 ? Math.round((c.monto/c.antes-1)*100) : null; });
  inf.anterior={hayDatos:ant.hayDatos, mesesConDatos:ant.mesesConDatos, ingOp:ant.ingOp, gasOp:ant.gasOp};
  inf.hallazgos=hallazgosDelPeriodo(inf, ant);
  return inf;
}

// Pura. El mismo informe en texto plano, para mandarlo por WhatsApp o pegarlo.
function informeComoTexto(inf){
  const F=fmtTotal, L=[];
  L.push(`Informe de Enola · ${inf.desde===inf.hasta ? mesLbl(inf.desde) : `${mesLbl(inf.desde)} a ${mesLbl(inf.hasta)}`}`, "");
  L.push(`Ingresos ${F(inf.ingresos)} · Gastos ${F(inf.gastos)} · Ahorrado ${F(inf.ahorrado)} · Disponible ${inf.disponible<0?"−":""}${F(Math.abs(inf.disponible))}`);
  L.push(`Sin créditos ni inversiones: ingresos ${F(inf.ingOp)} · gastos ${F(inf.gasOp)} · resultado ${inf.netoOp<0?"−":""}${F(Math.abs(inf.netoOp))}`, "");
  L.push("Mes a mes (ingresos / gastos / disponible):");
  inf.meses.filter(x=>x.hayDatos).forEach(x=>L.push(`• ${mesCortoInforme(x.ym)}: ${F(x.ingresos)} / ${F(x.gastos)} / ${x.disponible<0?"−":""}${F(Math.abs(x.disponible))}`));
  L.push("", "En qué se fue la plata:");
  inf.categorias.slice(0,6).forEach(c=>L.push(`• ${c.cat}: ${F(c.monto)} (${Math.round(c.pct)}%)${c.delta!==null?` · ${c.delta>=0?"+":""}${c.delta}% vs año anterior`:""}`));
  if(inf.hallazgos.length){ L.push("", "Para tener en cuenta:"); inf.hallazgos.forEach(h=>L.push(`${h.icono} ${h.texto}`)); }
  L.push("", "Hecho con Enola");
  return L.join("\n");
}

// ── Pantalla ──
const informeFmt=n=>`${n<0?"−":""}${fmtTotal(Math.abs(n))}`;
function informeTablaHTML(inf){
  const filas=inf.meses.filter(x=>x.hayDatos).map(x=>`<tr><td>${escapeHtml(mesCortoInforme(x.ym))}</td><td>${fmtAbbr(x.ingresos)}</td><td>${fmtAbbr(x.gastos)}</td><td class="${x.disponible<0?"neg":"pos"}">${informeFmt(x.disponible)}</td><td class="${x.netoOp<0?"neg":""}">${informeFmt(x.netoOp)}</td></tr>`).join("");
  return `<div class="informe-scroll"><table class="informe-tabla"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Disponible</th><th>Sin créd./inv.</th></tr></thead><tbody>${filas}
    <tr class="total"><td>Total</td><td>${fmtAbbr(inf.ingresos)}</td><td>${fmtAbbr(inf.gastos)}</td><td class="${inf.disponible<0?"neg":"pos"}">${informeFmt(inf.disponible)}</td><td class="${inf.netoOp<0?"neg":""}">${informeFmt(inf.netoOp)}</td></tr></tbody></table></div>`;
}
function informeHTML(inf){
  if(!inf.hayDatos) return `<p class="txt-sm txt-muted" style="margin:12px 0">No hay movimientos en ese período.</p>`;
  const col=inf.disponible>=0 ? "var(--save)" : "var(--danger)";
  const cats=inf.categorias.slice(0,8).map(c=>`<div class="cierre-cat"><div class="cierre-cat-top"><span>${getIcon(c.cat,"📦")} ${escapeHtml(c.cat)}</span><span><strong>${fmtTotal(c.monto)}</strong> <span class="txt-muted">${Math.round(c.pct)}%</span>${c.delta!==null?` <span class="cierre-delta ${c.delta>0?"sube":c.delta<0?"baja":""}">${c.delta>0?"▲":c.delta<0?"▼":"="} ${Math.abs(c.delta)}%</span>`:""}</span></div>
    <div class="cierre-barra"><div style="width:${Math.min(c.pct,100)}%"></div></div>${c.subs.length?`<div class="informe-subs">${c.subs.map(s=>`${escapeHtml(s.sub||"Sin subcategoría")} ${fmtAbbr(s.monto)}`).join(" · ")}</div>`:""}</div>`).join("");
  const fuentes=inf.fuentes.slice(0,5).map(f=>`<div class="informe-fila"><span>${getIcon(f.cat,"💰")} ${escapeHtml(f.cat)}</span><strong>${fmtTotal(f.monto)}</strong></div>`).join("");
  const grandes=inf.gastosGrandes.map(g=>`<div class="informe-fila"><span>${escapeHtml(fmtDiaMes(g.fecha))} · ${escapeHtml(g.desc)} <span class="txt-muted">${escapeHtml(g.cat)}</span></span><strong>${fmtTotal(g.monto)}</strong></div>`).join("");
  const hall=inf.hallazgos.map(h=>`<p class="cierre-nota">${h.icono} ${escapeHtml(h.texto)}</p>`).join("");
  return `<div class="cierre-hero"><div class="txt-xs txt-muted">Disponible en el período</div><div class="cierre-hero-num" style="color:${col}">${informeFmt(inf.disponible)}</div></div>
    <div class="cierre-fila3">
      <div><span class="txt-xs txt-muted">Ingresos</span><strong style="color:var(--success)">${fmtTotal(inf.ingresos)}</strong></div>
      <div><span class="txt-xs txt-muted">Gastos</span><strong style="color:var(--danger)">${fmtTotal(inf.gastos)}</strong></div>
      <div><span class="txt-xs txt-muted">Ahorrado</span><strong style="color:var(--save)">${fmtTotal(inf.ahorrado)}</strong></div>
    </div>
    <div class="cierre-sec">Para tener en cuenta</div>${hall}
    <div class="cierre-sec">Mes a mes</div>${informeTablaHTML(inf)}
    <p class="txt-xs txt-muted" style="margin:6px 0 0;line-height:1.4">“Sin créd./inv.” deja afuera créditos, préstamos, inversiones y MEP: es lo que de verdad entró y salió de tu bolsillo.</p>
    <div class="cierre-sec">En qué se fue la plata${inf.anterior.hayDatos?" (vs mismo período del año anterior)":""}</div>${cats}
    ${fuentes?`<div class="cierre-sec">De dónde entró la plata</div>${fuentes}`:""}
    ${grandes?`<div class="cierre-sec">Tus mayores gastos</div>${grandes}`:""}`;
}

let informeDesde="", informeHasta="";
// "Antes de usar la app": desde enero del año de la primera importación hasta el último mes completo anterior a ella. null si no hay importaciones.
function periodoAntesDeLaApp(importaciones){
  const fechas=(importaciones||[]).map(i=>/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(i&&i.fecha||""))).filter(Boolean)
    .map(m=>`${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`).sort();
  if(!fechas.length) return null;
  const y=fechas[0].slice(0,4), ym=fechas[0].slice(0,7), hasta=addMonths(ym,-1);
  return hasta>=`${y}-01` ? {desde:`${y}-01`, hasta, importacion:fechas[0]} : null;
}
function informeRangoValido(){ return mesesDelRango(informeDesde, informeHasta).length>0; }
function renderInforme(){
  const cuerpo=document.getElementById("informe-cuerpo");
  if(!cuerpo) return;
  const d=document.getElementById("informe-desde"), h=document.getElementById("informe-hasta");
  if(d && d.value!==informeDesde) d.value=informeDesde;
  if(h && h.value!==informeHasta) h.value=informeHasta;
  const comp=document.getElementById("informe-compartir"), compT=document.getElementById("informe-compartir-texto");
  if(!informeRangoValido()){ cuerpo.innerHTML=`<p class="txt-sm txt-muted" style="margin:12px 0">Elegí un período: el mes de inicio tiene que ser anterior o igual al de fin.</p>`; if(comp) comp.style.display="none"; if(compT) compT.style.display="none"; return; }
  const inf=informeDePeriodo(informeDesde, informeHasta, getMesMov, e=>gananciaInvDelMes(e, movs));
  cuerpo.innerHTML=informeHTML(inf);
  if(comp) comp.style.display=inf.hayDatos ? "" : "none"; if(compT) compT.style.display=inf.hayDatos ? "" : "none";
}
function informeElegir(preset){
  const hoy=currentYM(), y=hoy.slice(0,4);
  if(preset==="anio"){ informeDesde=`${y}-01`; informeHasta=hoy; }
  else if(preset==="seis"){ informeDesde=addMonths(hoy,-5); informeHasta=hoy; }
  else if(preset==="antes"){ const p=periodoAntesDeLaApp(importHistory); if(p){ informeDesde=p.desde; informeHasta=p.hasta; } }
  renderInforme();
}
function informeCambioMes(){
  const d=document.getElementById("informe-desde"), h=document.getElementById("informe-hasta");
  if(d) informeDesde=d.value||informeDesde; if(h) informeHasta=h.value||informeHasta;
  renderInforme();
}
function abrirInforme(preset){
  if(!document.getElementById("informe-cuerpo")) return;
  const antes=periodoAntesDeLaApp(importHistory);
  const bAntes=document.getElementById("informe-preset-antes"); if(bAntes) bAntes.style.display=antes ? "" : "none";
  informeElegir(preset==="antes" && antes ? "antes" : (preset||(antes ? "antes" : "anio")));
  document.getElementById("modal-informe").classList.add("open");
}
function cerrarInforme(){ const m=document.getElementById("modal-informe"); if(m) m.classList.remove("open"); }
// ── Compartir como imagen (canvas, sin librerías: PNG de 1080 px, el mismo estilo que el resumen del mes) ──
// Pura (solo usa el contexto para medir). Parte un texto en renglones que entren en `ancho` píxeles.
function partirEnRenglones(ctx, texto, ancho){
  const out=[]; let cur="";
  String(texto).split(/\s+/).filter(Boolean).forEach(w=>{
    const prueba=cur ? cur+" "+w : w;
    if(cur && ctx.measureText(prueba).width>ancho){ out.push(cur); cur=w; } else cur=prueba;
  });
  if(cur) out.push(cur);
  return out;
}
const INFORME_IMG_MAX_HALLAZGOS=6;
function dibujarInforme(canvas, inf){
  const W=1080, pad=64, ctx=canvas.getContext("2d"), FUENTE="system-ui,-apple-system,sans-serif";
  const cats=inf.categorias.slice(0,5);
  const hall=inf.hallazgos.slice(0,INFORME_IMG_MAX_HALLAZGOS), masHall=inf.hallazgos.length-hall.length;
  ctx.font=`500 28px ${FUENTE}`;
  const bloques=hall.map(h=>partirEnRenglones(ctx, `${h.icono} ${h.texto}`, W-2*pad-8));
  const lineasHall=bloques.reduce((a,b)=>a+b.length,0);
  const conMeses=inf.meses.filter(x=>x.hayDatos);
  const yBase=560+240, yCats=yBase+(inf.meses.length>12?160:120);
  const H=yCats+cats.length*92+70+(hall.length?70+lineasHall*40+hall.length*14+(masHall>0?44:0):0)+80;
  canvas.width=W; canvas.height=H;
  ctx.fillStyle="#f7f6f2"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#1f6e68"; ctx.fillRect(0,0,W,16);
  const txt=(t,x,y,size,color,peso,align)=>{ ctx.font=`${peso||500} ${size}px ${FUENTE}`; ctx.fillStyle=color; ctx.textAlign=align||"left"; ctx.fillText(t,x,y); };
  txt("Enola · Informe", pad, 110, 52, "#1a1a18", 700);
  txt(inf.desde===inf.hasta ? mesLbl(inf.desde) : `${mesLbl(inf.desde)} a ${mesLbl(inf.hasta)}`, pad, 156, 30, "#6e6d65");
  txt("Disponible en el período", pad, 236, 30, "#6e6d65");
  txt((inf.disponible<0?"−":"")+fmtTotal(Math.abs(inf.disponible)), pad, 316, 84, inf.disponible>=0?"#1f6e68":"#a32d2d", 700);
  const col=(i,etq,val,color)=>{ const x=pad+i*((W-2*pad)/3); txt(etq, x, 396, 26, "#6e6d65"); txt(val, x, 442, 38, color, 700); };
  col(0,"Ingresos",fmtTotal(inf.ingresos),"#2d7a3a"); col(1,"Gastos",fmtTotal(inf.gastos),"#a32d2d"); col(2,"Ahorrado",fmtTotal(inf.ahorrado),"#1f6e68");
  txt("Sin créditos ni inversiones", pad, 500, 26, "#6e6d65");
  txt((inf.netoOp<0?"−":"")+fmtTotal(Math.abs(inf.netoOp)), W-pad, 500, 30, inf.netoOp>=0?"#1f6e68":"#a32d2d", 700, "right");
  // Barras: lo que quedó cada mes
  txt("Mes a mes", pad, 560, 30, "#6e6d65", 700);
  const n=Math.max(inf.meses.length,1), ancho=(W-2*pad)/n, max=Math.max(...conMeses.map(x=>Math.abs(x.disponible)),1);
  ctx.fillStyle="#cfccc3"; ctx.fillRect(pad, yBase, W-2*pad, 3);
  const hueco=n>24 ? 1 : n>12 ? 3 : 8, paso=n<=12 ? 1 : Math.ceil(100/ancho);
  inf.meses.forEach((x,i)=>{
    if(x.hayDatos){ const h=Math.max(Math.abs(x.disponible)/max*220, 6); ctx.fillStyle=x.disponible>=0?"#1f6e68":"#a32d2d";
      if(x.disponible>=0) ctx.fillRect(pad+i*ancho+hueco, yBase-h, ancho-2*hueco, h); else ctx.fillRect(pad+i*ancho+hueco, yBase+3, ancho-2*hueco, Math.min(h,40)); }
    if(i%paso===0) txt(n<=12 ? mesCortoInforme(x.ym).split(" ")[0] : mesCortoInforme(x.ym), pad+i*ancho+ancho/2, yBase+(n<=12 ? 66 : 76), n<=12 ? 24 : 20, "#6e6d65", 500, "center");
  });
  let y=yCats;
  cats.forEach(c=>{
    txt(c.cat, pad, y, 32, "#1a1a18", 600); txt(`${fmtTotal(c.monto)}  ·  ${Math.round(c.pct)}%`, W-pad, y, 30, "#6e6d65", 500, "right");
    ctx.fillStyle="#e8e5df"; ctx.fillRect(pad, y+16, W-2*pad, 14);
    ctx.fillStyle="#1f6e68"; ctx.fillRect(pad, y+16, (W-2*pad)*Math.min(c.pct,100)/100, 14);
    y+=92;
  });
  if(hall.length){
    y+=20; txt("Para tener en cuenta", pad, y, 30, "#6e6d65", 700); y+=52;
    bloques.forEach(b=>{ b.forEach(l=>{ txt(l, pad, y, 28, "#1a1a18"); y+=40; }); y+=14; });
    if(masHall>0) txt(`…y ${masHall} más en el informe de la app`, pad, y, 26, "#9a998f");
  }
  txt("Hecho con Enola", W/2, H-36, 24, "#9a998f", 500, "center");
  return canvas;
}
// Manda un PNG por el menú de compartir (WhatsApp, etc.) o, si el navegador no puede, lo descarga.
async function entregarPNG(canvas, nombre, titulo){
  const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
  if(!blob){ showToast("No se pudo armar la imagen"); return; }
  let archivo=null; try{ archivo=new File([blob], nombre, {type:"image/png"}); }catch(e){ archivo=null; }
  if(archivo && typeof navigator.canShare==="function" && navigator.canShare({files:[archivo]})){
    try{ await navigator.share({files:[archivo], title:titulo}); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast("Imagen descargada ✓");
}
function informeActual(){
  if(!informeRangoValido()) return null;
  const inf=informeDePeriodo(informeDesde, informeHasta, getMesMov, e=>gananciaInvDelMes(e, movs));
  if(!inf.hayDatos){ showToast("No hay movimientos para compartir"); return null; }
  return inf;
}
async function compartirInforme(){
  const inf=informeActual(); if(!inf) return;
  await entregarPNG(dibujarInforme(document.createElement("canvas"), inf), `enola-informe-${inf.desde}_${inf.hasta}.png`, "Informe de Enola");
}
async function compartirInformeTexto(){
  const inf=informeActual(); if(!inf) return;
  const texto=informeComoTexto(inf);
  if(navigator.share){ try{ await navigator.share({title:"Informe de Enola", text:texto}); return; }catch(e){ if(e && e.name==="AbortError") return; } }
  try{ await navigator.clipboard.writeText(texto); showToast("Informe copiado ✓"); }
  catch(e){ showToast("No se pudo copiar el informe"); }
}
