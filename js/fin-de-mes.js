// ═══════════════════════════════════════════
// ¿LLEGO A FIN DE MES? (proyección del mes en curso)
// ═══════════════════════════════════════════
// Parte del balance de hoy (el mismo "Balance del mes" de Movimientos: ya tiene adentro los gastos
// fijos del mes, pagados o no) y le suma o resta lo que falta:
//   + los ingresos frecuentes que todavía no cobraste
//   − lo que resta pagar de los resúmenes de tarjeta del mes (si los pagás con "Pagar resumen")
//   − lo que SUELÉS gastar del día de hoy a fin de mes, sacado de tus meses anteriores
// Solo pesos. No adivina ahorros que vayas a hacer ni compras grandes que no tengan patrón.

const FDM_MESES_BASE=6;      // cuántos meses anteriores mirar
const FDM_MIN_MESES=2;       // con menos que esto se usa el ritmo del mes

// Un gasto "del día a día": consume plata del mes y no es un fijo, un pago de tarjeta, un ajuste
// ni algo pagado con plata del fondo (eso no baja lo disponible: entra y sale del fondo).
function esGastoVariable(m){
  return !!m && m.moneda!=="USD" && esConsumo(m) && !esRetiroAhorro(m)
    && !m._isFrecVirtual && !m.frecuente && !(typeof esPagoTarjeta==="function" && esPagoTarjeta(m)) && !m.ajusteSaldo;
}
const diaDe=f=>Number(String(f||"").slice(8,10))||0;

// Pura. `deps`: {mesFn(ym) → movimientos del mes con los frecuentes expandidos, disponibleHoy,
// porCobrar (ARS), tarjetaPorPagar (ARS)}. Devuelve el detalle de la cuenta y `final`.
function proyeccionFinDeMes(hoyISO, deps){
  const ym=String(hoyISO).slice(0,7), dia=diaDe(hoyISO), dias=diasDelMes(ym), restan=Math.max(dias-dia,0);
  const r2=x=>Math.round(x*100)/100;
  // Lo que gastaste del día de hoy en adelante en cada uno de tus meses anteriores (solo los que tienen datos).
  const historial=[];
  for(let i=1;i<=FDM_MESES_BASE;i++){
    const ymP=addMonths(ym,-i);
    const lista=(deps.mesFn(ymP)||[]).filter(esGastoVariable);
    if(!lista.length) continue;
    historial.push(lista.filter(m=>diaDe(m.fecha)>dia).reduce((s,m)=>s+(m.importe||0),0));
  }
  const variableHoy=(deps.mesFn(ym)||[]).filter(m=>esGastoVariable(m) && diaDe(m.fecha)<=dia).reduce((s,m)=>s+(m.importe||0),0);
  let variable=0, metodo="historial";
  if(restan===0){ metodo="ultimo-dia"; }
  else if(historial.length>=FDM_MIN_MESES){ variable=mediana(historial); }
  else if(dia>=3 && variableHoy>0){ metodo="ritmo"; variable=variableHoy/dia*restan; }
  else { metodo="sin-datos"; }
  const disponibleHoy=r2(deps.disponibleHoy||0), porCobrar=r2(deps.porCobrar||0), tarjeta=r2(deps.tarjetaPorPagar||0);
  variable=r2(variable);
  return {ym, dia, dias, restan, disponibleHoy, porCobrar, tarjeta, variable, metodo, mesesBase:historial.length,
          final:r2(disponibleHoy+porCobrar-tarjeta-variable)};
}

// Lo que resta pagar de los resúmenes en pesos del mes. Solo si pagás los resúmenes con "Pagar"
// (gastos ligados al resumen): si los cargás como un gasto común, ya están en tu historial y
// contarlos acá los restaría dos veces.
function tarjetaPorPagarARS(ym, lista){
  const usaPagos=(lista||[]).some(m=>esPagoTarjeta(m) && String(m.fecha||"")>=addMonths(ym,-6));
  if(!usaPagos) return 0;
  const venc=typeof leerVencTc==="function" ? leerVencTc() : {};
  return resumenesDelMes(ym, lista).filter(r=>r.moneda==="ARS").reduce((s,r)=>{
    const d=datosResumenTc(venc, r.tarjeta, ym);
    return s+(resumenMarcadoPagado(d, "ARS", lista) ? 0 : r.resta);
  },0);
}

