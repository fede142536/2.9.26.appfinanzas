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
const ENC_KEYS = ["fmovs3","ftcs3","fcustom3","fmetas","fimphist3","fcuentas","ftarjetas","fpresup","fcatorder","ficons"];
let encKey=null;   // CryptoKey en memoria, solo durante la sesión desbloqueada (nunca se persiste)
let encCache=null; // cuando el cifrado está activo: copia en memoria {clave: valorJSONstring, ...}

// El cifrado está activo si existe el sobre (formato nuevo) o el salt suelto (formato viejo,
// ver guardarSobre): mientras exista cualquiera de los dos, los datos NO están en claro.
function isEncActive(){
  return !!(localStorage.getItem("fencblob") || localStorage.getItem("fencsalt"));
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
  // Formato viejo (v1): el salt vivía aparte, en "fencsalt"
  if(!sobre.salt) sobre.salt=localStorage.getItem("fencsalt");
  return sobre;
}

async function guardarSobre(clave, salt, cache){
  const {iv, data}=await encryptBlob(clave, cache);
  localStorage.setItem("fencblob", JSON.stringify({v:2, salt, iv, data}));
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

async function deriveKey(pin, saltB64){
  const salt=Uint8Array.from(atob(saltB64), c=>c.charCodeAt(0));
  const baseKey=await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations:150000, hash:"SHA-256"},
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
  fmetas:"tus metas de ahorro", fimphist3:"tu historial de importaciones",
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
// Hash simple SHA-256 del PIN. NO guardamos el PIN en texto plano.
// Esto NO es alta seguridad (alguien con acceso al dispositivo y conocimiento técnico
// puede saltearlo) pero protege contra el típico curioso que toma tu celu.
async function hashPin(pin){
  const enc=new TextEncoder().encode(pin+"enola_salt_v1");
  const buf=await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

let pinBuffer=""; // PIN que se está tipeando en la pantalla de bloqueo
let pinSetupStep=0; // 0=ingresar, 1=confirmar (en setup)
let pinSetupFirst=""; // primer PIN ingresado durante setup
const PIN_LEN=4;

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
    const hash=localStorage.getItem("fpinhash");
    if(!hash){
      // No hay PIN configurado: app abierta sin bloqueo
      document.getElementById("lock-screen").style.display="none";
      resolve();
      return;
    }
    // Hay PIN: mostrar pantalla y esperar a que checkPin() la resuelva
    _unlockResolve=resolve;
    pinBuffer="";
    pinSetupStep=0;
    updatePinDisplay();
    document.getElementById("pin-error").textContent="";
    document.getElementById("lock-screen").style.display="flex";
  });
}

function updatePinDisplay(){
  const dots=document.querySelectorAll("#pin-display .pin-dot");
  dots.forEach((d,i)=>{
    d.classList.toggle("filled", i<pinBuffer.length);
  });
}

function pinPress(d){
  if(pinBuffer.length>=PIN_LEN) return;
  vibrar(15);
  pinBuffer+=d;
  updatePinDisplay();
  if(pinBuffer.length===PIN_LEN){
    setTimeout(checkPin, 150);
  }
}
function pinBackspace(){
  if(pinBuffer.length>0){
    pinBuffer=pinBuffer.slice(0,-1);
    updatePinDisplay();
    document.getElementById("pin-error").textContent="";
  }
}

