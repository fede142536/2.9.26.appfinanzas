// ═══════════════════════════════════════════
// PATRIMONIO TOTAL
// ═══════════════════════════════════════════
// Todo lo que tenés, en un número: lo que hay en tus cuentas, tus fondos de ahorro, tus
// inversiones y tus dólares a mano. La clave es no contar nada dos veces:
//   · Cuentas: el saldo de hoy de las cuentas con saldo real cargado (Dashboard › Saldo por cuenta).
//   · Fondos de ahorro: lo que vale hoy si cargaste su valor actual; si no, lo que aportaste.
//   · Inversiones: las que NO son parte de un fondo (las compras de un fondo ya están en el
//     fondo). A precio de hoy si hay cantidad y precio; si no, el capital que sigue invertido.
//   · Dólares a mano: los que entraron menos los que salieron, sin lo guardado en un fondo ni lo
//     que está invertido (eso ya figura en su parte).
// Los dólares se pasan a pesos con el dólar que elijas (por defecto, el de tu último cambio).

const PAT_DOLAR_KEY="fdolarpat";   // {valor, fecha}: el dólar con el que se suma todo en pesos (preferencia)

// Pura. Dólares billete a mano: entradas − salidas en USD (gastos, depósitos a un fondo) + lo que
// volvió de un fondo − lo que pusiste en inversiones en dólares + lo que cobraste de ellas.
function dolaresAMano(lista){
  let usd=0;
  (lista||[]).forEach(m=>{
    if(!m) return;
    if(m.tipo==="Inversion"){
      const soloUSD=(m.importeUSD||0)>0 && !((m.importe||0)>0);
      if(soloUSD) usd+=isInvSalida(m) ? m.importeUSD : -m.importeUSD;
      return;
    }
    if(m.moneda!=="USD" || !m.importeOrig) return;
    if(m.tipo==="Ingreso") usd+=m.importeOrig;
    else if(esGasto(m)) usd-=m.importeOrig;
    if(esRetiroAhorro(m)) usd+=m.importeOrig;
  });
  return Math.round(usd*100)/100;
}

// Pura. Los tickers que son parte de un fondo de ahorro: compras o ventas emparejadas con un
// depósito o retiro del fondo, o cargadas solo como movimiento del fondo con ticker y cantidad.
function tickersDeFondos(lista){
  const set=new Set();
  try{
    emparejarFondoInversion(lista).pares.forEach(p=>{ if(p.inv.ticker) set.add(tickerClave(p.inv.ticker)); });
    operacionesParaPosiciones(lista).forEach(o=>{ if(o.desdeFondo && o.ticker) set.add(tickerClave(o.ticker)); });
  }catch(e){ /* sin inversiones */ }
  return set;
}

// Pura. `d`: {lista, cuentas:[{cuenta, saldo}], sinSaldo:[cuenta], vals, precios, splits, hoy, dolar}.
function calcularPatrimonio(d){
  const r2=x=>Math.round((x||0)*100)/100;
  const lista=d.lista||[];
  // Cuentas
  const cuentas=(d.cuentas||[]).map(c=>({cuenta:c.cuenta, ars:r2(c.saldo)}));
  // Fondos de ahorro
  const saldos=saldosPorCategoria(lista), vals=d.vals||{};
  const fondos=Object.keys(saldos).map(cat=>{
    const s=saldos[cat], v=vals[cat]||{};
    const usaArs=v.ars!==null && v.ars!==undefined && s.ars>0, usaUsd=v.usd!==null && v.usd!==undefined && s.usd>0;
    return {cat, ars:r2(usaArs ? v.ars : s.ars), usd:r2(usaUsd ? v.usd : s.usd), aValorActual:usaArs||usaUsd, fecha:v.fecha||""};
  }).filter(f=>Math.abs(f.ars)>=0.01 || Math.abs(f.usd)>=0.01);
  // Inversiones fuera de los fondos
  const enFondo=tickersDeFondos(lista);
  const capital=resultadoInv(lista).capitalPorTicker||{};
  const pos=calcularPosiciones(lista, d.precios||{}, d.hoy, d.splits||{});
  const inversiones=Object.keys(capital).filter(t=>!enFondo.has(t)).map(t=>{
    const c=capital[t], p=pos[t];
    if(p && p.valorActual!==null && p.valorActual!==undefined && p.cartera>0 && !p.sinCantidad)
      return {ticker:p.ticker||t, ars:p.usd?0:r2(p.valorActual), usd:p.usd?r2(p.valorActual):0, aPrecioHoy:true};
    return {ticker:(p&&p.ticker)||t, ars:r2(c.ars), usd:r2(c.usd), aPrecioHoy:false};
  }).filter(i=>i.ars>=0.01 || i.usd>=0.01).sort((a,b)=>(b.ars+b.usd*(d.dolar||0))-(a.ars+a.usd*(d.dolar||0)));
  const usdMano=dolaresAMano(lista);
  const suma=(arr,k)=>r2(arr.reduce((s,x)=>s+(x[k]||0),0));
  const partes={
    cuentas:{ars:suma(cuentas,"ars"), usd:0, detalle:cuentas, sinSaldo:d.sinSaldo||[]},
    fondos:{ars:suma(fondos,"ars"), usd:suma(fondos,"usd"), detalle:fondos},
    inversiones:{ars:suma(inversiones,"ars"), usd:suma(inversiones,"usd"), detalle:inversiones},
    dolares:{ars:0, usd:usdMano}
  };
  const totalARS=r2(Object.values(partes).reduce((s,p)=>s+p.ars,0));
  const totalUSD=r2(Object.values(partes).reduce((s,p)=>s+p.usd,0));
  const dolar=d.dolar>0 ? d.dolar : null;
  return {partes, totalARS, totalUSD, dolar, total: dolar ? r2(totalARS+totalUSD*dolar) : totalARS};
}

