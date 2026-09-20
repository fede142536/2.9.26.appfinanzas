// ═══════════════════════════════════════════
// IMPORTAR EL RESUMEN MENSUAL DE BALANZ
// ═══════════════════════════════════════════
// Cargar las operaciones a mano no escala: cruzando la app contra el resumen del broker
// aparecieron meses enteros sin cargar —SPY tenía 48 CEDEARs al 31/07 y en la app había una
// sola compra— y eso hace que todos los números de inversiones mientan.
//
// El PDF de Balanz se puede leer sin ninguna librería, pero hay que saber tres cosas:
//
//  1. El texto vive en streams comprimidos con zlib. El navegador los descomprime solo, con
//     DecompressionStream("deflate"), que es nativo y no necesita CDN.
//  2. La fuente usa un encoding propio DESPLAZADO 29 lugares: "%ROHWR" es "Boleto". Los dígitos
//     caen en caracteres de control, por eso el PDF parece no tener números cuando se lo mira
//     crudo — están, invisibles.
//  3. Las COLUMNAS no están separadas por espacios sino por el kerning del array TJ. Un salto
//     grande entre dos trozos de texto es un cambio de columna. Sin eso, "−3,00" y "0,00" y
//     "17.980,00" quedan pegados en un solo número imposible de partir.

const BALANZ_SEP="\u0001";        // marca de columna que se mete donde el kerning salta
// Medido sobre los resúmenes reales de mayo y agosto: los 184 saltos que caen DENTRO de una
// palabra son ajustes ópticos de la fuente y ninguno llega a 1; los saltos entre columnas
// arrancan en 200. No hay nada en el medio, así que el corte va en la banda vacía, lejos de
// los dos lados. Con -400 se perdían columnas reales: en mayo, el monto y la comisión de un
// boleto venían separados por 389,72 y quedaban pegados ("55.025,00275,13"), lo que corría
// todas las columnas y hacía que el importe se leyera de la columna de la fecha.
const BALANZ_KERN=-50;
const BALANZ_ACENTOS={0xB5:"ó",0xB1:"í",0xB3:"ñ",0xB7:"ú",0xB2:"á",0xB4:"é",0xBC:"ü"};

// ── 1. Sacar los streams del PDF y descomprimirlos ──
async function inflarBalanz(bytes){
  const ds=new DecompressionStream("deflate");
  const escritor=ds.writable.getWriter();
  // Un stream que no es Flate hace fallar a las DOS puntas. Si no se atrapa acá, el rechazo
  // queda sin manejar: ensucia la consola en cada PDF y le llega al banner de error global,
  // que le avisaría al usuario de un problema que no existe.
  escritor.write(bytes).catch(()=>{});
  escritor.close().catch(()=>{});
  const partes=[]; const lector=ds.readable.getReader();
  for(;;){
    const {done, value}=await lector.read();
    if(done) break;
    partes.push(value);
  }
  let largo=0; partes.forEach(p=>largo+=p.length);
  const out=new Uint8Array(largo); let off=0;
  partes.forEach(p=>{ out.set(p, off); off+=p.length; });
  return out;
}

function indiceDe(bytes, aguja, desde){
  outer: for(let i=desde; i<=bytes.length-aguja.length; i++){
    for(let j=0;j<aguja.length;j++) if(bytes[i+j]!==aguja[j]) continue outer;
    return i;
  }
  return -1;
}
const BYTES_STREAM=[115,116,114,101,97,109];             // "stream"
const BYTES_ENDSTREAM=[101,110,100,115,116,114,101,97,109]; // "endstream"

async function streamsDeBalanz(bytes){
  const out=[]; let i=0;
  for(;;){
    const p=indiceDe(bytes, BYTES_STREAM, i);
    if(p<0) break;
    let ini=p+6;
    if(bytes[ini]===13) ini++;
    if(bytes[ini]===10) ini++;
    const fin=indiceDe(bytes, BYTES_ENDSTREAM, ini);
    if(fin<0) break;
    try{ out.push(await inflarBalanz(bytes.slice(ini, fin))); }catch(e){ /* no es Flate */ }
    i=fin+9;
  }
  return out;
}