async function checkPin(){
  const pinIngresado=pinBuffer;
  const hash=await hashPin(pinIngresado);
  const stored=localStorage.getItem("fpinhash");
  let migracionRecien=false; // true solo si ESTA llamada acaba de migrar un PIN legado a cifrado
  if(hash===stored){
    if(isEncActive()){
      // Cifrado ya activo: derivar la clave con el PIN recién validado y descifrar el sobre.
      try{
        const sobre=leerSobre();
        // Si hay salt pero no sobre, algo quedó a medias. ANTES esto desbloqueaba con datos
        // vacíos y el primer guardado pisaba todo; ahora se avisa y no se entra, que deja
        // los datos donde están y da chance de restaurar un backup.
        if(!sobre || !sobre.salt || !sobre.data){
          throw new Error("Los datos cifrados están incompletos. Restaurá un backup desde otra copia de la app.");
        }
        encKey=await deriveKey(pinIngresado, sobre.salt);
        encCache=await decryptBlob(encKey, sobre);
      }catch(err){
        console.error("Error al descifrar datos:", err);
        encKey=null; encCache=null;
        document.getElementById("pin-error").textContent=`Error al descifrar: ${err.name||""} ${err.message||err}`;
        pinBuffer="";
        setTimeout(updatePinDisplay, 300);
        return; // NO resolvemos: la pantalla de bloqueo sigue esperando
      }
    } else {
      // PIN configurado desde una versión anterior a esta funcionalidad: todavía sin cifrar.
      // Migramos ahora mismo, usando el PIN recién validado.
      try{
        const salt=randomSaltB64();
        encKey=await deriveKey(pinIngresado, salt);
        encCache={};
        ENC_KEYS.forEach(k=>{
          const v=localStorage.getItem(k);
          if(v!==null) encCache[k]=v;
        });
        // Una sola escritura: o queda el sobre entero, o no queda nada y los datos en claro
        // siguen intactos (isEncActive() sigue en false y la app abre normal).
        await guardarSobre(encKey, salt, encCache);
        ENC_KEYS.forEach(k=>localStorage.removeItem(k));
        migracionRecien=true;
      }catch(err){
        console.error("Error al migrar a cifrado:", err);
        encKey=null; encCache=null;
        document.getElementById("pin-error").textContent=`Error al cifrar: ${err.name||""} ${err.message||err}`;
        pinBuffer="";
        setTimeout(updatePinDisplay, 300);
        return; // NO resolvemos: la pantalla de bloqueo sigue esperando
      }
    }
    document.getElementById("lock-screen").style.display="none";
    pinBuffer="";
    updatePinDisplay();
    if(_unlockResolve){ const r=_unlockResolve; _unlockResolve=null; r(); }
    // El aviso se muestra DESPUÉS de desbloquear, y con showToast (no alert()): alert()/
    // confirm()/prompt() son diálogos nativos del navegador que en una PWA instalada (modo
    // standalone, sin barra de navegador) pueden no tener dónde renderizarse y quedan colgados
    // esperando una interacción que nunca llega — eso dejaba al usuario trabado para siempre
    // en la pantalla de PIN la primera vez que se migraba un PIN viejo a cifrado.
    if(migracionRecien){
      showToast("🔒 Tus datos ahora están cifrados y ligados a tu PIN. Te recomendamos descargar un backup desde Configuración por si alguna vez lo olvidás.");
    }
  } else {
    document.getElementById("pin-error").textContent="PIN incorrecto";
    pinBuffer="";
    setTimeout(updatePinDisplay, 300);
    // Animación de shake
    const display=document.getElementById("pin-display");
    display.style.transform="translateX(-8px)";
    setTimeout(()=>{display.style.transform="translateX(8px)";},80);
    setTimeout(()=>{display.style.transform="";},160);
  }
}