// ── Datos de la app ──
// El dólar del último cambio que cargaste (pesos por dólar), o null.
function dolarDelUltimoCambio(lista){
  const patas=(lista||[]).filter(m=>m && m.cambioId).sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")) || (b.id||0)-(a.id||0));
  for(const p of patas){
    const op=typeof leerCambio==="function" ? leerCambio(patasDelCambio(p.cambioId, lista)) : null;
    if(op && op.tc>0) return {valor:op.tc, fecha:op.fecha, origen:"cambio"};
  }
  return null;
}
function leerDolarPatrimonio(){
  try{
    const o=JSON.parse(localStorage.getItem(PAT_DOLAR_KEY)||"null");
    if(o && typeof o.valor==="number" && o.valor>0 && o.valor<1e7) return {valor:o.valor, fecha:o.fecha||"", origen:"manual"};
  }catch(e){ /* preferencia rota: se usa la del último cambio */ }
  return dolarDelUltimoCambio(movs);
}
function cuentasParaPatrimonio(){
  const cuentas=[], sinSaldo=[];
  const conMovs=new Set(movs.filter(m=>m && m.cuenta && m.moneda!=="USD" && (m.tipo==="Gasto"||m.tipo==="Ingreso")).map(m=>m.cuenta));
  new Set([...Object.keys(saldosCuentas||{}), ...conMovs]).forEach(c=>{
    const s=saldoActualDeCuenta(c);
    if(s) cuentas.push({cuenta:c, saldo:s.saldo}); else if(c!=="Cuentas") sinSaldo.push(c);
  });
  return {cuentas, sinSaldo};
}
function patrimonioActual(){
  const {cuentas, sinSaldo}=cuentasParaPatrimonio();
  const dolar=leerDolarPatrimonio();
  return {...calcularPatrimonio({lista:movs, cuentas, sinSaldo, vals:valoresFondos, precios:preciosActuales, splits:splitsInv, hoy:hoyLocal(), dolar:dolar?dolar.valor:null}), dolarInfo:dolar};
}

// ── Tarjeta del Dashboard ──
function renderPatrimonioCard(){
  const el=document.getElementById("dash-patrimonio");
  if(!el) return;
  let p;
  try{ p=patrimonioActual(); }catch(e){ el.innerHTML=""; return; }
  const hay=p.totalARS!==0 || p.totalUSD!==0;
  if(!hay){ el.innerHTML=""; return; }
  const usdSuelto=!p.dolar && p.totalUSD!==0 ? ` + USD ${fmtNum2(p.totalUSD)}` : "";
  el.innerHTML=`<div class="pat-card" role="button" tabindex="0" onclick="abrirPatrimonio()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirPatrimonio();}">
    <div class="pat-card-lbl">💎 Tu patrimonio hoy</div>
    <div class="pat-card-val">${fmtTotal(p.total)}<span class="pat-card-usd">${escapeHtml(usdSuelto)}</span></div>
    <div class="pat-card-sub">Cuentas, ahorros, inversiones y dólares · tocá para ver el detalle</div>
  </div>`;
}

