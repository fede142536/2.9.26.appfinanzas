// ═══════════════════════════════════════════
// CIFRADO DE DATOS SENSIBLES LIGADO AL PIN
// ═══════════════════════════════════════════
// Cuando el usuario activa un PIN, los datos financieros (las 10 claves de ENC_KEYS) dejan
// de guardarse en texto plano en localStorage: se cifran con AES-GCM usando una clave
// derivada del PIN (PBKDF2) y se guardan como un único blob en "fencblob" (+ "fencsalt").
// Mientras la app está bloqueada esos datos NO existen en memoria (ver checkLock/checkPin
// más abajo y loadSensitiveIntoMemory) — antes, la pantalla de PIN era solo una capa visual
// mientras todo ya estaba cargado en JS. Si el usuario NUNCA activó un PIN, isEncActive()
// da false siempre y getSensitiveRaw/setSensitiveRaw se comportan exactamente igual que
// localStorage.getItem/setItem de toda la vida: cero cambio de comportamiento ni overhead.
const ENC_KEYS = ["fmovs3","ftcs3","fcustom3","fmetas","fimphist3","fcuentas","ftarjetas","fpresup","fcatorder","ficons","fpapelera"];
// Costo de derivar la clave desde el PIN. Los sobres viejos (v2) no lo guardaban: eran 150.000. Los nuevos (v3) lo guardan en `it`, así se puede
// subir más adelante sin romper los datos ya guardados. Un PIN de 6 dígitos son solo 1.000.000 de combinaciones: lo que lo cuida, si alguien se
// lleva el archivo, es que cada intento cueste (1.000.000 de vueltas de PBKDF2), no el PIN en sí.
const KDF_ITER_LEGADO=150000;
const KDF_ITER=1000000;
const PIN_LEN_LEGADO=4;   // los PIN de antes tenían 4 dígitos
const PIN_LEN_NUEVO=6;
// Además del PIN numérico se puede usar un código alfanumérico (letras y números, de 8 a 12 caracteres): con 8 caracteres hay más de
// 200.000.000.000.000 de combinaciones, contra 1.000.000 de un PIN de 6 dígitos. El sobre anota el modo en `pm` ("a" = alfanumérico).
const CODIGO_MIN=8;
const CODIGO_MAX=12;
let encKey=null;   // CryptoKey en memoria, solo durante la sesión desbloqueada (nunca se persiste)
let encCache=null; // cuando el cifrado está activo: copia en memoria {clave: valorJSONstring, ...}

// El cifrado está activo si existe el sobre (formato nuevo) o el salt suelto (formato viejo,
// ver guardarSobre): mientras exista cualquiera de los dos, los datos NO están en claro.
function isEncActive(){
  return !!(localStorage.getItem("fencblob") || localStorage.getItem("fencsalt"));
}
// ¿Hay un PIN? El sobre cifrado ES el PIN: no se guarda ningún hash del PIN (con 4 o 6 dígitos un hash se adivina al instante, y con él
// el cifrado no servía de nada). Un PIN se comprueba descifrando el sobre. "fpinhash" solo lo dejan los PIN de antes del cifrado: se usa
// una vez, para migrarlos, y se borra.
function pinConfigurado(){
  return isEncActive() || !!localStorage.getItem("fpinhash");
}
// Cuántos dígitos tiene el PIN actual: lo dice el sobre (`pl`); los de antes eran de 4.
function pinLen(){
  try{ const o=leerSobre(); if(o && Number.isInteger(o.pl) && o.pl>=4 && o.pl<=12) return o.pl; }catch(e){ /* sobre ilegible */ }
  return PIN_LEN_LEGADO;
}
// "n" = PIN numérico (teclado de números en pantalla), "a" = código alfanumérico (campo de texto).
function pinModo(){
  try{ const o=leerSobre(); if(o && o.pm==="a") return "a"; }catch(e){ /* sobre ilegible */ }
  return "n";
}

// ── El sobre cifrado ──
// El salt va DENTRO del blob, no en una clave aparte. Esto no es cosmético: localStorage no
// tiene transacciones, así que dos escrituras separadas se pueden cortar por la mitad. Con
// salt y blob separados, quedarse sin espacio entre una y otra dejaba dos escenarios feos:
//   · migración: quedaba el salt sin blob → al abrir, la app se desbloqueaba VACÍA y el
//     primer guardado pisaba los datos buenos;
//   · cambio de PIN: el salt nuevo con el blob viejo → ningún PIN podía descifrar nunca más.
// Con una sola escritura eso no puede pasar: o entró el sobre completo, o no entró nada y
// queda el anterior intacto.
function leerSobre(){
  const crudo=localStorage.getItem("fencblob");
  if(!crudo) return null;
  const sobre=JSON.parse(crudo);
  if(!sobre || typeof sobre!=="object") return null;
  // Formato viejo (v1): el salt vivía aparte, en "fencsalt"
  if(!sobre.salt) sobre.salt=localStorage.getItem("fencsalt");
  return sobre;
}

// `meta` ({it, pl, pm}): iteraciones de la derivación, dígitos del PIN y modo ("a" = alfanumérico). Sin `meta` se conservan los del sobre que ya está guardado, para que
// guardar datos nuevos nunca cambie con qué parámetros hay que abrirlo (y un sobre viejo siga siendo v2, sin `it`).
async function guardarSobre(clave, salt, cache, meta){
  const {iv, data}=await encryptBlob(clave, cache);
  let previo=null; try{ previo=leerSobre(); }catch(e){ previo=null; }
  const it=meta && meta.it!==undefined ? meta.it : (previo && previo.it);
  const pl=meta && meta.pl!==undefined ? meta.pl : (previo && previo.pl);
  const pm=meta && meta.pm!==undefined ? meta.pm : (previo && previo.pm);
  localStorage.setItem("fencblob", JSON.stringify({v:it?3:2, salt, ...(it?{it}:{}), ...(pl?{pl}:{}), ...(pm?{pm}:{}), iv, data}));
  // El sobre nuevo ya se basta solo: el salt suelto del formato viejo sobra.
  localStorage.removeItem("fencsalt");
}

// Convierte bytes a base64 de a bloques. NO usar String.fromCharCode(...bytes): el spread
// pasa CADA byte como un argumento distinto, así que con un blob grande (años de
// movimientos = cientos de miles de bytes) revienta con "Maximum call stack size exceeded".
function bytesToB64(bytes){
  const CHUNK=0x8000;
  let bin="";
  for(let i=0;i<bytes.length;i+=CHUNK){
    bin+=String.fromCharCode.apply(null, bytes.subarray(i, i+CHUNK));
  }
  return btoa(bin);
}

function randomSaltB64(){
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriveKey(pin, saltB64, iteraciones){
  const salt=Uint8Array.from(atob(saltB64), c=>c.charCodeAt(0));
  const baseKey=await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations:iteraciones||KDF_ITER_LEGADO, hash:"SHA-256"},
    baseKey, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]
  );
}

async function encryptBlob(key, obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(obj));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, data);
  return {iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher))};
}

