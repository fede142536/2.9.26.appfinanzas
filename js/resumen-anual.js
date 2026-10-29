// ═══════════════════════════════════════════
// RESUMEN DEL AÑO
// ═══════════════════════════════════════════
// Al cerrar el año (o cuando quieras): lo que entró, lo que gastaste, lo que ahorraste y lo que te quedó disponible en los 12 meses, mes a
// mes, en qué se fue la plata, tu mejor y tu peor mes, y cómo vas contra el año anterior. Se puede compartir como imagen. Usa la misma cuenta
// que el Balance del mes (resumenDePeriodo), así que los números coinciden con Movimientos y el Dashboard.

const ANUAL_AVISO_KEY="fanualavisado";   // el último año cuyo aviso se descartó
const MESES_INICIAL=["E","F","M","A","M","J","J","A","S","O","N","D"];

// Pura. El resumen de `anio`. mesFn(ym) = movimientos del mes (frecuentes expandidos), ganFn(ym) = ganancia de inversiones del mes,
// hastaYM = el último mes que cuenta (para no proyectar fijos a meses que no llegaron), anterior = el resumen del año previo (para comparar).
function resumenDelAnio(anio, mesFn, ganFn, hastaYM, anterior){
  const meses=[];
  for(let m=1;m<=12;m++){
    const ym=`${anio}-${String(m).padStart(2,"0")}`;
    if(hastaYM && ym>hastaYM){ meses.push({ym, hayDatos:false, ingresos:0, gastos:0, ahorrado:0, aMano:0, disponible:0, depositos:0, retiros:0, ganancia:0, lista:[]}); continue; }
    const lista=mesFn(ym)||[], g=ganFn ? ganFn(ym) : undefined;
    const r=resumenDePeriodo(lista, g), t=totalesDePlata(lista, g);
    meses.push({ym, hayDatos:lista.length>0, ingresos:r.ingresos, gastos:r.gastos, ahorrado:r.ahorrado, aMano:r.retiradoAMano, disponible:r.disponible, depositos:t.depositos, retiros:t.retiros, ganancia:(g&&g.ars)||0, lista});
  }
  const con=meses.filter(x=>x.hayDatos);
  const suma=k=>r2cm(con.reduce((s,x)=>s+x[k],0));
  const porCat={};
  let mayor=null;
  con.forEach(x=>x.lista.filter(esConsumo).forEach(m=>{
    const v=montoARS(m); if(!(v>0)) return;
    const c=m.cat||"Sin categoría"; porCat[c]=(porCat[c]||0)+v;
    if(!mayor || v>mayor.monto) mayor={desc:m.nota||m.cat||"Gasto", monto:r2cm(v), fecha:m.fecha};
  }));
  const totalCat=Object.values(porCat).reduce((s,x)=>s+x,0);
  const top=Object.entries(porCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,monto])=>({cat, monto:r2cm(monto), pct:totalCat>0?Math.round(monto/totalCat*100):0}));
  const mejor=con.length>=2 ? con.reduce((a,b)=>b.disponible>a.disponible?b:a) : null;
  const peor=con.length>=2 ? con.reduce((a,b)=>b.disponible<a.disponible?b:a) : null;
  const caro=con.length>=2 ? con.reduce((a,b)=>b.gastos>a.gastos?b:a) : null;
  const out={anio, hayDatos:con.length>0, mesesConDatos:con.length, ingresos:suma("ingresos"), gastos:suma("gastos"), ahorrado:suma("ahorrado"), aMano:suma("aMano"), disponible:suma("disponible"),
    ahorroNeto:r2cm(con.reduce((s,x)=>s+x.depositos-x.retiros,0)), ganancia:suma("ganancia"),
    promedioGasto: con.length ? r2cm(suma("gastos")/con.length) : 0,
    meses:meses.map(({lista,...x})=>x), top, mayor,
    mejorMes: mejor ? {ym:mejor.ym, disponible:mejor.disponible} : null, peorMes: peor ? {ym:peor.ym, disponible:peor.disponible} : null, mesMasCaro: caro ? {ym:caro.ym, gastos:caro.gastos} : null,
    dIngresos:null, dGastos:null};
  if(anterior && anterior.hayDatos){ out.dIngresos=deltaPct(out.ingresos, anterior.ingresos); out.dGastos=deltaPct(out.gastos, anterior.gastos); }
  return out;
}