function finDeMesActual(){
  const hoy=hoyLocal(), ym=hoy.slice(0,7);
  const mes=getMesMov(ym);
  const gan=typeof gananciaInvDelMes==="function" ? gananciaInvDelMes(ym) : undefined;
  return proyeccionFinDeMes(hoy, {
    mesFn:getMesMov,
    disponibleHoy:resumenDePeriodo(mes, gan).disponible,
    porCobrar:ingresosFrecPorCobrar(ym, hoy).filter(v=>v.moneda==="ARS").reduce((s,v)=>s+v.monto,0),
    tarjetaPorPagar:tarjetaPorPagarARS(ym, movs)
  });
}

// El mosaico de Movimientos (solo en el mes en curso).
function finDeMesMosaicoHTML(){
  if(!(typeof funcionActiva!=="function" || funcionActiva("findemes"))) return "";
  let p;
  try{ p=finDeMesActual(); }catch(e){ return ""; }
  if(p.metodo==="sin-datos" && !p.porCobrar && !p.tarjeta) return "";
  const color=p.final>=0 ? "var(--success)" : "var(--danger)";
  const val=`<span style="color:${color}">≈ ${p.final<0?"−":""}${fmtTotal(Math.abs(p.final))}</span>`;
  const sub=p.final>=0 ? "Te quedaría a fin de mes, si gastás como siempre" : "Te faltaría a fin de mes, si gastás como siempre";
  return mosaicoHTML("🔮","Fin de mes",color==="var(--success)"?"var(--accent)":"var(--danger)",val,sub,'data-ancho="2"',"abrir:findemes");
}

// ── Hoja con el detalle ──
function abrirFinDeMes(){
  const cont=document.getElementById("findemes-contenido");
  if(!cont) return;
  const p=finDeMesActual();
  const f=n=>fmtS(Math.abs(n));
  const fila=(txt, monto, signo, nota)=>`<div class="fdm-fila"><div><div>${txt}</div>${nota?`<div class="fdm-nota">${nota}</div>`:""}</div><div class="fdm-monto">${signo}${f(monto)}</div></div>`;
  const metodoTxt={historial:`Es la mediana de lo que gastaste del día ${p.dia+1} a fin de mes en tus últimos ${p.mesesBase} meses (sin gastos fijos ni pagos de tarjeta).`,
    ritmo:`Todavía no hay meses anteriores para comparar: se estima con tu ritmo de este mes.`,
    "ultimo-dia":"Hoy es el último día del mes.", "sin-datos":"Sin meses anteriores ni gastos este mes no hay con qué estimar el gasto del día a día."}[p.metodo];
  const ok=p.final>=0;
  cont.innerHTML=`<div class="fdm-total" style="background:${ok?"var(--success-light)":"var(--danger-light)"}">
      <div class="fdm-total-lbl">${ok?"Te quedaría a fin de mes":"Te faltaría a fin de mes"}</div>
      <div class="fdm-total-val" style="color:${ok?"var(--success)":"var(--danger)"}">≈ ${fmtTotal(Math.abs(p.final))}</div>
      <div class="fdm-nota">Quedan ${p.restan} ${p.restan===1?"día":"días"} de ${mesLbl(p.ym).split(" ")[0].toLowerCase()}.</div>
    </div>
    ${fila("Balance de hoy", p.disponibleHoy, p.disponibleHoy<0?"−":"", "El de Movimientos: ya descuenta tus gastos fijos del mes, pagados o no.")}
    ${p.porCobrar?fila("Ingresos fijos por cobrar", p.porCobrar, "+ "):""}
    ${p.tarjeta?fila("Resúmenes de tarjeta por pagar", p.tarjeta, "− "):""}
    ${p.metodo!=="sin-datos" && p.metodo!=="ultimo-dia" ? fila("Gasto del día a día que suele venir", p.variable, "− ", escapeHtml(metodoTxt)) : `<p class="fdm-nota" style="margin:10px 0">${escapeHtml(metodoTxt)}</p>`}
    <p class="fdm-nota" style="margin-top:12px">Es una estimación en pesos: no cuenta lo que vayas a pasar a ahorros ni compras fuera de lo común. Se recalcula con cada movimiento que cargás.</p>`;
  document.getElementById("modal-findemes").classList.add("open");
}
function cerrarFinDeMes(){ document.getElementById("modal-findemes").classList.remove("open"); }
