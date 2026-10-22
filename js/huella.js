// ═══════════════════════════════════════════
// DESBLOQUEO CON HUELLA O ROSTRO (passkey + extensión PRF)
// ═══════════════════════════════════════════
// El teléfono puede dar un secreto propio de esta app (extensión PRF de WebAuthn) SOLO después de que pasás la huella o el rostro. Con
// ese secreto se cifra tu PIN y se guarda el resultado (inservible sin el teléfono y sin tu huella). Al abrir la app, la huella
// devuelve el mismo secreto, se recupera el PIN y se entra por el mismo camino de siempre. El PIN y el cifrado de tus datos NO cambian:
// la huella es un atajo para teclearlo, no un reemplazo, así que la seguridad no baja.
//   · No usa servidores ni cuesta nada: es una función del navegador y del celular.
//   · Si el celular no soporta PRF, no se puede activar y la app lo dice.
//   · Si cambiás o desactivás el PIN, la huella se desactiva (hay que activarla de nuevo con el PIN nuevo).

const HUELLA_KEY="fhuella";   // {cred, salt, iv, data} en base64. No contiene el PIN en claro.
const b64aBytes=s=>Uint8Array.from(atob(s), c=>c.charCodeAt(0));

function leerHuella(){
  try{
    const o=JSON.parse(localStorage.getItem(HUELLA_KEY)||"null");
    return o && typeof o.cred==="string" && typeof o.salt==="string" && typeof o.iv==="string" && typeof o.data==="string" ? o : null;
  }catch(e){ return null; }
}
const huellaActiva=()=>!!leerHuella();
function quitarHuella(){ try{ localStorage.removeItem(HUELLA_KEY); }catch(e){ /* sin almacenamiento */ } }

