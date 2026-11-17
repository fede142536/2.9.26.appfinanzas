// ═══════════════════════════════════════════
// RESULTADO DE INVERSIONES
// ═══════════════════════════════════════════
// Comprar una inversión NO es un gasto y venderla NO es un ingreso: es la misma plata tuya
// cambiando de lugar. Lo único que entra o sale de tu patrimonio es el RESULTADO — lo que
// ganaste o perdiste.
//
// Contarlas enteras infla los dos totales cada vez que rotás. Con los datos reales de la app
// eso significaba $7.566.837 sumados como "ingreso por inversiones" cuando lo ganado fueron
// $176.670: de cada $100 que figuraban como ingreso, $2,30 eran reales. Y lo peor no eran los
// totales sino el orden de los meses: junio figuraba como el mejor mes del año por un rescate
// de $1,8M, cuando julio había sido seis veces mejor.
//
// LA REGLA: primero recuperás capital, después ganás.
// De una venta de $252.000 en un ticker donde pusiste $250.000 y no habías sacado nada:
// $250.000 son capital que vuelve (neutro) y $2.000 son ganancia.
// Se lleva por ticker y por moneda, y no necesita precio ni cantidad — alcanza con el ticker,
// que ya se guarda en cada operación.

// Orden en que OCURRIERON las operaciones. La fecha sola no alcanza: comprar y vender el mismo
// día es habitual (un trade corto, una caución colocada y tomada), y si el orden se invierte la
// venta parece no tener capital detrás y la ganancia sale disparatada. El id es el timestamp de
// carga, así que desempata dentro del mismo día.
function ordenDeOperacion(a, b){
  const fa=String(a.fecha||""), fb=String(b.fecha||"");
  if(fa!==fb) return fa<fb ? -1 : 1;
  return (a.id||0)-(b.id||0);
}

// Lo que una inversión te PAGA sin devolverte capital: un cupón o un dividendo. Es ganancia pura desde el primer peso. "Rendimiento" NO entra acá a
// propósito: en un fondo se suele cargar así un rescate (capital + lo que rindió) y contarlo entero como ganancia infló el balance (un rendimiento
// de $200.000 en BCAHA sumó $200.000 a octubre). Un rendimiento, igual que un rescate, devuelve capital primero; la ganancia de un fondo sale de
// la regla de rescate y resuscripción del mismo mes (más abajo).
// "SPY", "Spy" y "spy" son el mismo ticker: la clave con la que se agrupa todo es siempre en mayúsculas. Antes cada variante era un ticker aparte: una venta cargada como
// "Spy" no encontraba el capital de "SPY" y se contaba entera como ganancia.
const tickerClave=t=>String(t||"Sin ticker").trim().toUpperCase() || "SIN TICKER";
// Cómo se GUARDA un ticker que se escribe a mano: igual que los que ya existen con esa clave (la forma más usada), y si es nuevo, en mayúsculas — que es como lo
// muestra el campo. Antes se guardaba tal como se tipeó ("spy") aunque la pantalla dijera "SPY", y así aparecían variantes del mismo ticker.
function tickerParaGuardar(t, lista){
  const raw=String(t||"").trim(); if(!raw) return "";
  const k=tickerClave(raw), formas={};
  (lista||[]).forEach(m=>{ if(m && m.tipo==="Inversion" && m.ticker && tickerClave(m.ticker)===k){ const f=String(m.ticker).trim(); formas[f]=(formas[f]||0)+1; } });
  const mejor=Object.entries(formas).sort((a,b)=>(b[1]-a[1]) || ((b[0]===b[0].toUpperCase())-(a[0]===a[0].toUpperCase())))[0];
  return mejor ? mejor[0] : raw.toUpperCase();
}
const esPagoDeInversion=m=>/cup[oó]n|dividendo/.test(normalizarTexto(m && m.subcat || ""));

// Importe de una operación en cada moneda. Las inversiones en USD guardan el monto en
// importeUSD y dejan importe en 0 (o al revés), así que cada moneda se sigue por separado:
// mezclarlas daría un capital que no existe.
function montoInv(m, moneda){
  return moneda==="USD" ? (m.importeUSD||0) : (m.moneda==="USD" ? 0 : (m.importe||0));
}