// ── 2. Tokenizar el content stream en filas con columnas ──
function filasDeStream(s){
  const out=[]; let buf=""; let i=0; const n=s.length;
  const cerrar=()=>{ if(buf) out.push(buf); buf=""; };
  const esDigito=c=>(c>=48&&c<=57);
  while(i<n){
    const c=s[i];
    if(c===0x28){                                  // (
      let j=i+1, prof=1, trozo="";
      while(j<n && prof){
        const b=s[j];
        if(b===0x5C){ trozo+=String.fromCharCode(s[j+1]); j+=2; continue; }
        if(b===0x28) prof++;
        else if(b===0x29){ prof--; if(!prof) break; }
        trozo+=String.fromCharCode(b); j++;
      }
      buf+=trozo; i=j+1; continue;
    }
    if((esDigito(c) || c===0x2D) && buf){          // un número entre trozos: es kerning
      let j=i, txt="";
      while(j<n && (esDigito(s[j])||s[j]===0x2D||s[j]===0x2E)){ txt+=String.fromCharCode(s[j]); j++; }
      if(parseFloat(txt)<=BALANZ_KERN) buf+=BALANZ_SEP;
      i=j; continue;
    }
    const dos=String.fromCharCode(c, s[i+1]||32);
    if(dos==="TJ"||dos==="Tj"||dos==="T*"||dos==="Td"||dos==="TD"||dos==="Tm"||c===0x27||c===0x22){
      cerrar(); i+=2; continue;
    }
    i++;
  }
  cerrar();
  return out;
}

// ── 3. Deshacer el desplazamiento de la fuente ──
function decodificaBalanz(s){
  let out="";
  for(const ch of s){
    if(ch===BALANZ_SEP){ out+=BALANZ_SEP; continue; }
    const c=ch.charCodeAt(0);
    if(BALANZ_ACENTOS[c]){ out+=BALANZ_ACENTOS[c]; continue; }
    const d=c+29;
    if(d>=32 && d<127) out+=String.fromCharCode(d);
  }
  // Ya desplazado, un espacio suelto separa glifos y varios separan palabras.
  return out.replace(/ {2,}/g,"\u0000").replace(/ /g,"").replace(/\u0000/g," ");
}

async function lineasDeBalanz(bytes){
  const out=[];
  for(const s of await streamsDeBalanz(bytes)){
    let tieneTexto=false;
    for(let i=0;i<s.length-1;i++){
      if(s[i]===0x54 && (s[i+1]===0x4A||s[i+1]===0x6A)){ tieneTexto=true; break; }
    }
    if(!tieneTexto) continue;
    for(const f of filasDeStream(s)){
      const t=decodificaBalanz(f).trim();
      if(t) out.push(t);
    }
  }
  return out;
}

// ═══════════════════════════════════════════
// 4. DE LAS FILAS A LAS OPERACIONES
// ═══════════════════════════════════════════
// Una fila puede partirse en dos renglones del PDF (el neto y las fechas se van a la línea
// siguiente), así que se van pegando hasta que termina en DOS fechas, que es como termina
// toda operación completa.
const RE_FECHA_FIN=/(\d{1,2}\/\d{1,2}\/\d{4})\u0001?(\d{1,2}\/\d{1,2}\/\d{4})$/;

function numeroBalanz(txt){
  if(txt==null) return 0;
  const limpio=String(txt).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  const n=parseFloat(limpio);
  return isFinite(n) ? n : 0;
}
function fechaBalanz(txt){
  const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(txt||"");
  if(!m) return "";
  return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
}

// El encabezado de cada sección trae el ticker al final: "...-SPY/8549", "...-BMM A".
function tickerDeEncabezado(linea){
  const m=/-([A-Z0-9]{2,12})\/\d+$/.exec(linea.replace(/\u0001/g,""));
  if(m) return m[1];
  const f=/-([A-Z0-9]{2,12})A?$/.exec(linea.replace(/\u0001/g,"").replace(/\s+/g,""));
  return f ? f[1] : "";
}
function categoriaDeEncabezado(linea){
  const t=linea.toUpperCase();
  if(t.includes("CEDEAR")) return "CEDEARs";
  if(t.includes("BALANZ") || t.includes("FCI")) return "FCI";
  if(t.includes("BONO") || t.includes("LETRA")) return "Bonos";
  return "Acciones";
}

// Después de la cartera, el resumen repite CADA boleto en la sección "Monedas", ahora desde la
// vista del efectivo. Parsearla duplicaba todo y, como esos encabezados no traen ticker, las
// filas se colgaban del último instrumento visto: aparecían rescates de FCI a nombre de YPFD
// por 68 mil millones de pesos.
const RE_MONEDA=/^(Monedas|Pesos-|Dólar|Dólares)/;

