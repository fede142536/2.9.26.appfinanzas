// ═══════════════════════════════════════════
// ANÁLISIS LOCAL
// ═══════════════════════════════════════════
// Todo lo de este archivo se calcula EN EL DISPOSITIVO, con los movimientos que ya tenés
// cargados. No sale nada a internet, no hace falta ninguna clave de API y funciona sin
// conexión. Son funciones puras (no tocan el DOM) para poder probarlas de verdad; el render
// vive al final, separado.

// ═══════════════════════════════════════════
// TEXTO
// ═══════════════════════════════════════════

// Palabras que no aportan nada para adivinar una categoría. Sin esto, "compra de nafta" y
// "compra de remedios" comparten "compra" y "de", y el puntaje las da por parecidas.
const PALABRAS_VACIAS = new Set([
  "de","del","la","el","los","las","un","una","unos","unas","y","o","a","al","en","con",
  "por","para","que","mi","su","lo","se","es","son","this","the","pago","compra","gasto"
]);

// Pasa un texto a una forma comparable: sin mayúsculas, sin acentos, sin puntuación y con
// los espacios colapsados. Sin sacar los acentos, "almacén" y "almacen" son dos cosas
// distintas para el buscador, y en la práctica los escribís de las dos formas.
//
// La ñ también cae: NFD la parte en n + tilde y el strip se lleva la tilde, así que "niño"
// queda "nino". Es a propósito — quien escribe "nino" tiene que encontrar lo que cargó como
// "niño" — y por eso el filtro de caracteres solo deja a-z0-9: para cuando llega, ya no hay
// ninguna ñ que conservar.
function normalizarTexto(s){
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")  // acentos (y con ellos la ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

// Las palabras de un texto que sirven para comparar: normalizadas, de 3 letras o más y sin
// las vacías de arriba.
function palabrasClave(s){
  return normalizarTexto(s).split(" ").filter(p=>p.length>=3 && !PALABRAS_VACIAS.has(p));
}

// ═══════════════════════════════════════════
// NÚMEROS
// ═══════════════════════════════════════════

// Mediana (no promedio) a propósito: un solo gasto enorme mueve el promedio y deja de
// representar lo que gastás normalmente; la mediana no se inmuta.
function mediana(nums){
  const xs=nums.filter(n=>typeof n==="number" && isFinite(n)).sort((a,b)=>a-b);
  if(!xs.length) return 0;
  const medio=Math.floor(xs.length/2);
  return xs.length%2 ? xs[medio] : (xs[medio-1]+xs[medio])/2;
}

// ═══════════════════════════════════════════
// 1. CATEGORIZACIÓN AUTOMÁTICA
// ═══════════════════════════════════════════
// Tres niveles, del más confiable al más genérico. En cuanto uno acierta, se corta.
//
// Que "aprenda de tus correcciones" no necesita ningún modelo: cada vez que corregís una
// sugerencia y guardás el movimiento, ese movimiento entra en `movs`, que es exactamente de
// donde salen los niveles 1 y 2. La próxima vez que escribas lo mismo, tu corrección pesa.

const SUG_MIN_LARGO = 3;   // menos que esto no alcanza para adivinar nada

// Nivel 1: alguien ya cargó EXACTAMENTE esta nota. Es la señal más fuerte que hay.
function sugerirPorNotaExacta(texto, tipoActual, lista){
  const objetivo=normalizarTexto(texto);
  if(objetivo.length<SUG_MIN_LARGO) return null;
  const conteo={};
  (lista||[]).forEach(m=>{
    if(m.tipo!==tipoActual || !m.nota) return;
    if(normalizarTexto(m.nota)!==objetivo) return;
    const key=m.cat+"||"+(m.subcat||"");
    conteo[key]=(conteo[key]||0)+1;
  });
  return mejorDelConteo(conteo, "exacta");
}

// Nivel 2: notas anteriores que comparten palabras con lo que estás escribiendo. Cada
// palabra en común suma 1; gana la categoría con más puntaje.
function sugerirPorPalabras(texto, tipoActual, lista){
  const palabras=palabrasClave(texto);
  if(!palabras.length) return null;
  const conteo={};
  (lista||[]).forEach(m=>{
    if(m.tipo!==tipoActual || !m.nota) return;
    const notaNorm=normalizarTexto(m.nota);
    let matches=0;
    palabras.forEach(p=>{ if(notaNorm.includes(p)) matches++; });
    if(!matches) return;
    const key=m.cat+"||"+(m.subcat||"");
    conteo[key]=(conteo[key]||0)+matches;
  });
  return mejorDelConteo(conteo, "historial");
}

// Nivel 3: la tabla de comercios conocidos (AUTO_CAT_RULES, en form-cargar.js).
function sugerirPorReglas(texto, tipoActual){
  const limpio=normalizarTexto(texto);
  if(limpio.length<SUG_MIN_LARGO) return null;
  if(typeof AUTO_CAT_RULES==="undefined") return null;
  for(const rule of AUTO_CAT_RULES){
    if(rule.tipo!==tipoActual) continue;
    if(rule.re.test(limpio)) return {cat:rule.cat, subcat:rule.subcat||null, fuente:"reglas", casos:0};
  }
  return null;
}

// Elige la clave más votada. Si hay empate en el primer puesto devuelve null: no hay un
// patrón claro y sugerir cualquiera de las dos es tirar una moneda delante del usuario.
function mejorDelConteo(conteo, fuente){
  const entradas=Object.entries(conteo).sort((a,b)=>b[1]-a[1]);
  if(!entradas.length) return null;
  if(entradas.length>1 && entradas[0][1]===entradas[1][1]) return null;
  const [cat,subcat]=entradas[0][0].split("||");
  return {cat, subcat:subcat||null, fuente, casos:entradas[0][1]};
}

function sugerirCategoriaPara(texto, tipoActual, lista){
  if(normalizarTexto(texto).length<SUG_MIN_LARGO) return null;
  return sugerirPorNotaExacta(texto, tipoActual, lista)
      || sugerirPorPalabras(texto, tipoActual, lista)
      || sugerirPorReglas(texto, tipoActual);
}

// ═══════════════════════════════════════════
// 2. GASTOS RECURRENTES
// ═══════════════════════════════════════════
// Detecta los gastos que se repiten mes a mes AUNQUE no los hayas marcado como frecuentes.
// Agrupa por la nota normalizada y mira en cuántos meses distintos aparece.

const REC_MIN_MESES = 3;      // con menos de 3 meses no hay patrón, hay casualidad
const REC_COBERTURA_MIN = 0.7; // % de los meses del período en los que tiene que aparecer

// Cuenta cuántos meses hay entre dos "YYYY-MM" (inclusive en ambas puntas).
function mesesEntre(ymA, ymB){
  const [aY,aM]=String(ymA).split("-").map(Number);
  const [bY,bM]=String(ymB).split("-").map(Number);
  return (bY-aY)*12 + (bM-aM);
}

function detectarRecurrentes(lista, hoyYM){
  const grupos={};
  (lista||[]).forEach(m=>{
    if(!esGasto(m) || esDepositoAhorro(m)) return;
    const clave=normalizarTexto(m.nota);
    if(clave.length<SUG_MIN_LARGO) return;
    const ym=String(m.fecha||"").slice(0,7);
    if(ym.length!==7) return;
    if(!grupos[clave]) grupos[clave]={clave, desc:m.nota, cat:m.cat, subcat:m.subcat||null, meses:new Set(), montos:[]};
    grupos[clave].meses.add(ym);
    grupos[clave].montos.push(m.importe||0);
  });

  const out=[];
  Object.values(grupos).forEach(g=>{
    const meses=[...g.meses].sort();
    if(meses.length<REC_MIN_MESES) return;
    // Cobertura: de los meses que van del primero al último, ¿en cuántos aparece? Un gasto
    // que apareció en enero, febrero y en octubre no es mensual, es casualidad.
    const span=mesesEntre(meses[0], meses[meses.length-1])+1;
    if(meses.length/span < REC_COBERTURA_MIN) return;
    const ultimoYM=meses[meses.length-1];
    out.push({
      clave:g.clave, desc:g.desc, cat:g.cat, subcat:g.subcat,
      meses, n:meses.length, span,
      montoTipico: mediana(g.montos),
      ultimoYM,
      // Lo pagaste de forma sostenida y este mes todavía no apareció: puede que te lo estés
      // olvidando de cargar, o que te lo hayan debitado y no lo viste.
      faltaEsteMes: !!hoyYM && ultimoYM<hoyYM && !g.meses.has(hoyYM)
    });
  });
  return out.sort((a,b)=>b.montoTipico-a.montoTipico);
}

// ═══════════════════════════════════════════
// 3. GASTOS FUERA DE LO NORMAL
// ═══════════════════════════════════════════
// A diferencia de detectarMovsAtipicos() (que usa una mediana GLOBAL y un umbral de 10x para
// encontrar basura de importación), esto compara cada gasto contra la mediana DE SU PROPIA
// CATEGORÍA. $80.000 en Supermercado puede ser normal y en Salidas ser un desvío.

const INU_MIN_CASOS = 4;  // con menos casos la mediana de la categoría no significa nada
const INU_FACTOR = 3;     // cuántas veces la mediana para considerarlo fuera de lo normal

// Mediana de gastos de una categoría, sin contar el movimiento que estamos evaluando
// (si no, un gasto enorme se hace subir su propia vara y nunca se detecta a sí mismo).
function medianaDeCategoria(lista, cat, excluirId){
  const importes=(lista||[])
    .filter(m=>esConsumo(m) && m.cat===cat && m.id!==excluirId)
    .map(m=>m.importe||0)
    .filter(n=>n>0);
  return {mediana: mediana(importes), n: importes.length};
}

// Devuelve {veces, mediana} si el gasto está fuera de lo normal para su categoría, o null.
function gastoFueraDeLoNormal(mov, lista){
  if(!esGasto(mov) || esDepositoAhorro(mov)) return null;
  const importe=mov.importe||0;
  if(importe<=0) return null;
  const {mediana:med, n}=medianaDeCategoria(lista, mov.cat, mov.id);
  if(n<INU_MIN_CASOS || med<=0) return null;
  const veces=importe/med;
  if(veces<INU_FACTOR) return null;
  return {veces: Math.round(veces*10)/10, mediana: med, cat: mov.cat};
}

// Los gastos de un mes que están fuera de lo normal, del más desviado al menos.
function inusualesDelMes(lista, ym){
  return (lista||[])
    .filter(m=>String(m.fecha||"").slice(0,7)===ym)
    .map(m=>{ const r=gastoFueraDeLoNormal(m, lista); return r?{mov:m, ...r}:null; })
    .filter(Boolean)
    .sort((a,b)=>b.veces-a.veces);
}

// ═══════════════════════════════════════════
// 4. EL MES CONTRA TU HISTORIAL
// ═══════════════════════════════════════════

const COMP_MESES_BASE = 6;   // cuántos meses anteriores mirar
const COMP_MIN_BASE = 3;     // con menos meses de historial no se compara nada
const COMP_UMBRAL_PCT = 15;  // desvío mínimo para que valga la pena avisar

// Gastos de un mes. NO cuenta los depósitos al fondo de ahorro: ahorrar más no es gastar
// más, y si se contaran, un mes en el que guardaste plata dispararía una alerta de
// "te fuiste al carajo" que es exactamente al revés de lo que pasó.
function gastosDelMes(lista, ym){
  return (lista||[])
    .filter(m=>esConsumo(m) && String(m.fecha||"").slice(0,7)===ym)
    .reduce((s,m)=>s+(m.importe||0),0);
}

// Cuántos días tiene un mes "YYYY-MM".
function diasDelMes(ym){
  const [y,m]=String(ym).split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// Compara el gasto de un mes contra la mediana de los meses anteriores.
//
// El mes en curso está a medio terminar, así que compararlo crudo contra meses completos
// siempre dice "vas bien" — sobre todo el día 3. Por eso, cuando `ym` es el mes de `hoyYMD`,
// se proyecta a fin de mes por regla de tres y se marca `parcial:true` para que el que
// muestre esto pueda aclararlo.
function comparativaMes(lista, ym, hoyYMD){
  const actual=gastosDelMes(lista, ym);
  // Meses anteriores CON datos (un mes sin movimientos no es un mes de $0, es un mes que no
  // cargaste, y meterlo en la mediana la hunde).
  const base=[];
  for(let i=1;i<=COMP_MESES_BASE;i++){
    const ymPrev=addMonths(ym,-i);
    const total=gastosDelMes(lista, ymPrev);
    if(total>0) base.push(total);
  }
  if(base.length<COMP_MIN_BASE) return {actual, mediana:0, mesesBase:base.length, hayDatos:false};

  const med=mediana(base);
  const hoyYM=String(hoyYMD||"").slice(0,7);
  const parcial = hoyYM===ym;
  let referencia=actual;
  let proyectado=null;
  if(parcial){
    const dia=Number(String(hoyYMD).slice(8,10))||1;
    const total=diasDelMes(ym);
    proyectado=Math.round(actual/dia*total);
    referencia=proyectado;
  }
  const pct=med>0 ? Math.round((referencia-med)/med*100) : 0;
  return {
    actual, proyectado, mediana:med, mesesBase:base.length, hayDatos:true,
    parcial, pct,
    // Solo llamamos "desvío" a algo que se nota: ±15%. Debajo de eso es ruido del mes.
    desviado: Math.abs(pct)>=COMP_UMBRAL_PCT
  };
}

// ═══════════════════════════════════════════
// 5. SIMULADOR DE CUOTAS
// ═══════════════════════════════════════════
// "¿Me banco $50.000 en 6 cuotas?" es aritmética, no una opinión: la app ya sabe cuánta
// cuota tenés comprometida cada mes y cuánto entra por mes. Esto lo pone al lado.

// Mediana del ingreso mensual de los últimos `cuantos` meses con movimientos.
function ingresoMensualTipico(lista, hoyYM, cuantos){
  const n=cuantos||6;
  const totales=[];
  for(let i=1;i<=n;i++){
    const ym=addMonths(hoyYM,-i);
    const delMes=(lista||[]).filter(m=>String(m.fecha||"").slice(0,7)===ym);
    if(!delMes.length) continue;
    const t=totalesDePlata(delMes).ingresos;
    if(t>0) totales.push(t);
  }
  return {mediana: mediana(totales), meses: totales.length};
}

// Devuelve la proyección mes a mes de sumar una compra nueva a lo que ya debés.
// `filas`: [{ym, yaComprometido, nueva, total}] · `pico`: la fila más cara.
function simularCuotas(monto, cuotas, mesInicio, lista, hoyYM){
  const total=Number(monto)||0;
  const n=Math.max(1, Math.floor(Number(cuotas)||0));
  if(total<=0 || !mesInicio) return null;

  const cuota=Math.round(total/n*100)/100;
  const filas=[];
  for(let i=0;i<n;i++){
    const ym=addMonths(mesInicio,i);
    // Lo que YA tenés comprometido ese mes en tarjetas (cuotas en curso + gastos fijos).
    const ya=getTcMovsEnMes(ym)
      .filter(m=>m.moneda!=="USD")
      .reduce((s,m)=>s+(m.importe||0),0);
    filas.push({ym, yaComprometido:ya, nueva:cuota, total:ya+cuota});
  }
  const pico=filas.reduce((a,b)=>b.total>a.total?b:a, filas[0]);
  const ing=ingresoMensualTipico(lista, hoyYM||currentYM());
  return {
    cuota, filas, pico,
    ingresoTipico: ing.mediana,
    mesesDeIngreso: ing.meses,
    // Qué porcentaje de un mes de ingresos se te va en tarjeta en el peor mes.
    pctPico: ing.mediana>0 ? Math.round(pico.total/ing.mediana*100) : null
  };
}

// ═══════════════════════════════════════════
// 5b. REGISTROS INCOMPLETOS
// ═══════════════════════════════════════════
// Un campo numérico que quedó vacío hace que los totales den NaN, y desde que NaN se muestra
// como "—" (ver fmtTotal) eso se ve en pantalla. Pero el guión solo dice QUE algo está roto,
// no CUÁL: sin esta lista habría que ir movimiento por movimiento a mano.

// Devuelve [{que, id, desc, motivo}] — `que` es "tarjeta" o "movimiento".
function registrosIncompletos(lista, tcsLista){
  const rotos=[];

  (tcsLista||[]).forEach(t=>{
    const desc=t.desc||"(sin descripción)";
    // En un gasto frecuente `total` es el monto mensual; en cuotas, el total de la compra.
    if(numeroRoto(t.total) || Number(t.total)<=0){
      rotos.push({que:"tarjeta", id:t.id, desc, motivo:t.frecuente?"le falta el monto mensual":"le falta el monto total"});
      return;
    }
    if(!t.frecuente){
      if(numeroRoto(t.cuotasTotal) || Number(t.cuotasTotal)<1){
        rotos.push({que:"tarjeta", id:t.id, desc, motivo:"le falta en cuántas cuotas"});
        return;
      }
      if(!t.mesInicio){
        rotos.push({que:"tarjeta", id:t.id, desc, motivo:"le falta el mes de la primera cuota"});
        return;
      }
    } else if(!t.mesInicio){
      rotos.push({que:"tarjeta", id:t.id, desc, motivo:"le falta el mes de inicio"});
    }
  });

  (lista||[]).forEach(m=>{
    const enUSD=m.moneda==="USD";
    const monto=enUSD ? m.importeOrig : m.importe;
    // Un movimiento en USD guarda 0 en `importe` a propósito, así que solo se mira el campo
    // que le corresponde a su moneda.
    if(numeroRoto(monto)){
      rotos.push({que:"movimiento", id:m.id, desc:m.nota||m.cat||"(sin descripción)",
                  motivo:"el importe no es un número"});
    }
  });

  return rotos;
}

// ═══════════════════════════════════════════
// 6. ALERTAS
// ═══════════════════════════════════════════
// Arma la lista de avisos del momento. Cada uno es {nivel, icono, titulo, detalle}.
// `nivel`: "info" | "warn" | "danger" — solo define el color.

const ALERTA_MAX = 5;  // más que esto y dejás de leerlas

function alertasDelMomento(lista, tcsLista, hoyYMD){
  const hoyYM=String(hoyYMD||"").slice(0,7);
  const out=[];

  // ── El mes contra tu historial ──
  const comp=comparativaMes(lista, hoyYM, hoyYMD);
  if(comp.hayDatos && comp.desviado){
    const arriba=comp.pct>0;
    const proyTxt=comp.parcial
      ? `Llevás ${fmtS(comp.actual)}; a este ritmo terminás el mes en ${fmtTotal(comp.proyectado)}.`
      : `Gastaste ${fmtTotal(comp.actual)}.`;
    out.push({
      nivel: arriba?"warn":"info",
      icono: arriba?"📈":"📉",
      titulo: `Vas ${Math.abs(comp.pct)}% ${arriba?"arriba":"abajo"} de tu mes típico`,
      detalle: `${proyTxt} Tu mediana de los últimos ${comp.mesesBase} meses es ${fmtTotal(comp.mediana)}. No cuenta lo que pasaste a ahorros.`
    });
  }

  // ── Cuotas y gastos fijos que caen este mes ──
  const delMes=typeof getTcMovsEnMes==="function" ? getTcMovsEnMes(hoyYM) : [];
  if(delMes.length){
    const totalARS=delMes.filter(m=>m.moneda!=="USD").reduce((s,m)=>s+(m.importe||0),0);
    // La última cuota de una compra es la noticia: el mes que viene ese monto se libera.
    const ultimas=delMes.filter(m=>!m.frecuente && m.nCuota===m.cuotasTotal);
    out.push({
      nivel:"info", icono:"💳",
      titulo:`${delMes.length} ${delMes.length===1?"cuota":"cuotas"} de tarjeta este mes · ${fmtTotal(totalARS)}`,
      detalle: ultimas.length
        ? `Se te termina de pagar: ${ultimas.map(m=>m.desc).join(", ")}. El mes que viene te libera ${fmtTotal(ultimas.reduce((s,m)=>s+(m.importe||0),0))}.`
        : `No se termina ninguna compra este mes.`
    });
  }

  // ── Gastos recurrentes que este mes todavía no aparecieron ──
  const faltantes=detectarRecurrentes(lista, hoyYM).filter(r=>r.faltaEsteMes).slice(0,3);
  if(faltantes.length){
    const n=faltantes.length;
    out.push({
      nivel:"warn", icono:"🔁",
      titulo:`${n} ${n===1?"gasto habitual":"gastos habituales"} que este mes todavía no ${n===1?"aparece":"aparecen"}`,
      detalle: faltantes.map(r=>`${r.desc} (~${fmtAbbr(r.montoTipico)})`).join(" · ")
    });
  }

  // ── Gastos de este mes fuera de lo normal para su categoría ──
  const inusuales=inusualesDelMes(lista, hoyYM).slice(0,3);
  if(inusuales.length){
    out.push({
      nivel:"warn", icono:"⚠️",
      titulo:`${inusuales.length} ${inusuales.length===1?"gasto":"gastos"} fuera de lo normal este mes`,
      detalle: inusuales.map(i=>`${i.mov.nota||i.mov.cat}: ${fmtS(i.mov.importe)} (${i.veces}× tu mediana de ${i.cat})`).join(" · ")
    });
  }

  // ── Registros a los que les falta un dato ──
  // Va al final pero se cuela primero si existe: un número que no se puede calcular ensucia
  // todas las demás cuentas, así que arreglarlo es más urgente que cualquier otro aviso.
  const rotos=registrosIncompletos(lista, tcsLista);
  if(rotos.length){
    out.unshift({
      nivel:"danger", icono:"🔧",
      titulo:`${rotos.length} ${rotos.length===1?"registro al que le falta":"registros a los que les falta"} un dato`,
      detalle: rotos.slice(0,3).map(r=>`${r.desc}: ${r.motivo}`).join(" · ")
        + (rotos.length>3?` · y ${rotos.length-3} más`:"")
        + ". Donde no se puede calcular vas a ver un “—” en vez de un monto."
    });
  }

  return out.slice(0, ALERTA_MAX);
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════

const COLOR_ALERTA={
  info:   {bg:"var(--accent-light)",  fg:"var(--accent)"},
  warn:   {bg:"var(--warning-light)", fg:"var(--warning)"},
  danger: {bg:"var(--danger-light)",  fg:"var(--danger)"}
};

function renderAlertas(){
  const el=document.getElementById("dash-alertas");
  const card=document.getElementById("dash-alertas-card");
  if(!el) return;
  const alertas=alertasDelMomento(movs, tcs, currentYMD());
  // Sin nada que destacar, la card entera se oculta —título incluido, como #dash-usd-card—
  // en vez de quedar del mismo tamaño que las demás con un renglón "no hay nada". No hay
  // ningún dato que perder ocultándola: se vuelve a calcular sola en cada render.
  if(!alertas.length){
    if(card) card.style.display="none";
    el.innerHTML="";
    return;
  }
  if(card) card.style.display="block";
  el.innerHTML=alertas.map(a=>{
    const c=COLOR_ALERTA[a.nivel]||COLOR_ALERTA.info;
    return `<div style="background:${c.bg};border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px">
      <div style="font-size:13px;font-weight:600;color:${c.fg}">${a.icono} ${escapeHtml(a.titulo)}</div>
      <div class="txt-xs txt-muted" style="margin-top:3px;line-height:1.45">${escapeHtml(a.detalle)}</div>
    </div>`;
  }).join("");
}

// ── SIMULADOR (modal, se abre desde el form de Tarjeta) ──

function abrirSimulador(){
  // Precarga lo que ya escribiste en el form, si escribiste algo.
  const totalEl=document.getElementById("tc-total");
  const cuotasEl=document.getElementById("tc-cuotas");
  const mesEl=document.getElementById("tc-mes-inicio");
  const monto=totalEl ? parseFloat(String(totalEl.value).replace(/\./g,"").replace(",",".")) : NaN;
  document.getElementById("sim-monto").value = isFinite(monto)&&monto>0 ? Math.round(monto) : "";
  document.getElementById("sim-cuotas").value = (cuotasEl && Number(cuotasEl.value)>0) ? cuotasEl.value : 6;
  document.getElementById("sim-mes").value = (mesEl && mesEl.value) ? mesEl.value : currentYM();
  document.getElementById("modal-simulador").classList.add("open");
  correrSimulacion();
}

function cerrarSimulador(){
  document.getElementById("modal-simulador").classList.remove("open");
}

function correrSimulacion(){
  const el=document.getElementById("sim-resultado");
  if(!el) return;
  const monto=parseFloat(document.getElementById("sim-monto").value);
  const cuotas=parseInt(document.getElementById("sim-cuotas").value,10);
  const mes=document.getElementById("sim-mes").value;
  const r=(isFinite(monto)&&monto>0&&cuotas>0&&mes) ? simularCuotas(monto, cuotas, mes, movs, currentYM()) : null;
  if(!r){
    el.innerHTML=`<p class="txt-sm txt-muted" style="text-align:center;padding:14px 0">Poné un monto, en cuántas cuotas y desde qué mes.</p>`;
    return;
  }

  let html=`<div style="background:var(--warning-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="txt-sm" style="color:var(--warning)">Cada cuota</span>
      <strong style="font-size:22px;color:var(--warning)">${fmtS(r.cuota)}</strong>
    </div>
    <div class="txt-xs txt-muted" style="margin-top:4px">${r.filas.length} ${r.filas.length===1?"mes":"meses"}, de ${mesLbl(r.filas[0].ym)} a ${mesLbl(r.filas[r.filas.length-1].ym)}</div>
  </div>`;

  // El veredicto en una línea, que es lo que realmente venís a buscar.
  if(r.pctPico!==null){
    const nivel = r.pctPico>=40 ? "danger" : (r.pctPico>=25 ? "warn" : "info");
    const c=COLOR_ALERTA[nivel];
    const frase = r.pctPico>=40
      ? "Es una parte muy grande de tu mes."
      : (r.pctPico>=25 ? "Es una mordida considerable." : "Entra cómodo.");
    html+=`<div style="background:${c.bg};border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:${c.fg}">En ${mesLbl(r.pico.ym)}, tu peor mes, la tarjeta se lleva el ${r.pctPico}% de lo que entra</div>
      <div class="txt-xs txt-muted" style="margin-top:3px">${fmtTotal(r.pico.total)} de tarjeta contra un ingreso típico de ${fmtTotal(r.ingresoTipico)} (mediana de ${r.mesesDeIngreso} ${r.mesesDeIngreso===1?"mes":"meses"}). ${frase}</div>
    </div>`;
  } else {
    html+=`<div class="txt-xs txt-muted" style="margin-bottom:12px">No hay ingresos cargados en los meses anteriores, así que no puedo decirte qué porcentaje de tu sueldo es. Abajo está igual el total mes a mes.</div>`;
  }

  // Mes a mes: lo que ya debías + la cuota nueva.
  const maxTotal=Math.max(...r.filas.map(f=>f.total),1);
  html+=`<div class="seccion-label mb-6">Mes a mes, con esta compra adentro</div>`;
  html+=r.filas.map(f=>`
    <div style="margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
        <span>${escapeHtml(mesLbl(f.ym))}${f.ym===r.pico.ym?' <span class="badge badge-accent">pico</span>':""}</span>
        <strong>${fmtS(f.total)}</strong>
      </div>
      <div class="bar-track" style="display:flex">
        <div class="bar-fill" style="width:${Math.round(f.yaComprometido/maxTotal*100)}%;background:var(--muted)"></div>
        <div class="bar-fill" style="width:${Math.round(f.nueva/maxTotal*100)}%;background:var(--warning)"></div>
      </div>
    </div>`).join("");
  html+=`<div class="txt-micro txt-muted" style="margin-top:8px">
    <span style="color:var(--muted)">■</span> lo que ya tenías comprometido ·
    <span style="color:var(--warning)">■</span> esta compra
  </div>`;

  el.innerHTML=html;
}