// Recorre TODA la historia de inversiones (no se puede por mes: para saber si una venta es
// ganancia hace falta saber cuánto capital venías poniendo desde antes) y devuelve:
//   gananciaPorMes  {"2026-06": {ars, usd}}   ganancia (+) o pérdida (−) reconocida ese mes
//   capitalPorTicker {"BCMMA": {ars, usd}}    lo que sigue invertido, no consumido
//   flujoPorMes     {"2026-06": {ars, usd}}   capital neto que ENTRÓ a inversiones ese mes
//                                             (negativo = sacaste capital)
//   eventos         lista de ganancias reconocidas, para poder auditarlas
function calcularResultadoInv(lista){
  const inv=(lista||[]).filter(m=>m && m.tipo==="Inversion").slice().sort(ordenDeOperacion);
  // Una venta cargada con "Sale de mis ahorros" lleva un retiro del fondo ligado (retiro-por-venta.js) y ESE retiro es el que suma a lo
  // disponible. Si además se contara como ganancia, la misma plata entraría dos veces: de esa venta solo se descuenta el capital.
  const conRetiro=new Set((lista||[]).filter(x=>x && x.origenInvId).map(x=>x.origenInvId));
  // Cuánto sacó del fondo cada retiro ligado, por moneda. Si el retiro es por TODA la venta (lo de siempre) la ganancia no se cuenta (ya entra por el
  // retiro); si es solo por el capital, lo que sobra de la venta SÍ es ganancia: el retiro la deja afuera a propósito (ver montoRetiroDeVenta).
  const retiradoPorVenta={};
  (lista||[]).forEach(x=>{
    if(!x || !x.origenInvId) return;
    const o=retiradoPorVenta[x.origenInvId] || (retiradoPorVenta[x.origenInvId]={ars:0, usd:0});
    if(x.moneda==="USD") o.usd+=(x.importeOrig||0); else o.ars+=(x.importe||0);
  });
  const devuelto={};   // devuelto[id] = {ars, usd}: el capital que cada venta o rescate devolvió
  const capital={};   // capital[ticker] = {ars, usd}
  const ganancia={};  // ganancia[ym]    = {ars, usd}
  const flujo={};     // flujo[ym]       = {ars, usd}
  const eventos=[];
  const caja=(obj,k)=>(obj[k] || (obj[k]={ars:0, usd:0}));

  // RESCATE CON RESUSCRIPCIÓN EN EL MISMO MES. Un fondo se suele rescatar entero (capital + lo que rindió) y volver a suscribir el capital: en el
  // mes el rescate de capital supera a la suscripción y esa DIFERENCIA es la ganancia (es la cuenta que muestra la tarjeta del ticker). Con la regla
  // "primero vuelve el capital" esa diferencia se descontaba de capital viejo todavía cargado y la ganancia quedaba en 0. Se reconoce como
  // ganancia solo cuando la diferencia es chica frente a lo suscripto (hasta RESUSCRIPCION_MAX): rescatar 500.000 y reinvertir 100.000 NO es una
  // ganancia de 400.000, es sacar capital, y sigue por la regla de siempre. Un rescate con retiro ligado queda afuera (ya suma a lo disponible).
  // Solo para fondos (suscripción / rescate): en acciones o bonos no hay "volver a suscribir", y una compra y una venta del mismo mes no son el mismo capital.
  const RESUSCRIPCION_MAX=0.10;
  const esOpDeFondo=m=>/suscripci|rescate/.test(normalizarTexto(m && m.subcat || ""));
  const grupos={};
  inv.forEach(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length!==7 || esPagoDeInversion(m) || !esOpDeFondo(m)) return;
    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      const g=grupos[tickerClave(m.ticker)+"|"+ym+"|"+k] || (grupos[tickerClave(m.ticker)+"|"+ym+"|"+k]={sus:0, res:0, ret:false, ids:[]});
      if(isInvSalida(m)){ g.res+=monto; if(conRetiro.has(m.id)) g.ret=true; } else g.sus+=monto;
      g.ids.push(m.id);
    });
  });
  const reinvertido=(ticker,ym,k)=>{
    const g=grupos[ticker+"|"+ym+"|"+k];
    return g && !g.ret && g.sus>0 && g.res>g.sus && (g.res-g.sus)<=g.sus*RESUSCRIPCION_MAX ? g : null;
  };
  const yaContado=new Set();
  const reinvertidas=new Set();   // ids de las operaciones que entraron por la regla de rescate + resuscripción (no devuelven capital)

  inv.forEach(m=>{
    const ticker=tickerClave(m.ticker);
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length!==7) return;   // sin fecha usable no se puede ubicar en el tiempo
    const cap=caja(capital, ticker), gan=caja(ganancia, ym), flu=caja(flujo, ym);
    const salida=isInvSalida(m);

    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      const rollover=(esPagoDeInversion(m) || !esOpDeFondo(m)) ? null : reinvertido(ticker, ym, k);
      if(rollover){
        reinvertidas.add(m.id);
        // La suscripción y el rescate de este mes se cancelan entre sí (la plata solo dio la vuelta); queda la diferencia como ganancia.
        const clave=ticker+"|"+ym+"|"+k;
        if(!yaContado.has(clave)){
          yaContado.add(clave);
          const dif=rollover.res-rollover.sus;
          gan[k]+=dif;
          eventos.push({fecha:m.fecha, ticker, moneda:k==="usd"?"USD":"ARS", ganancia:dif});
        }
        return;
      }
      if(salida && esPagoDeInversion(m)){
        // Un cupón / dividendo no toca el capital: es ganancia entera (y no cambia cuánto sigue invertido).
        if(conRetiro.has(m.id)) return;
        gan[k]+=monto;
        eventos.push({fecha:m.fecha, ticker, moneda:k==="usd"?"USD":"ARS", ganancia:monto});
      } else if(salida){
        // Primero vuelve tu capital; lo que sobra es ganancia. Si nunca se cargó la compra,
        // el capital es 0 y TODA la venta cuenta como ganancia — se ve raro a propósito, para
        // que se note que falta una operación en vez de esconderlo en un total.
        const devuelve=Math.min(monto, cap[k]);
        cap[k]-=devuelve;
        flu[k]-=devuelve;
        (devuelto[m.id] || (devuelto[m.id]={ars:0, usd:0}))[k]+=devuelve;
        let ganado=monto-devuelve;
        if(conRetiro.has(m.id)){
          // Con retiro por todo el monto no hay ganancia que contar; con retiro solo por el capital, queda la ganancia entera.
          const retirado=(retiradoPorVenta[m.id]||{})[k]||0;
          ganado=Math.max(0, Math.min(monto-retirado, monto-devuelve));
        }
        gan[k]+=ganado;
        if(ganado>0) eventos.push({fecha:m.fecha, ticker, moneda:k==="usd"?"USD":"ARS", ganancia:ganado});
      } else {
        cap[k]+=monto;
        flu[k]+=monto;
      }
    });
  });

  const redondear=o=>{ Object.keys(o).forEach(k=>{
    o[k].ars=Math.round(o[k].ars*100)/100;
    o[k].usd=Math.round(o[k].usd*100)/100;
  }); return o; };

  return {
    gananciaPorMes: redondear(ganancia),
    capitalPorTicker: redondear(capital),
    flujoPorMes: redondear(flujo),
    capitalDevueltoPorOp: devuelto,
    reinvertidas,
    eventos
  };
}