// Junta los renglones partidos y devuelve una lista de {cols:[...], seccion:{ticker,cat}}.
function operacionesDeBalanz(lineas){
  const out=[]; let seccion={ticker:"", cat:"Acciones"}; let pend=""; let enMonedas=false;
  const esEncabezado=l=>/-[A-Z0-9]{2,12}\/\d+$/.test(l.replace(/\u0001/g,"")) ||
                        /^(BALANZ|CEDEAR|BONO|LETRA)/.test(l.replace(/\u0001/g,""));
  for(const linea of lineas){
    const plano=linea.replace(/\u0001/g,"");
    if(RE_MONEDA.test(plano)){ enMonedas=true; pend=""; continue; }
    if(esEncabezado(plano) && !/^Boleto|^Liquidación/.test(plano)){
      const tk=tickerDeEncabezado(linea);
      if(tk){ seccion={ticker:tk, cat:categoriaDeEncabezado(plano)}; pend=""; enMonedas=false; continue; }
    }
    if(enMonedas) continue;
    const esFila=/^(Boleto|Liquidación)/.test(pend ? pend.replace(/\u0001/g,"") : plano);
    if(!esFila && !pend) continue;
    pend = pend ? pend+linea : linea;
    if(!RE_FECHA_FIN.test(pend.replace(/\u0001/g,""))) continue;   // sigue en el renglón siguiente
    out.push({cols: pend.split(BALANZ_SEP).map(x=>x.trim()), seccion:{...seccion}});
    pend="";
  }
  return out;
}

// ═══════════════════════════════════════════
// 5. DE LAS OPERACIONES A LOS MOVIMIENTOS
// ═══════════════════════════════════════════
// Boleto: el importe es el NETO, que ya trae comisiones y derechos descontados. Es el número
// que salió o entró de verdad, y es el que la app necesita.
// FCI: el resumen no da el importe en pesos, da cuotapartes y precio. El importe es su producto.
// El neto es la última columna con número antes de las fechas, no una posición fija: un
// boleto de CEDEARs trae una columna de aranceles que un bono no tiene, así que cols[9] era
// el neto en agosto (todo CEDEARs) y la FECHA en mayo (donde hay bonos). De ahí salían los
// "$2.052.026" de AL30, que no eran plata: eran el 20/5/2026 sin las barras.
const RE_FECHA_COL=/^\d{1,2}\/\d{1,2}\/\d{4}$/;
function netoDeBoleto(cols){
  let fin=cols.length;
  while(fin>1 && RE_FECHA_COL.test(cols[fin-1])) fin--;   // saltear concertación y liquidación
  return fin>1 ? cols[fin-1] : "";
}

function movimientoDeBalanz(op){
  const cols=op.cols, cab=cols[0]||"";
  const fechas=cols.filter(c=>/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c));
  const fecha=fechaBalanz(fechas[0]);
  if(!fecha) return null;

  const boleto=/^Boleto\/(\d+)\/(COMPRA|VENTA)\/\d+\/([A-Z0-9]+)\/(\S*)/.exec(cab.replace(/\s+/g,""));
  if(boleto){
    const venta=boleto[2]==="VENTA";
    const ticker=boleto[3];
    const neto=Math.abs(numeroBalanz(netoDeBoleto(cols)));
    if(!neto) return null;
    // La moneda viene al final del encabezado del boleto: "…/AL30/$" o "…/AL30/usd". Es la
    // pata en dólares del MEP, y guardarla en pesos la contaba como si fueran $54 en vez de
    // USD 54.
    const enUSD=/^u\$?s?d?$/i.test(boleto[4]||"");
    const monto=Math.round(neto*100)/100;
    return {
      fecha, tipo:"Inversion", ticker,
      cat: op.seccion.cat==="FCI" ? "Acciones" : op.seccion.cat,
      subcat: `${op.seccion.cat==="FCI" ? "Acciones" : op.seccion.cat} ${venta?"Venta":"Compra"}`,
      importe: enUSD ? 0 : monto,
      importeUSD: enUSD ? monto : 0,
      moneda: enUSD ? "USD" : undefined,
      cuenta:"Balanz", nota:"", refBalanz:boleto[1]
    };
  }

  const fci=/^Liquidaciónde(Suscripción|Rescate)\/(\d+)\//.exec(cab.replace(/\s+/g,""));
  if(fci){
    const rescate=fci[1]==="Rescate";
    const cuotapartes=Math.abs(numeroBalanz(cols[1]));
    const precio=numeroBalanz(cols[3]);
    const importe=Math.round(cuotapartes*precio*100)/100;
    if(!importe) return null;
    return {
      fecha, tipo:"Inversion", ticker: op.seccion.ticker || "FCI",
      cat:"FCI", subcat: rescate ? "FCI Rescate capital" : "FCI Suscripción",
      importe, importeUSD:0, cuenta:"Balanz", nota:"", refBalanz:fci[2]
    };
  }
  return null;
}

