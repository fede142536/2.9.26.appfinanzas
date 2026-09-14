// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// FALLBACK HISTÓRICO (vacío por defecto - solo se usa si el usuario no tiene datos)
// ═══════════════════════════════════════════
const HIST_MONTHLY = [];
const HIST_CAT_YEAR = {};
const FONDO_DATA = [];

// ═══════════════════════════════════════════
// CATEGORÍAS REALES
// ═══════════════════════════════════════════
const DEFAULT_CATS = {
  Gasto:{
    "Casa":["Alquiler","Bazar","Baño","Cocina","Electrodomésticos","Ferretería","Garrafa","Gastos Lujan","Luz","Streaming","Vivero","Otros"],
    "Supermercado":["Almacen","Bebidas/Agua bidones","Carnicería","Comida TRABAJO","Fiambreria","Limpieza","Panadería","Pastas","Polleria","Verduleria","Otros"],
    "Tarjeta de crédito":["Pago total","Gastos Tarjeta","Netflix, HBO, Paramount, Apple TV","Otros"],
    "Auto":["Nafta","Estacionamiento","Peajes","TelePASE","Reparación","Service","Patente","VTV","Aire","Otros"],
    "Salidas":["Restaurante","Asados","Bar","Cine","Helado","Meriendas","Recital","Stand up","Teatro","Otros"],
    "Gastos propios":["Ropa","Celular","Educacion","Fútbol","Gimnasio","Peluqueria","Psicologo","Obra social","Spotify","Tramites personales","Zapatillas","Otros"],
    "Tany":["Gastos Grales","Tarjeta de Crédito","FCI","Seguros","SUBE","Celular","Vacaciones","Otros"],
    "Delivery":["Pizza","Empanadas","Hamburguesas","Helado","Rotiseria","Otros"],
    "Salud":["Médico","Dentista","Farmacia","RPG","Otros"],
    "Enola":["Alimento","Veterinario","Peluqueria","Ropa","Otros"],
    "Inversiones":["Cedears","MEP","ON","Otros"],
    "Fondo de Retiro":["Cedears"],
    "Vacaciones Gastos":["Alemania","Bariloche","Chascomus","Italia","La Costa","San Rafael","Otros"],
    "Regalos":["Familia","Trabajo","Otros"],
    "Transporte":["Nafta","SUBE","Uber/Didi","Otros"],
    "Otros":["Varios"]
  },
  Ingreso:{
    "Salario":["Salario","Aguinaldo","Plus","Adelanto de sueldo","Regalo cumpleaños"],
    "Alquiler Lujan":["Alquiler"],
    "Tany":["Gastos Grales","Crédito","Usd Tany","Vacaciones","Otros"],
    "Dinero extra":["AFIP","Cashback","Cuenta DNI","Devolución IVA","Mercado Libre","MODO","Regalo","Reintegro OSDE","Otros"],
    "Crédito":["BPat","Banco","Préstamo personal","Otros"],
    "Inversiones":["Cedears","ON","MEP","FCI Rendimiento","Otros"]
  },
  Inversion:{
    "FCI":["Suscripción","Rescate capital","Rendimiento"],
    "Bonos USD":["Compra AL30","Compra GD30","Compra GD35","Venta","Cupón","Amortización"],
    "CEDEARs":["Compra SPY","Compra QQQ","Compra NVDA","Compra KO","Compra otro","Venta","Dividendo"],
    "ONs Corporativas":["Compra IRCFO","Compra MGC9O","Compra TLCMO","Compra otra","Venta","Cupón"],
    "Caución":["Colocada","Tomada"],
    "Otros":["Varios"]
  },
  Tarjeta:{
    "Supermercado":["Otros"],
    "Tecnología":["Otros"],
    "Ropa":["Otros"],
    "Salud":["Otros"],
    "Educación":["Otros"],
    "Viajes":["Otros"],
    "Entretenimiento":["Otros"],
    "Streaming":["Netflix","Spotify","HBO","Disney","Apple TV","Otros"],
    "Servicios":["Otros"],
    "Otros":["Varios"]
  }
};

const ICONS={"Casa":"🏠","Supermercado":"🛒","Tarjeta de crédito":"💳","Auto":"🚗","Salidas":"🍽️","Gastos propios":"👤","Tany":"👩","Salud":"❤️","Delivery":"🛵","Enola":"🐕","Inversiones":"📈","Fondo de Retiro":"🏦","Vacaciones Gastos":"✈️","Regalos":"🎁","Transporte":"🚌","Otros":"📦","Salario":"💼","Alquiler Lujan":"🏢","Crédito":"💰","Dinero extra":"✨","FCI":"📊","Bonos USD":"🇺🇸","CEDEARs":"📈","ONs Corporativas":"🏭","Caución":"🔒"};

