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
// El mapa ICONS de arriba son las categorías con las que arrancó la app. Cualquier categoría
// que crees después no figura ahí y quedaba con un puntito gris, igual que todas las otras
// categorías nuevas: en una lista no se distinguían entre sí.
// Estas reglas adivinan un ícono por el nombre, para no tener que elegirlo a mano cada vez.
// El orden importa: gana la primera que coincide, así que lo específico va antes que lo general
// ("farmacia" antes que "salud" no hace falta porque son íconos distintos, pero "nafta" sí
// tiene que ir antes que cualquier regla amplia de auto).
const ICONOS_POR_PALABRA=[
  [/cambio\s*de\s*moneda|\bmep\b|d[oó]lar|\bblue\b|\bccl\b|contado\s*con\s*liqui/, "💱"],
  [/supermercad|^super|almacen|verduler|carnicer|fiambrer|panader|kiosco|chino|coto|dia\b|jumbo|carrefour/, "🛒"],
  [/restaurant|resto|comida|delivery|pedido|rappi|cena|almuerzo|parrilla|pizzer|sushi/, "🍽️"],
  [/cafe|cafeter|starbuck|desayuno/, "☕"],
  [/cerveza|bar\b|boliche|trago|vino|birra/, "🍺"],
  [/nafta|combustible|ypf|shell|axion|peaje|estacionamient|cochera/, "⛽"],
  [/auto|mecanic|neumatic|cubierta|patente|vtv|seguro.*auto/, "🚗"],
  [/transport|colectivo|sube|subte|tren|micro|bondi/, "🚌"],
  [/taxi|uber|cabify|didi|remis/, "🚕"],
  [/farmac|remedio|medicament/, "💊"],
  [/salud|medic|obra social|prepaga|osde|swiss|galeno|dentist|odontolog|psicolog|terapia/, "❤️"],
  [/gimnasio|gym|entrenamient|crossfit|pilates|yoga/, "🏋️"],
  [/luz|edesur|edenor|electricidad|servicio/, "💡"],
  [/gas\b|metrogas|camuzzi/, "🔥"],
  [/agua|aysa|absa/, "💧"],
  [/internet|wifi|fibertel|telecentro|movistar|claro|personal|celular|telefon/, "📶"],
  [/netflix|spotify|disney|hbo|prime|streaming|suscripcion/, "🎬"],
  [/cine|teatro|recital|concierto|entrada|show/, "🎫"],
  [/ocio|salida|juego|videojuego|steam|playstation|xbox/, "🎮"],
  [/alquiler|renta|inquilin/, "🏢"],
  [/expensa|abl|impuest|afip|arba|monotributo|rentas/, "🧾"],
  [/casa|hogar|ferreter|mueble|deco|sodimac|easy/, "🏠"],
  [/ropa|indument|zapatill|calzado|zara|vestiment/, "👗"],
  [/educac|curso|facultad|universidad|colegio|cuota.*escolar|libro|apunte/, "🎓"],
  [/mascota|veterinar|perro|gato|petshop|alimento.*balanceado/, "🐾"],
  [/regalo|cumple|navidad|aguinaldo.*regalo/, "🎁"],
  [/viaje|vacacion|pasaje|avion|vuelo|hotel|airbnb/, "✈️"],
  [/peluquer|barber|belleza|cosmetic|perfum|uñas/, "✂️"],
  [/bebe|pañal|infantil|jugueter/, "👶"],
  [/ahorro|fondo|reserva/, "🏦"],
  [/inversion|bono|accion|cedear|plazo fijo|fci|caucion|dolar/, "📈"],
  [/sueldo|salario|honorario|freelance|trabajo|cobro/, "💼"],
  [/tarjeta|credito|visa|mastercard|amex/, "💳"]
];

