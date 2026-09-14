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

function isEncActive(){ return !!localStorage.getItem("fencsalt"); }

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
  if(isEncActive() && encCache) return (key in encCache) ? encCache[key] : fallback;
  return localStorage.getItem(key) || fallback;
}
let encSaveTimer=null;
function setSensitiveRaw(key, value){
  if(isEncActive() && encCache){
    encCache[key]=value;
    clearTimeout(encSaveTimer);
    encSaveTimer=setTimeout(persistEncBlobNow, 400);
  } else {
    localStorage.setItem(key, value);
  }
}
async function persistEncBlobNow(){
  if(!encKey || !encCache) return;
  const blob=await encryptBlob(encKey, encCache);
  localStorage.setItem("fencblob", JSON.stringify(blob));
}

// Puebla las variables globales en memoria (movs, tcs, custom, etc.) con los datos reales:
// en claro si el cifrado no está activo, o desde encCache (ya descifrado por checkPin) si
// lo está. Se llama desde bootApp() DESPUÉS de que checkLock() resuelve — es decir, después
// de que no hace falta PIN, o de que el PIN correcto ya fue ingresado y descifrado.
function loadSensitiveIntoMemory(){
  movs = JSON.parse(getSensitiveRaw("fmovs3","[]"));
  tcs = JSON.parse(getSensitiveRaw("ftcs3","[]"));
  custom = JSON.parse(getSensitiveRaw("fcustom3",'{"Gasto":{},"Ingreso":{},"Inversion":{},"Tarjeta":{}}'));
  if(!custom.Tarjeta) custom.Tarjeta={};
  metas = JSON.parse(getSensitiveRaw("fmetas","[]"));
  importHistory = JSON.parse(getSensitiveRaw("fimphist3","[]"));
  catOrder = JSON.parse(getSensitiveRaw("fcatorder","{}"));
  presupuestos = JSON.parse(getSensitiveRaw("fpresup","{}"));
  cuentasCustom = JSON.parse(getSensitiveRaw("fcuentas","[]"));
  tarjetasCustom = JSON.parse(getSensitiveRaw("ftarjetas","[]"));
  iconsCustom = JSON.parse(getSensitiveRaw("ficons","{}"));
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
      // Cifrado ya activo: derivar la clave con el PIN recién validado y descifrar el blob.
      try{
        const salt=localStorage.getItem("fencsalt");
        encKey=await deriveKey(pinIngresado, salt);
        const blobRaw=localStorage.getItem("fencblob");
        const blob=blobRaw?JSON.parse(blobRaw):{iv:"",data:""};
        encCache=blobRaw ? await decryptBlob(encKey, blob) : {};
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
        const blob=await encryptBlob(encKey, encCache);
        localStorage.setItem("fencsalt", salt);
        localStorage.setItem("fencblob", JSON.stringify(blob));
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
    if(!confirm("Antes de activar el PIN vamos a descargar un backup de tus datos. Si en el futuro olvidás el PIN, es la única forma de recuperarlos. ¿Continuamos?")) return;
    exportarBackup();
    if(!confirm("¿Ya guardaste el archivo de backup en un lugar seguro (Drive, mail, etc.)? Confirmá para terminar de activar el PIN.")) return;
  }
  const pin=prompt("Elegí un PIN de 4 dígitos para proteger la app:");
  if(pin===null) return;
  if(!/^\d{4}$/.test(pin)){
    showToast("El PIN debe ser de 4 dígitos numéricos");
    return;
  }
  const pinConfirmado=prompt("Confirmá el PIN:");
  if(pinConfirmado!==pin){
    showToast("Los PINs no coinciden");
    return;
  }
  const hash=await hashPin(pin);
  if(esActivacionNueva){
    // Activación nueva: cifrar todos los datos sensibles (hoy en claro) y ligarlos al PIN.
    const salt=randomSaltB64();
    encKey=await deriveKey(pin, salt);
    encCache={};
    ENC_KEYS.forEach(k=>{
      const v=localStorage.getItem(k);
      if(v!==null) encCache[k]=v;
    });
    const blob=await encryptBlob(encKey, encCache);
    localStorage.setItem("fencsalt", salt);
    localStorage.setItem("fencblob", JSON.stringify(blob));
    ENC_KEYS.forEach(k=>localStorage.removeItem(k));
  } else {
    // Cambio de PIN (llamado desde changePin(), que ya validó el PIN actual): re-cifrar
    // el encCache existente (sigue en memoria desde que se desbloqueó la sesión) con clave nueva.
    const salt=randomSaltB64();
    encKey=await deriveKey(pin, salt);
    localStorage.setItem("fencsalt", salt);
    await persistEncBlobNow();
  }
  localStorage.setItem("fpinhash", hash);
  showToast("✓ PIN configurado. Se va a pedir al abrir la app.");
  renderPinStatus();
}

async function changePin(){
  const actual=prompt("Ingresá tu PIN actual:");
  if(actual===null) return;
  const hashActual=await hashPin(actual);
  if(hashActual!==localStorage.getItem("fpinhash")){
    showToast("PIN incorrecto");
    return;
  }
  await setupPin();
}

async function removePin(){
  const actual=prompt("Para desactivar el PIN, ingresalo:");
  if(actual===null) return;
  const hashActual=await hashPin(actual);
  if(hashActual!==localStorage.getItem("fpinhash")){
    showToast("PIN incorrecto");
    return;
  }
  if(window.confirm("¿Seguro que querés desactivar el bloqueo? Cualquiera con tu celular va a poder abrir la app.")){
    // Volcar los datos sensibles de vuelta a texto plano en localStorage antes de
    // desactivar el cifrado (a partir de acá getSensitiveRaw/setSensitiveRaw vuelven a
    // comportarse como localStorage.getItem/setItem de siempre).
    if(encCache){
      ENC_KEYS.forEach(k=>{
        if(k in encCache) localStorage.setItem(k, encCache[k]);
      });
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
      <div style="display:flex;gap:8px">
        <button class="btn-sm" style="flex:1" onclick="changePin()">Cambiar PIN</button>
        <button class="btn-sm" style="flex:1;color:var(--danger)" onclick="removePin()">Desactivar</button>
      </div>`;
  } else {
    el.innerHTML=`
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">El PIN te protege si alguien toma tu celular. Es opcional.</p>
      <button class="btn-primary" style="background:var(--accent);color:#fff;width:100%" onclick="setupPin()">🔐 Activar PIN</button>`;
  }
}