// El cálculo recorre toda la historia, y el dashboard lo pide doce veces seguidas (una por mes).
// Se guarda el último resultado y se rehace solo cuando la lista cambió: comparar largo + último
// id alcanza porque los movimientos se agregan, se editan o se borran pasando siempre por save().
let _resultadoInvCache=null;
let _resultadoInvFirma="";
function firmaDeLista(lista){
  const inv=(lista||[]).filter(m=>m && m.tipo==="Inversion");
  let suma=0;
  inv.forEach(m=>{ suma += (m.id||0) + (m.importe||0) + (m.importeUSD||0); });
  const ligadas=(lista||[]).filter(m=>m && m.origenInvId);   // un retiro ligado cambia el resultado de su venta (y su monto, si es solo por el capital)
  let sumaRet=0; ligadas.forEach(m=>{ sumaRet += (m.importe||0) + (m.importeOrig||0); });
  return inv.length+"|"+suma+"|"+ligadas.length+"|"+sumaRet;
}
function resultadoInv(lista){
  const fuente = lista || (typeof movs!=="undefined" ? movs : []);
  const firma=firmaDeLista(fuente);
  if(_resultadoInvCache && firma===_resultadoInvFirma) return _resultadoInvCache;
  _resultadoInvCache=calcularResultadoInv(fuente);
  _resultadoInvFirma=firma;
  return _resultadoInvCache;
}
// La llama save() para que un alta, una edición o un borrado no sigan leyendo el cálculo viejo.
function invalidarResultadoInv(){
  _resultadoInvCache=null;
  _resultadoInvFirma="";
}

// Ganancia (+) o pérdida (−) reconocida en un mes. Es lo que suma a ingresos o a gastos.
function gananciaInvDelMes(ym, lista){
  return resultadoInv(lista).gananciaPorMes[ym] || {ars:0, usd:0};
}

// Lo mismo para un rango de meses (el filtro por fechas de Movimientos y el año del dashboard).
function gananciaInvEntre(desdeYM, hastaYM, lista){
  const tabla=resultadoInv(lista).gananciaPorMes;
  const out={ars:0, usd:0};
  Object.keys(tabla).forEach(ym=>{
    if(ym>=desdeYM && ym<=hastaYM){ out.ars+=tabla[ym].ars; out.usd+=tabla[ym].usd; }
  });
  out.ars=Math.round(out.ars*100)/100;
  out.usd=Math.round(out.usd*100)/100;
  return out;
}

// Capital neto que entró a inversiones en un mes. No toca el balance — es informativo, para el
// chip "Guardado": plata que pusiste a trabajar y sigue siendo tuya.
function flujoInvDelMes(ym, lista){
  return resultadoInv(lista).flujoPorMes[ym] || {ars:0, usd:0};
}

// Total que seguís teniendo invertido, sumando todos los tickers.
function capitalInvertido(lista){
  const tabla=resultadoInv(lista).capitalPorTicker;
  const out={ars:0, usd:0};
  Object.keys(tabla).forEach(t=>{ out.ars+=tabla[t].ars; out.usd+=tabla[t].usd; });
  out.ars=Math.round(out.ars*100)/100;
  out.usd=Math.round(out.usd*100)/100;
  return out;
}

// ═══════════════════════════════════════════
// NETO POR TICKER (para los chips de Movimientos)
// ═══════════════════════════════════════════
// Agrupa las operaciones de un período por ticker y devuelve, para cada uno, cuánta plata entró
// menos cuánta salió:  neto = rescates/ventas − suscripciones/compras.
//
// OJO con qué significa este número: es el FLUJO del mes, no la ganancia. Un mes en que solo
// comprás da negativo aunque no hayas perdido nada — significa "hay plata puesta ahí, todavía sin
// rescatar". La ganancia de verdad la calcula gananciaInvDelMes(), que lleva el capital por
// ticker a lo largo de toda la historia. Los dos números son útiles y responden cosas distintas.
//
// Devuelve la lista ordenada por monto, de mayor a menor, para que los tickers con más plata en
// juego queden primero entre los chips.
function netoPorTickerDelPeriodo(lista){
  const porTicker={};
  (lista||[]).filter(m=>m && m.tipo==="Inversion").forEach(m=>{
    const t=tickerClave(m.ticker);
    if(!porTicker[t]) porTicker[t]={ticker:m.ticker || "Sin ticker", cat:m.cat||"", ars:0, usd:0, movs:0};
    // Rescate o venta: entra plata (+). Suscripción o compra: sale (−).
    const signo=isInvSalida(m) ? 1 : -1;
    porTicker[t].ars += (m.moneda==="USD" ? 0 : (m.importe||0)) * signo;
    porTicker[t].usd += (m.importeUSD||0) * signo;
    porTicker[t].movs++;
  });
  return Object.values(porTicker).map(p=>({
    ...p,
    ars: Math.round(p.ars*100)/100,
    usd: Math.round(p.usd*100)/100
  })).sort((a,b)=>Math.abs(b.ars)-Math.abs(a.ars) || Math.abs(b.usd)-Math.abs(a.usd));
}

