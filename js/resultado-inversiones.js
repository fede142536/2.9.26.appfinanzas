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
// LA REGLA: primero recuperás capital, después ganás. Y si vendiste TODO por menos de lo que
// habías puesto, lo que falta no es capital que siga adentro: es la pérdida.
//
// Esa última parte faltaba, y era grave. Vender por menos de lo comprado dejaba la diferencia
// como "capital invertido" para siempre, así que el modelo NO PODÍA expresar una pérdida: todo
// resultado salía positivo o cero. Con los datos reales, MCD (comprado a $54.238,57 y vendido a
// $53.581,03) figuraba con $657,54 "todavía invertidos" en vez de $657,54 perdidos.
//
// La app no guarda cantidades, solo montos, así que una venta más chica que el capital es
// ambigua: puede ser que vendiste todo a pérdida, o que vendiste una parte. Esas dos no se
// distinguen solas. Por eso la venta que CIERRA la posición se marca (m.cierraPosicion), igual
// que un traspaso o una posición inicial: la app propone y vos confirmás.
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
// `posIni` es lo que ya tenías puesto en cada ticker ANTES del primer movimiento cargado.
// Sin eso, una venta de algo comprado antes de usar la app no encuentra capital detrás y se
// cuenta entera como ganancia (ver posicion-inicial.js). Se pasa como parámetro y no se lee
// del global adentro para que el cálculo siga siendo probable con una lista suelta.
function calcularResultadoInv(lista, posIni){
  const inv=(lista||[]).filter(m=>m && m.tipo==="Inversion").slice().sort(ordenDeOperacion);
  const capital={};   // capital[ticker] = {ars, usd}
  Object.keys(posIni||{}).forEach(t=>{
    const p=posIni[t]||{};
    const ars=Number(p.ars)||0, usd=Number(p.usd)||0;
    if(ars>0 || usd>0) capital[t]={ars, usd};
  });
  const ganancia={};  // ganancia[ym]    = {ars, usd}
  const flujo={};     // flujo[ym]       = {ars, usd}
  const capPorMes={}; // capPorMes[ym]   = {ars, usd} capital al CIERRE de ese mes
  const eventos=[];
  const caja=(obj,k)=>(obj[k] || (obj[k]={ars:0, usd:0}));

  inv.forEach(m=>{
    const ticker=m.ticker || "Sin ticker";
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length!==7) return;   // sin fecha usable no se puede ubicar en el tiempo
    const cap=caja(capital, ticker), gan=caja(ganancia, ym), flu=caja(flujo, ym);
    const salida=isInvSalida(m);

    ["ars","usd"].forEach(k=>{
      const monto=montoInv(m, k==="usd"?"USD":"ARS");
      if(!monto) return;
      if(salida){
        // Primero vuelve tu capital; lo que sobra es ganancia. Si nunca se cargó la compra,
        // el capital es 0 y TODA la venta cuenta como ganancia — se ve raro a propósito, para
        // que se note que falta una operación en vez de esconderlo en un total.
        const devuelve=Math.min(monto, cap[k]);
        cap[k]-=devuelve;
        gan[k]+=monto-devuelve;
        flu[k]-=devuelve;
        if(monto-devuelve>0) eventos.push({fecha:m.fecha, ticker, moneda:k==="usd"?"USD":"ARS", ganancia:monto-devuelve});
        // Esta venta cerró la posición: lo que quedaba sin recuperar no sigue invertido, se
        // perdió. Sin esto ninguna pérdida podía aparecer nunca.
        if(m.cierraPosicion && cap[k]>0.005){
          const perdida=cap[k];
          gan[k]-=perdida;
          flu[k]-=perdida;
          eventos.push({fecha:m.fecha, ticker, moneda:k==="usd"?"USD":"ARS", ganancia:-perdida});
          cap[k]=0;
        }
      } else {
        cap[k]+=monto;
        flu[k]+=monto;
      }
    });
    // Foto del capital después de cada operación: la última de cada mes queda como el cierre.
    const foto={ars:0, usd:0};
    Object.keys(capital).forEach(t=>{ foto.ars+=capital[t].ars; foto.usd+=capital[t].usd; });
    capPorMes[ym]=foto;
  });

  const redondear=o=>{ Object.keys(o).forEach(k=>{
    o[k].ars=Math.round(o[k].ars*100)/100;
    o[k].usd=Math.round(o[k].usd*100)/100;
  }); return o; };

  return {
    gananciaPorMes: redondear(ganancia),
    capitalPorTicker: redondear(capital),
    flujoPorMes: redondear(flujo),
    capitalPorMes: redondear(capPorMes),
    eventos
  };
}