async function movimientosDeBalanz(bytes){
  const lineas=await lineasDeBalanz(bytes);
  const out=[];
  for(const op of operacionesDeBalanz(lineas)){
    const m=movimientoDeBalanz(op);
    if(m) out.push(m);
  }
  return out;
}

// ═══════════════════════════════════════════
// 6. NO DUPLICAR
// ═══════════════════════════════════════════
// El mismo resumen se puede subir dos veces, y muchas operaciones ya están cargadas a mano.
// Se descarta lo que ya está: mismo día, mismo ticker y mismo importe al centavo.
// El ticker con el que Balanz nombra la operación. Unificar tickers renombra el movimiento y
// guarda el nombre viejo en tickerOrig; si la identidad mirara el nombre nuevo, volver a subir
// el mismo PDF después de unificar no reconocería nada y duplicaría el historial entero.
function tickerDeOrigen(m){
  return (m && (m.tickerOrig || m.ticker)) || "";
}
function claveDeMov(m){
  return `${String(m.fecha).slice(0,10)}|${tickerDeOrigen(m)}|${Math.round((m.importe||0)*100)}`;
}
// Balanz numera cada operación (el boleto, o la liquidación del FCI) y ese número es único.
// Alcanza para reconocer la MISMA operación leída dos veces —el resumen mensual y el resumen
// de cuenta se pisan— sin confundirla con dos operaciones distintas que casualmente coinciden.
function refDeMov(m){
  return m && m.refBalanz ? `${m.refBalanz}|${tickerDeOrigen(m)}` : "";
}
// Qué falta cargar. Hay dos formas de "ya está" y no son la misma:
//
//   · Por número de operación: es la misma operación, leída de otro PDF. Certeza total.
//   · Por fecha + ticker + importe: es lo único que se puede comparar contra un movimiento
//     cargado a mano, que no tiene número. Pero NO es una identidad: dos rescates de $20.000
//     el mismo día son dos operaciones reales. Por eso se cuentan, no se marcan: si la app
//     tiene uno y el PDF trae dos, falta agregar uno.
//
// Contarlos importa de verdad recién ahora, importando meses viejos de una vez: un resumen
// tiene varios rescates iguales el mismo día, y marcarlos perdía todos menos el primero.
function nuevosDeBalanz(candidatos, lista){
  const cuantosHay={};
  const refsCargadas=new Set();
  (lista||[]).filter(m=>m&&m.tipo==="Inversion").forEach(m=>{
    const k=claveDeMov(m);
    cuantosHay[k]=(cuantosHay[k]||0)+1;
    const r=refDeMov(m);
    if(r) refsCargadas.add(r);
  });

  const out=[], refsVistas=new Set(), sinRefVistas=new Set();
  (candidatos||[]).forEach(m=>{
    const k=claveDeMov(m);
    const r=refDeMov(m);
    if(r){
      if(refsCargadas.has(r) || refsVistas.has(r)) return;   // la misma operación, otra vez
      refsVistas.add(r);
    }else{
      // Sin número no hay forma de distinguir dos operaciones idénticas de una leída dos
      // veces, así que se colapsan: agregar de más es peor que quedarse corto, porque
      // inventa plata que no se movió. El parser siempre numera, así que esto es el borde.
      if(sinRefVistas.has(k)) return;
      sinRefVistas.add(k);
    }
    if(cuantosHay[k]>0){ cuantosHay[k]--; return; }          // ya había una así sin numerar
    out.push(m);
  });
  return out;
}

// Qué está cargado con otro monto. Sin esto no hay forma de arreglar una importación vieja:
// el número de operación coincide, así que la operación se saltea como "ya está" y el monto
// equivocado queda para siempre. Se comparan solo los montos y la moneda —no el ticker, que
// puede haberse unificado a mano, ni la categoría— y siempre se muestra el antes y el después.
function correccionesDeBalanz(candidatos, lista){
  const porRef={};
  (lista||[]).filter(m=>m&&m.tipo==="Inversion"&&m.refBalanz).forEach(m=>{ porRef[refDeMov(m)]=m; });
  const out=[];
  const vistas=new Set();
  (candidatos||[]).forEach(c=>{
    const r=refDeMov(c);
    if(!r || vistas.has(r)) return;
    const viejo=porRef[r];
    if(!viejo) return;
    const mismoArs = Math.round((viejo.importe||0)*100)===Math.round((c.importe||0)*100);
    const mismoUsd = Math.round((viejo.importeUSD||0)*100)===Math.round((c.importeUSD||0)*100);
    if(mismoArs && mismoUsd) return;
    vistas.add(r);
    out.push({mov:viejo, nuevo:c});
  });
  return out;
}
function aplicarCorreccionesBalanz(correcciones){
  (correcciones||[]).forEach(({mov, nuevo})=>{
    mov.importe=nuevo.importe;
    mov.importeUSD=nuevo.importeUSD;
    if(nuevo.moneda) mov.moneda=nuevo.moneda; else delete mov.moneda;
  });
  if(correcciones && correcciones.length) save();
  return (correcciones||[]).length;
}