async function decryptBlob(key, blob){
  const iv=Uint8Array.from(atob(blob.iv), c=>c.charCodeAt(0));
  const data=Uint8Array.from(atob(blob.data), c=>c.charCodeAt(0));
  const plain=await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

// Lectura/escritura de las 10 claves sensibles. Si el cifrado NO está activo, se comportan
// exactamente igual que localStorage.getItem/setItem de siempre (cero cambio de comportamiento
// para usuarios sin PIN). Si está activo, leen/escriben en encCache (memoria) y programan
// la persistencia cifrada conjunta en "fencblob".
function getSensitiveRaw(key, fallback){
  if(isEncActive()){
    // Con el cifrado activo los datos SOLO viven en el sobre. Si todavía no se descifró
    // (app bloqueada), no hay nada que devolver: leer localStorage acá devolvería restos.
    if(!encCache) return fallback;
    return (key in encCache) ? encCache[key] : fallback;
  }
  return localStorage.getItem(key) || fallback;
}
let encSaveTimer=null;
function setSensitiveRaw(key, value){
  if(isEncActive()){
    // Con el cifrado activo y la app todavía bloqueada, escribir en localStorage guardaría
    // los datos EN CLARO, y además quedarían invisibles (al desbloquear se lee el sobre, no
    // estas claves). Pasaba, por ejemplo, soltando un backup sobre la pantalla del PIN.
    // Mejor fallar fuerte que guardar mal en silencio.
    if(!encCache) throw new Error("La app está bloqueada: ingresá el PIN antes de guardar cambios.");
    encCache[key]=value;
    clearTimeout(encSaveTimer);
    encSaveTimer=setTimeout(persistEncBlobNow, 400);
  } else {
    localStorage.setItem(key, value);
  }
}
async function persistEncBlobNow(){
  encSaveTimer=null;
  if(!encKey || !encCache) return;
  const sobre=leerSobre();
  try{
    await guardarSobre(encKey, (sobre && sobre.salt) || randomSaltB64(), encCache);
  }catch(err){
    // Con el PIN activo el guardado real es diferido (encCache + este volcado con 400ms de
    // retraso), así que cuando se entera del fallo ya pasó tiempo y puede haber más de un
    // cambio en el aire: revertir podría llevarse puesto algo que el usuario no espera. Por
    // eso acá se avisa y se ofrece el backup —que se arma desde la memoria y por lo tanto
    // incluye todo lo que no llegó al disco— pero no se toca nada.
    console.error("No se pudo guardar el sobre cifrado:", err);
    avisarGuardadoFallido(err, {puedeRevertir:false});
  }
}

// El guardado cifrado se difiere 400 ms para no re-cifrar todo en cada tecla. Si la app se
// cierra dentro de esa ventana, ese último cambio se perdía: antes la escritura era
// sincrónica y esto no pasaba. Se fuerza el guardado al ocultarse la app (que en un celular
// es lo que ocurre al cambiar de app o bloquear la pantalla).
function flushGuardadoPendiente(){
  if(encSaveTimer){
    clearTimeout(encSaveTimer);
    persistEncBlobNow();
  }
}
window.addEventListener("pagehide", flushGuardadoPendiente);
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden") flushGuardadoPendiente();
});

// Nombres legibles para el aviso al usuario si una clave sale corrupta. En español, porque
// es lo único de esto que el usuario llega a ver.
const NOMBRE_CLAVE_DATOS={
  fmovs3:"tus movimientos", ftcs3:"tus tarjetas", fcustom3:"tus categorías personalizadas",
  fmetas:"tus metas de ahorro", fpapelera:"tu papelera", fimphist3:"tu historial de importaciones",
  fcatorder:"el orden de tus categorías", fpresup:"tus presupuestos",
  fcuentas:"tus cuentas", ftarjetas:"tus tarjetas guardadas", ficons:"tus íconos personalizados"
};

// Parsea un valor guardado por la propia app sin dejar que uno corrupto tire abajo el resto
// del arranque. Antes, un JSON.parse roto en loadSensitiveIntoMemory() —JSON inválido, o un
// tipo que cambió de forma, por ejemplo "fmovs3" con un objeto en vez de una lista— cortaba
// la función a la mitad: todo lo que venía DESPUÉS se quedaba sin cargar (tcs, presupuestos,
// cuentas...) y la app se veía completamente vacía, sin ningún aviso de qué pasó.
//   - `tipo` es "array" u "object": si el JSON parsea pero no tiene esa forma, también se
//     trata como corrupto (fmovs3 pisado con "{}" rompía renderMovs() con un TypeError,
//     "movs.forEach is not a function").
//   - Nunca tira: si algo falla, lo anota en datosCorruptosAlArrancar y devuelve el valor
//     por defecto, para que la clave siguiente se siga cargando bien.
//   - A propósito NO reescribe la clave en localStorage ni en el sobre cifrado: si el dato
//     original todavía está ahí (aunque roto), sigue disponible para recuperarlo a mano en
//     vez de perderse apenas arranca la app. Recién se pisa si el usuario sigue usando la
//     app y algo la guarda de nuevo — igual que pasaría con cualquier dato nuevo.
let datosCorruptosAlArrancar=[];
// Guarda una lista leída con leerJSONSeguro(). Tiene que existir al lado de la lectura, porque
// el par leer/escribir se rompe fácil: leerJSONSeguro() pasa por getSensitiveRaw(), que con el
// PIN activo lee de encCache, y si la escritura va derecho a localStorage el valor se guarda
// donde nadie lo busca. Eso pasó con las listas de "no me lo muestres más" de la migración de
// cambios y de traspasos: con PIN, tocabas el botón y el movimiento volvía a aparecer al
// instante — desde afuera, el botón no hacía nada.
function guardarJSONSeguro(clave, valor){
  try{
    setSensitiveRaw(clave, JSON.stringify(valor));
    return true;
  }catch(e){
    // setSensitiveRaw tira si la app está bloqueada. Una preferencia no vale un error rojo.
    console.warn(`No se pudo guardar "${clave}":`, e);
    return false;
  }
}

function leerJSONSeguro(clave, defaultJSON, tipo){
  const crudo=getSensitiveRaw(clave, defaultJSON);
  let valor;
  try{ valor=JSON.parse(crudo); }catch(e){ valor=undefined; }
  const formaOk = tipo==="array" ? Array.isArray(valor)
    : (valor!==null && typeof valor==="object" && !Array.isArray(valor));
  if(formaOk) return valor;
  datosCorruptosAlArrancar.push(clave);
  return JSON.parse(defaultJSON);
}

// Puebla las variables globales en memoria (movs, tcs, custom, etc.) con los datos reales:
// en claro si el cifrado no está activo, o desde encCache (ya descifrado por checkPin) si
// lo está. Se llama desde bootApp() DESPUÉS de que checkLock() resuelve — es decir, después
// de que no hace falta PIN, o de que el PIN correcto ya fue ingresado y descifrado.
function loadSensitiveIntoMemory(){
  datosCorruptosAlArrancar=[];
  movs = leerJSONSeguro("fmovs3","[]","array");
  tcs = leerJSONSeguro("ftcs3","[]","array");
  custom = leerJSONSeguro("fcustom3",'{"Gasto":{},"Ingreso":{},"Inversion":{},"Tarjeta":{}}',"object");
  if(!custom.Tarjeta) custom.Tarjeta={};
  metas = leerJSONSeguro("fmetas","[]","array");
  importHistory = leerJSONSeguro("fimphist3","[]","array");
  catOrder = leerJSONSeguro("fcatorder","{}","object");
  presupuestos = leerJSONSeguro("fpresup","{}","object");
  cuentasCustom = leerJSONSeguro("fcuentas","[]","array");
  tarjetasCustom = leerJSONSeguro("ftarjetas","[]","array");
  iconsCustom = leerJSONSeguro("ficons","{}","object");
  if(typeof cargarPapelera==="function") cargarPapelera();
  if(datosCorruptosAlArrancar.length) avisarDatosCorruptos(datosCorruptosAlArrancar);
}