// Pura. El año del que hay que avisar: en la 2ª quincena de diciembre el actual y en enero (hasta el 20) el que terminó; si tuvo datos y no se descartó.
function anioParaResumen(hoyISO, aniosConDatos, descartado){
  const y=Number(String(hoyISO).slice(0,4)), m=Number(String(hoyISO).slice(5,7)), d=Number(String(hoyISO).slice(8,10));
  let a=null;
  if(m===12 && d>=15) a=y; else if(m===1 && d<=20) a=y-1;
  if(a===null || String(descartado)===String(a) || !(aniosConDatos||[]).includes(a)) return null;
  return a;
}
const aniosConMovimientos=lista=>[...new Set((lista||[]).map(m=>Number(String(m.fecha||"").slice(0,4))).filter(a=>a>=2000 && a<=2100))].sort((a,b)=>a-b);

// ── Pantalla ──
const pctFlechaAnual=p=>p===null ? "" : `<span class="cierre-delta ${p>0?"sube":p<0?"baja":""}">${p>0?"▲":p<0?"▼":"="} ${Math.abs(p)}%</span>`;
// La cabecera del año (arriba de la pantalla "Año completo"): lo que te quedó, ingresos/gastos/ahorrado y cuánto cambiaron contra el año anterior.
function anioCabeceraHTML(r){
  if(!r.hayDatos) return `<p class="txt-sm txt-muted" style="margin:8px 0">No hay movimientos en ${r.anio}.</p>`;
  const col=r.disponible>=0 ? "var(--save)" : "var(--danger)";
  return `<div class="cierre-hero"><div class="txt-xs txt-muted">Te quedó disponible en ${r.anio}</div><div class="cierre-hero-num" id="dash-anio-num" style="color:${col}">${fmtTotal(r.disponible)}</div></div>
    <div class="cierre-fila3">
      <div><span class="txt-xs txt-muted">Ingresos</span><strong style="color:var(--success)">${fmtTotal(r.ingresos)}</strong>${pctFlechaAnual(r.dIngresos)}</div>
      <div><span class="txt-xs txt-muted">Gastos</span><strong style="color:var(--danger)">${fmtTotal(r.gastos)}</strong>${pctFlechaAnual(r.dGastos)}</div>
      <div><span class="txt-xs txt-muted">Ahorrado</span><strong style="color:var(--save)">${fmtTotal(r.ahorrado)}</strong></div>
    </div>
    ${r.dIngresos!==null||r.dGastos!==null?`<p class="txt-xs txt-muted" style="margin:6px 0 0;text-align:center">Los porcentajes comparan con ${r.anio-1}.</p>`:""}`;
}
// Pura. Las frases de "Para recordar" (HTML) del año; [] si no hay nada que contar.
function anioNotas(r){
  const notas=[];
  if(!r.hayDatos) return notas;
  if(r.mejorMes) notas.push(`🏆 Tu mejor mes fue <strong>${escapeHtml(mesLbl(r.mejorMes.ym))}</strong>: te quedaron ${fmtTotal(r.mejorMes.disponible)}.`);
  if(r.peorMes && r.peorMes.ym!==r.mejorMes.ym) notas.push(`📉 El más ajustado fue <strong>${escapeHtml(mesLbl(r.peorMes.ym))}</strong>: ${fmtTotal(r.peorMes.disponible)}.`);
  if(r.mesMasCaro) notas.push(`💸 Gastaste más en <strong>${escapeHtml(mesLbl(r.mesMasCaro.ym))}</strong> (${fmtTotal(r.mesMasCaro.gastos)}).`);
  if(r.mesesConDatos>1) notas.push(`📊 Gastaste en promedio ${fmtTotal(r.promedioGasto)} por mes.`);
  if(r.mayor) notas.push(`🧾 Tu gasto más grande: <strong>${escapeHtml(r.mayor.desc)}</strong> (${fmtTotal(r.mayor.monto)}).`);
  if(r.ahorroNeto!==0) notas.push(`🏦 Lo que quedó en tus ahorros: ${r.ahorroNeto>0?"+":"−"}${fmtTotal(Math.abs(r.ahorroNeto))} (depósitos menos retiros).`);
  if(Math.round(r.ganancia)!==0) notas.push(`📈 Resultado de tus inversiones: ${r.ganancia>0?"+":"−"}${fmtTotal(Math.abs(r.ganancia))}.`);
  return notas;
}