// ═══════════════════════════════════════════
// LO QUE SE PARECE A ALGO CARGADO A MANO
// ═══════════════════════════════════════════
// Reconocer por fecha + ticker + importe exactos alcanza para el PDF contra sí mismo, pero no
// contra lo que cargaste a mano, donde casi nunca coincide todo: anotaste el bruto y el
// resumen trae el neto (XLK: $12.863,82 contra $12.794,29), pusiste la fecha en que se
// liquidó y el PDF usa la de concertación, redondeaste el monto, o le pusiste al fondo el
// nombre que usás vos y no el de Balanz. En los cuatro casos entraba una copia.
//
// Y la copia no se nota: unificar tickers después junta las dos posiciones en una, así que
// una suscripción de $261.414,64 termina figurando como $522.829,28 sin que nada lo avise.
//
// Por eso acá se buscan parecidos, no iguales. Un parecido no se importa solo: se muestra al
// lado del movimiento tuyo y vos decidís. Errar de más es barato —la operación sigue en el
// PDF y se puede agregar— y errar de menos mete plata que no existe.

function montoComparable(m){
  const usd=Number((m&&m.importeUSD)||0), ars=Number((m&&m.importe)||0);
  return (m&&m.moneda==="USD") || (!ars && usd)
    ? {moneda:"USD", monto:usd}
    : {moneda:"ARS", monto:ars};
}
function diasEntreFechas(a, b){
  const ta=Date.parse(String(a).slice(0,10)), tb=Date.parse(String(b).slice(0,10));
  if(isNaN(ta) || isNaN(tb)) return Infinity;
  return Math.abs(ta-tb)/86400000;
}
// Con el mismo ticker se puede ser generoso: la fecha y el monto bailan por las razones de
// arriba. Con tickers distintos hace falta el mismo día y prácticamente el mismo monto: el
// caso que hay que atrapar es tu fondo con el nombre de Balanz (BCMMA contra BMMA), que es la
// misma operación y cae el mismo día. Aflojar la fecha acá marcaba dos CEDEARs distintos
// comprados en días seguidos por montos parecidos, que no tienen nada que ver.
const PAR_DIAS_MISMO_TICKER=5, PAR_PCT_MISMO_TICKER=0.02;
const PAR_DIAS_OTRO_TICKER=0, PAR_PCT_OTRO_TICKER=0.005;

function parecidoAManual(cand, mov){
  const a=montoComparable(cand), b=montoComparable(mov);
  if(a.moneda!==b.moneda) return false;
  if(!a.monto || !b.monto) return false;
  // Una compra no se confunde con una venta aunque coincida todo lo demás.
  if(isInvSalida(cand)!==isInvSalida(mov)) return false;
  const rel=Math.abs(a.monto-b.monto)/Math.max(Math.abs(a.monto), Math.abs(b.monto));
  const dias=diasEntreFechas(cand.fecha, mov.fecha);
  return tickerDeOrigen(cand)===tickerDeOrigen(mov)
    ? (dias<=PAR_DIAS_MISMO_TICKER && rel<=PAR_PCT_MISMO_TICKER)
    : (dias<=PAR_DIAS_OTRO_TICKER  && rel<=PAR_PCT_OTRO_TICKER);
}

// Solo se miran los movimientos SIN número de operación: los que ya vinieron de un PDF se
// reconocen por el número y no necesitan adivinanza. Cada movimiento tuyo se reclama una vez
// sola, para que dos operaciones del PDF no apunten las dos al mismo.
function parecidosDeBalanz(candidatos, lista){
  const aMano=(lista||[]).filter(m=>m && m.tipo==="Inversion" && !m.refBalanz);
  const usados=new Set();
  const out=[];
  (candidatos||[]).forEach(c=>{
    const mov=aMano.find(m=>!usados.has(m.id) && parecidoAManual(c, m));
    if(!mov) return;
    usados.add(mov.id);
    out.push({nuevo:c, mov});
  });
  return out;
}