// Aviso post-arranque: reusa el banner de error global (el mismo que atrapa cualquier
// excepción no manejada) en vez de inventar otra UI. Se llama con un delay corto para no
// competir con el primer render de la pantalla.
function avisarDatosCorruptos(claves){
  const nombres=claves.map(k=>NOMBRE_CLAVE_DATOS[k]||k).join(", ");
  setTimeout(()=>{
    mostrarErrorGlobal(
      `No se pudieron leer ${nombres}. Se muestran vacíos por ahora.`,
      `Claves afectadas: ${claves.join(", ")}\n\n` +
      `Los datos guardados no se borraron: siguen en el dispositivo tal cual estaban. ` +
      `Si tenés un backup exportado, podés restaurarlo desde Configuración. ` +
      `Si el problema persiste, copiá este detalle y compartilo para poder ayudarte.`
    );
  }, 400);
}

// ═══════════════════════════════════════════
// PIN DE BLOQUEO (opcional)
// ═══════════════════════════════════════════
// El PIN es la clave del sobre cifrado (ver arriba) y se comprueba descifrándolo: no se guarda ningún hash. Los PIN de antes del cifrado
// dejaron un hash en "fpinhash": se acepta una sola vez para migrarlos y se borra. Esto NO es seguridad militar: un PIN de 6 dígitos tiene
// 1.000.000 de combinaciones y, si alguien se lleva el archivo del navegador, las prueba todas (cada una cuesta 1.000.000 de vueltas de PBKDF2,
// así que no es instantáneo, pero un equipo potente lo hace en minutos u horas). Protege bien contra quien agarra tu celular.
// Hash SHA-256 del PIN de las versiones sin cifrado: solo sirve para migrarlos (ver checkPin).
async function hashPin(pin){
  const enc=new TextEncoder().encode(pin+"enola_salt_v1");
  const buf=await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

let pinBuffer=""; // PIN que se está tipeando en la pantalla de bloqueo
let pinSetupStep=0; // 0=ingresar, 1=confirmar (en setup)
let pinSetupFirst=""; // primer PIN ingresado durante setup

// ── Intentos fallidos: desde el 5º, hay que esperar (30 s, 1 min, 2 min… hasta 1 hora) ──
// Es una traba de la pantalla: frena al curioso que prueba PIN en tu celular. No frena a quien se lleva el archivo (eso lo frena el costo de
// la derivación). Se guarda en localStorage llano porque tiene que funcionar con la app bloqueada.
const PIN_FALLOS_KEY="fpinfallos";
const PIN_FALLOS_LIBRES=4;   // los primeros intentos erróneos no esperan
// Pura. Segundos de espera tras `n` intentos fallidos seguidos.
function esperaTrasFallos(n){
  if(!(n>PIN_FALLOS_LIBRES)) return 0;
  return Math.min(30*Math.pow(2, n-PIN_FALLOS_LIBRES-1), 3600);
}
function leerFallosPin(){
  try{ const o=JSON.parse(localStorage.getItem(PIN_FALLOS_KEY)||"null"); return {n:Math.max(0, o&&o.n|0), hasta:Number(o&&o.hasta)||0}; }
  catch(e){ return {n:0, hasta:0}; }
}
// Segundos que faltan para poder volver a intentar (0 = ya se puede).
function segundosDeEsperaPin(ahora){
  const f=leerFallosPin();
  return f.hasta>(ahora||Date.now()) ? Math.ceil((f.hasta-(ahora||Date.now()))/1000) : 0;
}
function registrarFalloPin(ahora){
  const f=leerFallosPin(); f.n++;
  const e=esperaTrasFallos(f.n); f.hasta=e ? (ahora||Date.now())+e*1000 : 0;
  try{ localStorage.setItem(PIN_FALLOS_KEY, JSON.stringify(f)); }catch(err){ /* sin almacenamiento */ }
  return f;
}
function limpiarFallosPin(){ try{ localStorage.removeItem(PIN_FALLOS_KEY); }catch(e){ /* sin almacenamiento */ } }
// [AAA bloqueo] Con espacio duro (\u00a0) entre la cifra y la unidad: "30 s" no se parte en dos renglones.
const textoEspera=seg=>seg>=60 ? `${Math.ceil(seg/60)}\u00a0min` : `${seg}\u00a0s`;

// Comprueba un PIN contra el sobre: devuelve {clave, cache} si abre, o null si el PIN no es. No toca el estado de la app.
async function verificarPin(pin){
  try{
    const sobre=leerSobre();
    if(!sobre || !sobre.salt || !sobre.data) return null;
    const clave=await deriveKey(String(pin), sobre.salt, sobre.it||KDF_ITER_LEGADO);
    return {clave, cache:await decryptBlob(clave, sobre)};
  }catch(e){ return null; }   // con un PIN equivocado, AES-GCM falla la verificación: eso es "PIN incorrecto"
}

// Resuelve la promise de checkLock() cuando el PIN correcto fue ingresado (y ya se
// descifraron/cargaron los datos). Ver checkPin().
let _unlockResolve=null;
// Decide si hay que mostrar la pantalla de bloqueo al iniciar. Devuelve una Promise que
// se resuelve inmediatamente si no hay PIN configurado, o recién cuando el PIN correcto
// se ingresa (y, si el cifrado está activo, los datos ya quedaron descifrados en memoria).
// bootApp() espera (await) esta promise ANTES de cargar los datos sensibles y renderizar,
// así que mientras la pantalla de bloqueo está visible los datos financieros no existen
// todavía en JS (antes se cargaban igual, en paralelo, y el PIN era solo una capa visual).
function checkLock(){
  return new Promise((resolve)=>{
    if(!pinConfigurado()){
      // No hay PIN configurado: app abierta sin bloqueo
      document.getElementById("lock-screen").style.display="none";
      resolve();
      return;
    }
    // Hay PIN: mostrar pantalla y esperar a que checkPin() la resuelva
    _unlockResolve=resolve;
    pinBuffer="";
    pinSetupStep=0;
    ajustarPantallaBloqueo();
    updatePinDisplay();
    document.getElementById("pin-error").textContent="";
    document.getElementById("lock-screen").style.display="flex";
    // Si hay huella activa, el botón aparece y se la pide enseguida (se puede cancelar y teclear el PIN).
    if(typeof mostrarBotonHuella==="function" && typeof huellaActiva==="function" && huellaActiva()){
      mostrarBotonHuella();
      setTimeout(()=>{ if(typeof desbloquearConHuella==="function") desbloquearConHuella(); }, 350);
    }
  });
}

// La pantalla de bloqueo según el modo: con PIN numérico, los puntitos y el teclado de números; con código alfanumérico, un campo de texto.
function ajustarPantallaBloqueo(){
  const alfa=pinModo()==="a", ver=(id,d)=>{ const e=document.getElementById(id); if(e) e.style.display=d; };
  ver("pin-display", alfa?"none":"flex"); ver("pin-pad", alfa?"none":"grid"); ver("pin-texto-wrap", alfa?"flex":"none");
  const t=document.getElementById("lock-texto"); if(t) t.textContent=alfa ? "Ingresá tu código para continuar" : "Ingresá tu PIN para continuar";
  ajustarBloqueoAlTeclado();
  if(alfa){ const i=document.getElementById("pin-texto"); if(i){ i.value=""; i.type="password"; setTimeout(()=>{ try{ i.focus(); }catch(e){} }, 400); } }
}
// El código alfanumérico se manda con el botón Entrar o con Enter (un PIN numérico se manda solo al completar los dígitos).
async function pinTextoEnviar(){
  const i=document.getElementById("pin-texto"); if(!i || !i.value) return;
  pinBuffer=i.value; i.value="";
  await checkPin();
  if(!appDesbloqueadaConPin()){ try{ i.focus(); }catch(e){} }
}
function pinTextoMostrar(){
  const i=document.getElementById("pin-texto"); if(!i) return;
  i.type=i.type==="password" ? "text" : "password";
  const b=document.getElementById("pin-texto-ver"); if(b){ b.textContent=i.type==="password" ? "Mostrar" : "Ocultar"; b.setAttribute("aria-pressed", String(i.type!=="password")); }
  try{ i.focus(); }catch(e){}   // [AAA bloqueo] el foco vuelve al campo: el teclado no se cierra al tocar Mostrar
}
// Los puntitos de la pantalla de bloqueo: tantos como dígitos tiene el PIN (4 los de antes, 6 los nuevos).
function updatePinDisplay(){
  const cont=document.getElementById("pin-display");
  const n=pinLen();
  if(cont && cont.querySelectorAll(".pin-dot").length!==n){
    cont.innerHTML=Array.from({length:n}, ()=>'<span class="pin-dot"></span>').join("");
  }
  const dots=document.querySelectorAll("#pin-display .pin-dot");
  dots.forEach((d,i)=>{
    d.classList.toggle("filled", i<pinBuffer.length);
  });
  // [AAA bloqueo] Los puntitos son un dibujo: el lector de pantalla lee cuántos dígitos van (sin decir cuáles).
  if(cont) cont.setAttribute("aria-label", `PIN: ${Math.min(pinBuffer.length,n)} de ${n} dígitos`);
}

function pinPress(d){
  const largo=pinLen();
  if(pinBuffer.length>=largo) return;
  vibrar(15);
  if(pinBuffer.length===0) quitarErrorPin(true);   // empieza un intento nuevo: el aviso del anterior ya cumplió
  pinBuffer+=d;
  updatePinDisplay();
  if(pinBuffer.length===largo){
    setTimeout(checkPin, 150);
  }
}
function pinBackspace(){
  if(pinBuffer.length>0){
    pinBuffer=pinBuffer.slice(0,-1);
    updatePinDisplay();
    document.getElementById("pin-error").textContent="";
    quitarErrorPin();
  }
}

// [AAA bloqueo] Teclado físico y foco de la pantalla de bloqueo (y de la bienvenida): con el PIN numérico los dígitos y Retroceso del teclado
// funcionan como las teclas de pantalla; Tab no se escapa a la app que está detrás (todavía sin datos): da la vuelta por los controles visibles.
function pantallaTapa(id){ const e=document.getElementById(id); return !!e && e.style.display!=="none" && getComputedStyle(e).display!=="none"; }
document.addEventListener("keydown", e=>{
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const dialogo=document.getElementById("modal-dialogo");
  if(dialogo && dialogo.classList.contains("open")) return;
  const id=pantallaTapa("lock-screen") ? "lock-screen" : (pantallaTapa("onboarding-screen") ? "onboarding-screen" : "");
  if(!id) return;
  if(e.key==="Tab"){
    const raiz=document.getElementById(id);
    const f=[...raiz.querySelectorAll("button,input,select,a[href]")].filter(x=>!x.disabled && x.offsetParent!==null && getComputedStyle(x).visibility!=="hidden");
    if(!f.length) return;
    const primero=f[0], ultimo=f[f.length-1];
    if(!raiz.contains(document.activeElement)){ e.preventDefault(); (e.shiftKey?ultimo:primero).focus(); }
    else if(e.shiftKey && document.activeElement===primero){ e.preventDefault(); ultimo.focus(); }
    else if(!e.shiftKey && document.activeElement===ultimo){ e.preventDefault(); primero.focus(); }
    return;
  }
  if(id==="lock-screen" && pinModo()==="n" && e.target && e.target.tagName!=="INPUT"){
    if(/^[0-9]$/.test(e.key)){ e.preventDefault(); pinPress(e.key); }
    else if(e.key==="Backspace"){ e.preventDefault(); pinBackspace(); }
  }
});

// [AAA bloqueo] El error se dice de tres formas, para que no dependa del movimiento ni del color: el texto (con role="alert"), el sacudón de la
// pantalla y los puntitos/el campo en rojo, que quedan hasta el próximo intento. Con prefers-reduced-motion el sacudón no se mueve (lo apaga el CSS)
// pero el rojo sí se ve. La animación es una clase (.sacudon): se reinicia sacándola y poniéndola de nuevo.
let pinErrorTimer=null;
function sacudirPin(){
  ["pin-display","pin-texto-wrap"].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.classList.remove("sacudon"); void el.offsetWidth;
    el.classList.add("sacudon", "con-error");
    el.addEventListener("animationend", ()=>el.classList.remove("sacudon"), {once:true});
  });
  clearTimeout(pinErrorTimer); pinErrorTimer=setTimeout(()=>quitarErrorPin(), 2500);
}
function quitarErrorPin(tambienTexto){
  clearTimeout(pinErrorTimer);
  ["pin-display","pin-texto-wrap"].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove("con-error","sacudon"); });
  if(tambienTexto){ const e=document.getElementById("pin-error"); if(e) e.textContent=""; }
}
// [AAA bloqueo] La espera por intentos cuenta hacia atrás en pantalla (antes el "28 s" se quedaba quieto y nunca se despejaba). Solo repinta el
// texto del aviso y no toca ningún contador de seguridad: los segundos salen de segundosDeEsperaPin(). El lector de pantalla oye el aviso una
// vez (role="alert"); mientras cuenta, el aviso se marca aria-live="off" para que no lo repita cada segundo.
let pinCuentaAtras=null;
const AVISO_ESPERA=/^(Demasiados intentos|PIN incorrecto\. Esperá)/;
function iniciarCuentaAtrasPin(){
  clearInterval(pinCuentaAtras); pinCuentaAtras=null;
  const err=document.getElementById("pin-error");
  if(!err || segundosDeEsperaPin()<=0 || !AVISO_ESPERA.test(err.textContent)) return;
  const demasiados=err.textContent.startsWith("Demasiados");
  const texto=seg=>demasiados ? `Demasiados intentos. Probá de nuevo en ${textoEspera(seg)}.` : `PIN incorrecto. Esperá ${textoEspera(seg)} para volver a intentar.`;
  pinCuentaAtras=setInterval(()=>{
    const e=document.getElementById("pin-error");
    if(!e || !AVISO_ESPERA.test(e.textContent)){ clearInterval(pinCuentaAtras); pinCuentaAtras=null; return; }   // el aviso ya es otro (o se borró): no se pisa
    const seg=segundosDeEsperaPin();
    e.setAttribute("aria-live","off");
    if(seg<=0){ clearInterval(pinCuentaAtras); pinCuentaAtras=null; e.removeAttribute("aria-live"); e.textContent="Ya podés volver a intentar."; return; }
    e.textContent=texto(seg);
  }, 1000);
}

