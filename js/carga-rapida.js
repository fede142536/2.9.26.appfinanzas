// ═══════════════════════════════════════════
// CARGA RÁPIDA POR TEXTO
// ═══════════════════════════════════════════
// Escribís una frase corta —"nafta 15000 visa ayer", "sueldo 1.200.000 galicia", "netflix usd 5,99 mastercard"— y la app arma el
// movimiento: tipo, monto, moneda, fecha, cuenta o tarjeta, cuotas y categoría (con la misma sugerencia que ya usa la nota).
// NO guarda nada: rellena el formulario de Cargar para que lo revises y toques "Guardar".

const CR_RELLENO=new Set(["en","con","de","del","por","pague","pagué","gaste","gasté","compre","compré","pago","gasto","a","al","mi","la","el","un","una","me","cobre","cobré","use","usé","para","que","y"]);
// "me transfirió", "me depositaron", "me pagó"…: alguien te mandó plata, es un ingreso. Con "me" delante alcanza el verbo; sin "me" solo
// valen las formas de tercera persona del pasado ("transfirió", "depositaron"), porque "deposito" o "pago" dichos solos suelen ser un gasto.
const CR_VERBO_ME=/^(transfi\w*|deposit\w*|pag(o|aron|aba)|devolv\w*|devolu\w*|mand\w*|envi\w*|lleg\w*|acredit\w*|regal\w*|prest\w*|abon\w*|reintegr\w*)$/;
const CR_VERBO_SOLO=/^(transfirio|transfirieron|depositaron|acreditaron|acredito|devolvio|devolvieron|pagaron|llego)$/;
const CR_INGRESO=/^(sueldo|salario|haberes|aguinaldo|bono|honorarios|cobre|ingreso|cobro|devolucion|reintegro)$/;
// Inversiones: palabras que dicen QUÉ se compró o vendió y cuál es la operación.
const CR_ACTIVO={accion:"Acciones", acciones:"Acciones", cedear:"CEDEARs", cedears:"CEDEARs", etf:"CEDEARs", fci:"FCI", caucion:"Caución", cripto:"Cripto", criptomoneda:"Cripto", bitcoin:"Cripto", btc:"Cripto", eth:"Cripto",
  bonos:"Bonos USD", on:"ONs Corporativas", ons:"ONs Corporativas", lecap:"Otros", letra:"Otros"};
// Sacar plata de una inversión es una venta o un rescate; ponerla, una compra o suscripción ("recuperé", "retiré", "saqué" / "puse", "invertí").
const CR_OP_VENTA=new Set(["venta","vendi","vendimos","vender","rescate","rescati","rescatamos","recupere","recuperamos","recuperar","retire","retiramos","retirar","retiro","saque","sacamos","sacar"]);
const CR_OP_COMPRA=new Set(["compra","compre","compramos","comprar","suscripcion","suscribi","suscribo","puse","pusimos","poner","inverti","invertimos","invertir","deposite","depositamos"]);
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

// Comprar o vender dólares es un cambio de moneda (no un gasto ni una inversión): operación + moneda o una de estas marcas.
const CR_MARCA_CAMBIO=new Set(["mep","blue","ccl","oficial"]);

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

// ── Números dichos con palabras ("quince mil", "dos millones doscientos mil", "tres cuotas") ──
// Al dictar, el celular a veces escribe los números con letras. Se pasan a cifras ANTES de interpretar, pero solo si la frase no trae
// ninguna cifra: así "cena con tres amigos 30000" no se toca (el monto ya está) y "nafta quince mil visa" sí se entiende.
const CR_NUM_UNIDAD={cero:0,uno:1,un:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,
  veinte:20,veintiuno:21,veintiun:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,
  treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,
  cien:100,ciento:100,doscientos:200,doscientas:200,trescientos:300,trescientas:300,cuatrocientos:400,cuatrocientas:400,quinientos:500,quinientas:500,seiscientos:600,seiscientas:600,setecientos:700,setecientas:700,ochocientos:800,ochocientas:800,novecientos:900,novecientas:900};