// ── Hoja de detalle ──
function abrirPatrimonio(){
  pintarPatrimonio();
  document.getElementById("modal-patrimonio").classList.add("open");
}
function cerrarPatrimonio(){ document.getElementById("modal-patrimonio").classList.remove("open"); }
function pintarPatrimonio(){
  const cont=document.getElementById("patrimonio-contenido");
  if(!cont) return;
  const p=patrimonioActual(), P=p.partes;
  const enPesos=(ars,usd)=>p.dolar ? ars+usd*p.dolar : ars;
  const monto=(ars,usd)=>[ars||!usd ? fmtS(ars) : "", usd ? `USD ${fmtNum2(usd)}` : ""].filter(Boolean).join(" + ");
  const seccion=(ico, titulo, parte, filas, nota)=>{
    const tot=enPesos(parte.ars, parte.usd);
    return `<details class="pat-sec"${filas?"":" open"}>
      <summary><span>${ico} ${titulo}</span><strong>${p.dolar ? fmtS(tot)+(parte.usd?` <span class="pat-tag">USD ${fmtNum2(parte.usd)}</span>`:"") : monto(parte.ars, parte.usd)}</strong></summary>
      ${filas||""}${nota?`<div class="pat-nota">${nota}</div>`:""}
    </details>`;
  };
  const fila=(txt, ars, usd, extra)=>`<div class="pat-fila"><span>${txt}${extra?` <span class="pat-tag">${extra}</span>`:""}</span><span>${monto(ars,usd)}</span></div>`;
  const cuentasF=P.cuentas.detalle.map(c=>fila(escapeHtml(c.cuenta), c.ars, 0)).join("");
  const sinSaldo=P.cuentas.sinSaldo.length ? `${P.cuentas.sinSaldo.length===1?"La cuenta":"Las cuentas"} ${P.cuentas.sinSaldo.map(c=>`<strong>${escapeHtml(c)}</strong>`).join(", ")} no ${P.cuentas.sinSaldo.length===1?"tiene":"tienen"} saldo cargado: no suman. <a href="#" onclick="event.preventDefault();cerrarPatrimonio();irASaldoPorCuenta()">Cargar saldos</a>` : "";
  const fondosF=P.fondos.detalle.map(f=>fila(escapeHtml(f.cat), f.ars, f.usd, f.aValorActual?"valor actual":"lo aportado")).join("");
  const invF=P.inversiones.detalle.map(i=>fila(escapeHtml(i.ticker), i.ars, i.usd, i.aPrecioHoy?"precio de hoy":"lo invertido")).join("");
  const dol=p.dolarInfo;
  cont.innerHTML=`<div class="pat-total">
      <div class="pat-total-lbl">Patrimonio${p.dolar?" en pesos":""}</div>
      <div class="pat-total-val">${fmtTotal(p.total)}</div>
      ${p.dolar ? `<div class="pat-nota">${fmtS(p.totalARS)} en pesos + USD ${fmtNum2(p.totalUSD)} a ${fmtS(p.dolar)}</div>` : (p.totalUSD ? `<div class="pat-nota">Más USD ${fmtNum2(p.totalUSD)}. Poné el valor del dólar para sumarlos.</div>` : "")}
    </div>
    <div class="pat-dolar">
      <label for="pat-dolar-input">Dólar a</label>
      <div class="amount-wrap"><span class="amount-prefix">$</span><input type="text" id="pat-dolar-input" class="form-input amount-input" inputmode="decimal" placeholder="Ej: 1.450" value="${dol?String(dol.valor).replace(".",","):""}"></div>
      <button type="button" class="btn-sm" onclick="guardarDolarPatrimonio()">Usar</button>
    </div>
    <div class="pat-nota" style="margin:-4px 2px 10px">${dol ? (dol.origen==="cambio" ? `Es el de tu último cambio (${escapeHtml(fmtDiaMes(dol.fecha))}). Podés poner el de hoy.` : `Lo pusiste vos${dol.fecha?` el ${escapeHtml(fmtDiaMes(dol.fecha))}`:""}.`) : "Sin cambios de moneda cargados no sé a cuánto está: escribilo."}</div>
    ${seccion("🏦","Cuentas", P.cuentas, cuentasF, sinSaldo || (P.cuentas.detalle.length ? "Saldo de hoy de cada cuenta, a partir del saldo real que cargaste." : ""))}
    ${seccion("🐷","Fondos de ahorro", P.fondos, fondosF, P.fondos.detalle.some(f=>!f.aValorActual) ? "Los que dicen «lo aportado» no tienen valor actual cargado: cargalo en Ahorros para verlos a precio de hoy." : "")}
    ${seccion("📈","Inversiones", P.inversiones, invF, "Las que no son parte de un fondo de ahorro (esas ya están en el fondo).")}
    ${seccion("💵","Dólares a mano", P.dolares, "", "Los que entraron menos los que salieron, sin lo guardado en un fondo ni lo invertido.")}`;
}
function guardarDolarPatrimonio(){
  const el=document.getElementById("pat-dolar-input");
  const v=parseFloat(limpiarImporte(el ? el.value : ""));
  if(!(v>0) || v>=1e7){ showToast("Escribí cuántos pesos vale un dólar"); return; }
  guardarPreferencia(PAT_DOLAR_KEY, JSON.stringify({valor:Math.round(v*100)/100, fecha:hoyLocal()}));
  pintarPatrimonio(); renderPatrimonioCard();
  showToast("Dólar actualizado ✓");
}