// El cálculo recorre toda la historia, y el dashboard lo pide doce veces seguidas (una por mes).
// Se guarda el último resultado y se rehace solo cuando la lista cambió: comparar largo + último
// id alcanza porque los movimientos se agregan, se editan o se borran pasando siempre por save().
let _resultadoInvCache=null;
let _resultadoInvFirma="";
function firmaDeLista(lista, posIni){
  const inv=(lista||[]).filter(m=>m && m.tipo==="Inversion");
  let suma=0;
  inv.forEach(m=>{ suma += (m.id||0) + (m.importe||0) + (m.importeUSD||0) + (m.cierraPosicion?0.5:0); });
  // La posición inicial entra a la firma: cambiarla cambia el resultado, y sin esto la
  // pantalla seguía mostrando el cálculo viejo hasta el próximo alta.
  return inv.length+"|"+suma+"|"+JSON.stringify(posIni||{});
}
function posicionInicialActual(){
  return (typeof posicionInicial!=="undefined" && posicionInicial) ? posicionInicial : {};
}
function resultadoInv(lista){
  const fuente = lista || (typeof movs!=="undefined" ? movs : []);
  const posIni = posicionInicialActual();
  const firma=firmaDeLista(fuente, posIni);
  if(_resultadoInvCache && firma===_resultadoInvFirma) return _resultadoInvCache;
  _resultadoInvCache=calcularResultadoInv(fuente, posIni);
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

// La curva de la cartera: cuánto capital quedaba adentro al cierre de cada mes. Sube cuando
// ponés y baja cuando recuperás; una ganancia NO la mueve, porque no es capital. Solo aparecen
// los meses en que hubo alguna operación.
function capitalInvertidoPorMes(lista){
  const tabla=resultadoInv(lista).capitalPorMes;
  return Object.keys(tabla).sort().map(ym=>({ym, ars:tabla[ym].ars, usd:tabla[ym].usd}));
}

// Total que seguís teniendo invertido, sumando todos los tickers.
function capitalPorTicker(lista){
  const tabla=resultadoInv(lista).capitalPorTicker;
  return Object.keys(tabla)
    .map(t=>({ticker:t, ars:tabla[t].ars, usd:tabla[t].usd}))
    .filter(p=>Math.round(p.ars)!==0 || Math.abs(p.usd)>=0.01);
}

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

// Lo mismo agrupado por categoría (FCI, MEP, Acciones...). Misma convención de signo: negativo
// significa que pusiste plata y no la sacaste, no que hayas perdido.
function netoPorCategoriaDelPeriodo(lista){
  const porCat={};
  (lista||[]).filter(m=>m && m.tipo==="Inversion").forEach(m=>{
    const c=m.cat || "Sin categoría";
    if(!porCat[c]) porCat[c]={ticker:c, ars:0, usd:0, movs:0};
    const signo=isInvSalida(m) ? 1 : -1;
    porCat[c].ars += (m.moneda==="USD" ? 0 : (m.importe||0)) * signo;
    porCat[c].usd += (m.importeUSD||0) * signo;
    porCat[c].movs++;
  });
  return Object.values(porCat).map(p=>({
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
