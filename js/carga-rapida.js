// ═══════════════════════════════════════════
// CARGA RÁPIDA POR TEXTO
// ═══════════════════════════════════════════
// Escribís una frase corta —"nafta 15000 visa ayer", "sueldo 1.200.000 galicia", "netflix usd 5,99 mastercard"— y la app arma el
// movimiento: tipo, monto, moneda, fecha, cuenta o tarjeta, cuotas y categoría (con la misma sugerencia que ya usa la nota).
// NO guarda nada: rellena el formulario de Cargar para que lo revises y toques "Guardar".

const CR_RELLENO=new Set(["en","con","de","del","por","pague","pagué","gaste","gasté","compre","compré","pago","gasto","a","mi","la","el","un","una","me","cobre","cobré","use","usé"]);
const CR_INGRESO=/^(sueldo|salario|haberes|aguinaldo|bono|honorarios|cobre|ingreso|cobro|devolucion|reintegro)$/;
// Inversiones: palabras que dicen QUÉ se compró o vendió y cuál es la operación.
const CR_ACTIVO={accion:"Acciones", acciones:"Acciones", cedear:"CEDEARs", cedears:"CEDEARs", etf:"CEDEARs", fci:"FCI", caucion:"Caución", cripto:"Cripto", criptomoneda:"Cripto", bitcoin:"Cripto", btc:"Cripto", eth:"Cripto",
  bonos:"Bonos USD", on:"ONs Corporativas", ons:"ONs Corporativas", lecap:"Otros", letra:"Otros"};
const CR_OP_VENTA=new Set(["venta","vendi","vendimos","vender","rescate","rescate","rescati"]);
const CR_OP_COMPRA=new Set(["compra","compre","compramos","comprar","suscripcion","suscribi","suscribo"]);
// La opción de subcategoría de inversión que corresponde a la operación ("Venta", "Compra SPY", "Rescate capital"…).
function crElegirSubInversion(opciones, op, ticker){
  const lista=(opciones||[]).map(o=>({o, n:crNorm(o)}));
  const claves=op==="venta" ? ["venta","rescate","tomada"] : ["compra","suscripcion","colocada"];
  if(op==="compra" && ticker){ const t=lista.find(x=>x.n==="compra "+crNorm(ticker)); if(t) return t.o; }
  for(const k of claves){ const exacta=lista.find(x=>x.n===k); if(exacta) return exacta.o; }
  for(const k of claves){ const parcial=lista.find(x=>x.n.startsWith(k)); if(parcial) return parcial.o; }
  // Subcategorías con el nombre de la categoría delante, como las que se crean a mano ("Acciones Venta", "Acciones Compra")
  for(const k of claves){ const palabra=lista.find(x=>x.n.split(/\s+/).includes(k)); if(palabra) return palabra.o; }
  return "";
}

const CR_PLACEHOLDER_CUENTAS=["cuentas","tarjetas de credito"];

// Minúsculas y sin acentos, pero CONSERVANDO los puntos y comas de los números (normalizarTexto los saca).
const crNorm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.,;:!?¡¿]+$/,"");
const crISO=(y,m,d)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const crSumarDias=(iso,n)=>{ const [y,m,d]=iso.split("-").map(Number); const t=new Date(Date.UTC(y,m-1,d+n)); return crISO(t.getUTCFullYear(), t.getUTCMonth()+1, t.getUTCDate()); };
const crDiasDelMes=(y,m)=>new Date(y,m,0).getDate();

// Un número en formato argentino ("15.000", "1.200.000,50", "15000", "12,5", "5,99") o con sufijo ("15k", "1,5k"). null si no es un monto.
function crLeerMonto(n){
  let t=n.replace(/^\$|^u\$s|^us\$/,"");
  let mult=1;
  const suf=/^(.*?)(k|mil)$/.exec(t);
  if(suf && suf[1]){ t=suf[1]; mult=1000; }
  let v=null;
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) v=parseFloat(t.replace(/\./g,"").replace(",","."));
  else if(/^\d+(,\d+)?$/.test(t)) v=parseFloat(t.replace(",","."));
  else if(/^\d+\.\d{1,2}$/.test(t)) v=parseFloat(t);   // 12.5 / 5.99: decimal con punto
  if(v===null || !isFinite(v)) return null;
  return {valor:Math.round(v*mult*100)/100, explicito:/^\$/.test(n)||mult!==1};
}