function resumenDeAnio(anio){
  const hoyYM=currentYM(), hasta=String(anio)===hoyYM.slice(0,4) ? hoyYM : undefined;
  const ganFn=e=>gananciaInvDelMes(e, movs);
  const ant=resumenDelAnio(anio-1, getMesMov, ganFn, undefined);
  return resumenDelAnio(anio, getMesMov, ganFn, hasta, ant);
}
// Pinta la cabecera y "Para recordar" del año que se mira en "Año completo" (dashYear).
function pintarResumenAnio(anio){
  const cab=document.getElementById("dash-anio-cabecera"); if(!cab) return;
  const r=resumenDeAnio(anio);
  cab.innerHTML=anioCabeceraHTML(r);
  const num=document.getElementById("dash-anio-num"); if(num) animarNumero(num, r.disponible, 700, fmtTotal);
  const comp=document.getElementById("anual-compartir"); if(comp) comp.style.display=r.hayDatos?"":"none";
  const notas=anioNotas(r), card=document.getElementById("dash-anio-notas-card"), cont=document.getElementById("dash-anio-notas");
  if(card) card.style.display=notas.length?"":"none";
  if(cont) cont.innerHTML=notas.map(n=>`<p class="cierre-nota">${n}</p>`).join("");
}
// Abre "Año completo" en `anio` (por defecto el que termina o está en curso: en enero el año anterior si tuvo datos, si no el actual). Sirve desde cualquier pestaña.
function abrirResumenAnual(anio){
  const hoy=hoyLocal(), anios=aniosConMovimientos(movs), y=Number(hoy.slice(0,4));
  const a=anio || (Number(hoy.slice(5,7))<=1 && anios.includes(y-1) ? y-1 : (anios.includes(y) ? y : (anios[anios.length-1]||y)));
  showPage("dash", document.querySelector('.nav-btn[onclick*="\'dash\'"]'));
  openDashYearCompleto(a);
}