// ═══════════════════════════════════════════
// 7. LA PANTALLA
// ═══════════════════════════════════════════
// Nunca se importa de una: primero se muestra qué se encontró y qué se va a agregar, y el
// usuario confirma. Un PDF mal leído no puede ensuciar los datos en silencio.
let balanzPendientes=[];
let balanzCorrecciones=[];
let balanzParecidos=[];
// Las que vos marcaste como "son distintas": son las únicas parecidas que se importan.
let balanzIncluir=new Set();
// Lo que hizo falta para pintar la vista previa, guardado para poder repintarla cuando
// cambiás de opinión sobre un parecido sin tener que volver a leer el PDF.
let balanzLeidos=0, balanzNombre="", balanzFallados=[];

// Varios PDF de una vez: recuperar el histórico son doce resúmenes, y de a uno es un trámite.
// Un archivo que no se puede leer no cancela a los demás — se cuenta y se avisa al final.
async function handleBalanz(input){
  const archivos=input && input.files ? [...input.files] : [];
  if(!archivos.length) return;
  const est=document.getElementById("balanz-status");
  const encontrados=[]; const fallados=[];
  try{
    for(let i=0;i<archivos.length;i++){
      if(est) est.textContent=archivos.length>1
        ? `Leyendo ${i+1} de ${archivos.length}…`
        : "Leyendo el resumen…";
      try{
        const bytes=new Uint8Array(await archivos[i].arrayBuffer());
        const delArchivo=await movimientosDeBalanz(bytes);
        if(delArchivo.length) encontrados.push(...delArchivo);
        else fallados.push(archivos[i].name);
      }catch(err){
        console.error("Balanz:", archivos[i].name, err);
        fallados.push(archivos[i].name);
      }
    }
    // Se ordenan por fecha porque llegan en el orden en que el usuario eligió los archivos,
    // y la lista de la vista previa tiene que leerse como una historia.
    encontrados.sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    balanzPendientes=nuevosDeBalanz(encontrados, movs);
    balanzCorrecciones=correccionesDeBalanz(encontrados, movs);
    balanzParecidos=parecidosDeBalanz(balanzPendientes, movs);
    balanzIncluir=new Set();
    balanzLeidos=encontrados.length;
    balanzNombre=archivos.length===1 ? archivos[0].name : `${archivos.length} archivos`;
    balanzFallados=fallados;
    renderPreviewBalanz(balanzLeidos, balanzNombre, balanzFallados);
  }finally{
    input.value="";
  }
}