// Interpreta `texto`. ctx = {hoy:"YYYY-MM-DD", cuentas:[…], tarjetas:[…], sugerir:(texto,tipo)=>{cat,subcat}|null, cats:tipo=>({cat:[subs]})}.
// Devuelve {ok, motivo, tipo, importe, moneda, fecha, cuenta, tarjeta, cuotas, nota, cat, subcat, entendido:[…]}.
function interpretarCargaRapida(texto, ctx){
  const out={ok:false, motivo:"", tipo:"Gasto", importe:0, moneda:"ARS", fecha:ctx.hoy, cuenta:"", tarjeta:"", cuotas:0, nota:"", cat:"", subcat:"", ticker:"", operacion:"", entendido:[]};
  const toks=String(texto||"").trim().split(/\s+/).filter(Boolean).map(o=>({o, n:crNorm(o), u:false}));
  if(!toks.length){ out.motivo="Escribí algo, por ejemplo: nafta 15000 visa ayer"; return out; }
  const usar=(i,len)=>{ for(let k=0;k<len;k++) toks[i+k].u=true; };
  const libre=i=>i>=0 && i<toks.length && !toks[i].u;
  const [hy,hm,hd]=ctx.hoy.split("-").map(Number);

  // 1. Moneda
  toks.forEach((t,i)=>{ if(!t.u && /^(usd|u\$s|us\$|u\$d|dolar|dolares|dollars?)$/.test(t.n)){ out.moneda="USD"; usar(i,1); } });

  // 2. Cuotas: "3 cuotas", "en 6 cuotas"
  for(let i=0;i<toks.length-1;i++){
    if(libre(i) && /^\d{1,2}$/.test(toks[i].n) && libre(i+1) && /^cuotas?$/.test(toks[i+1].n)){
      out.cuotas=parseInt(toks[i].n,10); usar(i,2); if(libre(i-1) && toks[i-1].n==="en") usar(i-1,1); break;
    }
  }

  // 3. Fecha
  let fechaTxt="";
  for(let i=0;i<toks.length;i++){
    if(!libre(i)) continue;
    const n=toks[i].n;
    let m;
    if(n==="hoy"){ usar(i,1); fechaTxt="hoy"; }
    else if(n==="ayer"){ out.fecha=crSumarDias(ctx.hoy,-1); usar(i,1); fechaTxt="ayer"; }
    else if(n==="anteayer"){ out.fecha=crSumarDias(ctx.hoy,-2); usar(i,1); fechaTxt="anteayer"; }
    else if(n==="antes" && libre(i+1) && toks[i+1].n==="de" && libre(i+2) && toks[i+2].n==="ayer"){ out.fecha=crSumarDias(ctx.hoy,-2); usar(i,3); fechaTxt="anteayer"; }
    else if(n==="hace" && libre(i+1) && /^\d{1,3}$/.test(toks[i+1].n) && libre(i+2) && /^dias?$/.test(toks[i+2].n)){ out.fecha=crSumarDias(ctx.hoy,-parseInt(toks[i+1].n,10)); usar(i,3); fechaTxt=`hace ${toks[i+1].n} días`; }
    else if((m=/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/.exec(n))){
      const d=+m[1], mes=+m[2]; let y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):hy;
      if(mes>=1&&mes<=12 && d>=1 && d<=crDiasDelMes(y,mes)){
        if(!m[3] && crISO(y,mes,d)>ctx.hoy) y--;   // "28/12" en enero es de diciembre del año pasado
        out.fecha=crISO(y,mes,d); usar(i,1); fechaTxt=`${d}/${mes}`;
      }
    }
    else if(n==="el" && libre(i+1) && /^\d{1,2}$/.test(toks[i+1].n) && +toks[i+1].n>=1 && +toks[i+1].n<=31 && !(libre(i+2) && /^cuotas?$/.test(toks[i+2].n))){
      let y=hy, mes=hm; const d=+toks[i+1].n;
      if(d>hd){ mes--; if(mes<1){ mes=12; y--; } }
      out.fecha=crISO(y,mes,Math.min(d,crDiasDelMes(y,mes))); usar(i,2); fechaTxt=`el ${d}`;
    }
  }

  // 4. Tarjeta y cuenta: se buscan por nombre (más palabras primero) entre lo que ya tenés cargado.
  const ALIAS={master:"mastercard", mc:"mastercard"};
  // Se prueban todos los nombres juntos, los de más palabras primero: así "Naranja X" (cuenta) gana sobre "Naranja" (tarjeta).
  const nombres=[
    ...(ctx.tarjetas||[]).filter(t=>crNorm(t)!=="otra").map(nombre=>({nombre, clase:"tarjeta"})),   // "Otra" es una palabra común: no sirve para reconocer
    ...(ctx.cuentas||[]).filter(c=>!CR_PLACEHOLDER_CUENTAS.includes(crNorm(c))).map(nombre=>({nombre, clase:"cuenta"}))
  ].map(x=>({...x, palabras:crNorm(x.nombre).split(/\s+/)})).sort((a,b)=>b.palabras.length-a.palabras.length);
  for(const {nombre, clase, palabras} of nombres){
    if(out[clase]) continue;
    for(let i=0;i<=toks.length-palabras.length && !out[clase];i++){
      let ok=true;
      for(let k=0;k<palabras.length;k++){ const t=toks[i+k]; const n=ALIAS[t.n] && crNorm(nombre)===ALIAS[t.n] ? ALIAS[t.n] : t.n; if(t.u || n!==palabras[k]){ ok=false; break; } }
      if(ok){ usar(i,palabras.length); out[clase]=nombre; }
    }
  }

  // 5. Monto: el que lleva $ o sufijo; si no, el más grande. "15 mil" / "1,2 palos" cuentan como un solo monto.
  const cand=[];
  toks.forEach((t,i)=>{
    if(t.u) return;
    const r=crLeerMonto(t.n);
    if(!r) return;
    let valor=r.valor, largo=1, explicito=r.explicito;
    if(libre(i+1) && /^mil$/.test(toks[i+1].n)){ valor=Math.round(valor*1000*100)/100; largo=2; explicito=true; }
    else if(libre(i+1) && /^(palo|palos|millon|millones)$/.test(toks[i+1].n)){ valor=Math.round(valor*1e6*100)/100; largo=2; explicito=true; }
    cand.push({i, largo, valor, explicito});
  });
  if(cand.length){
    const elegido=cand.filter(c=>c.explicito).sort((a,b)=>b.valor-a.valor)[0] || cand.sort((a,b)=>b.valor-a.valor)[0];
    if(elegido.valor>0){ out.importe=elegido.valor; usar(elegido.i, elegido.largo); }
  }

  // 6. Inversión: un activo que conocés por su ticker ("ypf", "spy") o que se nombra ("acción", "cedear", "fci"), con su operación.
  let hayInv=false, activo="", opInv="";
  if(!out.tarjeta && !(out.cuotas>1)){
    const conocidos=ctx.tickers||[];
    toks.forEach((t,i)=>{
      if(t.u) return;
      if(CR_OP_VENTA.has(t.n)){ opInv=opInv||"venta"; usar(i,1); }
      else if(CR_OP_COMPRA.has(t.n)){ opInv=opInv||"compra"; usar(i,1); }
    });
    toks.forEach((t,i)=>{
      if(t.u || out.ticker) return;
      const k=conocidos.find(c=>c.clave===t.n);
      if(k){ out.ticker=k.ticker; activo=k.cat||""; usar(i,1); hayInv=true; }
    });
    toks.forEach((t,i)=>{
      if(t.u || !CR_ACTIVO[t.n]) return;
      hayInv=true; activo=activo||CR_ACTIVO[t.n]; usar(i,1);
      // "acción ggal": lo que sigue a la palabra del activo es el ticker, si todavía no se reconoció uno
      const sig=toks[i+1];
      if(!out.ticker && sig && !sig.u && /^[a-z][a-z0-9]{1,6}$/.test(sig.n) && !CR_RELLENO.has(sig.n) && !CR_OP_VENTA.has(sig.n) && !CR_OP_COMPRA.has(sig.n)){
        const k=conocidos.find(c=>c.clave===sig.n);
        out.ticker=k ? k.ticker : sig.n.toUpperCase(); if(k && k.cat) activo=k.cat; usar(i+1,1);
      }
    });
    if(!hayInv){ /* una "venta" o "compra" sin activo no es una inversión: esas palabras vuelven a la descripción */
      toks.forEach(t=>{ if(CR_OP_VENTA.has(t.n)||CR_OP_COMPRA.has(t.n)) t.u=false; });
      opInv="";
    }
  }
  // 7. Tipo
  const restantes=toks.filter(t=>!t.u);
  if(out.tarjeta || out.cuotas>1) out.tipo="Tarjeta";
  else if(hayInv) out.tipo="Inversion";
  else if(restantes.some(t=>CR_INGRESO.test(t.n))) out.tipo="Ingreso";

  // 8. Descripción: lo que sobra, sin palabras de relleno en los bordes
  let sobra=toks.filter(t=>!t.u);
  while(sobra.length && CR_RELLENO.has(sobra[0].n)) sobra=sobra.slice(1);
  while(sobra.length && CR_RELLENO.has(sobra[sobra.length-1].n)) sobra=sobra.slice(0,-1);
  let nota=sobra.map(t=>t.o).join(" ").replace(/[.,;:]+$/,"").trim();
  if(nota) nota=nota.charAt(0).toUpperCase()+nota.slice(1);
  out.nota=nota;

  // 9. Categoría (la misma sugerencia de la nota: tu historial primero, después reglas conocidas)
  if(out.tipo==="Inversion"){
    const catsInv=ctx.cats ? ctx.cats("Inversion") : null;
    out.operacion=opInv||"compra";
    if(activo && (!catsInv || catsInv[activo])) out.cat=activo;
    if(out.cat && catsInv) out.subcat=crElegirSubInversion(catsInv[out.cat], out.operacion, out.ticker);
    out.nota=nota;   // lo que sobra, si algo: el ticker ya identifica el activo
  } else {
    const tipoCat=out.tipo==="Tarjeta" ? "Gasto" : out.tipo;
    const sug=nota && ctx.sugerir ? ctx.sugerir(nota, tipoCat) : null;
    const catsDe=ctx.cats ? ctx.cats(out.tipo==="Tarjeta"?"Tarjeta":out.tipo) : null;
    if(sug && sug.cat && (!catsDe || catsDe[sug.cat])){ out.cat=sug.cat; out.subcat=(sug.subcat && catsDe && (catsDe[sug.cat]||[]).includes(sug.subcat)) ? sug.subcat : ""; }
  }

  if(!(out.importe>0)){ out.motivo="No encontré el monto. Probá con algo como: nafta 15000 visa ayer"; return out; }
  out.ok=true;
  const m$=out.moneda==="USD" ? `USD ${String(out.importe).replace(".",",")}` : fmtS(out.importe);
  const tipoTxt=out.tipo==="Inversion" ? `Inversión · ${out.operacion==="venta"?"Venta":"Compra"}${out.ticker?" "+out.ticker:""}` : (out.tipo==="Tarjeta"&&out.cuotas>1 ? `Tarjeta en ${out.cuotas} cuotas` : out.tipo);
  out.entendido=[tipoTxt, m$, out.cat?(out.cat+(out.subcat?` › ${out.subcat}`:"")):"", out.tarjeta, out.cuenta, fechaTxt||"hoy"].filter(Boolean);
  return out;
}