// La suma de todos los netos: el efecto total de las inversiones sobre el bolsillo en el período.
function netoInvTotal(lista){
  return netoPorTickerDelPeriodo(lista).reduce((acc,p)=>({
    ars: Math.round((acc.ars+p.ars)*100)/100,
    usd: Math.round((acc.usd+p.usd)*100)/100
  }), {ars:0, usd:0});
}


// ═══════════════════════════════════════════
// POSICIONES: cuántos nominales comprás y vendés de cada ticker
// ═══════════════════════════════════════════
// Como en el broker (Mis inversiones): por ticker, la cantidad en cartera, el precio promedio de compra, el valor inicial, y —si cargaste el precio de hoy— el
// valor actual, el rendimiento, los días de tenencia y la TNA. Usa la cantidad (`cantidad`) de cada compra o venta, y el método del PRECIO PROMEDIO: cada compra
// promedia el costo; una venta saca nominales al precio promedio de ese momento. Las operaciones sin cantidad no entran (se cuentan en `sinCantidad`).
// Es una vista de control: no cambia el balance ni "Resultado inv." (que sigue la regla de capital, ver arriba).
const numeroPositivo=n=>(typeof n==="number" && isFinite(n) && n>0 && n<1e13) ? n : null;
function normalizarPreciosActuales(o){
  const out={};
  if(!o || typeof o!=="object" || Array.isArray(o)) return out;
  Object.keys(o).forEach(t0=>{
    const v=o[t0], t=tickerClave(t0); if(t0==="__proto__" || !v || typeof v!=="object") return;
    const precio=numeroPositivo(v.precio); if(precio===null) return;
    out[t]={precio:Math.round(precio*10000)/10000, fecha:/^\d{4}-\d{2}-\d{2}$/.test(v.fecha||"") ? v.fecha : ""};
  });
  return out;
}
// Desdoblamientos: {TICKER:[{fecha, factor}]}. Una operación ANTERIOR a la fecha de un split cuenta sus nominales multiplicados por el factor.
function normalizarSplits(o){
  const out={};
  if(!o || typeof o!=="object" || Array.isArray(o)) return out;
  Object.keys(o).forEach(t0=>{
    const t=tickerClave(t0);
    if(t0==="__proto__" || !Array.isArray(o[t0])) return;
    const lista=o[t0].filter(x=>x && typeof x==="object" && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha||"") && typeof x.factor==="number" && isFinite(x.factor) && x.factor>0 && x.factor!==1 && x.factor<=1000)
      .map(x=>({fecha:x.fecha, factor:Math.round(x.factor*1e6)/1e6})).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    if(lista.length) out[t]=[...(out[t]||[]),...lista].sort((a,b)=>a.fecha.localeCompare(b.fecha));
  });
  return out;
}
const factorDeSplit=(splits,ticker,fecha)=>((splits||{})[ticker]||[]).reduce((f,s)=>String(fecha||"").slice(0,10)<s.fecha ? f*s.factor : f, 1);
const diasEntreFechas=(a,b)=>Math.round((Date.parse(String(b).slice(0,10)+"T00:00:00Z")-Date.parse(String(a).slice(0,10)+"T00:00:00Z"))/86400000);
// Pura. {TICKER: {ticker, cat, usd, comprado, vendido, cartera, costoUnit, valorInicial, desde, dias, sinCantidad, precio, fechaPrecio, valorActual, rend, rendPct, tna}}.
// `hoy` ("AAAA-MM-DD") es la fecha hasta la que se cuentan los días de tenencia.
// Pura. Las operaciones con las que se cuentan los nominales: las inversiones MÁS los movimientos del fondo de ahorro que no tienen inversión (la compra o venta que
// solo cargaste como depósito o retiro del fondo), siempre que digan ticker y cantidad. Una inversión sin cantidad toma la del movimiento del fondo que la acompaña
// (mismo sentido, hasta 7 días y 3% de monto, o el retiro ligado a la venta). Así se puede llevar la cantidad en el fondo sin duplicarla en Inversiones.
// Pura. Empareja cada inversión (compra o venta) con el movimiento del fondo de ahorro que la acompaña: el depósito de una compra, el retiro de una venta. Primero
// el que está LIGADO (origenInvId); si no, el más parecido del mismo sentido, hasta 7 días y 3% de monto, y del mismo ticker cuando los dos lo dicen.
// Devuelve {pares:[{inv, f, ligado}], fondo:[{m, info, venta, usada}]}. Solo movimientos del fondo en pesos (o en dólares si están ligados).
function emparejarFondoInversion(lista){
  const invs=(lista||[]).filter(m=>m && m.tipo==="Inversion");
  const conocidos=[...new Set(invs.filter(m=>m.ticker).map(m=>String(m.ticker).toUpperCase()))];
  const fondo=(lista||[]).filter(m=>m && m.tipo==="Gasto" && (m.esAhorro||m.usaAhorro) && (m.moneda!=="USD" ? (m.importe||0)>0 : !!m.origenInvId))
    .map(m=>({m, info:infoDeFondo(m,conocidos), venta:!!m.usaAhorro && !m.esAhorro, usada:false}));
  const montoOp=i=>(i.importeUSD>0 && !(i.importe>0)) ? 0 : (i.importe||0);
  const pares=[];
  // Los ligados primero, así una inversión parecida no se queda con el depósito de otra.
  invs.forEach(i=>{ const f=fondo.find(x=>!x.usada && x.m.origenInvId===i.id); if(f){ f.usada=true; pares.push({inv:i, f, ligado:true}); } });
  const conPar=new Set(pares.map(p=>p.inv.id));
  invs.forEach(i=>{
    if(conPar.has(i.id) || esPagoDeInversion(i) || (isInvSalida(i) && /rendimiento/.test(normalizarTexto(i.subcat||"")))) return;
    const venta=isInvSalida(i), monto=montoOp(i), tk=String(i.ticker||"").toUpperCase();
    if(!(monto>0)) return;
    let mejor=null, mejorP=Infinity;
    fondo.forEach(f=>{
      if(f.usada || f.venta!==venta || f.m.moneda==="USD" || f.m.origenInvId) return;
      if(diasDif(f.m.fecha,i.fecha)>FONDO_DIAS || Math.abs(f.m.importe-monto)/monto>FONDO_REL) return;
      if(f.info.ticker && tk && f.info.ticker!==tk) return;
      const p=Math.abs(f.m.importe-monto)/monto*100+diasDif(f.m.fecha,i.fecha);
      if(p<mejorP){ mejorP=p; mejor=f; }
    });
    if(mejor){ mejor.usada=true; pares.push({inv:i, f:mejor, ligado:false}); }
  });
  return {pares, fondo};
}
// Pura. Las operaciones con las que se cuentan los nominales: las inversiones MÁS los movimientos del fondo de ahorro que no tienen inversión (la compra o venta que
// solo cargaste como depósito o retiro del fondo), siempre que digan ticker y cantidad. Una inversión sin cantidad toma la del movimiento del fondo que la acompaña.
// Así se puede llevar la cantidad en el fondo sin duplicarla en Inversiones.
function operacionesParaPosiciones(lista){
  const {pares, fondo}=emparejarFondoInversion(lista);
  const parDe=new Map(pares.map(p=>[p.inv.id, p.f]));
  const out=(lista||[]).filter(m=>m && m.tipo==="Inversion").map(i=>{
    const f=parDe.get(i.id);
    return (i.cantidad>0 || !f || !(f.info.cantidad>0)) ? i : {...i, cantidad:f.info.cantidad};
  });
  fondo.filter(f=>!f.usada && f.m.moneda!=="USD" && f.info.ticker && f.info.cantidad>0).forEach(f=>out.push({id:f.m.id, tipo:"Inversion", cat:"CEDEARs", subcat:f.venta?"CEDEARs Venta":"CEDEARs Compra",
    ticker:f.info.ticker, importe:f.m.importe, importeUSD:0, fecha:f.m.fecha, cantidad:f.info.cantidad, desdeFondo:true}));
  return out;
}
function calcularPosiciones(lista, precios, hoy, splits){
  const inv=operacionesParaPosiciones(lista).slice().sort(ordenDeOperacion);
  const por={};
  inv.forEach(m=>{
    const ticker=tickerClave(m.ticker);
    const o=por[ticker] || (por[ticker]={ticker:m.ticker || "Sin ticker", cat:m.cat, usd:false, comprado:0, vendido:0, cartera:0, costo:0, desde:null, sinCantidad:0, ops:0});
    if(m.cat) o.cat=m.cat;
    if(m.importeUSD>0 && !(m.importe>0)) o.usd=true;
    const salida=isInvSalida(m);
    if(salida && esPagoDeInversion(m)) return;                // un cupón o dividendo no mueve nominales
    if(salida && /rendimiento/.test(normalizarTexto(m.subcat||""))) return;
    o.ops++;
    const c0=numeroPositivo(m.cantidad);
    if(!c0){ o.sinCantidad++; return; }
    const c=c0*factorDeSplit(splits, ticker, m.fecha);   // nominales de antes de un split, en nominales de hoy
    const monto=(m.importeUSD>0 && !(m.importe>0)) ? m.importeUSD : (m.importe||0);
    if(!salida){
      if(o.cartera<=0) o.desde=String(m.fecha||"").slice(0,10);   // la posición empieza de nuevo
      o.comprado+=c; o.cartera+=c; o.costo+=monto;
    } else {
      const saca=Math.min(c, o.cartera), prom=o.cartera>0 ? o.costo/o.cartera : 0;
      if(c>saca+1e-9) o.deMas=(o.deMas||0)+(c-saca);   // vendiste más de lo que la app sabe que tenías: falta una compra, una cantidad o un split
      o.vendido+=c; o.cartera-=saca; o.costo-=saca*prom;
      if(o.cartera<=1e-9){ o.cartera=0; o.costo=0; o.desde=null; }
    }
  });
  const out={};
  Object.keys(por).forEach(t=>{
    const o=por[t];
    if(o.comprado===0 && o.vendido===0) { out[t]={...o, costoUnit:0, valorInicial:0, dias:null, precio:null, fechaPrecio:"", valorActual:null, rend:null, rendPct:null, tna:null}; delete out[t].costo; return; }
    const costoUnit=o.cartera>0 ? o.costo/o.cartera : 0;
    const p=(precios||{})[t], precio=p ? numeroPositivo(p.precio) : null;
    const valorInicial=Math.round(o.costo*100)/100;
    const valorActual=(precio && o.cartera>0) ? Math.round(precio*o.cartera*100)/100 : null;
    const rend=valorActual!==null ? Math.round((valorActual-valorInicial)*100)/100 : null;
    const rendPct=(rend!==null && valorInicial>0) ? Math.round(rend/valorInicial*10000)/100 : null;
    const dias=(o.desde && hoy) ? Math.max(1, diasEntreFechas(o.desde, hoy)) : null;
    const tna=(rendPct!==null && dias) ? Math.round(rendPct*365/dias*100)/100 : null;
    out[t]={...o, cartera:Math.round(o.cartera*1e6)/1e6, comprado:Math.round(o.comprado*1e6)/1e6, vendido:Math.round(o.vendido*1e6)/1e6,
      costoUnit:Math.round(costoUnit*100)/100, valorInicial, dias, precio, fechaPrecio:p?p.fecha:"", valorActual, rend, rendPct, tna, vendidoDeMas:Math.round((o.deMas||0)*1e6)/1e6};
    delete out[t].costo;
  });
  return out;
}