// Saca tildes y pasa a minúsculas para que "Educación" y "educacion" matcheen igual.
function normalizarTexto(txt){
  return String(txt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function iconoPorPalabra(cat){
  const t=normalizarTexto(cat);
  if(!t) return "";
  for(const [patron, icono] of ICONOS_POR_PALABRA){
    if(patron.test(t)) return icono;
  }
  return "";
}

// Un ícono es un emoji o una letra. Nunca tiene por qué contener HTML.
//
// Importa porque getIcon() se interpola en innerHTML en más de quince lugares, y su valor puede
// venir de iconsCustom, que se restaura TAL CUAL desde un backup. Un backup preparado a mala fe
// podía traer, en vez de un emoji, código que se ejecutaba al renderizar cualquier pantalla —
// con la app ya desbloqueada y los datos descifrados en memoria.
//
// Se corta acá y no en cada interpolación a propósito: escapar en dieciséis lugares es cuestión
// de tiempo hasta que alguien agregue el diecisiete y se olvide. Además el valor sale limpio
// también para los usos con textContent, donde escapar mostraría "&amp;" literal.
const ICONO_MAX_LARGO = 8;
function iconoSeguro(valor){
  const t=String(valor==null ? "" : valor).trim();
  if(!t || t.length>ICONO_MAX_LARGO) return "";
  // Cualquier carácter con el que se pueda abrir una etiqueta o un atributo lo descalifica.
  if(/[<>&"'`]/.test(t)) return "";
  return t;
}

function getIcon(cat, fallback){
  // Sin fallback explícito se usa la inicial en vez de un punto: dos categorías distintas
  // se veían exactamente igual, y la letra al menos las diferencia de un vistazo.
  // Con fallback explícito se respeta lo que pidió quien llama, incluido el vacío: los chips
  // de filtro pasan "" justamente para no mostrar nada cuando la categoría no tiene ícono.
  const sinFallback = fallback===undefined;
  if(sinFallback){
    const t=String(cat||"").trim();
    fallback = t ? t[0].toUpperCase() : "•";
  }
  return iconoSeguro(iconsCustom[cat]) || iconoSeguro(ICONS[cat]) || iconoSeguro(iconoPorPalabra(cat))
      || iconoSeguro(fallback) || (sinFallback ? "•" : "");
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
    iconsCustom[iconPickerTarget.cat]=iconoSeguro(ic);
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
  if(localStorage.getItem("fencblob") || localStorage.getItem("fencsalt")) return;
  const oldMovs = localStorage.getItem("fmovs2")||localStorage.getItem("fmovs")||"[]";
  // Esta función es la PRIMERA línea que corre en el PRIMER script que carga la app (ver el
  // migrateStorage() suelto, dos líneas más abajo). Un throw acá corta la ejecución de este
  // archivo a la mitad: todo lo que viene después —cientos de funciones y variables, incluida
  // "let movs"— queda sin declarar. Reproducido con una clave vieja ("fmovs") corrupta de una
  // versión anterior: la app quedaba en blanco, sin pantalla de PIN ni nada, con
  // "Cannot access 'movs' before initialization" en la consola.
  let existing, migrated;
  try{ existing = JSON.parse(localStorage.getItem("fmovs3")||"[]"); }catch(e){ existing=[]; }
  if(!Array.isArray(existing)) existing=[];
  if(!existing.length){
    try{ migrated = JSON.parse(oldMovs); }catch(e){ migrated=[]; }
    if(Array.isArray(migrated) && migrated.length){
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
// Lo que ya tenías invertido en cada ticker antes del primer movimiento cargado, por moneda:
// {"AL30D": {ars:0, usd:78.96}}. Ver posicion-inicial.js.
let posicionInicial = {};
// Cuánto vale hoy cada posición abierta, cargado a mano: {"SPY": {ars, usd, fecha}}.
// Ver valuaciones.js. La app no busca precios en ningún lado.
let valuaciones = {};

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

// ═══════════════════════════════════════════
// QUÉ CUENTA COMO GASTO Y COMO INGRESO
// ═══════════════════════════════════════════
// El modelo, en una frase: CADA PESO SE CUENTA UNA VEZ, CUANDO SE MUEVE.
//
//   Depositás en el fondo   → es un gasto (la plata se va de la mano)
//   Sacás del fondo         → es un ingreso (la plata vuelve a la mano)
//   Pagás algo con esa plata→ es un gasto (se va de nuevo)
//
// Un retiro es el único movimiento que cuenta DOS veces y en sentidos opuestos: la app lo
// guarda como un solo registro (un Gasto con usaAhorro) que representa la compra pagada con
// ahorros, así que suma como ingreso (el retiro) Y resta como gasto (la compra). Se cancelan
// en el balance y el fondo baja, que es exactamente lo que pasó.
//
// Esta regla estaba escrita a mano en 55 lugares del código y no todos decían lo mismo:
// el gráfico por categoría y los presupuestos contaban la compra, pero los totales del mes
// y del dashboard la sumaban como ingreso y NUNCA la restaban como gasto. El balance quedaba
// inflado en exactamente la plata que sacabas del fondo.
//
// Si alguna vez querés cambiar el criterio, se cambia ACÁ y vale para toda la app.

function esGasto(m){
  return !!m && m.tipo==="Gasto";
}
// Depósito al fondo de ahorro.
function esDepositoAhorro(m){
  return esGasto(m) && !!m.esAhorro;
}
// Compra pagada con plata del fondo. Es un gasto: consumiste, y el fondo baja.
function esRetiroAhorro(m){
  return esGasto(m) && !!m.usaAhorro;
}
// Un TRASPASO mueve plata entre bolsillos tuyos —del fondo a una inversión, de una cuenta a
// otra— sin que dejes de tenerla. No es ingreso ni gasto.
//
// Hacía falta porque la app no tenía forma de decirlo: marcar "sale de mis ahorros" en un gasto
// obliga a que el movimiento sea consumo. Para sacar plata del fondo y ponerla en CEDEARs no
// había casilla correcta, y esa plata figuraba gastada. En los datos reales eran $1.040.321 en
// cuatro movimientos, todos en los meses que daban rojo.
function esTraspaso(m){
  return !!m && !!m.traspaso;
}
// Un CAMBIO DE MONEDA son dos movimientos que se corresponden: los pesos que salen y los
// dólares que entran. Es la misma plata cambiando de bolsillo, igual que un traspaso.
//
// Antes los pesos contaban como GASTO: el balance se leía como un balance en pesos, y comprar
// dólares lo bajaba. Es defendible, pero era el único caso así — guardar en el fondo, traspasar
// entre bolsillos y poner plata en una inversión ya salían de Gastos y se mostraban en un chip
// aparte, porque esa plata la seguís teniendo. Comprar dólares es exactamente lo mismo.
// Con los datos reales eran once meses con pesos contados como gastados: diciembre 2025 solo,
// $305.947.
//
// En las vistas POR MONEDA cada pata sigue siendo real para su moneda: los dólares que entran
// por un cambio son dólares que entraron, y por eso la card de USD los cuenta.
function esPataDeCambio(m){ return !!m && !!m.cambioId; }
// Plata que dejaste de tener. Es LA definición que usan el balance, el dashboard y los chips:
// un gasto que no es ni un depósito al fondo ni un traspaso.
function esConsumo(m){
  return esGasto(m) && !esDepositoAhorro(m) && !esTraspaso(m) && !esPataDeCambio(m);
}
// Plata que ENTRA a tu patrimonio: solo los ingresos propiamente dichos.
//
// Antes un retiro del fondo también contaba como ingreso, porque el balance medía "plata a la
// mano". Ya no: el balance mide cuánto creció tu patrimonio, y sacar plata de tu propio fondo
// no te hace más rico. La compra que pagaste con ese retiro sí es un gasto, y ahí baja el
// patrimonio — una sola vez, donde corresponde.
function esIngreso(m){
  return !!m && m.tipo==="Ingreso" && !esPataDeCambio(m);
}

// Totales de plata de un conjunto de movimientos, en un solo lugar y sin tocar el DOM,
// para que la regla de arriba se pueda probar de verdad y no haya dos versiones dando vueltas.
// `balance` es cuánto cambió la plata que tenés a mano en ese período.
// EL MODELO DE LA PLATA, en un solo lugar.
//
// Ingresos = lo que entró a tu patrimonio.
// Gastos   = lo que consumiste. Guardar plata NO es consumirla, así que los depósitos al fondo
//            y el capital que ponés en inversiones quedan afuera. Gastar plata del fondo SÍ es
//            consumo, y por eso los retiros se quedan adentro.
// Balance  = cuánto creció tu patrimonio este mes, esté donde esté esa plata (en la cuenta, en
//            el fondo o invertida).
//
// De las inversiones solo cuenta el RESULTADO, y lo calcula resultado-inversiones.js, que
// necesita toda la historia (para saber si una venta es ganancia hay que saber cuánto capital
// venías poniendo desde antes). Por eso llega como parámetro en vez de calcularse acá:
// totalesDePlata() ve una lista suelta y no puede saberlo. Sin ese parámetro las inversiones
// son neutras, que es la respuesta correcta cuando no se sabe.
function totalesDePlata(lista, gananciaInv){
  const ingresos = lista.filter(esIngreso).reduce((s,m)=>s+(m.importe||0),0);
  const depositos= lista.filter(esDepositoAhorro).reduce((s,m)=>s+(m.importe||0),0);
  const retiros  = lista.filter(esRetiroAhorro).reduce((s,m)=>s+(m.importe||0),0);
  // Todo lo que tiene tipo "Gasto" menos lo que seguís teniendo: lo que fue a parar al fondo y
  // los traspasos entre tus propios bolsillos.
  const gastos   = lista.filter(m=>esConsumo(m)).reduce((s,m)=>s+(m.importe||0),0);
  const traspasos= lista.filter(esTraspaso).reduce((s,m)=>s+(m.importe||0),0);
  // Los pesos que se fueron a dólares. No son gasto, pero se muestran: es plata que se movió.
  const cambios  = lista.filter(m=>esPataDeCambio(m) && m.cambioPata==="sale" && m.moneda!=="USD")
                        .reduce((s,m)=>s+(m.importe||0),0);
  const inversiones = lista.filter(m=>m.tipo==="Inversion");
  // Los flujos brutos quedan para mostrarlos como informativos. NO entran al balance: son la
  // misma plata yendo y viniendo, y contarlos enteros infla los dos totales en cada vuelta.
  const invEntra = inversiones.filter(m=>isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const invSale  = inversiones.filter(m=>!isInvSalida(m)).reduce((s,m)=>s+(m.importe||0),0);
  const ganancia = (gananciaInv && gananciaInv.ars) || 0;
  return {
    ingresos, gastos, depositos, retiros, traspasos, cambios, invEntra, invSale,
    gananciaInv: ganancia,
    // Una ganancia suma a ingresos; una pérdida resta, y por eso se parte en dos.
    ingresosTotal: Math.round((ingresos + Math.max(ganancia,0))*100)/100,
    gastosTotal:   Math.round((gastos   + Math.max(-ganancia,0))*100)/100,
    balance: Math.round((ingresos + ganancia - gastos)*100)/100
  };
}

// ── SEGURIDAD ──
// Devuelve un valor listo para usar como ARGUMENTO dentro de un onclick="...".
// Hay DOS contextos anidados y hay que respetar los dos: el atributo HTML (delimitado por
// comillas dobles) y, adentro, el literal de JavaScript. El patrón viejo
//     onclick="f('${valor.replace(/'/g,"\\'")}')"
// solo escapaba la comilla simple, así que un nombre de cuenta o categoría con comilla
// DOBLE cerraba el atributo antes de tiempo y permitía inyectar otros (onerror=, etc.).
// JSON.stringify produce un literal JS válido con cualquier contenido, y escapeHtml lo
// vuelve seguro como atributo; el navegador decodifica las entidades antes de evaluar el JS,
// así que el valor llega entero a la función.
//    attrJS(`Visa "Oro"`)  →  &quot;Visa \&quot;Oro\&quot;&quot;
// Uso: onclick="setFiltroTarjeta(${attrJS(t)})"   ← sin comillas alrededor, ya las trae
function attrJS(valor){
  return escapeHtml(JSON.stringify(String(valor==null?"":valor)));
}

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
// Lo que se muestra cuando un número NO es un número: un registro cargado a medias, un
// import raro, un campo que quedó vacío. No puede ser "$0".
//
// Un cero es un DATO ("este mes no gastaste nada"); esto es la AUSENCIA de dato. Mostrar los
// dos igual es lo que escondió durante meses el saldo USD mal calculado: una tarjeta sin
// `total` daba NaN, el total del mes daba NaN, y la pantalla decía "$0" como si estuviera
// todo bien. Con "—" se ve que falta algo y se puede ir a buscarlo.
const SIN_DATO = "—";

// `isFinite(Number(x))` cubre NaN e Infinity de una. Los chequeos de antes son porque
// Number(null) y Number("") dan 0, no NaN: sin ellos, un campo vacío pasaría como un cero.
function numeroRoto(n){
  return n===undefined || n===null || n==="" || typeof n==="boolean" || !isFinite(Number(n));
}

function fmt(n){
  if(numeroRoto(n))return SIN_DATO;
  const abs=Math.abs(n);
  const rounded=Math.round(abs*100)/100;
  const sign=n<0?"-":"";
  // Siempre 2 decimales, separador de miles punto, decimal coma (es-AR)
  return sign+"$"+rounded.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
// fmtTotal = para TOTALES y balances (chips de resumen, balance del año, saldo de una cuenta).
// Sin centavos: en una cifra de siete u ocho dígitos los centavos son dos dígitos que nadie va
// a usar y que hacen más lento leer el número. En la app convivían "$14.236.967,97" arriba y
// "$2.1M" abajo, o sea tres precisiones distintas en la misma pantalla.
// Los centavos siguen estando donde SÍ importan: en el importe de un movimiento (fmtS).
function fmtTotal(n){
  if(numeroRoto(n))return SIN_DATO;
  const abs=Math.abs(n);
  const sign=n<0?"-":"";
  return sign+"$"+Math.round(abs).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
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
  return `<span style="font-size:.6em;font-weight:500;vertical-align:2px">${signo}</span>${fmtTotal(abs)}`;
}
// fmtAbbr = versión abreviada solo para ejes de gráficos donde no hay espacio
function fmtAbbr(n){
  if(numeroRoto(n))return SIN_DATO;
  if(n===0)return "$0";
  const abs=Math.abs(n);
  const sign=n<0?"-":"";
  if(abs>=1000000)return sign+"$"+(abs/1000000).toFixed(1)+"M";
  if(abs>=1000)return sign+"$"+(abs/1000).toFixed(0)+"K";
  return fmt(n);
}
function mesLbl(ym){if(!ym)return"";const[y,m]=ym.split("-");return MESES[parseInt(m)-1]+" "+y;}
// Formatea un monto según su moneda. ARS usa el formato es-AR ($), USD usa "USD X.XX"
function fmtMoneda(n, moneda){
  if(numeroRoto(n))return SIN_DATO;
  if(moneda==="USD"){
    const abs=Math.abs(n||0);
    const sign=(n||0)<0?"-":"";
    return sign+"USD "+(Math.round(abs*100)/100).toFixed(2);
  }
  return fmt(n);
}