// [AAA bloqueo] Con el teclado del celular abierto (código alfanumérico) la pantalla de bloqueo se acomoda al área que de verdad se ve: el
// borde de arriba y de abajo del visualViewport pasan al CSS como --vv-top y --vv-bottom, y el contenido se vuelve a centrar ahí. Si el
// navegador achica la página entera, los dos valores dan 0 y no cambia nada.
function ajustarBloqueoAlTeclado(){
  const lock=document.getElementById("lock-screen"), v=window.visualViewport;
  if(!lock || !v) return;
  const alto=document.documentElement.clientHeight;
  lock.style.setProperty("--vv-top", Math.max(0, Math.round(v.offsetTop))+"px");
  lock.style.setProperty("--vv-bottom", Math.max(0, Math.round(alto-v.offsetTop-v.height))+"px");
}
document.addEventListener("input", e=>{ if(e.target && e.target.id==="pin-texto") quitarErrorPin(true); });   // al volver a escribir, se va el rojo y el aviso
if(window.visualViewport){ visualViewport.addEventListener("resize", ajustarBloqueoAlTeclado); visualViewport.addEventListener("scroll", ajustarBloqueoAlTeclado); }

async function checkPin(){
  const pinIngresado=pinBuffer;
  const err=document.getElementById("pin-error");
  // Con intentos fallidos de más hay que esperar: ni se prueba el PIN.
  const espera=segundosDeEsperaPin();
  if(espera>0){
    err.textContent=`Demasiados intentos. Probá de nuevo en ${textoEspera(espera)}.`;
    pinBuffer=""; setTimeout(updatePinDisplay, 300); sacudirPin(); iniciarCuentaAtrasPin();
    return;
  }
  let ok=false;
  let migracionRecien=false; // true solo si ESTA llamada acaba de migrar un PIN legado a cifrado
  if(isEncActive()){
    // Cifrado activo: el PIN es bueno si abre el sobre. No hay otro dato contra el que compararlo.
    let sobre=null; try{ sobre=leerSobre(); }catch(e){ sobre=null; }   // un sobre ilegible cuenta como incompleto
    // Si hay salt pero no sobre, algo quedó a medias. ANTES esto desbloqueaba con datos
    // vacíos y el primer guardado pisaba todo; ahora se avisa y no se entra, que deja
    // los datos donde están y da chance de restaurar un backup.
    if(!sobre || !sobre.salt || !sobre.data){
      err.textContent="Los datos cifrados están incompletos. Restaurá un backup desde otra copia de la app.";
      pinBuffer=""; setTimeout(updatePinDisplay, 300);
      return; // NO resolvemos: la pantalla de bloqueo sigue esperando
    }
    const abierto=await verificarPin(pinIngresado);
    if(abierto){ encKey=abierto.clave; encCache=abierto.cache; ok=true; }
  } else if(localStorage.getItem("fpinhash")){
    // PIN configurado desde una versión anterior al cifrado: todavía sin cifrar. Es la única vez que se mira el hash: si el PIN
    // es el bueno, se migra ahora mismo a un sobre cifrado y el hash se borra.
    if(await hashPin(pinIngresado)===localStorage.getItem("fpinhash")){
      try{
        const salt=randomSaltB64();
        encKey=await deriveKey(pinIngresado, salt, KDF_ITER);
        encCache={};
        ENC_KEYS.forEach(k=>{
          const v=localStorage.getItem(k);
          if(v!==null) encCache[k]=v;
        });
        // Una sola escritura: o queda el sobre entero, o no queda nada y los datos en claro
        // siguen intactos (isEncActive() sigue en false y la app abre normal).
        await guardarSobre(encKey, salt, encCache, {it:KDF_ITER, pl:pinIngresado.length});
        ENC_KEYS.forEach(k=>localStorage.removeItem(k));
        migracionRecien=true; ok=true;
      }catch(e){
        console.error("Error al migrar a cifrado:", e);
        encKey=null; encCache=null;
        err.textContent=`Error al cifrar: ${e.name||""} ${e.message||e}`;
        pinBuffer="";
        setTimeout(updatePinDisplay, 300);
        return; // NO resolvemos: la pantalla de bloqueo sigue esperando
      }
    }
  }
  if(ok){
    limpiarFallosPin();
    localStorage.removeItem("fpinhash");   // ya no hace falta: el sobre es la única verificación
    document.getElementById("lock-screen").style.display="none";
    pinBuffer="";
    updatePinDisplay();
    ultimaActividadPin=Date.now(); ocultoDesdePin=0;
    if(_unlockResolve){ const r=_unlockResolve; _unlockResolve=null; r(); }
    // El aviso se muestra DESPUÉS de desbloquear, y con showToast (no alert()): alert()/
    // confirm()/prompt() son diálogos nativos del navegador que en una PWA instalada (modo
    // standalone, sin barra de navegador) pueden no tener dónde renderizarse y quedan colgados
    // esperando una interacción que nunca llega — eso dejaba al usuario trabado para siempre
    // en la pantalla de PIN la primera vez que se migraba un PIN viejo a cifrado.
    if(migracionRecien){
      showToast("🔒 Tus datos ahora están cifrados y ligados a tu PIN. Te recomendamos descargar un backup desde Configuración por si alguna vez lo olvidás.");
    }
    setTimeout(ofrecerSubirPin, 1800);
  } else {
    const f=registrarFalloPin();
    const e=esperaTrasFallos(f.n);
    err.textContent=e>0 ? `PIN incorrecto. Esperá ${textoEspera(e)} para volver a intentar.` : "PIN incorrecto";
    pinBuffer="";
    setTimeout(updatePinDisplay, 300);
    sacudirPin();
    iniciarCuentaAtrasPin();
  }
}