// Las compras y ventas a las que les falta la cantidad (no cuentan los cupones, dividendos ni rendimientos, ni los dólares MEP ni las cauciones). `ticker` opcional.
function operacionesSinCantidad(lista, ticker){
  const efectivas=new Map(operacionesParaPosiciones(lista).filter(o=>o.cantidad>0).map(o=>[o.id,o.cantidad]));   // la que ya dice el movimiento del fondo cuenta
  return (lista||[]).filter(m=>{
    if(!m || m.tipo!=="Inversion" || m.cantidad>0 || efectivas.has(m.id)) return false;
    if(ticker && tickerClave(m.ticker)!==tickerClave(ticker)) return false;
    if(m.mep===true || m.cat==="MEP" || /cauci/.test(normalizarTexto(m.cat||""))) return false;
    if(isInvSalida(m) && (esPagoDeInversion(m) || /rendimiento/.test(normalizarTexto(m.subcat||"")))) return false;
    return true;
  }).sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")) || (b.id||0)-(a.id||0));
}
// Pura. Una cantidad que se puede leer de las notas: "Spy x 18", "18 nominales", "x18" en la nota de la propia operación o en la del depósito al fondo de ahorro
// que la acompaña (mismo ticker en la nota, hasta 7 días de diferencia y 3% de monto). null si no hay de dónde sacarla. Es solo una SUGERENCIA: se confirma antes de guardar.
function sugerirCantidad(m, lista){
  const leer=nota=>{
    const t=String(nota||"");
    const a=/[xX×]\s*(\d+(?:[.,]\d+)?)/.exec(t) || /(\d+(?:[.,]\d+)?)\s*(?:nominales|nom\.?|cuotapartes|unidades)\b/i.exec(t);
    const n=a ? Number(a[1].replace(",",".")) : NaN;
    return n>0 ? n : null;
  };
  const propia=leer(m.nota);
  if(propia) return propia;
  const tk=normalizarTexto(m.ticker||""), monto=m.importeUSD>0&&!(m.importe>0) ? m.importeUSD : (m.importe||0);
  if(tk.length<2 || !(monto>0)) return null;
  let mejor=null, mejorP=Infinity;
  (lista||[]).forEach(x=>{
    if(!x || x.tipo!=="Gasto" || !(x.esAhorro||x.usaAhorro) || x.moneda==="USD") return;
    const tkFondo=x.ticker ? normalizarTexto(x.ticker) : "";
    if(tkFondo ? tkFondo!==tk : !normalizarTexto(x.nota||"").split(/[^a-z0-9]+/).includes(tk)) return;
    const dias=Math.abs(Math.round((Date.parse(String(x.fecha).slice(0,10)+"T00:00:00Z")-Date.parse(String(m.fecha).slice(0,10)+"T00:00:00Z"))/86400000));
    const dif=Math.abs((x.importe||0)-monto)/monto;
    if(dias>7 || dif>0.03) return;
    const c=x.cantidad>0 ? Number(x.cantidad) : leer(x.nota); if(!c) return;
    const puntaje=dif*100+dias; if(puntaje<mejorP){ mejorP=puntaje; mejor=c; }
  });
  return mejor;
}

