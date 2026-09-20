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
const BALANZ_KERN=-400;           // a partir de acá, el salto es un cambio de columna
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
function movimientoDeBalanz(op){
  const cols=op.cols, cab=cols[0]||"";
  const fechas=cols.filter(c=>/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c));
  const fecha=fechaBalanz(fechas[0]);
  if(!fecha) return null;

  const boleto=/^Boleto\/(\d+)\/(COMPRA|VENTA)\/\d+\/([A-Z0-9]+)\//.exec(cab.replace(/\s+/g,""));
  if(boleto){
    const venta=boleto[2]==="VENTA";
    const ticker=boleto[3];
    const neto=Math.abs(numeroBalanz(cols[9]!==undefined ? cols[9] : cols[cols.length-3]));
    if(!neto) return null;
    return {
      fecha, tipo:"Inversion", ticker,
      cat: op.seccion.cat==="FCI" ? "Acciones" : op.seccion.cat,
      subcat: `${op.seccion.cat==="FCI" ? "Acciones" : op.seccion.cat} ${venta?"Venta":"Compra"}`,
      importe: Math.round(neto*100)/100, importeUSD:0,
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
function claveDeMov(m){
  return `${String(m.fecha).slice(0,10)}|${m.ticker||""}|${Math.round((m.importe||0)*100)}`;
}
function nuevosDeBalanz(candidatos, lista){
  const yaEstan=new Set((lista||[]).filter(m=>m&&m.tipo==="Inversion").map(claveDeMov));
  const out=[]; const vistos=new Set();
  candidatos.forEach(m=>{
    const k=claveDeMov(m);
    if(yaEstan.has(k) || vistos.has(k)) return;
    vistos.add(k); out.push(m);
  });
  return out;
}

// ═══════════════════════════════════════════
// 7. LA PANTALLA
// ═══════════════════════════════════════════
// Nunca se importa de una: primero se muestra qué se encontró y qué se va a agregar, y el
// usuario confirma. Un PDF mal leído no puede ensuciar los datos en silencio.
let balanzPendientes=[];

async function handleBalanz(input){
  const archivo=input && input.files && input.files[0];
  if(!archivo) return;
  const est=document.getElementById("balanz-status");
  if(est) est.textContent="Leyendo el resumen…";
  try{
    const bytes=new Uint8Array(await archivo.arrayBuffer());
    const encontrados=await movimientosDeBalanz(bytes);
    balanzPendientes=nuevosDeBalanz(encontrados, movs);
    renderPreviewBalanz(encontrados.length, archivo.name);
  }catch(err){
    console.error("Balanz:", err);
    if(est) est.textContent="No se pudo leer el archivo. ¿Es el Resumen mensual en PDF?";
  }finally{
    input.value="";
  }
}

function renderPreviewBalanz(totalLeidos, nombre){
  const est=document.getElementById("balanz-status");
  const prev=document.getElementById("balanz-preview");
  if(!est||!prev) return;
  if(!totalLeidos){
    est.textContent="No encontré operaciones en ese PDF. Tiene que ser el “Resumen mensual Comitente”.";
    prev.innerHTML=""; return;
  }
  const repetidos=totalLeidos-balanzPendientes.length;
  est.textContent=`${totalLeidos} ${totalLeidos===1?"operación leída":"operaciones leídas"} de ${nombre}.`;
  if(!balanzPendientes.length){
    prev.innerHTML=`<div class="inset"><div class="txt-md">Ya estaban todas cargadas.</div>
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
  prev.innerHTML=`<div class="inset mb-10">
      <div class="txt-md txt-strong">${balanzPendientes.length} ${balanzPendientes.length===1?"operación nueva":"operaciones nuevas"}</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">${resumen}${repetidos?` · ${repetidos} ya ${repetidos===1?"estaba":"estaban"} cargada${repetidos===1?"":"s"}`:""}</div>
      ${avisoTickers}
    </div>`
    + balanzPendientes.slice(0,12).map(m=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div class="u-flex1 u-min0">
          <div class="txt-md">${escapeHtml(m.ticker)} <span class="txt-xs txt-muted">${escapeHtml(m.subcat)}</span></div>
          <div class="txt-xs txt-muted">${escapeHtml(m.fecha)}</div>
        </div>
        <div class="txt-md txt-strong" style="white-space:nowrap">${fmtS(m.importe)}</div>
      </div>`).join("")
    + (balanzPendientes.length>12 ? `<div class="txt-xs txt-muted" style="margin-top:6px">…y ${balanzPendientes.length-12} más.</div>` : "")
    + `<button class="btn-primary" style="width:100%;margin-top:12px" onclick="confirmarImportBalanz()">Agregar ${balanzPendientes.length} ${balanzPendientes.length===1?"operación":"operaciones"}</button>`;
}

function confirmarImportBalanz(){
  if(!balanzPendientes.length) return;
  const cuantos=balanzPendientes.length;
  let id=Date.now();
  balanzPendientes.forEach(m=>{ movs.push({...m, id:id++}); });
  balanzPendientes=[];
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
