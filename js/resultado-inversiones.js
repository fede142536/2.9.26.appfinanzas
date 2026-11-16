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
      const g=grupos[(m.ticker||"Sin ticker")+"|"+ym+"|"+k] || (grupos[(m.ticker||"Sin ticker")+"|"+ym+"|"+k]={sus:0, res:0, ret:false, ids:[]});
      if(isInvSalida(m)){ g.res+=monto; if(conRetiro.has(m.id)) g.ret=true; } else g.sus+=monto;
      g.ids.push(m.id);
    });
  });
  const reinvertido=(ticker,ym,k)=>{
    const g=grupos[ticker+"|"+ym+"|"+k];
    return g && !g.ret && g.sus>0 && g.res>g.sus && (g.res-g.sus)<=g.sus*RESUSCRIPCION_MAX ? g : null;
  };
  const yaContado=new Set();

  inv.forEach(m=>{
    const ticker=m.ticker || "Sin ticker";
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length!==7) return;   // sin fecha usable no se puede ubicar en el tiempo
    const cap=caja(capital, ticker), gan=caja(ganancia, ym), flu=caja(flujo, ym);
    const salida=isInvSalida(m);

    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      const rollover=(esPagoDeInversion(m) || !esOpDeFondo(m)) ? null : reinvertido(ticker, ym, k);
      if(rollover){
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
    const t=m.ticker || "Sin ticker";
    if(!porTicker[t]) porTicker[t]={ticker:t, cat:m.cat||"", ars:0, usd:0, movs:0};
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
  Object.keys(o).forEach(t=>{
    const v=o[t]; if(t==="__proto__" || !v || typeof v!=="object") return;
    const precio=numeroPositivo(v.precio); if(precio===null) return;
    out[t]={precio:Math.round(precio*10000)/10000, fecha:/^\d{4}-\d{2}-\d{2}$/.test(v.fecha||"") ? v.fecha : ""};
  });
  return out;
}
const diasEntreFechas=(a,b)=>Math.round((Date.parse(String(b).slice(0,10)+"T00:00:00Z")-Date.parse(String(a).slice(0,10)+"T00:00:00Z"))/86400000);
// Pura. {TICKER: {ticker, cat, usd, comprado, vendido, cartera, costoUnit, valorInicial, desde, dias, sinCantidad, precio, fechaPrecio, valorActual, rend, rendPct, tna}}.
// `hoy` ("AAAA-MM-DD") es la fecha hasta la que se cuentan los días de tenencia.
function calcularPosiciones(lista, precios, hoy){
  const inv=(lista||[]).filter(m=>m && m.tipo==="Inversion").slice().sort(ordenDeOperacion);
  const por={};
  inv.forEach(m=>{
    const ticker=m.ticker || "Sin ticker";
    const o=por[ticker] || (por[ticker]={ticker, cat:m.cat, usd:false, comprado:0, vendido:0, cartera:0, costo:0, desde:null, sinCantidad:0, ops:0});
    if(m.cat) o.cat=m.cat;
    if(m.importeUSD>0 && !(m.importe>0)) o.usd=true;
    const salida=isInvSalida(m);
    if(salida && esPagoDeInversion(m)) return;                // un cupón o dividendo no mueve nominales
    if(salida && /rendimiento/.test(normalizarTexto(m.subcat||""))) return;
    o.ops++;
    const c=numeroPositivo(m.cantidad);
    if(!c){ o.sinCantidad++; return; }
    const monto=(m.importeUSD>0 && !(m.importe>0)) ? m.importeUSD : (m.importe||0);
    if(!salida){
      if(o.cartera<=0) o.desde=String(m.fecha||"").slice(0,10);   // la posición empieza de nuevo
      o.comprado+=c; o.cartera+=c; o.costo+=monto;
    } else {
      const saca=Math.min(c, o.cartera), prom=o.cartera>0 ? o.costo/o.cartera : 0;
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
      costoUnit:Math.round(costoUnit*100)/100, valorInicial, dias, precio, fechaPrecio:p?p.fecha:"", valorActual, rend, rendPct, tna};
    delete out[t].costo;
  });
  return out;
}

// Las compras y ventas a las que les falta la cantidad (no cuentan los cupones, dividendos ni rendimientos, ni los dólares MEP ni las cauciones). `ticker` opcional.
function operacionesSinCantidad(lista, ticker){
  return (lista||[]).filter(m=>{
    if(!m || m.tipo!=="Inversion" || m.cantidad>0) return false;
    if(ticker && (m.ticker||"Sin ticker")!==ticker) return false;
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
    if(!normalizarTexto(x.nota||"").split(/[^a-z0-9]+/).includes(tk)) return;
    const dias=Math.abs(Math.round((Date.parse(String(x.fecha).slice(0,10)+"T00:00:00Z")-Date.parse(String(m.fecha).slice(0,10)+"T00:00:00Z"))/86400000));
    const dif=Math.abs((x.importe||0)-monto)/monto;
    if(dias>7 || dif>0.03) return;
    const c=leer(x.nota); if(!c) return;
    const puntaje=dif*100+dias; if(puntaje<mejorP){ mejorP=puntaje; mejor=c; }
  });
  return mejor;
}