// ── Pasar de 4 a 6 dígitos ──
// Un PIN de 4 dígitos tiene solo 10.000 combinaciones. Al desbloquear con uno, se ofrece subirlo (como mucho una vez por día, hasta que se haga).
const PIN_SUBIR_KEY="fpinsubir";
async function ofrecerSubirPin(){
  if(!pinConfigurado() || pinModo()==="a" || pinLen()>=PIN_LEN_NUEVO || !encKey) return;
  // Un diálogo nuevo cancela al que está abierto (ver _dialogoAbrir): si ya hay uno (por ejemplo el recordatorio de backup), se espera a que
  // el usuario lo responda en vez de pisarlo, y se sigue esperando hasta un minuto.
  const abierto=()=>{ const d=document.querySelector("#modal-dialogo"); return !!(d && d.classList.contains("open")); };
  for(let i=0; i<90 && abierto(); i++) await new Promise(r=>setTimeout(r, 700));
  if(abierto() || !encKey) return;
  const hoy=typeof hoyLocal==="function" ? hoyLocal() : new Date().toISOString().slice(0,10);
  if(localStorage.getItem(PIN_SUBIR_KEY)===hoy) return;
  try{ localStorage.setItem(PIN_SUBIR_KEY, hoy); }catch(e){ /* sin almacenamiento */ }
  if(await mostrarConfirm(`Tu PIN tiene ${pinLen()} dígitos: alguien que pruebe todas las combinaciones lo adivina en minutos. Con ${PIN_LEN_NUEVO} dígitos es 100 veces más difícil, y con un código de ${CODIGO_MIN} a ${CODIGO_MAX} letras y números, muchísimo más. ¿Lo cambiás ahora?`,
    {titulo:"🔐 Reforzá tu PIN", textoOk:"Cambiarlo ahora", textoCancelar:"Más tarde"})) await setupPin();
}