function renderPreviewBalanz(totalLeidos, nombre, fallados){
  const est=document.getElementById("balanz-status");
  const prev=document.getElementById("balanz-preview");
  if(!est||!prev) return;
  const malos=fallados||[];
  const avisoMalos = malos.length
    ? ` No pude leer ${malos.length===1 ? escapeHtml(malos[0]) : malos.length+" archivos"}.`
    : "";
  if(!totalLeidos){
    est.textContent=`No encontré operaciones. Tiene que ser el “Resumen mensual Comitente” en PDF.${avisoMalos?" "+malos.join(", "):""}`;
    prev.innerHTML=""; return;
  }
  const repetidos=totalLeidos-balanzPendientes.length;
  est.textContent=`${totalLeidos} ${totalLeidos===1?"operación leída":"operaciones leídas"} de ${nombre}.${avisoMalos}`;
  if(!balanzPendientes.length){
    prev.innerHTML=(balanzCorrecciones.length ? bloqueCorreccionesBalanz() : "")
      + (balanzParecidos.length ? bloqueParecidosBalanz() : "")
      + `<div class="inset"><div class="txt-md">Ya estaban todas cargadas.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">No hay nada nuevo que agregar.</div></div>`;
    return;
  }
  // Balanz usa sus propios tickers: al fondo money market le dice BMMA y la app lo tiene como
  // BCMMA. Si no se avisa, quedan dos posiciones separadas de la misma plata sin que se note.
  const yaConocidos=new Set(movs.filter(m=>m.tipo==="Inversion").map(m=>m.ticker));
  const porTicker={};
  balanzPendientes.forEach(m=>{ porTicker[m.ticker]=(porTicker[m.ticker]||0)+1; });
  const nuevosTickers=Object.keys(porTicker).filter(t=>!yaConocidos.has(t));
  const resumen=Object.entries(porTicker).sort((a,b)=>b[1]-a[1])
    .map(([t,n])=>`${escapeHtml(t)} (${n})`).join(" · ");
  const avisoTickers = nuevosTickers.length
    ? `<div class="txt-xs" style="color:var(--warning);margin-top:6px">⚠️ ${nuevosTickers.map(escapeHtml).join(", ")} ${nuevosTickers.length===1?"no estaba":"no estaban"} en la app. Si es el mismo activo con otro nombre, va a quedar como una posición aparte.</div>`
    : "";
  // Importando el histórico entero la lista de operaciones no se puede leer de un vistazo, y
  // lo que hay que poder verificar es otra cosa: que estén los meses que esperabas.
  const porMes={};
  balanzPendientes.forEach(m=>{ const k=String(m.fecha).slice(0,7); porMes[k]=(porMes[k]||0)+1; });
  const meses=Object.keys(porMes).sort();
  const detalleMeses = meses.length>1
    ? `<div class="txt-xs txt-muted" style="margin-top:6px">${meses.map(k=>`${escapeHtml(mesLbl(k))}: ${porMes[k]}`).join(" · ")}</div>`
    : "";
  const van=aImportarBalanz();
  const frenadas=balanzPendientes.length-van.length;
  prev.innerHTML=(balanzCorrecciones.length ? bloqueCorreccionesBalanz() : "")
    + (balanzParecidos.length ? bloqueParecidosBalanz() : "")
    + `<div class="inset mb-10">
      <div class="txt-md txt-strong">${van.length} ${van.length===1?"operación para agregar":"operaciones para agregar"}${meses.length>1?` en ${meses.length} meses`:""}</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">${resumen}${repetidos?` · ${repetidos} ya ${repetidos===1?"estaba":"estaban"} cargada${repetidos===1?"":"s"}`:""}${frenadas?` · ${frenadas} frenada${frenadas===1?"":"s"} por parecido`:""}</div>
      ${detalleMeses}
      ${avisoTickers}
    </div>`
    + van.slice(0,12).map(m=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div class="u-flex1 u-min0">
          <div class="txt-md">${escapeHtml(m.ticker)} <span class="txt-xs txt-muted">${escapeHtml(m.subcat)}</span></div>
          <div class="txt-xs txt-muted">${escapeHtml(m.fecha)}</div>
        </div>
        <div class="txt-md txt-strong" style="white-space:nowrap">${montoLeidoBalanz(m)}</div>
      </div>`).join("")
    + (van.length>12 ? `<div class="txt-xs txt-muted" style="margin-top:6px">…y ${van.length-12} más.</div>` : "")
    + (van.length
        ? `<button class="btn-primary" style="width:100%;margin-top:12px" onclick="confirmarImportBalanz()">Agregar ${van.length} ${van.length===1?"operación":"operaciones"}</button>`
        : `<div class="inset txt-xs txt-muted">Todas las operaciones nuevas se parecen a algo que ya tenías. Si alguna es distinta, marcala arriba.</div>`);
}

// Corregir NO es importar: se muestra aparte, con el monto viejo al lado del nuevo, y se
// confirma por separado. Pisar montos ya guardados sin que se vean es justo lo que no puede
// pasar en silencio.
// Una operación en dólares tiene importe 0 y el monto en importeUSD: mostrarla con fmtS()
// la dejaba como "$0,00" en la vista previa, justo donde hay que poder controlarla.
function montoLeidoBalanz(m){
  return (m && (m.moneda==="USD" || (!m.importe && m.importeUSD)))
    ? "USD "+(m.importeUSD||0).toFixed(2)
    : fmtS((m&&m.importe)||0);
}

function bloqueCorreccionesBalanz(){
  const filas=balanzCorrecciones.slice(0,8).map(({mov, nuevo})=>{
    const antes=montoLeidoBalanz(mov), despues=montoLeidoBalanz(nuevo);
    return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div class="txt-md">${escapeHtml(mov.ticker||"")} <span class="txt-xs txt-muted">${escapeHtml(mov.subcat||"")}</span></div>
        <div class="txt-xs txt-muted">${escapeHtml(String(mov.fecha||"").slice(0,10))}</div>
      </div>
      <div class="txt-xs" style="white-space:nowrap;text-align:right">
        <span class="txt-muted" style="text-decoration:line-through">${antes}</span><br>
        <span class="txt-md txt-strong">${despues}</span>
      </div>
    </div>`;
  }).join("");
  const n=balanzCorrecciones.length;
  return `<div class="inset mb-10">
      <div class="txt-md txt-strong" style="color:var(--warning)">${n} ${n===1?"operación ya cargada tiene":"operaciones ya cargadas tienen"} otro monto</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Mismo número de operación de Balanz, distinto importe. Si las importaste con una versión vieja de la app, esto las deja como figuran en el resumen.</div>
    </div>`
    + filas
    + (n>8 ? `<div class="txt-xs txt-muted" style="margin-top:6px">…y ${n-8} más.</div>` : "")
    + `<button class="btn-sm" style="width:100%;margin:10px 0 14px" onclick="confirmarCorreccionBalanz()">Corregir ${n} ${n===1?"monto":"montos"}</button>`;
}