// ═══════════════════════════════════════════
// HISTORIAL DE INVERSIONES DESDE EL FONDO DE AHORRO
// ═══════════════════════════════════════════
// Cuando el fondo de ahorro ES una inversión (por ejemplo un fondo de retiro todo en SPY), cada depósito es una compra. Las compras de antes de empezar a cargar
// inversiones existen solo como depósitos: la app no sabe cuánto capital hay invertido y "Resultado inv." de las ventas sale inflado. Estas funciones encuentran
// esos depósitos sin inversión para poder crear la compra que les corresponde (con tu confirmación).
const FONDO_DIAS=7, FONDO_REL=0.03;   // el mismo criterio que la conciliación: hasta 7 días y 3% de diferencia
const montoCompraInv=m=>(m.importeUSD>0 && !(m.importe>0)) ? 0 : (m.importe||0);   // solo en pesos: un depósito al fondo es en pesos
const diasDif=(a,b)=>Math.abs(diasEntreFechas(String(a).slice(0,10), String(b).slice(0,10)));
// Pura. Los depósitos en pesos de una categoría de ahorro que NO tienen una compra de inversión parecida (mismo mes, monto casi igual), más viejo primero:
// [{mov, ticker, cantidad}] con ticker y cantidad tomados de los campos del depósito o de su nota ("Spy x 2"). `tickerPorDefecto` cubre los que no dicen cuál es.
function comprasDelFondoSinInversion(lista, cat, tickerPorDefecto){
  const invs=(lista||[]).filter(m=>m && m.tipo==="Inversion" && !isInvSalida(m) && montoCompraInv(m)>0);
  const conocidos=[...new Set((lista||[]).filter(m=>m && m.tipo==="Inversion" && m.ticker).map(m=>String(m.ticker).toUpperCase()))];
  return (lista||[]).filter(d=>d && d.tipo==="Gasto" && d.esAhorro && d.moneda!=="USD" && (d.cat||"Sin categoría")===cat && (d.importe||0)>0)
    .filter(d=>!invs.some(i=>diasDif(i.fecha,d.fecha)<=FONDO_DIAS && Math.abs(i.importe-d.importe)/d.importe<=FONDO_REL))
    .map(d=>{ const info=infoDeFondo(d, conocidos); return {mov:d, ticker:info.ticker||tickerPorDefecto||"", cantidad:info.cantidad||null}; })
    .sort((a,b)=>String(a.mov.fecha).localeCompare(String(b.mov.fecha)) || (a.mov.id||0)-(b.mov.id||0));
}
// Pura. Las categorías de ahorro que se comportan como una inversión (al menos un depósito dice de qué ticker es) y cuántas compras les faltan:
// [{cat, faltan, ticker}] con el ticker más repetido en sus depósitos.
function fondosConComprasSinInversion(lista){
  const cats=[...new Set((lista||[]).filter(d=>d && d.tipo==="Gasto" && d.esAhorro && d.moneda!=="USD").map(d=>d.cat||"Sin categoría"))];
  const out=[];
  cats.forEach(cat=>{
    const conocidos=[...new Set((lista||[]).filter(m=>m && m.tipo==="Inversion" && m.ticker).map(m=>String(m.ticker).toUpperCase()))];
    const deps=(lista||[]).filter(d=>d && d.tipo==="Gasto" && d.esAhorro && d.moneda!=="USD" && (d.cat||"Sin categoría")===cat);
    const cuenta={}; deps.forEach(d=>{ const t=infoDeFondo(d,conocidos).ticker; if(t) cuenta[t]=(cuenta[t]||0)+1; });
    const ticker=Object.entries(cuenta).sort((a,b)=>b[1]-a[1])[0]; if(!ticker) return;
    const faltan=comprasDelFondoSinInversion(lista, cat, ticker[0]).length;
    if(faltan) out.push({cat, faltan, ticker:ticker[0]});
  });
  return out.sort((a,b)=>b.faltan-a.faltan);
}