// Pura. ¿Es un PIN demasiado fácil de adivinar? "" si está bien; si no, el motivo. Se rechazan los repetidos (111111), las escaleras (123456, 654321)
// y los patrones más comunes.
function motivoPinDebil(pin){
  const p=String(pin||"");
  if(/^(\d)\1+$/.test(p)) return "No uses el mismo dígito repetido.";
  const d=[...p].map(Number);
  if(d.every((x,i)=>i===0 || x===(d[i-1]+1)%10) || d.every((x,i)=>i===0 || x===(d[i-1]+9)%10)) return "No uses una escalera de números (123456, 654321).";
  const comunes=["121212","123123","112233","101010","123321","159753","147258","000123","696969","520520","789456","456789","200000","100000","654123"];
  if(comunes.includes(p)) return "Ese PIN es de los más usados: elegí otro.";
  return "";
}

// Pura. ¿Sirve este código como PIN? {modo:"n"|"a", motivo:""}: "n" = 6 dígitos, "a" = 8 a 12 letras y números (al menos una letra y un número,
// sin espacios ni símbolos; las mayúsculas cuentan). `motivo` vacío = está bien; si no, qué corregir.
function validarCodigo(codigo){
  const c=String(codigo==null?"":codigo);
  if(new RegExp(`^\\d{${PIN_LEN_NUEVO}}$`).test(c)) return {modo:"n", motivo:motivoPinDebil(c)};
  const forma=`Usá ${PIN_LEN_NUEVO} dígitos, o un código de ${CODIGO_MIN} a ${CODIGO_MAX} letras y números (sin espacios ni símbolos).`;
  if(!new RegExp(`^[A-Za-z0-9]{${CODIGO_MIN},${CODIGO_MAX}}$`).test(c)) return {modo:"a", motivo:forma};
  if(!/[A-Za-z]/.test(c) || !/\d/.test(c)) return {modo:"a", motivo:"Mezclá letras y números."};
  if(new Set(c.toLowerCase()).size<5) return {modo:"a", motivo:"Usá más caracteres distintos: ese código se repite demasiado."};
  const base=c.toLowerCase().replace(/\d+/g,"");
  if(["password","pass","contrasena","clave","qwerty","qwertyuiop","asdfgh","asdfghjkl","abcd","abcdef","abcdefgh","enola","admin","finanzas","dinero","usuario"].includes(base)) return {modo:"a", motivo:"Ese código es de los más usados: elegí otro."};
  return {modo:"a", motivo:""};
}
// Cómo pedir el código en un cuadro de diálogo, según el modo del que ya está activo.
const opcionesPromptPin=()=>({tipoInput:"password", inputMode:pinModo()==="a" ? "text" : "numeric"});

// ── Setup del PIN desde Config ──
// Activar el PIN por primera vez cifra todos los datos sensibles y los liga a él: si en el
// futuro se olvida el PIN, esos datos ya no son recuperables desde el dispositivo. Por eso,
// antes de pedir el PIN nuevo, forzamos la descarga de un backup (única red de salvación).
async function setupPin(){
  const esActivacionNueva = !pinConfigurado();
  if(esActivacionNueva){
    if(!await mostrarConfirm("Antes de activar el PIN vamos a descargar un backup de tus datos. Si en el futuro olvidás el PIN, es la única forma de recuperarlos. ¿Continuamos?", {titulo:"🔐 Activar PIN", textoOk:"Continuar"})) return;
    exportarBackup();
    if(!await mostrarConfirm("¿Ya guardaste el archivo de backup en un lugar seguro (Drive, mail, etc.)? Confirmá para terminar de activar el PIN.", {titulo:"🔐 Activar PIN", textoOk:"Ya lo guardé"})) return;
  }
  const pin=await mostrarPrompt(`Elegí un PIN de ${PIN_LEN_NUEVO} dígitos, o un código de ${CODIGO_MIN} a ${CODIGO_MAX} letras y números (más seguro). Las mayúsculas cuentan:`,
    {titulo:"🔐 Activar PIN", tipoInput:"password", inputMode:"text", placeholder:`${PIN_LEN_NUEVO} dígitos o ${CODIGO_MIN}-${CODIGO_MAX} letras y números`});
  if(pin===null) return;
  const v=validarCodigo(pin);
  if(v.motivo){ showToast(v.motivo); return; }
  const pinConfirmado=await mostrarPrompt("Confirmá el PIN:", {titulo:"🔐 Activar PIN", tipoInput:"password", inputMode:"text", placeholder:"Repetilo"});
  if(pinConfirmado!==pin){
    showToast("No coinciden");
    return;
  }
  const salt=randomSaltB64();
  const claveNueva=await deriveKey(pin, salt, KDF_ITER);
  const meta={it:KDF_ITER, pl:v.modo==='a' ? 0 : PIN_LEN_NUEVO, pm:v.modo==='a' ? 'a' : ''};   // pl 0 y pm '' = no se anotan
  // Se guarda el sobre anterior para poder volver atrás si algo falla a mitad de camino.
  const sobreAnterior=localStorage.getItem("fencblob");
  try{
    if(esActivacionNueva){
      // Activación nueva: cifrar todos los datos sensibles (hoy en claro) y ligarlos al PIN.
      const cache={};
      ENC_KEYS.forEach(k=>{
        const v=localStorage.getItem(k);
        if(v!==null) cache[k]=v;
      });
      await guardarSobre(claveNueva, salt, cache, meta);
      // Recién con el sobre ya escrito se pasa a estado cifrado y se borra el claro.
      encKey=claveNueva; encCache=cache;
      ENC_KEYS.forEach(k=>localStorage.removeItem(k));
    } else {
      // Cambio de PIN (desde changePin(), que ya validó el actual): re-cifrar el encCache
      // que sigue en memoria desde que se desbloqueó la sesión.
      await guardarSobre(claveNueva, salt, encCache, meta);
      encKey=claveNueva;
    }
    localStorage.removeItem("fpinhash");
    limpiarFallosPin();
  }catch(err){
    console.error("Error al guardar el PIN:", err);
    // Dejar todo como estaba: sin esto un sobre a medias deja los datos inaccesibles para siempre.
    if(sobreAnterior!==null) localStorage.setItem("fencblob", sobreAnterior);
    else localStorage.removeItem("fencblob");
    await mostrarAlerta(`No se pudo guardar el PIN: ${err.message||err}\n\nTus datos quedaron como estaban.`, "Error");
    return;
  }
  if(typeof quitarHuella==="function") quitarHuella();   // la huella guardaba el PIN anterior: hay que activarla de nuevo
  showToast("✓ PIN configurado. Se va a pedir al abrir la app.");
  renderPinStatus();
  // Las copias automáticas viejas quedaron en claro o con la clave anterior: se reemplazan.
  reiniciarCopiasAuto();
}

