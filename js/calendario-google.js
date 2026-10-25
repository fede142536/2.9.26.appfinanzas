// ═══════════════════════════════════════════
// GOOGLE CALENDAR: LOS VENCIMIENTOS SE AGREGAN Y SE ACTUALIZAN SOLOS EN EL CALENDARIO
// ═══════════════════════════════════════════
// Cada gasto frecuente (de gastos o de tarjeta) con día de vencimiento queda como UN evento mensual
// que se repite sin fin, y lo mismo cada tarjeta con día habitual; los resúmenes con otra fecha, como
// eventos sueltos (lo que se manda sale de eventosParaCalendario(), en tarjetas-inversiones.js, igual que
// el archivo .ics). La app compara lo que DEBERÍA haber en el calendario con lo que ya mandó y manda
// solo la diferencia:
//   · gasto nuevo o con vencimiento nuevo → crea el evento
//   · cambió el día, el monto o el nombre → actualiza ESE evento
// NUNCA borra nada del calendario: si eliminás un gasto, su evento queda hasta que lo borres vos.
// La comunicación pasa por la API de Google Calendar con el permiso `calendar.events`, que el
// usuario da una vez. Hace falta un "ID de cliente" de Google (lo crea el usuario: ver Config).
// Todo esto es preferencia, no dato financiero: va en localStorage llano. El token dura 1 hora; sin
// token vigente la app no pregunta sola: avisa que hay cambios sin enviar y se sincroniza al tocar el botón.

const GCAL_ID_KEY="fgcalid";        // ID de cliente OAuth
const GCAL_ON_KEY="fgcalon";        // "1" cuando el usuario ya conectó
const GCAL_MAPA_KEY="fgcalmapa";    // {clave: {id, h, f}}: qué evento de Google es cada vencimiento
const GCAL_TOKEN_KEY="fgcaltok";    // {t, exp}
const GCAL_ULTIMA_KEY="fgcalultima";
const GCAL_CUENTA_KEY="fgcalcuenta";  // el mail de la cuenta de Google a la que se mandan los eventos (lo devuelve Google al crearlos)
const GCAL_VERSION_EVENTO=2;          // sube cuando cambia la forma del evento: así los ya enviados se actualizan solos
const GCAL_SCOPE="https://www.googleapis.com/auth/calendar.events";
const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";   // solo los archivos que crea esta app
const GCAL_API="https://www.googleapis.com/calendar/v3";

function gcalLeer(clave, defecto){
  try{ const v=JSON.parse(localStorage.getItem(clave)); return v===null||v===undefined ? defecto : v; }
  catch(e){ return defecto; }
}
function gcalClienteId(){ try{ return (localStorage.getItem(GCAL_ID_KEY)||"").trim(); }catch(e){ return ""; } }
function gcalActivo(){ try{ return localStorage.getItem(GCAL_ON_KEY)==="1" && !!gcalClienteId(); }catch(e){ return false; } }
function gcalMapa(){ const m=gcalLeer(GCAL_MAPA_KEY,{}); return (m && typeof m==="object" && !Array.isArray(m)) ? m : {}; }
function gcalGuardarMapa(m){ return guardarPreferencia(GCAL_MAPA_KEY, JSON.stringify(m)); }

// ── Lo que debería haber en el calendario (funciones puras salvo que leen movs/tcs globales) ──

// Un evento de día completo suena "N días antes a las 9:00". Google cuenta los minutos hacia atrás
// desde las 0:00 del día; el mismo día (a las 9) no se puede expresar con minutos negativos, así que
// avisa a las 0:00 (el primer momento del día).
function minutosAvisoGcal(dias){
  const n=Number.isInteger(dias)&&dias>=0 ? dias : VENC_AVISO_DEFECTO;
  return Math.max(n*1440-540, 0);
}

function diaSiguienteISO(iso){
  const [y,m,d]=String(iso).slice(0,10).split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
}

function hashEntradaGcal(e){
  return JSON.stringify([e.titulo, e.descripcion, e.inicio, e.rrule||"", e.minutos, GCAL_VERSION_EVENTO]);
}