function crNumerosEnPalabras(texto){
  const t=String(texto||"");
  if(/\d/.test(t)) return t;
  const toks=t.split(/\s+/).filter(Boolean);
  const n=toks.map(x=>crNorm(x));
  const esMil=w=>w==="mil", esMillon=w=>w==="millon"||w==="millones";
  const esNum=(w,sig)=> (w in CR_NUM_UNIDAD && (w!=="un" && w!=="una" && w!=="uno" || esMil(sig) || esMillon(sig))) || esMil(w) || esMillon(w);
  const out=[];
  for(let i=0;i<toks.length;i++){
    if(!esNum(n[i], n[i+1])){ out.push(toks[i]); continue; }
    let j=i, total=0, cur=0;
    while(j<toks.length){
      const w=n[j];
      if(esNum(w, n[j+1])){
        if(esMil(w)){ total+=(cur||1)*1000; cur=0; }
        else if(esMillon(w)){ total+=(cur||1)*1000000; cur=0; }
        else cur+=CR_NUM_UNIDAD[w];
        j++;
      }else if(w==="y" && j+1<toks.length && esNum(n[j+1], n[j+2]) && n[j+1] in CR_NUM_UNIDAD && CR_NUM_UNIDAD[n[j+1]]<10 && cur>=20) j++;   // "treinta y cinco"
      else break;
    }
    out.push(String(total+cur));
    i=j-1;
  }
  return out.join(" ");
}