// ═══════════════════════════════════════════
// ÍCONOS PERSONALIZADOS POR CATEGORÍA
// ═══════════════════════════════════════════
// El usuario puede elegir un ícono propio para cualquier categoría (default o custom).
// Se guarda aparte de ICONS (que son los emojis de fábrica) para no tocar el objeto fuente.
let iconsCustom = {};
function saveIconsCustom(){ setSensitiveRaw("ficons", JSON.stringify(iconsCustom)); marcarDatosSucios(); }
// Devuelve el ícono efectivo de una categoría: el elegido por el usuario si existe,
// si no el de fábrica, si no un fallback (por defecto "•").
function getIcon(cat, fallback){
  if(fallback===undefined) fallback="•";
  return iconsCustom[cat] || ICONS[cat] || fallback;
}

// Set curado de emojis para elegir, agrupados por tema (se muestran todos juntos en una grilla)
const ICON_CHOICES=["🏠","🏢","🛒","💳","🚗","🍽️","🍔","🍕","☕","🍺","👤","🤝","❤️","🏥","💊","🛵","🐾","🐕","🐱","📈","📉","📊","🏦","✈️","🧳","🎁","🚌","🚕","⛽","📦","💼","🏢","💰","✨","🔒","🎓","📚","🎮","📱","💻","👗","👟","💡","⚽","🎬","🎵","🎫","🧴","✂️","🔧","🌳","🍿","🍷","🎂","👶","🐣","🏋️","🚴","🏖️","🧾","🔥","💧","📶","🐷","💵","🪙","🏷️","🎯","📌","⭐"];
let iconPickerTarget=null; // null | {mode:'new'} | {mode:'edit', cat}
function openIconPicker(target){
  iconPickerTarget=target;
  document.getElementById("icon-picker-grid").innerHTML=ICON_CHOICES.map(ic=>
    `<button type="button" onclick="elegirIcono('${ic}')" style="font-size:22px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);cursor:pointer">${ic}</button>`
  ).join("");
  document.getElementById("modal-icon-picker").classList.add("open");
}
function closeIconPicker(){ document.getElementById("modal-icon-picker").classList.remove("open"); }
function elegirIcono(ic){
  if(iconPickerTarget && iconPickerTarget.mode==="new"){
    nuevoCatIcono=ic;
    document.getElementById("new-cat-icon-preview").textContent=ic;
  } else if(iconPickerTarget && iconPickerTarget.mode==="edit"){
    iconsCustom[iconPickerTarget.cat]=ic;
    saveIconsCustom();
    renderCatManager();
    buildCats(); buildTcCats(); buildInvCats();
    showToast("Ícono actualizado ✓");
  }
  closeIconPicker();
}
let nuevoCatIcono=null; // ícono elegido para la categoría que se está por crear