// Lo que debería haber en el calendario: los mismos eventos del archivo .ics (eventosParaCalendario), con la
// clave del evento (su UID, que no cambia nunca) y el recordatorio. Cada elemento:
// {clave, titulo, descripcion, inicio, rrule, minutos}.
function entradasCalendario(hoyISO, lista, listaTcs, vencTc, diasAviso){
  const minutos=minutosAvisoGcal(diasAviso);
  return eventosParaCalendario(hoyISO, lista, listaTcs, vencTc).map(e=>({clave:e.uid, titulo:e.titulo,
    descripcion:e.descripcion, inicio:e.inicio, rrule:e.rrule, minutos, fecha:e.rrule?undefined:e.inicio}));
}

// Qué hay que mandar para que el calendario tenga todo lo deseado, dado lo que ya se mandó (`mapa`).
// Lo que ya no se desea (un gasto eliminado) se sigue contando como enviado: el evento queda en el
// calendario. Solo se descartan los resúmenes sueltos que ya vencieron, para que el mapa no crezca.
function planSyncGcal(deseado, mapa, hoyISO){
  const crear=[], actualizar=[], olvidar=[];
  const claves=new Set(deseado.map(e=>e.clave));
  deseado.forEach(e=>{
    const s=mapa[e.clave];
    if(!s) crear.push(e);
    else if(s.h!==hashEntradaGcal(e)) actualizar.push({entrada:e, id:s.id});
  });
  Object.entries(mapa).forEach(([clave, s])=>{ if(!claves.has(clave) && s.f && s.f<hoyISO) olvidar.push(clave); });
  return {crear, actualizar, olvidar};
}
function planTieneCambios(p){ return !!(p.crear.length || p.actualizar.length); }

function cuerpoEventoGcal(e){
  const b={
    summary:e.titulo, description:e.descripcion,
    start:{date:e.inicio}, end:{date:diaSiguienteISO(e.inicio)},
    transparency:"transparent",
    // Privado, sin invitados y sin permisos para nadie más: el evento es solo de la cuenta que dio el permiso. Si ese calendario
    // está compartido con otra persona, "private" hace que no vea el detalle (ni los montos). Nunca se agregan `attendees`.
    visibility:"private", guestsCanModify:false, guestsCanInviteOthers:false, guestsCanSeeOtherGuests:false,
    reminders:{useDefault:false, overrides:[{method:"popup", minutes:e.minutos}]},
    extendedProperties:{private:{enola:e.clave}}
  };
  if(e.rrule) b.recurrence=[e.rrule];
  return b;
}