// ═══════════════════════════════════════════
// RENDIMIENTO POR INSTRUMENTO EN UN PERÍODO (la card "Inversiones" de Movimientos)
// ═══════════════════════════════════════════
// Pura. Por cada ticker con movimientos en `lista` (los del período): cuánto pusiste, cuánto cobraste, el neto de caja y el RESULTADO (la ganancia o pérdida
// reconocida en el período, de `eventos`: ver calcularResultadoInv). Con `posiciones` (calcularPosiciones) suma lo que sigue en cartera y, si cargaste el precio de
// hoy, su rendimiento sin realizar. Ordenado: primero los de mayor resultado (en valor absoluto), después los de mayor movimiento.
function rendimientoPorInstrumento(lista, desdeYM, hastaYM, eventos, posiciones){
  const por={};
  const caja=(m)=>{ const k=tickerClave(m.ticker); return por[k] || (por[k]={clave:k, ticker:m.ticker||"Sin ticker", cat:m.cat||"", usd:false, pusoARS:0, pusoUSD:0, cobroARS:0, cobroUSD:0, resARS:0, resUSD:0, n:0}); };
  (lista||[]).filter(m=>m && m.tipo==="Inversion").forEach(m=>{
    const o=caja(m), ars=m.moneda==="USD" ? 0 : (m.importe||0), usd=m.importeUSD||0;
    if(isInvSalida(m)){ o.cobroARS+=ars; o.cobroUSD+=usd; } else { o.pusoARS+=ars; o.pusoUSD+=usd; }
    if(usd>0) o.usd=true;
    o.n++;
  });
  (eventos||[]).forEach(e=>{
    const ym=String(e.fecha||"").slice(0,7);
    if(ym<desdeYM || ym>hastaYM || !por[e.ticker]) return;
    if(e.moneda==="USD") por[e.ticker].resUSD+=e.ganancia; else por[e.ticker].resARS+=e.ganancia;
  });
  const r2=n=>Math.round(n*100)/100;
  return Object.values(por).map(o=>{
    const pos=(posiciones||{})[o.clave] || null;
    const usd=o.usd && !(o.pusoARS||o.cobroARS);
    return {...o, usd, pusoARS:r2(o.pusoARS), pusoUSD:r2(o.pusoUSD), cobroARS:r2(o.cobroARS), cobroUSD:r2(o.cobroUSD), resARS:r2(o.resARS), resUSD:r2(o.resUSD),
      netoARS:r2(o.cobroARS-o.pusoARS), netoUSD:r2(o.cobroUSD-o.pusoUSD),
      pos: (pos && pos.cartera>0) ? {cartera:pos.cartera, valorActual:pos.valorActual, rend:pos.rend, rendPct:pos.rendPct, usd:pos.usd} : null};
  }).sort((a,b)=>(Math.abs(b.resARS)+Math.abs(b.resUSD)*1000)-(Math.abs(a.resARS)+Math.abs(a.resUSD)*1000) || (b.pusoARS+b.cobroARS+(b.pusoUSD+b.cobroUSD)*1000)-(a.pusoARS+a.cobroARS+(a.pusoUSD+a.cobroUSD)*1000));
}