// ── Pantalla ──
// Los tickers que ya usaste en inversiones ("ypf" → YPFD, con la categoría en que lo cargaste), el más reciente primero.
function tickersConocidos(lista){
  const vistos=new Set(), out=[];
  (lista||[]).forEach(m=>{
    if(m.tipo!=="Inversion" || !m.ticker) return;
    [m.ticker, m.tickerOrig].filter(Boolean).forEach(t=>{ const clave=crNorm(t); if(clave && !vistos.has(clave)){ vistos.add(clave); out.push({clave, ticker:String(m.ticker).toUpperCase(), cat:m.cat||""}); } });
  });
  return out;
}
function contextoCargaRapida(){
  return {hoy:currentYMD(), cuentas:getCuentas(), tarjetas:getTarjetas(), tickers:tickersConocidos(movs), sugerir:(t,tp)=>buscarSugerencia(t,tp), cats:tp=>getCats(tp)};
}
function crPonerSelect(id, valor){
  const sel=document.getElementById(id);
  if(!sel || !sel.options || !valor) return false;
  if(![...sel.options].some(o=>o.value===valor)) return false;
  sel.value=valor; sel.dispatchEvent(new Event("change"));
  return true;
}
function crPonerMonto(id, valor, formatear){
  const el=document.getElementById(id);
  if(!el) return;
  el.value=Number.isInteger(valor) ? String(valor) : String(valor).replace(".",",");
  if(typeof aplicarMascaraMiles==="function" && formatear) aplicarMascaraMiles(el, formatear);
}
function crPonerFecha(id, iso){
  const el=document.getElementById(id);
  if(!el) return;
  el.value=iso;
  if(typeof refrescarFechaUI==="function") refrescarFechaUI(id);
}
// Rellena el formulario de Cargar con lo interpretado. No guarda.
function aplicarCargaRapida(r){
  setTipo(r.tipo);
  if(r.tipo==="Inversion"){
    crPonerMonto("inv-importe", r.importe, typeof formatearNumeroConMiles!=="undefined" ? formatearNumeroConMiles : null);
    if(typeof pillMoneda==="function") pillMoneda("inv-moneda", r.moneda);
    if(crPonerSelect("inv-cat", r.cat)){ if(typeof updateInvSubcats==="function") updateInvSubcats(); crPonerSelect("inv-subcat", r.subcat); if(typeof buildInvCatChips==="function") buildInvCatChips(); }
    const tk=document.getElementById("inv-ticker"); if(tk){ tk.value=r.ticker; if(typeof buildTickerRecientes==="function") buildTickerRecientes(); }
    crPonerSelect("inv-cuenta", r.cuenta);
    crPonerFecha("inv-fecha", r.fecha);
    const nt=document.getElementById("inv-nota"); if(nt) nt.value=r.nota;
  } else if(r.tipo==="Tarjeta"){
    document.getElementById("tc-desc").value=r.nota || r.cat || "Compra con tarjeta";
    crPonerMonto("tc-total", r.importe, typeof formatearNumeroConMiles!=="undefined" ? formatearNumeroConMiles : null);
    if(typeof pillMoneda==="function") pillMoneda("tc-moneda", r.moneda);
    crPonerSelect("tc-tarjeta", r.tarjeta);
    crPonerSelect("tc-cat", r.cat);
    crPonerSelect("tc-cuenta", r.cuenta);
    if(typeof pickCuotas==="function") pickCuotas(r.cuotas>0 ? r.cuotas : 1);
    crPonerFecha("tc-fecha", r.fecha);
    if(typeof calcCuota==="function") calcCuota();
  } else {
    crPonerMonto("inp-importe", r.importe, typeof formatearConMiles!=="undefined" ? formatearConMiles : null);
    if(typeof pillMoneda==="function") pillMoneda("inp-moneda", r.moneda);
    document.getElementById("inp-nota").value=r.nota;
    if(crPonerSelect("inp-cat", r.cat) && typeof updateSubcats==="function"){ updateSubcats(); crPonerSelect("inp-subcat", r.subcat); }
    crPonerSelect("inp-cuenta", r.cuenta);
    crPonerFecha("inp-fecha", r.fecha);
    if(typeof sugerirAhorroDeMeta==="function") sugerirAhorroDeMeta();
  }
}
function cargaRapida(){
  const inp=document.getElementById("carga-rapida"), res=document.getElementById("carga-rapida-res");
  if(!inp) return null;
  const r=interpretarCargaRapida(inp.value, contextoCargaRapida());
  if(res){
    res.style.display="block";
    res.innerHTML=r.ok ? `✓ Entendí: <strong>${r.entendido.map(escapeHtml).join(" · ")}</strong>${r.nota?` · “${escapeHtml(r.nota)}”`:""}. Revisá y tocá <strong>Guardar</strong>.` : escapeHtml(r.motivo);
    res.style.color=r.ok ? "var(--save)" : "var(--danger)";
  }
  if(r.ok){
    aplicarCargaRapida(r);
    inp.value="";
    // Si lo que quedó elegido en la operación no coincide con lo entendido, se avisa en vez de dejar un dato equivocado a la vista.
    if(r.tipo==="Inversion" && res){
      const sub=crNorm((document.getElementById("inv-subcat")||{}).value||"");
      const ok=r.operacion==="venta" ? /venta|rescate|tomada/.test(sub) : /compra|suscripcion|colocada/.test(sub);
      if(!ok){ res.innerHTML+=` <strong style="color:var(--warning)">⚠️ Elegí la operación (${r.operacion==="venta"?"venta":"compra"}) a mano: no encontré la opción en esa categoría.</strong>`; }
    }
  }
  return r;
}