async function changePin(){
  const actual=await mostrarPrompt("Ingresá tu PIN actual:", {titulo:"Cambiar PIN", ...opcionesPromptPin()});
  if(actual===null) return;
  if(!await verificarPin(actual)){
    showToast("PIN incorrecto");
    return;
  }
  await setupPin();
}

async function removePin(){
  const actual=await mostrarPrompt("Para desactivar el PIN, ingresalo:", {titulo:"Desactivar PIN", ...opcionesPromptPin()});
  if(actual===null) return;
  if(!await verificarPin(actual)){
    showToast("PIN incorrecto");
    return;
  }
  if(await mostrarConfirm("¿Seguro que querés desactivar el bloqueo? Cualquiera con tu celular va a poder abrir la app.", {textoOk:"Desactivar", peligroso:true})){
    // Volcar los datos sensibles de vuelta a texto plano en localStorage antes de
    // desactivar el cifrado (a partir de acá getSensitiveRaw/setSensitiveRaw vuelven a
    // comportarse como localStorage.getItem/setItem de siempre).
    try{
      if(encCache){
        ENC_KEYS.forEach(k=>{
          if(k in encCache) localStorage.setItem(k, encCache[k]);
        });
      }
    }catch(err){
      // Si el volcado a claro se corta por la mitad (sin espacio), borrar el sobre acá
      // perdería lo que no llegó a escribirse. Se deja todo cifrado y como estaba.
      console.error("Error al pasar los datos a texto plano:", err);
      await mostrarAlerta(`No se pudo desactivar el PIN: ${err.message||err}\n\nTus datos siguen cifrados y accesibles con tu PIN actual.`, "Error");
      return;
    }
    localStorage.removeItem("fpinhash");
    localStorage.removeItem("fencsalt");
    localStorage.removeItem("fencblob");
    limpiarFallosPin();
    if(typeof quitarHuella==="function") quitarHuella();
    encKey=null;
    encCache=null;
    showToast("PIN desactivado");
    renderPinStatus();
    // Las copias automáticas estaban cifradas con la clave del PIN: ya no se podrían abrir.
    reiniciarCopiasAuto();
  }
}

// ═══════════════════════════════════════════
// BLOQUEO AUTOMÁTICO
// ═══════════════════════════════════════════
// Sin esto, la app quedaba abierta para siempre una vez desbloqueada: dejabas el celular y quien lo agarraba entraba directo. Ahora vuelve a
// pedir el PIN cuando salís de la app o la dejás sin tocar un rato (1, 5 o 15 minutos, o nunca). Bloquear es recargar la app: así los datos
// dejan de estar en memoria y se vuelve a la pantalla de PIN (con la huella, si la tenés, se desbloquea con un toque).
const AUTOLOCK_KEY="fautolock";
const AUTOLOCK_DEFECTO="1";
const AUTOLOCK_OPCIONES=[["1","a 1 minuto"],["5","a 5 minutos"],["15","a 15 minutos"],["nunca","nunca"]];
function autoLockOpcion(){
  let v=null; try{ v=localStorage.getItem(AUTOLOCK_KEY); }catch(e){ /* sin almacenamiento */ }
  return AUTOLOCK_OPCIONES.some(o=>o[0]===v) ? v : AUTOLOCK_DEFECTO;
}
function cambiarAutoLock(v){
  if(!AUTOLOCK_OPCIONES.some(o=>o[0]===v)) return;
  guardarPreferencia(AUTOLOCK_KEY, v);
  showToast(v==="nunca" ? "La app ya no se bloquea sola" : `Se bloquea ${AUTOLOCK_OPCIONES.find(o=>o[0]===v)[1]} sin usar`);
}
// Pura. ¿Pasó el tiempo para bloquear? `desde` = cuándo salió de la app o tocó por última vez (ms); 0/null = no hay dato.
function bloqueoVencido(opcion, desde, ahora){
  if(opcion==="nunca" || !desde) return false;
  const min=Number(opcion);
  return Number.isFinite(min) && ahora-desde >= min*60000;
}
let ocultoDesdePin=0;                 // cuándo salió de la app (ms), 0 si está adentro
let ultimaActividadPin=Date.now();    // el último toque o tecla (ms)
// ¿Hay un PIN y la app está abierta (desbloqueada)? Con la pantalla de bloqueo puesta, encKey es null.
const appDesbloqueadaConPin=()=>pinConfigurado() && !!encKey;
// Recargar la app: aparte para poder reemplazarlo en las pruebas.
function recargarApp(){ location.reload(); }
let bloqueandoApp=false;
async function bloquearApp(){
  if(bloqueandoApp || !appDesbloqueadaConPin()) return;
  bloqueandoApp=true;
  try{
    // Primero se guarda lo pendiente: al recargar se pierde todo lo que no llegó al disco.
    if(encSaveTimer){ clearTimeout(encSaveTimer); await persistEncBlobNow(); }
  }catch(e){ /* el guardado ya avisa si falla */ }
  recargarApp();
}
document.addEventListener("visibilitychange", ()=>{
  if(!appDesbloqueadaConPin()) return;
  if(document.visibilityState==="hidden"){ ocultoDesdePin=Date.now(); return; }
  const desde=ocultoDesdePin; ocultoDesdePin=0;
  if(bloqueoVencido(autoLockOpcion(), desde, Date.now())) bloquearApp();
});
["pointerdown","keydown","touchstart","scroll","input"].forEach(ev=>
  document.addEventListener(ev, ()=>{ ultimaActividadPin=Date.now(); }, {capture:true, passive:true}));
// Sin tocar la pantalla: se revisa cada 15 s (un temporizador largo no sirve: el celular los frena con la app en segundo plano).
setInterval(()=>{
  if(!appDesbloqueadaConPin() || document.visibilityState==="hidden") return;
  if(typeof vozEscuchando!=="undefined" && vozEscuchando) return;   // dictando por voz no es estar sin usar la app
  if(bloqueoVencido(autoLockOpcion(), ultimaActividadPin, Date.now())) bloquearApp();
}, 15000);