// ═══════════════════════════════════════════
// REVISIÓN DE DATOS DE INVERSIONES
// ═══════════════════════════════════════════
// Busca lo que hace que los números de inversiones mientan sin que se note. Lo que más pesa: una venta que la app cuenta casi entera como GANANCIA porque no
// tiene cargada la compra que la respalda (así se inflaron junio, octubre y septiembre). Cada problema dice qué es y cómo se arregla (ver tarjetas-inversiones.js).
const REVISION_MIN_GANANCIA={ars:1000, usd:10};
// Pura. [{tipo, clave, ...}] con `clave` estable para poder marcar uno como "está bien" (`ignorados`, un Set de claves).
function revisionInversiones(lista, ignorados){
  const ign=ignorados instanceof Set ? ignorados : new Set(ignorados||[]);
  const out=[];
  const r=calcularResultadoInv(lista);
  const conRetiro=new Set((lista||[]).filter(x=>x && x.origenInvId).map(x=>x.origenInvId));
  const invs=(lista||[]).filter(m=>m && m.tipo==="Inversion");

  // 1. Ventas o rescates que devolvieron menos de la mitad en capital: el resto se contó como ganancia.
  invs.forEach(m=>{
    // Una operación MEP es un cambio de pesos a dólares (o al revés), no una venta con ganancia: no se revisa acá.
    if(!isInvSalida(m) || esPagoDeInversion(m) || r.reinvertidas.has(m.id) || conRetiro.has(m.id) || m.mep===true || m.cat==="MEP") return;
    const usd=m.importeUSD>0 && !(m.importe>0), k=usd?"usd":"ars", monto=usd ? m.importeUSD : (m.importe||0);
    const dev=((r.capitalDevueltoPorOp[m.id]||{})[k])||0, ganancia=monto-dev;
    if(!(monto>0) || dev>=monto*0.5 || ganancia<REVISION_MIN_GANANCIA[k]) return;
    const clave="venta:"+m.id;
    if(!ign.has(clave)) out.push({tipo:"venta-sin-capital", clave, id:m.id, ticker:m.ticker||"Sin ticker", fecha:m.fecha, moneda:usd?"USD":"ARS", monto, capital:Math.round(dev*100)/100, ganancia:Math.round(ganancia*100)/100});
  });

  // Las más grandes primero (en pesos antes que en dólares): son las que más mueven el balance.
  out.sort((a,b)=>(a.moneda===b.moneda ? b.ganancia-a.ganancia : (a.moneda==="ARS"?-1:1)));

  // 2. Depósitos de un fondo que es una inversión, sin su compra cargada.
  fondosConComprasSinInversion(lista).forEach(f=>{ const clave="fondo:"+f.cat; if(!ign.has(clave)) out.push({tipo:"fondo-sin-inversion", clave, cat:f.cat, faltan:f.faltan, ticker:f.ticker}); });

  // 3. Compras con su depósito al fondo cargado aparte (sin vincular), y las que además tienen montos distintos.
  const {pares}=emparejarFondoInversion(lista);
  const sueltos=pares.filter(p=>!p.ligado && !p.f.venta && !isInvSalida(p.inv)).map(p=>({invId:p.inv.id, fondoId:p.f.m.id, fecha:p.inv.fecha, ticker:p.inv.ticker||"",
    inversion:p.inv.importe||0, deposito:p.f.m.importe||0, dif:Math.round(((p.f.m.importe||0)-(p.inv.importe||0))*100)/100}));
  if(sueltos.length && !ign.has("vincular")) out.push({tipo:"sin-vincular", clave:"vincular", pares:sueltos, distintos:sueltos.filter(x=>Math.abs(x.dif)>=0.01)});

  // 4. Vendiste más nominales de los que la app sabe que tenías.
  const pos=calcularPosiciones(lista, {}, "", typeof splitsInv!=="undefined" ? splitsInv : {});
  Object.values(pos).forEach(p=>{ if(p.vendidoDeMas>0){ const clave="nominales:"+tickerClave(p.ticker); if(!ign.has(clave)) out.push({tipo:"nominales", clave, ticker:p.ticker, deMas:p.vendidoDeMas}); } });

  // 5. Un mismo ticker escrito de distintas formas ("SPY" y "Spy").
  const formas={};
  invs.forEach(m=>{ const raw=String(m.ticker||"").trim(); if(!raw) return; const k=tickerClave(raw); (formas[k]=formas[k]||{})[raw]=(formas[k][raw]||0)+1; });
  Object.entries(formas).forEach(([k,f])=>{ const lista2=Object.keys(f); if(lista2.length<2) return; const clave="variantes:"+k;
    const mejor=lista2.sort((a,b)=>(f[b]-f[a]) || ((b===b.toUpperCase())-(a===a.toUpperCase())))[0];
    if(!ign.has(clave)) out.push({tipo:"variantes", clave, ticker:k, formas:lista2, sugerida:mejor}); });

  // 6. Operaciones sin cantidad, solo de los tickers de los que ya llevás cantidades.
  const conCant=new Set(operacionesParaPosiciones(lista).filter(o=>o.cantidad>0).map(o=>tickerClave(o.ticker)));
  const sinCant=operacionesSinCantidad(lista).filter(m=>conCant.has(tickerClave(m.ticker)));
  if(sinCant.length && !ign.has("sin-cantidad")) out.push({tipo:"sin-cantidad", clave:"sin-cantidad", n:sinCant.length});

  return out;
}
