// ═══════════════════════════════════════════
// VENTA DE UNA INVERSIÓN QUE SALE DE UN FONDO DE AHORRO
// ═══════════════════════════════════════════
// Vender SPY y dejar los pesos en el broker no es un ingreso: es plata tuya que cambia de lugar. La venta se carga como inversión
// (así suma a lo que tenés a mano), pero el saldo del fondo de ahorro de donde salió solo baja con un RETIRO del fondo. Antes había
// que cargar dos movimientos a mano. Ahora, al cargar una venta, la casilla "Sale de mis ahorros" crea el retiro ligado
// (`origenInvId`): es un traspaso, así que baja el fondo sin contar como gasto. Si editás o borrás la venta, el retiro la acompaña.

const SALE_VENTA_RE=/venta|rescate|tomada/;
const esOperacionDeVenta=sub=>SALE_VENTA_RE.test(normalizarTexto(sub||""));

// Pura. Los fondos de ahorro (categoría › subcategoría) con saldo positivo en esa moneda, el más grande primero: [{cat, sub, saldo}].
function fondosConSaldo(lista, moneda){
  const mon=moneda==="USD" ? "USD" : "ARS", por={};
  (lista||[]).forEach(m=>{
    if(!esDepositoAhorro(m) && !esRetiroAhorro(m)) return;
    if((m.moneda==="USD" ? "USD" : "ARS")!==mon) return;
    const v=mon==="USD" ? (m.importeOrig||0) : (m.importe||0);
    const cat=m.cat||"Sin categoría", sub=m.subcat||"";
    const k=cat+"\u0001"+sub;
    const o=por[k]||(por[k]={cat, sub, saldo:0});
    o.saldo+=esDepositoAhorro(m) ? v : -v;
  });
  return Object.values(por).map(o=>({...o, saldo:Math.round(o.saldo*100)/100})).filter(o=>o.saldo>0).sort((a,b)=>b.saldo-a.saldo);
}

// Pura. El fondo donde más veces aparece el ticker en las notas de sus depósitos y retiros; si no aparece en ninguno, el de mayor saldo.
function fondoSugerido(lista, fondos, ticker){
  if(!fondos || !fondos.length) return null;
  const t=normalizarTexto(ticker||"");
  if(t.length>=2){
    const cuenta={};
    (lista||[]).forEach(m=>{
      if(!esDepositoAhorro(m) && !esRetiroAhorro(m)) return;
      if(!normalizarTexto(m.nota||"").split(/\s+/).includes(t)) return;
      const k=(m.cat||"Sin categoría")+"\u0001"+(m.subcat||"");
      cuenta[k]=(cuenta[k]||0)+1;
    });
    const mejor=fondos.map(f=>({f, n:cuenta[f.cat+"\u0001"+f.sub]||0})).sort((a,b)=>b.n-a.n)[0];
    if(mejor && mejor.n>0) return mejor.f;
  }
  return fondos[0];
}

// Pura. El retiro del fondo que acompaña a una venta: mismo monto y fecha, es un traspaso (no un gasto) y queda ligado a la venta.
function crearRetiroPorVenta(inv, fondo, id){
  const usd=!!(inv.importeUSD && !inv.importe);
  const monto=usd ? inv.importeUSD : inv.importe;
  return {id, tipo:"Gasto", importe: usd ? 0 : monto, importeOrig: usd ? monto : null, moneda: usd ? "USD" : "ARS",
    cat:fondo.cat, subcat:fondo.sub, cuenta:inv.cuenta||"", fecha:inv.fecha, nota: inv.nota || `Venta ${inv.ticker||""}`.trim(), tags:[],
    esAhorro:false, usaAhorro:true, traspaso:true, recuperable:0, origenInvId:inv.id};
}

// Si editás la venta (monto, moneda, fecha, cuenta), el retiro ligado se pone igual. Devuelve cuántos tocó.
function sincronizarRetiroLigado(inv, lista){
  let n=0;
  (lista||[]).forEach(x=>{
    if(x.origenInvId!==inv.id) return;
    const usd=!!(inv.importeUSD && !inv.importe), monto=usd ? inv.importeUSD : inv.importe;
    x.moneda=usd ? "USD" : "ARS"; x.importe=usd ? 0 : monto; x.importeOrig=usd ? monto : null;
    x.fecha=inv.fecha; x.cuenta=inv.cuenta||"";
    n++;
  });
  return n;
}

// ── Formulario de Cargar › Inversión ──
const fondoKey=f=>f.cat+"\u0001"+f.sub;
function actualizarSaleDeAhorro(){
  const grupo=document.getElementById("inv-sale-ahorro-group");
  if(!grupo) return;
  const chk=document.getElementById("inv-sale-ahorro"), sel=document.getElementById("inv-fondo"), sub=document.getElementById("inv-subcat"), fg=document.getElementById("inv-fondo-group");
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  const fondos=esOperacionDeVenta(sub && sub.value) ? fondosConSaldo(movs, moneda) : [];
  grupo.style.display=fondos.length ? "" : "none";
  if(!fondos.length){ if(chk) chk.checked=false; if(fg) fg.style.display="none"; return; }
  if(fg) fg.style.display=chk && chk.checked ? "" : "none";
  if(!sel) return;
  const previo=sel.value;
  sel.innerHTML=fondos.map(f=>`<option value="${escapeHtml(fondoKey(f))}">${escapeHtml(f.cat+(f.sub?" › "+f.sub:""))} · saldo ${moneda==="USD"?fmtMoneda(f.saldo,"USD"):fmtS(f.saldo)}</option>`).join("");
  const ticker=(document.getElementById("inv-ticker")||{}).value||"";
  const elegido=fondos.find(f=>fondoKey(f)===previo) || fondoSugerido(movs, fondos, ticker);
  if(elegido) sel.value=fondoKey(elegido);
}
// El fondo elegido en el formulario, o null si la casilla no está tildada.
function fondoElegidoEnFormulario(){
  const chk=document.getElementById("inv-sale-ahorro"), sel=document.getElementById("inv-fondo");
  if(!chk || !chk.checked || !sel || !sel.value) return null;
  const moneda=(document.getElementById("inv-moneda")||{}).value==="USD" ? "USD" : "ARS";
  return fondosConSaldo(movs, moneda).find(f=>fondoKey(f)===sel.value) || null;
}