// ═══════════════════════════════════════════
// BACKUPS CIFRADOS
// ═══════════════════════════════════════════
// Con un PIN activo los datos viven cifrados en el celular, pero el backup (el archivo, lo que se manda por el menú de compartir y la copia de Drive)
// salía en claro: quien lo tuviera lo leía sin tu PIN. Ahora sale cifrado con la MISMA clave del PIN. El archivo trae al principio, sin cifrar, lo
// que hace falta para volver a derivar la clave (la sal y las vueltas, que no son secretas) y nada de tus datos. Se abre con el PIN o código que
// tenías cuando se hizo, en este celular o en otro. Sin PIN activo no hay con qué cifrar y el backup sale como siempre.
const BACKUP_CIFRADO_KEY="fbackupcifrado";   // "0" = el usuario eligió no cifrar
function backupCifradoActivo(){
  let v=null; try{ v=localStorage.getItem(BACKUP_CIFRADO_KEY); }catch(e){ /* sin almacenamiento */ }
  return pinConfigurado() && !!encKey && v!=="0";
}
// Pura. ¿Es el sobre de un backup cifrado de Enola?
const esBackupCifrado=o=>!!o && typeof o==="object" && o.enola==="backup-cifrado" && typeof o.salt==="string" && typeof o.iv==="string" && typeof o.data==="string" && Number(o.it)>0;
const backupValido=b=>!!b && !!b.datos && Array.isArray(b.datos.movs);
async function cifrarBackup(backup){
  const sobre=leerSobre();
  if(!encKey || !sobre || !sobre.salt) throw new Error("Para cifrar el backup hace falta tener la app desbloqueada con PIN.");
  const {iv, data}=await encryptBlob(encKey, backup);
  return {enola:"backup-cifrado", version:1, app:"Enola", fecha:backup.fecha, kdf:"PBKDF2-SHA256", it:sobre.it||KDF_ITER_LEGADO, salt:sobre.salt,
          ...(sobre.pm==="a" ? {pm:"a"} : {}), iv, data};
}
// El backup de adentro, o null si el código no es el que lo cifró (o el archivo está roto).
async function abrirBackupCifrado(env, codigo){
  try{
    const clave=await deriveKey(String(codigo), env.salt, Number(env.it));
    const b=await decryptBlob(clave, {iv:env.iv, data:env.data});
    return backupValido(b) ? b : null;
  }catch(e){ return null; }
}
// Abre un backup cifrado: si es de la clave de este mismo celular no pide nada; si no, pide el PIN o código (hasta 5 intentos). null si se cancela o no se puede.
async function pedirCodigoDeBackup(env){
  let sobre=null; try{ sobre=leerSobre(); }catch(e){ sobre=null; }
  if(encKey && sobre && sobre.salt===env.salt && (sobre.it||KDF_ITER_LEGADO)===Number(env.it)){
    try{ const b=await decryptBlob(encKey, {iv:env.iv, data:env.data}); if(backupValido(b)) return b; }catch(e){ /* se pide el código */ }
  }
  for(let i=0; i<5; i++){
    const c=await mostrarPrompt(i===0 ? "Este backup está cifrado. Ingresá el PIN o código que tenías cuando lo hiciste:" : "No era ese. Probá de nuevo con el PIN o código que tenías cuando hiciste este backup:",
      {titulo:"🔒 Backup cifrado", tipoInput:"password", inputMode:env.pm==="a" ? "text" : "numeric"});
    if(c===null || c===undefined) return null;
    const b=await abrirBackupCifrado(env, c);
    if(b) return b;
  }
  showToast("No se pudo abrir el backup");
  return null;
}
async function onBackupCifradoToggle(chk){
  if(!chk.checked){
    if(!await mostrarConfirm("Los backups (el archivo y la copia de Drive) van a salir SIN cifrar: cualquiera que los tenga puede leer todos tus datos sin tu PIN. ¿Seguro?", {titulo:"Backups sin cifrar", textoOk:"Dejar sin cifrar", peligroso:true})){ chk.checked=true; return; }
    guardarPreferencia(BACKUP_CIFRADO_KEY, "0");
    showToast("Los backups salen sin cifrar");
  } else {
    guardarPreferencia(BACKUP_CIFRADO_KEY, "1");
    showToast("🔒 Los backups salen cifrados con tu PIN");
  }
}

// Pinta el estado actual del PIN en Config
function renderPinStatus(){
  const el=document.getElementById("pin-status");
  if(!el) return;
  const activo=pinConfigurado();
  if(activo){
    const largo=pinLen(), alfa=pinModo()==="a";
    const opcion=autoLockOpcion();
    el.innerHTML=`
      <p class="pin-estado">✓ ${alfa?"Código alfanumérico activo":`PIN activo (${largo} dígitos)`}. Se va a pedir cada vez que abras la app.</p>
      ${!alfa && largo>=PIN_LEN_NUEVO?`<p class="txt-xs txt-muted pin-nota">¿Querés más seguridad? Con “Cambiar PIN” podés usar un código de ${CODIGO_MIN} a ${CODIGO_MAX} letras y números.</p>`:""}
      ${!alfa && largo<PIN_LEN_NUEVO?`<div class="inset mb-10" style="border-left:3px solid var(--warning)"><p class="txt-sm" style="margin:0 0 8px">Tu PIN tiene ${largo} dígitos y se puede adivinar en minutos. Pasá a ${PIN_LEN_NUEVO} dígitos o a un código de ${CODIGO_MIN} a ${CODIGO_MAX} letras y números.</p><button class="btn-sm" style="width:100%" onclick="changePin()">Reforzar mi PIN</button></div>`:""}
      <div class="u-row">
        <button class="btn-sm u-flex1" onclick="changePin()">Cambiar PIN</button>
        <button class="btn-sm" style="flex:1;color:var(--danger)" onclick="removePin()">Desactivar</button>
      </div>
      <label class="opt-row" style="--chk:var(--save);margin-top:12px">
        <span class="opt-icon">🔒</span>
        <span class="opt-text"><span class="opt-title">Cifrar los backups</span><span class="opt-sub">El archivo, el menú de compartir y Drive. Se abren con tu PIN o código</span></span>
        <input type="checkbox" id="backup-cifrado-chk" class="chk-custom" ${localStorage.getItem(BACKUP_CIFRADO_KEY)==="0"?"":"checked"} onchange="onBackupCifradoToggle(this)">
      </label>
      <div class="form-group" style="margin-top:12px"><label class="form-label" for="autolock-sel">Volver a pedir el PIN</label>
        <select id="autolock-sel" class="form-select" onchange="cambiarAutoLock(this.value)">${AUTOLOCK_OPCIONES.map(([v,t])=>`<option value="${v}"${v===opcion?" selected":""}>${v==="nunca"?"Nunca (la app queda abierta)":`Si salís o no la usás ${t.replace("a ","")}`}</option>`).join("")}</select>
        <p class="txt-xs txt-muted" style="margin-top:4px">Si salís de la app o la dejás sin tocar ese tiempo, vuelve a pedir el PIN.</p></div>`;
  } else {
    el.innerHTML=`
      <p class="txt-sm txt-muted mb-10">El PIN te protege si alguien toma tu celular. Es opcional.</p>
      <button class="btn-primary" style="background:var(--accent);color:var(--on-solid);width:100%" onclick="setupPin()">🔐 Activar PIN</button>`;
  }
  if(typeof renderHuellaStatus==="function") renderHuellaStatus();
}