// ── Setup del PIN desde Config ──
// Activar el PIN por primera vez cifra todos los datos sensibles y los liga a él: si en el
// futuro se olvida el PIN, esos datos ya no son recuperables desde el dispositivo. Por eso,
// antes de pedir el PIN nuevo, forzamos la descarga de un backup (única red de salvación).
async function setupPin(){
  const esActivacionNueva = !localStorage.getItem("fpinhash");
  if(esActivacionNueva){
    if(!await mostrarConfirm("Antes de activar el PIN vamos a descargar un backup de tus datos. Si en el futuro olvidás el PIN, es la única forma de recuperarlos. ¿Continuamos?", {titulo:"🔐 Activar PIN", textoOk:"Descargar backup"})) return;
    exportarBackup();
    if(!await mostrarConfirm("¿Ya guardaste el archivo de backup en un lugar seguro (Drive, mail, etc.)? Confirmá para terminar de activar el PIN.", {titulo:"🔐 Activar PIN", textoOk:"Ya lo guardé"})) return;
  }
  const pin=await mostrarPrompt("Elegí un PIN de 4 dígitos para proteger la app:", {titulo:"🔐 Activar PIN", tipoInput:"password", inputMode:"numeric", placeholder:"4 dígitos"});
  if(pin===null) return;
  if(!/^\d{4}$/.test(pin)){
    showToast("El PIN debe ser de 4 dígitos numéricos");
    return;
  }
  const pinConfirmado=await mostrarPrompt("Confirmá el PIN:", {titulo:"🔐 Activar PIN", tipoInput:"password", inputMode:"numeric", placeholder:"Repetí el PIN"});
  if(pinConfirmado!==pin){
    showToast("Los PINs no coinciden");
    return;
  }
  const hash=await hashPin(pin);
  const salt=randomSaltB64();
  const claveNueva=await deriveKey(pin, salt);
  // Se guarda el sobre anterior para poder volver atrás: si el guardado entra pero el hash
  // del PIN no, quedaría un sobre que ningún PIN puede abrir. Es improbable (el hash son 64
  // caracteres contra ~1 MB del sobre), pero el costo de equivocarse es perder todo.
  const sobreAnterior=localStorage.getItem("fencblob");
  try{
    if(esActivacionNueva){
      // Activación nueva: cifrar todos los datos sensibles (hoy en claro) y ligarlos al PIN.
      const cache={};
      ENC_KEYS.forEach(k=>{
        const v=localStorage.getItem(k);
        if(v!==null) cache[k]=v;
      });
      await guardarSobre(claveNueva, salt, cache);
      localStorage.setItem("fpinhash", hash);
      // Recién con el sobre y el hash ya escritos se pasa a estado cifrado y se borra el claro.
      encKey=claveNueva; encCache=cache;
      ENC_KEYS.forEach(k=>localStorage.removeItem(k));
    } else {
      // Cambio de PIN (desde changePin(), que ya validó el actual): re-cifrar el encCache
      // que sigue en memoria desde que se desbloqueó la sesión.
      await guardarSobre(claveNueva, salt, encCache);
      localStorage.setItem("fpinhash", hash);
      encKey=claveNueva;
    }
  }catch(err){
    console.error("Error al guardar el PIN:", err);
    // Dejar todo como estaba: sin esto, un sobre nuevo con el hash viejo (o al revés) deja
    // los datos inaccesibles para siempre.
    if(sobreAnterior!==null) localStorage.setItem("fencblob", sobreAnterior);
    else localStorage.removeItem("fencblob");
    await mostrarAlerta(`No se pudo guardar el PIN: ${err.message||err}\n\nTus datos quedaron como estaban.`, "Error");
    return;
  }
  showToast("✓ PIN configurado. Se va a pedir al abrir la app.");
  renderPinStatus();
}

async function changePin(){
  const actual=await mostrarPrompt("Ingresá tu PIN actual:", {titulo:"Cambiar PIN", tipoInput:"password", inputMode:"numeric"});
  if(actual===null) return;
  const hashActual=await hashPin(actual);
  if(hashActual!==localStorage.getItem("fpinhash")){
    showToast("PIN incorrecto");
    return;
  }
  await setupPin();
}

async function removePin(){
  const actual=await mostrarPrompt("Para desactivar el PIN, ingresalo:", {titulo:"Desactivar PIN", tipoInput:"password", inputMode:"numeric"});
  if(actual===null) return;
  const hashActual=await hashPin(actual);
  if(hashActual!==localStorage.getItem("fpinhash")){
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
    encKey=null;
    encCache=null;
    showToast("PIN desactivado");
    renderPinStatus();
  }
}

// Pinta el estado actual del PIN en Config
function renderPinStatus(){
  const el=document.getElementById("pin-status");
  if(!el) return;
  const activo=!!localStorage.getItem("fpinhash");
  if(activo){
    el.innerHTML=`
      <p style="font-size:12px;color:var(--success);margin-bottom:10px">✓ PIN activo. Se va a pedir cada vez que abras la app.</p>
      <div class="u-row">
        <button class="btn-sm u-flex1" onclick="changePin()">Cambiar PIN</button>
        <button class="btn-sm" style="flex:1;color:var(--danger)" onclick="removePin()">Desactivar</button>
      </div>`;
  } else {
    el.innerHTML=`
      <p class="txt-sm txt-muted mb-10">El PIN te protege si alguien toma tu celular. Es opcional.</p>
      <button class="btn-primary" style="background:var(--accent);color:#fff;width:100%" onclick="setupPin()">🔐 Activar PIN</button>`;
  }
}