// ═══════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════
let tipo="Gasto";
// Migrate data from older storage keys if present
function migrateStorage(){
  // Si el cifrado ligado al PIN ya está activo, "fmovs3" en texto plano no existe
  // (se migró/nunca existió en claro), así que no hay nada para migrar acá.
  // (Se usa localStorage.getItem directo en vez de isEncActive() porque esta función
  // corre antes de que se cargue el módulo de cifrado — ver js/seguridad-pin.js.)
  if(localStorage.getItem("fencsalt")) return;
  const oldKeys = ["fmovs2","fmovs","ftcs2","ftcs"];
  const oldMovs = localStorage.getItem("fmovs2")||localStorage.getItem("fmovs")||"[]";
  const oldTcs  = localStorage.getItem("ftcs2") ||localStorage.getItem("ftcs") ||"[]";
  const existing = JSON.parse(localStorage.getItem("fmovs3")||"[]");
  if(!existing.length){
    const migrated = JSON.parse(oldMovs);
    if(migrated.length){
      localStorage.setItem("fmovs3", oldMovs);
      console.log("Migrated", migrated.length, "movs from old key");
    }
  }
}
migrateStorage();
// NOTA: estos arrancan con valores por defecto vacíos, NO leyendo localStorage acá.
// Los datos reales (en claro o descifrados desde el blob cifrado) se cargan recién en
// loadSensitiveIntoMemory(), llamada desde bootApp() después de que checkLock() resuelve
// (es decir, después de que no hay PIN o de que el PIN correcto ya se ingresó).
let movs=[];
let tcs=[];
let custom={"Gasto":{},"Ingreso":{},"Inversion":{},"Tarjeta":{}};
// Migración: si custom existe pero no tiene la clave Tarjeta, la agregamos
if(!custom.Tarjeta) custom.Tarjeta={};
let metas=[];
let importHistory=[];
// Devuelve el mes actual "YYYY-MM" usando hora LOCAL (no UTC).
// Importante en Argentina (UTC-3): a partir de las 21:00 del último día del mes,
// new Date().toISOString() ya está en el mes siguiente y eso confunde al usuario.
// (Relocada acá, antes de usarse por primera vez más abajo — su definición original
// vive junto al resto de los helpers de cuotas/tarjetas en js/tarjetas-inversiones.js,
// pero ese archivo carga después y estas variables se inicializan al arrancar.)
function currentYM(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2, "0");
}
// Versión completa "YYYY-MM-DD" en hora local (para inputs de fecha).
function currentYMD(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
// Arrancar en el último mes con datos, o el mes actual si no hay datos
let mesActual = currentYM(); // mes seleccionado en pestaña Movimientos (arranca en el mes actual real)
let mesTc = currentYM(); // mes seleccionado en pestaña Tarjetas
let mesInv = currentYM(); // mes seleccionado en pestaña Inversiones
let searchQuery = ""; // búsqueda actual en Movimientos
let filtroTarjeta = ""; // filtro por nombre de tarjeta dentro del filtro Tarjeta ("" = todas)
let filtroCategoria = ""; // filtro por categoría dentro de filtros Gasto/Ingreso ("" = todas)
let filtro="Todos";
let dashYear=2026;
let chartMensual=null, chartBalance=null, chartFondo=null, chartAcum=null;

const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ═══════════════════════════════════════════
// ORDEN CUSTOM DE CATEGORÍAS
// ═══════════════════════════════════════════
// El usuario puede reordenar las categorías a su gusto desde Config.
// Se guarda por tipo: { Gasto:[...nombres en orden], Ingreso:[...], Inversion:[...], Tarjeta:[...] }
// Las categorías que no están en la lista (nuevas) se agregan al final automáticamente.
let catOrder = {};
function saveCatOrder(){ setSensitiveRaw("fcatorder", JSON.stringify(catOrder)); marcarDatosSucios(); }

// Presupuestos mensuales por categoría — formato: { "Supermercado": 300000, ... }
// Se declara ACÁ (y no junto a sus funciones, más abajo) porque renderMovs() la lee: al
// declararla con `let` más abajo, el primer render tiraba ReferenceError por temporal dead
// zone y cortaba la función entera, dejando la pantalla de Movimientos completamente vacía.
let presupuestos = {};

// Devuelve los nombres de categoría de `catsObj` en el orden guardado por el usuario.
// Si no hay orden guardado para ese tipo, devuelve el orden natural del objeto.
function ordenarCats(tipo, catsObj){
  const nombres=Object.keys(catsObj);
  const orden=catOrder[tipo];
  if(!orden || !orden.length) return nombres;
  const enOrden=orden.filter(c=>nombres.includes(c));
  const nuevas=nombres.filter(c=>!orden.includes(c)); // categorías que no estaban guardadas (nuevas)
  return [...enOrden, ...nuevas];
}

// Mueve una categoría una posición arriba/abajo en el orden guardado (dir: -1 o +1)
function moverCategoriaOrden(tipo, cat, dir){
  const cats=getCats(tipo);
  let orden=ordenarCats(tipo, cats); // orden actual (guardado o natural)
  const idx=orden.indexOf(cat);
  const nuevoIdx=idx+dir;
  if(idx<0 || nuevoIdx<0 || nuevoIdx>=orden.length) return;
  orden=[...orden];
  [orden[idx], orden[nuevoIdx]] = [orden[nuevoIdx], orden[idx]];
  catOrder[tipo]=orden;
  saveCatOrder();
  renderCatManager();
  buildCats(); // refresca el select de Cargar por si el tipo actual coincide
}
// Para cada categoría, mergea sus subcategorías: default subs + subs agregadas por el usuario.
// Migración: si el usuario ya tenía movimientos/tarjetas con categorías que existían como
// default en una versión anterior de la app y luego se sacaron de los defaults (por ejemplo,
// al genericizar la lista para publicar en Play Store), esas categorías quedarían "huérfanas"
// y desaparecerían del selector aunque los movimientos viejos las sigan usando.
// Esta función las detecta y las mueve a "custom" para que no se pierdan ni dejen de poder editarse.
function migrarCategoriasHuerfanas(){
  let cambios=false;
  const tiposConMovs={Gasto:[],Ingreso:[],Inversion:[]};
  movs.forEach(m=>{ if(tiposConMovs[m.tipo]) tiposConMovs[m.tipo].push(m); });
  const tiposConTcs={Tarjeta: tcs};
  const todos={...tiposConMovs, ...tiposConTcs};

  Object.keys(todos).forEach(t=>{
    const def=DEFAULT_CATS[t]||{};
    if(!custom[t]) custom[t]={};
    const catsUsadas={}; // cat -> Set de subcats históricamente usadas
    todos[t].forEach(item=>{
      const cat=item.cat;
      if(!cat) return;
      if(!catsUsadas[cat]) catsUsadas[cat]=new Set();
      if(item.subcat) catsUsadas[cat].add(item.subcat);
    });
    Object.entries(catsUsadas).forEach(([cat,subsSet])=>{
      // Si la categoría ya está en defaults o ya está migrada a custom, no hacer nada
      if(def[cat] || custom[t][cat]) return;
      custom[t][cat]=subsSet.size ? Array.from(subsSet) : ["Otros"];
      cambios=true;
    });
  });
  if(cambios){
    setSensitiveRaw("fcustom3", JSON.stringify(custom));
    console.log("Categorías huérfanas migradas a custom");
  }
}

function getCats(t){
  const merged={};
  const def=DEFAULT_CATS[t]||{};
  const cust=custom[t]||{};
  // Primero copio defaults
  Object.entries(def).forEach(([cat,subs])=>{
    merged[cat]=[...subs];
  });
  // Después agrego/mergeo custom
  Object.entries(cust).forEach(([cat,subs])=>{
    if(merged[cat]){
      // Cat default: agrego subs custom evitando duplicados
      const set=new Set(merged[cat]);
      subs.forEach(s=>set.add(s));
      merged[cat]=Array.from(set);
    } else {
      // Cat nueva del usuario
      merged[cat]=[...subs];
    }
  });
  return merged;
}

// ── SEGURIDAD ──
// Escapa caracteres especiales de HTML para evitar XSS al interpolar texto libre
// ingresado por el usuario (notas, nombres custom, tickers, etc.) dentro de innerHTML.
function escapeHtml(str){
  if(str===undefined||str===null) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
// ── FORMAT ──
function fmt(n){
  if(n===undefined||n===null||isNaN(n))return "$0,00";
  const abs=Math.abs(n);
  const rounded=Math.round(abs*100)/100;
  const sign=n<0?"-":"";
  // Siempre 2 decimales, separador de miles punto, decimal coma (es-AR)
  return sign+"$"+rounded.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
// fmtS = mismo formato completo para chips y listas (no abreviar K/M)
// Extrae hashtags (#palabra) del texto de una nota. Devuelve array de tags en minúsculas,
// sin el "#" y sin duplicados. Acepta letras (con tildes/ñ), números y guión bajo.
function extraerTags(texto){
  if(!texto) return [];
  const matches=texto.match(/#[\p{L}0-9_]+/gu) || [];
  return [...new Set(matches.map(t=>t.slice(1).toLowerCase()))];
}
// Devuelve el HTML de los chips de etiquetas de un movimiento (o "" si no tiene ninguna)
function renderTagsChips(m){
  const tags=extraerTags(m.nota);
  if(!tags.length) return "";
  return `<div class="tx-tags">${tags.map(t=>`<span class="tag-chip">#${t}</span>`).join("")}</div>`;
}
function fmtS(n){
  return fmt(n);
}
// Devuelve HTML con el signo (+/-) en tamaño reducido y el monto en tamaño normal,
// para los balances grandes destacados (más legible: el ojo va directo a la cifra).
function fmtSignoGrande(valor){
  const neg=valor<0;
  const signo=neg?"-":"+";
  const abs=Math.abs(valor);
  return `<span style="font-size:.6em;font-weight:500;vertical-align:2px">${signo}</span>${fmtS(abs)}`;
}
// fmtAbbr = versión abreviada solo para ejes de gráficos donde no hay espacio
function fmtAbbr(n){
  if(!n||isNaN(n))return "$0";
  const abs=Math.abs(n);
  const sign=n<0?"-":"";
  if(abs>=1000000)return sign+"$"+(abs/1000000).toFixed(1)+"M";
  if(abs>=1000)return sign+"$"+(abs/1000).toFixed(0)+"K";
  return fmt(n);
}
function mesLbl(ym){if(!ym)return"";const[y,m]=ym.split("-");return MESES[parseInt(m)-1]+" "+y;}
// Formatea un monto según su moneda. ARS usa el formato es-AR ($), USD usa "USD X.XX"
function fmtMoneda(n, moneda){
  if(moneda==="USD"){
    const abs=Math.abs(n||0);
    const sign=(n||0)<0?"-":"";
    return sign+"USD "+(Math.round(abs*100)/100).toFixed(2);
  }
  return fmt(n);
}