// ¿Se puede usar? Hace falta un autenticador de plataforma (huella o rostro configurados en el celular) y un contexto seguro.
async function huellaDisponible(){
  try{
    return !!(window.isSecureContext && window.PublicKeyCredential && navigator.credentials
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  }catch(e){ return false; }
}

// El secreto de 32 bytes que da el autenticador sirve de clave AES-GCM para cifrar el PIN.
async function claveDeSecreto(bytes){
  return crypto.subtle.importKey("raw", bytes, {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
}
async function envolverPin(pin, secreto){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cifrado=await crypto.subtle.encrypt({name:"AES-GCM", iv}, await claveDeSecreto(secreto), new TextEncoder().encode(pin));
  return {iv:bytesToB64(iv), data:bytesToB64(new Uint8Array(cifrado))};
}
async function desenvolverPin(h, secreto){
  const plano=await crypto.subtle.decrypt({name:"AES-GCM", iv:b64aBytes(h.iv)}, await claveDeSecreto(secreto), b64aBytes(h.data));
  return new TextDecoder().decode(plano);
}

// Pide el secreto al autenticador (esto es lo que muestra la huella o el rostro). Devuelve los 32 bytes, o null si no hay PRF.
function secretoDeResultado(cred){
  const prf=cred && cred.getClientExtensionResults ? (cred.getClientExtensionResults()||{}).prf : null;
  const r=prf && prf.results && prf.results.first;
  return r && r.byteLength>=32 ? new Uint8Array(r).slice(0,32) : null;
}
async function pedirSecreto(credId, salt){
  const cred=await navigator.credentials.get({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials:[{type:"public-key", id:credId}],
    userVerification:"required", timeout:60000,
    extensions:{prf:{eval:{first:salt}}}
  }});
  return secretoDeResultado(cred);
}

// Activa la huella. Exige el PIN actual: es lo que se va a guardar cifrado. Devuelve true si quedó activa.
async function activarHuella(){
  if(!localStorage.getItem("fpinhash")){ showToast("Primero activá el PIN"); return false; }
  if(!await huellaDisponible()){
    await mostrarAlerta("Este celular no tiene huella o rostro configurados, o el navegador no permite usarlos acá. Configuralos en los ajustes del celular y volvé a intentar.", "Huella o rostro");
    return false;
  }
  const pin=await mostrarPrompt("Ingresá tu PIN para activar la huella:", {titulo:"👆 Huella o rostro", tipoInput:"password", inputMode:"numeric", placeholder:"4 dígitos"});
  if(pin===null) return false;
  if(await hashPin(pin)!==localStorage.getItem("fpinhash")){ showToast("PIN incorrecto"); return false; }
  try{
    const salt=crypto.getRandomValues(new Uint8Array(32));
    const cred=await navigator.credentials.create({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rp:{name:"Enola"},
      user:{id:crypto.getRandomValues(new Uint8Array(16)), name:"enola", displayName:"Enola"},
      pubKeyCredParams:[{type:"public-key", alg:-7},{type:"public-key", alg:-257}],
      authenticatorSelection:{authenticatorAttachment:"platform", userVerification:"required", residentKey:"preferred"},
      extensions:{prf:{eval:{first:salt}}}, timeout:60000
    }});
    const prfOk=(cred.getClientExtensionResults()||{}).prf;
    if(!prfOk || prfOk.enabled===false){
      await mostrarAlerta("Tu celular o tu navegador todavía no permiten usar la huella para desbloquear esta app (le falta una función de seguridad). Podés seguir usando el PIN.", "Huella o rostro");
      return false;
    }
    // Algunos celulares dan el secreto al crear y otros recién en un segundo toque.
    let secreto=secretoDeResultado(cred);
    if(!secreto) secreto=await pedirSecreto(cred.rawId, salt);
    if(!secreto){
      await mostrarAlerta("No se pudo obtener la clave de seguridad del celular. Podés seguir usando el PIN.", "Huella o rostro");
      return false;
    }
    const envuelto=await envolverPin(pin, secreto);
    localStorage.setItem(HUELLA_KEY, JSON.stringify({cred:bytesToB64(new Uint8Array(cred.rawId)), salt:bytesToB64(salt), ...envuelto}));
    showToast("👆 Huella activada ✓");
    return true;
  }catch(e){
    if(!(e && (e.name==="NotAllowedError" || e.name==="AbortError"))) console.warn("No se pudo activar la huella:", e);
    showToast(e && e.name==="NotAllowedError" ? "Se canceló la huella" : "No se pudo activar la huella en este celular");
    return false;
  }
}
async function desactivarHuella(){
  quitarHuella();
  showToast("Huella desactivada");
  renderHuellaStatus();
}

// En la pantalla de bloqueo: pide la huella, recupera el PIN y lo prueba por el camino normal (checkPin). Devuelve true si desbloqueó.
async function desbloquearConHuella(){
  const h=leerHuella();
  if(!h) return false;
  const err=document.getElementById("pin-error");
  try{
    const secreto=await pedirSecreto(b64aBytes(h.cred), b64aBytes(h.salt));
    if(!secreto) throw new Error("sin secreto");
    const pin=await desenvolverPin(h, secreto);
    pinBuffer=pin;
    updatePinDisplay();
    await checkPin();
    const lock=document.getElementById("lock-screen");
    if(lock && lock.style.display!=="none"){ quitarHuella(); mostrarBotonHuella(); if(err) err.textContent="La huella ya no coincide con tu PIN. Ingresalo y volvé a activarla."; return false; }
    return true;
  }catch(e){
    if(e && e.name==="OperationError"){ quitarHuella(); mostrarBotonHuella(); if(err) err.textContent="No se pudo usar la huella. Ingresá tu PIN."; }
    else if(err && !(e && (e.name==="NotAllowedError" || e.name==="AbortError"))) err.textContent="No se pudo usar la huella. Ingresá tu PIN.";
    return false;
  }
}
// El botón de la pantalla de bloqueo solo aparece si la huella está activa.
function mostrarBotonHuella(){
  const b=document.getElementById("btn-huella");
  if(b) b.style.display=huellaActiva() ? "" : "none";
}

// ── Configuración ──
async function renderHuellaStatus(){
  const el=document.getElementById("huella-status");
  if(!el) return;
  if(!localStorage.getItem("fpinhash")){ el.innerHTML=""; return; }
  if(huellaActiva()){
    el.innerHTML=`<p class="txt-xs" style="color:var(--success);margin:10px 0 6px">👆 Huella o rostro activados: se usan en vez de teclear el PIN.</p>
      <button class="btn-sm" style="width:100%;color:var(--danger)" onclick="desactivarHuella()">Desactivar huella</button>`;
    return;
  }
  const ok=await huellaDisponible();
  el.innerHTML=ok
    ? `<p class="txt-xs txt-muted" style="margin:10px 0 6px">Podés abrir la app con tu huella o rostro, sin teclear el PIN. El PIN sigue protegiendo tus datos.</p>
       <button class="btn-sm" style="width:100%" onclick="activarHuella().then(renderHuellaStatus)">👆 Activar huella o rostro</button>`
    : `<p class="txt-xs txt-muted" style="margin:10px 0 0">Este celular no ofrece huella o rostro para desbloquear apps web.</p>`;
}