// ── Permiso (Google Identity Services) ──
let gcalGisPromesa=null;
function gcalCargarGIS(){
  if(typeof google!=="undefined" && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if(gcalGisPromesa) return gcalGisPromesa;
  gcalGisPromesa=new Promise((ok, mal)=>{
    const s=document.createElement("script");
    s.src="https://accounts.google.com/gsi/client"; s.async=true;
    s.onload=()=>ok(); s.onerror=()=>{ gcalGisPromesa=null; mal(new Error("No pude cargar el acceso de Google (¿sin conexión?)")); };
    document.head.appendChild(s);
  });
  return gcalGisPromesa;
}
// Los permisos que hacen falta ahora: el calendario siempre y, si el usuario activó la copia de
// seguridad en Drive, también ese (un solo permiso de Google para las dos cosas).
function gcalAlcancesNecesarios(){
  return [GCAL_SCOPE, ...(typeof driveBackupActivo==="function" && driveBackupActivo() ? [DRIVE_SCOPE] : [])];
}
// Un token sirve si no venció y cubre todos los permisos que hacen falta (uno viejo, sin `s`, solo cubre el calendario).
function gcalTokenGuardado(alcances){
  const o=gcalLeer(GCAL_TOKEN_KEY,null);
  if(!o || !o.t || !(o.exp>Date.now()+60000)) return null;
  const tiene=String(o.s||GCAL_SCOPE).split(/\s+/);
  return (alcances||gcalAlcancesNecesarios()).every(a=>tiene.includes(a)) ? o.t : null;
}
function gcalOlvidarToken(){ try{ localStorage.removeItem(GCAL_TOKEN_KEY); }catch(e){} }

// Devuelve un token vigente. Sin uno guardado y con `interactivo`, abre el permiso de Google (solo
// puede abrirse dentro de un toque del usuario).
// `minimos`: los permisos que tiene que cubrir el token para esta tarea (por defecto, todos los necesarios). Al
// pedir uno nuevo se piden todos juntos, para que Google muestre un solo cartel.
async function gcalPedirToken(interactivo, minimos){
  const guardado=gcalTokenGuardado(minimos);
  if(guardado) return guardado;
  if(!interactivo) return null;
  await gcalCargarGIS();
  return new Promise(resolve=>{
    let listo=false;
    const fin=v=>{ if(!listo){ listo=true; resolve(v); } };
    const alcances=gcalAlcancesNecesarios();
    const cliente=google.accounts.oauth2.initTokenClient({
      client_id:gcalClienteId(), scope:alcances.join(" "),
      callback:r=>{
        if(r && r.access_token){
          guardarPreferencia(GCAL_TOKEN_KEY, JSON.stringify({t:r.access_token, exp:Date.now()+(Number(r.expires_in)||3600)*1000, s:r.scope||alcances.join(" ")}));
          fin(r.access_token);
        } else fin(null);
      },
      error_callback:()=>fin(null)
    });
    cliente.requestAccessToken({prompt: gcalActivo() ? "" : "consent"});
    setTimeout(()=>fin(null), 120000);
  });
}

// ── Llamadas a la API ──
async function gcalLlamar(deps, token, metodo, ruta, cuerpo){
  const res=await deps.fetch(GCAL_API+ruta, {
    method:metodo,
    headers:{"Authorization":"Bearer "+token, "Content-Type":"application/json"},
    body: cuerpo===undefined ? undefined : JSON.stringify(cuerpo)
  });
  let json=null;
  try{ json=await res.json(); }catch(e){ json=null; }
  return {status:res.status, json};
}
const gcalNoExiste=r=>r.status===404 || r.status===410;

const GCAL_DEPS={ token:gcalPedirToken, fetch:(...a)=>fetch(...a), ahora:()=>new Date() };
let gcalEnCurso=false;

// Pone el calendario al día. Devuelve {ok, motivo?, creados, actualizados, errores}.
// `opts.interactivo`: puede abrir el permiso de Google (solo desde un botón). `opts.deps`: para tests.
async function sincronizarCalendario(opts){
  opts=opts||{};
  const deps={...GCAL_DEPS, ...(opts.deps||{})};
  const res={ok:true, creados:0, actualizados:0, errores:0};
  if(!gcalClienteId()) return {...res, ok:false, motivo:"sin-cliente"};
  if(gcalEnCurso) return {...res, ok:false, motivo:"en-curso"};
  const hoy=hoyLocal();
  const mapa=gcalMapa();
  const plan=planSyncGcal(entradasCalendario(hoy, movs, tcs, leerVencTc(), leerDiasAviso()), mapa, hoy);
  plan.olvidar.forEach(c=>{ delete mapa[c]; });
  if(plan.olvidar.length) gcalGuardarMapa(mapa);
  if(!planTieneCambios(plan)) return res;

  gcalEnCurso=true;
  try{
    const token=await deps.token(!!opts.interactivo, [GCAL_SCOPE]);
    if(!token) return {...res, ok:false, motivo:"sin-permiso"};
    let abortar=null;
    const revisar=r=>{
      if(r.status===401){ gcalOlvidarToken(); abortar="sin-permiso"; }
      else if(r.status===403){ abortar="api"; res.detalle=(r.json&&r.json.error&&r.json.error.message)||""; }
      return abortar!==null;
    };
    const guardarEvento=(e, id)=>{ mapa[e.clave]={id, h:hashEntradaGcal(e), ...(e.fecha?{f:e.fecha}:{})}; gcalGuardarMapa(mapa); };
    // Google devuelve de quién es el calendario donde quedó el evento: se guarda para mostrar a qué cuenta se está mandando todo.
    const anotarCuenta=r=>{ const mail=r && r.json && r.json.organizer && r.json.organizer.email; if(mail) guardarPreferencia(GCAL_CUENTA_KEY, String(mail)); };
    const crear=async e=>{
      // Si el mapa se perdió (otro celular, datos borrados) el evento puede existir: se busca por su clave.
      const busq=await gcalLlamar(deps, token, "GET", `/calendars/primary/events?maxResults=1&privateExtendedProperty=${encodeURIComponent("enola="+e.clave)}`);
      if(revisar(busq)) return;
      const previo=busq.json && Array.isArray(busq.json.items) && busq.json.items[0];
      if(previo && previo.id){
        const r=await gcalLlamar(deps, token, "PATCH", `/calendars/primary/events/${encodeURIComponent(previo.id)}`, cuerpoEventoGcal(e));
        if(revisar(r)) return;
        if(r.status>=200 && r.status<300){ anotarCuenta(r); guardarEvento(e, previo.id); res.actualizados++; return; }
      }
      const r=await gcalLlamar(deps, token, "POST", "/calendars/primary/events", cuerpoEventoGcal(e));
      if(revisar(r)) return;
      if(r.status>=200 && r.status<300 && r.json && r.json.id){ anotarCuenta(r); guardarEvento(e, r.json.id); res.creados++; } else res.errores++;
    };
    for(const e of plan.crear){ if(abortar) break; await crear(e); }
    for(const a of plan.actualizar){
      if(abortar) break;
      const r=await gcalLlamar(deps, token, "PATCH", `/calendars/primary/events/${encodeURIComponent(a.id)}`, cuerpoEventoGcal(a.entrada));
      if(revisar(r)) break;
      if(gcalNoExiste(r)){ await crear(a.entrada); continue; }     // lo borraron a mano del calendario: se vuelve a crear
      if(r.status>=200 && r.status<300){ anotarCuenta(r); guardarEvento(a.entrada, a.id); res.actualizados++; } else res.errores++;
    }
    if(abortar) return {...res, ok:false, motivo:abortar};
    guardarPreferencia(GCAL_ULTIMA_KEY, String(Date.now()));
    return {...res, ok:res.errores===0};
  }catch(e){
    return {...res, ok:false, motivo:"red", detalle:String(e&&e.message||e)};
  }finally{ gcalEnCurso=false; }
}

// Cuántos cambios faltan mandar (sin tocar la red): para avisar en pantalla.
function calendarioPendientes(){
  if(!gcalActivo()) return 0;
  const hoy=hoyLocal();
  const p=planSyncGcal(entradasCalendario(hoy, movs, tcs, leerVencTc(), leerDiasAviso()), gcalMapa(), hoy);
  return p.crear.length+p.actualizar.length;
}

// Después de cada guardado: si ya hay un permiso vigente, se manda solo (con una pausa para juntar
// varios cambios). Sin permiso vigente no se molesta: queda el aviso "hay cambios sin enviar".
let gcalTimer=null;
function programarSyncCalendario(){
  if(!gcalActivo()) return;
  clearTimeout(gcalTimer);
  if(!gcalTokenGuardado([GCAL_SCOPE])){ gcalTimer=setTimeout(pintarAvisoCalendario, 400); return; }
  gcalTimer=setTimeout(async ()=>{
    await sincronizarCalendario({});
    // La copia de Drive es una por día: solo se sube si falta la de hoy y el permiso de Drive está vigente.
    if(typeof subirBackupDrive==="function" && gcalTokenGuardado([GCAL_SCOPE, DRIVE_SCOPE])) await subirBackupDrive({});
    pintarAvisoCalendario();
    if(typeof renderEstadoGcal==="function") renderEstadoGcal();
  }, 2500);
}

// La línea de Movimientos: "☁️ 3 cambios sin enviar · copia de hoy en Drive pendiente · Enviar".
function pintarAvisoCalendario(){
  const el=document.getElementById("gcal-aviso");
  if(!el) return;
  const n=calendarioPendientes();
  const bk=typeof backupDrivePendiente==="function" && backupDrivePendiente();
  if(!n && !bk){ el.style.display="none"; el.innerHTML=""; return; }
  const partes=[];
  if(n) partes.push(`${n} cambio${n===1?"":"s"} sin enviar`);
  if(bk) partes.push("copia en Drive pendiente");
  el.style.display="block";
  el.innerHTML=`<div class="venc-franja"><div class="venc-fila"><span class="venc-nombre">☁️ Google</span>
    <span class="venc-txt">${partes.join(" · ")}</span>
    <button type="button" class="venc-ok" onclick="enviarAGoogleCalendar()">Enviar</button></div></div>`;
}