function confirmarCorreccionBalanz(){
  const n=aplicarCorreccionesBalanz(balanzCorrecciones);
  if(!n) return;
  balanzCorrecciones=[];
  showToast(`${n} ${n===1?"monto corregido":"montos corregidos"} ✓`);
  const est=document.getElementById("balanz-status");
  if(est) est.textContent=`Listo: ${n} ${n===1?"monto corregido":"montos corregidos"}.`;
  const prev=document.getElementById("balanz-preview");
  if(prev) prev.innerHTML="";
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderInv==="function") renderInv();
  if(typeof renderDash==="function") renderDash();
}

function bloqueParecidosBalanz(){
  const n=balanzParecidos.length;
  const filas=balanzParecidos.map(({nuevo, mov})=>{
    const k=claveParecido(nuevo);
    const incluida=balanzIncluir.has(k);
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div class="u-flex1 u-min0">
          <div class="txt-xs txt-muted">Ya tenías</div>
          <div class="txt-md">${escapeHtml(mov.ticker||"")} · ${escapeHtml(String(mov.fecha||"").slice(0,10))}</div>
        </div>
        <div class="txt-md txt-strong" style="white-space:nowrap">${montoLeidoBalanz(mov)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px">
        <div class="u-flex1 u-min0">
          <div class="txt-xs txt-muted">El resumen trae</div>
          <div class="txt-md">${escapeHtml(nuevo.ticker||"")} · ${escapeHtml(String(nuevo.fecha||"").slice(0,10))}</div>
        </div>
        <div class="txt-md txt-strong" style="white-space:nowrap">${montoLeidoBalanz(nuevo)}</div>
      </div>
      <button class="btn-sm" style="width:100%;margin-top:8px" onclick="alternarParecido(${attrJS(k)})">
        ${incluida ? "Son distintas: se va a agregar ✓" : "Es la misma: no se agrega"}
      </button>
    </div>`;
  }).join("");
  return `<div class="inset mb-10">
      <div class="txt-md txt-strong" style="color:var(--warning)">${n} ${n===1?"se parece":"se parecen"} a algo que cargaste a mano</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">No coinciden exacto —el resumen trae el neto, otra fecha o el nombre que usa Balanz— así que no puedo saberlo solo. Por las dudas <strong>no se agregan</strong>: si alguna es una operación distinta, marcala.</div>
    </div>`
    + filas
    + `<div style="height:14px"></div>`;
}

function claveParecido(m){
  return `${refDeMov(m)||claveDeMov(m)}`;
}
function aImportarBalanz(){
  const frenados=new Set(balanzParecidos.map(x=>claveParecido(x.nuevo)));
  return balanzPendientes.filter(m=>{
    const k=claveParecido(m);
    return !frenados.has(k) || balanzIncluir.has(k);
  });
}
function alternarParecido(clave){
  if(balanzIncluir.has(clave)) balanzIncluir.delete(clave); else balanzIncluir.add(clave);
  renderPreviewBalanz(balanzLeidos, balanzNombre, balanzFallados);
}

function confirmarImportBalanz(){
  const van=aImportarBalanz();
  if(!van.length) return;
  const cuantos=van.length;
  let id=Date.now();
  van.forEach(m=>{ movs.push({...m, id:id++}); });
  balanzPendientes=[]; balanzParecidos=[]; balanzIncluir=new Set();
  save();
  showToast(`${cuantos} ${cuantos===1?"operación agregada":"operaciones agregadas"} ✓`);
  const prev=document.getElementById("balanz-preview");
  const est=document.getElementById("balanz-status");
  if(prev) prev.innerHTML="";
  if(est) est.textContent=`Listo: ${cuantos} ${cuantos===1?"operación agregada":"operaciones agregadas"}.`;
  if(typeof renderMovs==="function") renderMovs();
  if(typeof renderInv==="function") renderInv();
  if(typeof renderDash==="function") renderDash();
}