// ── Aviso al cerrar el año ──
function pintarAvisoAnual(){
  const el=document.getElementById("mov-anual-aviso");
  if(!el) return;
  const a=anioParaResumen(hoyLocal(), aniosConMovimientos(movs), localStorage.getItem(ANUAL_AVISO_KEY));
  if(a===null || filtro!=="Todos" || mesActual!==currentYM()){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block";
  el.innerHTML=`<div class="cierre-aviso"><span>🎉 Ya podés ver tu resumen de <strong>${a}</strong>.</span>
    <button type="button" class="btn-sm" onclick="abrirResumenAnual(${a})">Ver</button>
    <button type="button" class="cierre-x" aria-label="Descartar el aviso" onclick="descartarAvisoAnual(${a})">×</button></div>`;
}
function descartarAvisoAnual(a){
  guardarPreferencia(ANUAL_AVISO_KEY, String(a));
  pintarAvisoAnual();
}

// ── Compartir como imagen (canvas, sin librerías: PNG de 1080 px) ──
function dibujarResumenAnual(canvas, r){
  const W=1080, pad=64, ctx=canvas.getContext("2d");
  const cats=r.top.slice(0,5);
  const notas=[];
  if(r.mejorMes) notas.push(`Mejor mes: ${mesLbl(r.mejorMes.ym)} (${fmtTotal(r.mejorMes.disponible)})`);
  if(r.mesMasCaro) notas.push(`Mes con más gastos: ${mesLbl(r.mesMasCaro.ym)} (${fmtTotal(r.mesMasCaro.gastos)})`);
  if(r.mayor) notas.push(`Gasto más grande: ${r.mayor.desc} (${fmtTotal(r.mayor.monto)})`);
  if(r.mesesConDatos>1) notas.push(`Gasto promedio: ${fmtTotal(r.promedioGasto)} por mes`);
  const H=430+360+cats.length*92+(notas.length?70+notas.length*52:0)+90;
  canvas.width=W; canvas.height=H;
  ctx.fillStyle="#f7f6f2"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#1f6e68"; ctx.fillRect(0,0,W,16);
  const txt=(t,x,y,size,color,peso,align)=>{ ctx.font=`${peso||500} ${size}px system-ui,-apple-system,sans-serif`; ctx.fillStyle=color; ctx.textAlign=align||"left"; ctx.fillText(t,x,y); };
  txt(`Enola · Mi ${r.anio}`, pad, 110, 52, "#1a1a18", 700);
  txt("Me quedó disponible", pad, 190, 30, "#6e6d65");
  txt(fmtTotal(r.disponible), pad, 270, 84, r.disponible>=0?"#1f6e68":"#a32d2d", 700);
  const col=(i,etq,val,color)=>{ const x=pad+i*((W-2*pad)/3); txt(etq, x, 350, 26, "#6e6d65"); txt(val, x, 396, 38, color, 700); };
  col(0,"Ingresos",fmtTotal(r.ingresos),"#2d7a3a"); col(1,"Gastos",fmtTotal(r.gastos),"#a32d2d"); col(2,"Ahorrado",fmtTotal(r.ahorrado),"#1f6e68");
  // Barras: lo que quedó cada mes
  txt("Mes a mes", pad, 470, 30, "#6e6d65", 700);
  const base=470+60+240, ancho=(W-2*pad)/12, max=Math.max(...r.meses.map(x=>Math.abs(x.disponible)),1);
  ctx.fillStyle="#cfccc3"; ctx.fillRect(pad, base, W-2*pad, 3);
  r.meses.forEach((x,i)=>{
    if(x.hayDatos){ const h=Math.max(Math.abs(x.disponible)/max*220, 8); ctx.fillStyle=x.disponible>=0?"#1f6e68":"#a32d2d";
      if(x.disponible>=0) ctx.fillRect(pad+i*ancho+8, base-h, ancho-16, h); else ctx.fillRect(pad+i*ancho+8, base+3, ancho-16, Math.min(h,40)); }
    txt(MESES_INICIAL[i], pad+i*ancho+ancho/2, base+66, 26, "#6e6d65", 500, "center");
  });
  let y=base+150;
  cats.forEach(c=>{
    txt(c.cat, pad, y, 32, "#1a1a18", 600); txt(`${fmtTotal(c.monto)}  ·  ${c.pct}%`, W-pad, y, 30, "#6e6d65", 500, "right");
    ctx.fillStyle="#e8e5df"; ctx.fillRect(pad, y+16, W-2*pad, 14);
    ctx.fillStyle="#1f6e68"; ctx.fillRect(pad, y+16, (W-2*pad)*Math.min(c.pct,100)/100, 14);
    y+=92;
  });
  if(notas.length){ y+=20; txt("Para recordar", pad, y, 30, "#6e6d65", 700); y+=52; notas.forEach(n=>{ txt("• "+n, pad, y, 28, "#1a1a18"); y+=52; }); }
  txt("Hecho con Enola", W/2, H-36, 24, "#9a998f", 500, "center");
  return canvas;
}
async function compartirResumenAnual(){
  const anio=dashYear;
  const r=resumenDeAnio(anio);
  if(!r.hayDatos){ showToast("No hay movimientos para compartir"); return; }
  const canvas=dibujarResumenAnual(document.createElement("canvas"), r);
  const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
  if(!blob){ showToast("No se pudo armar la imagen"); return; }
  const nombre=`enola-resumen-${anio}.png`;
  let archivo=null; try{ archivo=new File([blob], nombre, {type:"image/png"}); }catch(e){ archivo=null; }
  if(archivo && typeof navigator.canShare==="function" && navigator.canShare({files:[archivo]})){
    try{ await navigator.share({files:[archivo], title:`Mi ${anio} en Enola`}); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast("Imagen descargada ✓");
}