// Interpreta `texto`. ctx = {hoy:"YYYY-MM-DD", cuentas:[…], tarjetas:[…], sugerir:(texto,tipo)=>{cat,subcat}|null, cats:tipo=>({cat:[subs]})}.
// Devuelve {ok, motivo, tipo, importe, moneda, fecha, cuenta, tarjeta, cuotas, nota, cat, subcat, entendido:[…]}.
function interpretarCargaRapida(texto, ctx){
  texto=crNumerosEnPalabras(texto);
  const out={ok:false, motivo:"", tipo:"Gasto", importe:0, moneda:"ARS", fecha:ctx.hoy, cuenta:"", tarjeta:"", cuotas:0, nota:"", cat:"", subcat:"", ticker:"", operacion:"", pesos:0, tc:0, entendido:[]};
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

  // 5b. Ingreso por verbo: "tany me transfirió 45000 a galicia", "me pagaron 120000", "recibí 5000"
  let ingresoPorVerbo=false;
  toks.forEach((t,i)=>{
    if(t.u) return;
    if(t.n==="me" && libre(i+1) && CR_VERBO_ME.test(toks[i+1].n)){ usar(i,2); ingresoPorVerbo=true; }
    else if(/^(recibi|recibimos|cobre|cobramos)$/.test(t.n)){ usar(i,1); ingresoPorVerbo=true; }
    else if(CR_VERBO_SOLO.test(t.n)){ usar(i,1); ingresoPorVerbo=true; }
  });

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
  // 6b. Cambio de moneda: "vendí 30 usd", "compré 50 dólares mep", "vendí mep 30 a 1500"
  let hayCambio=false;
  if(!hayInv && !out.tarjeta && !(out.cuotas>1)){
    const opT=toks.find(t=>CR_OP_VENTA.has(t.n) || CR_OP_COMPRA.has(t.n));
    const marca=toks.filter(t=>!t.u && CR_MARCA_CAMBIO.has(t.n));
    if(opT && (out.moneda==="USD" || marca.length)){
      hayCambio=true; out.operacion=CR_OP_VENTA.has(opT.n) ? "venta" : "compra";
      opT.u=true; marca.forEach(t=>{ t.u=true; });
      out.moneda="USD"; out.mepMarca=marca.some(t=>t.n==="mep");
      // dos números: el chico son los dólares y el grande, el tipo de cambio ("a 1500") o los pesos totales si es muy grande
      const otros=toks.map((t,i)=>({i, t, r:t.u?null:crLeerMonto(t.n)})).filter(x=>x.r);
      if(otros.length){
        const x=otros.sort((a,b)=>b.r.valor-a.r.valor)[0];
        if(out.importe>0){
          const usd=Math.min(out.importe, x.r.valor), mayor=Math.max(out.importe, x.r.valor);
          out.importe=usd; if(mayor<=10000) out.tc=mayor; else out.pesos=mayor;
          x.t.u=true;
        } else { out.importe=x.r.valor; x.t.u=true; }
      }
      if(out.tc>0 && !(out.pesos>0)) out.pesos=Math.round(out.importe*out.tc*100)/100;
      if(out.pesos>0 && !(out.tc>0) && out.importe>0) out.tc=Math.round(out.pesos/out.importe*100)/100;
    }
  }

  // 7. Tipo
  const restantes=toks.filter(t=>!t.u);
  if(hayCambio) out.tipo="Cambio";
  else if(out.tarjeta || out.cuotas>1) out.tipo="Tarjeta";
  else if(hayInv) out.tipo="Inversion";
  else if(ingresoPorVerbo || restantes.some(t=>CR_INGRESO.test(t.n))) out.tipo="Ingreso";

  // "de mis ahorros" / "del fondo de retiro" en una venta: la plata salió de un fondo de ahorro (el formulario tilda "Sale de mis ahorros").
  if(out.tipo==="Inversion" && opInv==="venta"){
    const marca=toks.findIndex(t=>!t.u && /^(ahorro|ahorros|fondo)$/.test(t.n));
    if(marca>=0){
      out.saleDeAhorro=true;
      toks.forEach((t,i)=>{ if(!t.u && /^(ahorro|ahorros|fondo|retiro|mis|mi|del|de|el|la)$/.test(t.n) && Math.abs(i-marca)<=3) t.u=true; });
    }
  }

  // 8. Descripción: lo que sobra, sin palabras de relleno en los bordes
  let sobra=toks.filter(t=>!t.u);
  while(sobra.length && CR_RELLENO.has(sobra[0].n)) sobra=sobra.slice(1);
  while(sobra.length && CR_RELLENO.has(sobra[sobra.length-1].n)) sobra=sobra.slice(0,-1);
  let nota=sobra.map(t=>t.o).join(" ").replace(/[.,;:]+$/,"").trim();
  if(nota) nota=nota.charAt(0).toUpperCase()+nota.slice(1);
  out.nota=nota;

  // 9. Categoría (la misma sugerencia de la nota: tu historial primero, después reglas conocidas)
  if(out.tipo==="Cambio"){
    out.nota=out.mepMarca ? (nota ? nota+" · MEP" : "MEP") : nota;
  } else if(out.tipo==="Inversion"){
    const catsInv=ctx.cats ? ctx.cats("Inversion") : null;
    out.operacion=opInv||"compra";
    if(activo && (!catsInv || catsInv[activo])) out.cat=activo;
    if(out.cat && catsInv) out.subcat=crElegirSubInversion(catsInv[out.cat], out.operacion, out.ticker);
    out.nota=nota;   // lo que sobra, si algo: el ticker ya identifica el activo
  } else {
    // Si el texto nombra una de TUS categorías ("dinero extra", "salario", "casa"), eso manda: y si solo existe como categoría de
    // ingresos, es un ingreso.
    const dePorNombre=(tp)=>{
      const cats=ctx.cats ? (ctx.cats(tp)||{}) : {};
      const frase=sobra.map(t=>t.n).join(" ");
      return Object.keys(cats).map(c=>({cat:c, n:crNorm(c)})).filter(x=>x.n && new RegExp(`(^| )${x.n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}( |$)`).test(frase)).sort((a,b)=>b.n.length-a.n.length)[0] || null;
    };
    let porNombre=null;
    // "pagué", "transferí", "gasté"…: lo hiciste vos, así que el nombre de una categoría de ingresos no lo vuelve un ingreso
    const verboSalida=toks.some(t=>/^(transferi|pague|gaste|abone|regale|preste|compre|pago)$/.test(t.n));
    if(out.tipo==="Gasto" || out.tipo==="Ingreso"){
      const ing=dePorNombre("Ingreso"), gas=dePorNombre("Gasto");
      if(out.tipo==="Gasto" && ing && !verboSalida && (!gas || ing.n.length>gas.n.length)){ out.tipo="Ingreso"; porNombre=ing; }
      else if(out.tipo==="Ingreso" && ing){ porNombre=ing; }
      else if(out.tipo==="Gasto" && gas){ porNombre=gas; }
    }
    const tipoCat=out.tipo==="Tarjeta" ? "Gasto" : out.tipo;
    const sug=nota && ctx.sugerir ? ctx.sugerir(nota, tipoCat) : null;
    const catsDe=ctx.cats ? ctx.cats(out.tipo==="Tarjeta"?"Tarjeta":out.tipo) : null;
    if(porNombre){
      out.cat=porNombre.cat;
      if(sug && sug.cat===porNombre.cat && sug.subcat && catsDe && (catsDe[sug.cat]||[]).includes(sug.subcat)) out.subcat=sug.subcat;
    } else if(sug && sug.cat && (!catsDe || catsDe[sug.cat])){ out.cat=sug.cat; out.subcat=(sug.subcat && catsDe && (catsDe[sug.cat]||[]).includes(sug.subcat)) ? sug.subcat : ""; }
  }

  if(!(out.importe>0)){ out.motivo="No encontré el monto. Probá con algo como: nafta 15000 visa ayer"; return out; }
  out.ok=true;
  const m$=out.moneda==="USD" ? `USD ${String(out.importe).replace(".",",")}` : fmtS(out.importe);
  const tipoTxt=out.tipo==="Cambio" ? `Cambio · ${out.operacion==="venta"?"Venta":"Compra"} de dólares` : out.tipo==="Inversion" ? `Inversión · ${out.operacion==="venta"?"Venta":"Compra"}${out.ticker?" "+out.ticker:""}` : (out.tipo==="Tarjeta"&&out.cuotas>1 ? `Tarjeta en ${out.cuotas} cuotas` : out.tipo);
  const extraCambio=out.tipo==="Cambio" ? [out.tc>0 ? `a ${fmtS(out.tc)}` : "", out.pesos>0 ? `${fmtS(out.pesos)} en pesos` : ""] : [];
  out.entendido=[tipoTxt, m$, out.saleDeAhorro?"sale de tus ahorros":"", ...extraCambio, out.cat?(out.cat+(out.subcat?` › ${out.subcat}`:"")):"", out.tarjeta, out.cuenta, fechaTxt||"hoy"].filter(Boolean);
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
// La categoría de una nota escrita HOY: primero lo que cargaste en los últimos meses (CR_RECIENTE_DIAS), después las reglas de comercios
// conocidos y, solo si nada de eso alcanza, todo el historial. Así un "pan" cargado en un viaje de hace seis meses no manda el pan de hoy
// a "Vacaciones". Devuelve {cat, subcat, fuente} o null, igual que buscarSugerencia.
const CR_RECIENTE_DIAS=150;
function sugerirParaCargaRapida(texto, tipo){
  const corte=crSumarDias(currentYMD(), -CR_RECIENTE_DIAS);
  const recientes=(movs||[]).filter(m=>String(m.fecha||"")>=corte);
  return sugerirPorNotaExacta(texto, tipo, recientes) || sugerirPorPalabras(texto, tipo, recientes) || sugerirPorReglas(texto, tipo) || sugerirCategoriaPara(texto, tipo, movs);
}
function contextoCargaRapida(){
  return {hoy:currentYMD(), cuentas:getCuentas(), tarjetas:getTarjetas(), tickers:tickersConocidos(movs), sugerir:sugerirParaCargaRapida, cats:tp=>getCats(tp)};
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
  if(r.tipo==="Cambio"){
    if(typeof setSentidoCambio==="function") setSentidoCambio(r.operacion);
    const u=document.getElementById("cambio-usd"); if(u) u.value=String(r.importe);
    if(r.pesos>0) crPonerMonto("cambio-ars", r.pesos, typeof formatearNumeroConMiles!=="undefined" ? formatearNumeroConMiles : null);
    crPonerSelect("cambio-cuenta", r.cuenta);
    crPonerFecha("cambio-fecha", r.fecha);
    const nt=document.getElementById("cambio-nota"); if(nt) nt.value=r.nota;
    if(typeof calcTipoCambio==="function") calcTipoCambio();
  } else if(r.tipo==="Inversion"){
    crPonerMonto("inv-importe", r.importe, typeof formatearNumeroConMiles!=="undefined" ? formatearNumeroConMiles : null);
    if(typeof pillMoneda==="function") pillMoneda("inv-moneda", r.moneda);
    if(crPonerSelect("inv-cat", r.cat)){ if(typeof updateInvSubcats==="function") updateInvSubcats(); crPonerSelect("inv-subcat", r.subcat); if(typeof buildInvCatChips==="function") buildInvCatChips(); }
    const tk=document.getElementById("inv-ticker"); if(tk){ tk.value=r.ticker; if(typeof buildTickerRecientes==="function") buildTickerRecientes(); }
    crPonerSelect("inv-cuenta", r.cuenta);
    crPonerFecha("inv-fecha", r.fecha);
    const nt=document.getElementById("inv-nota"); if(nt) nt.value=r.nota;
    const sa=document.getElementById("inv-sale-ahorro"); if(sa) sa.checked=!!r.saleDeAhorro;
    if(typeof actualizarSaleDeAhorro==="function") actualizarSaleDeAhorro();
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

// ═══════════════════════════════════════════
// DICTADO POR VOZ
// ═══════════════════════════════════════════
// El botón 🎤 escucha una frase ("nafta quince mil visa") y la pasa por la misma carga rápida de arriba: rellena el formulario,
// no guarda nada. Usa el reconocimiento de voz del navegador (gratis, sin servidores propios). OJO: en Chrome el audio se envía a
// Google para transcribirlo, por eso la primera vez se avisa y hace falta internet. Si el navegador no lo ofrece, el botón no aparece.

const VOZ_AVISO_KEY="fvozaviso";
let vozEscuchando=null;     // la sesión de reconocimiento en curso, o null

const vozConstructor=()=> typeof window!=="undefined" ? (window.SpeechRecognition||window.webkitSpeechRecognition||null) : null;
const vozDisponible=()=>!!vozConstructor();

// Pura. Junta lo que va entendiendo el reconocedor: {texto, final}. `resultados` es el SpeechRecognitionResultList (o algo igual).
function transcripcionDeVoz(resultados){
  let texto="", final=true;
  for(let i=0;i<(resultados||[]).length;i++){
    const r=resultados[i];
    if(!r || !r[0]) continue;
    texto+=(texto?" ":"")+String(r[0].transcript||"").trim();
    if(!r.isFinal) final=false;
  }
  return {texto:texto.trim(), final};
}
// Pura. Qué decirle al usuario según el código de error del reconocedor.
function mensajeErrorVoz(codigo){
  switch(codigo){
    case "not-allowed": case "service-not-allowed": return "No tengo permiso para usar el micrófono. Habilitalo para esta app en los ajustes del navegador.";
    case "no-speech": return "No te escuché. Tocá el micrófono y decilo de nuevo.";
    case "audio-capture": return "No encuentro el micrófono del celular.";
    case "network": return "Para entender la voz hace falta internet. Probá de nuevo con conexión o escribilo.";
    case "language-not-supported": return "Tu navegador no entiende el idioma elegido para dictar.";
    case "aborted": return "";
    default: return "No pude entender el audio. Probá de nuevo o escribilo.";
  }
}

function vozPintarBoton(escuchando){
  const b=document.getElementById("carga-rapida-voz");
  if(!b) return;
  b.classList.toggle("grabando", !!escuchando);
  b.textContent=escuchando ? "⏹" : "🎤";
  b.setAttribute("aria-label", escuchando ? "Dejar de escuchar" : "Dictar por voz");
  b.setAttribute("aria-pressed", escuchando ? "true" : "false");
}
function vozMensaje(texto, esError){
  const res=document.getElementById("carga-rapida-res");
  if(!res) return;
  res.style.display=texto ? "block" : "none";
  res.style.color=esError ? "var(--danger)" : "var(--text-muted)";
  res.textContent=texto||"";
}

async function dictarCargaRapida(){
  if(vozEscuchando){ try{ vozEscuchando.stop(); }catch(e){ /* ya terminó */ } return; }
  const SR=vozConstructor();
  if(!SR){ vozMensaje("Tu navegador no permite dictar. Escribí la frase en el campo.", true); return; }
  let avisado=false; try{ avisado=localStorage.getItem(VOZ_AVISO_KEY)==="1"; }catch(e){ /* sin almacenamiento */ }
  if(!avisado){
    const ok=await mostrarConfirm("Para entender tu voz, el navegador envía el audio a su servicio de reconocimiento (en Chrome, Google). Enola no lo guarda. ¿Querés usar el dictado?", {textoOk:"Sí, dictar"});
    if(!ok) return;
    try{ localStorage.setItem(VOZ_AVISO_KEY,"1"); }catch(e){ /* sin almacenamiento */ }
  }
  const inp=document.getElementById("carga-rapida");
  if(!inp) return;
  const rec=new SR();
  rec.lang="es-AR"; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
  let ultimo={texto:"", final:false}, fallo=false;
  rec.onresult=ev=>{
    ultimo=transcripcionDeVoz(ev.results);
    inp.value=ultimo.texto;
  };
  rec.onerror=ev=>{ fallo=true; const m=mensajeErrorVoz(ev && ev.error); if(m) vozMensaje(m, true); };
  rec.onend=()=>{
    vozEscuchando=null; vozPintarBoton(false);
    if(fallo) return;
    if(ultimo.texto.trim()) cargaRapida();
    else vozMensaje(mensajeErrorVoz("no-speech"), true);
  };
  try{
    rec.start();
    vozEscuchando=rec; vozPintarBoton(true);
    vozMensaje("🎤 Te escucho… decí, por ejemplo: “nafta quince mil visa”.", false);
  }catch(e){
    vozEscuchando=null; vozPintarBoton(false);
    vozMensaje(mensajeErrorVoz("audio-capture"), true);
  }
}
// El botón solo aparece si el navegador sabe reconocer voz.
function iniciarBotonVoz(){
  const b=document.getElementById("carga-rapida-voz");
  if(b) b.style.display=vozDisponible() ? "" : "none";
}
iniciarBotonVoz();
