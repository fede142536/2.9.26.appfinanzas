// ═══════════════════════════════════════════
// GOOGLE CALENDAR: LOS VENCIMIENTOS SE MANTIENEN SOLOS EN EL CALENDARIO
// ═══════════════════════════════════════════
// Cada gasto frecuente (de gastos o de tarjeta) con día de vencimiento queda como UN evento mensual
// que se repite sin fin. Cada resumen de tarjeta con fecha cargada, como un evento suelto. La app
// compara lo que DEBERÍA haber en el calendario con lo que ya mandó y corrige la diferencia:
//   · gasto nuevo o con vencimiento nuevo → crea el evento
//   · cambió el día, el monto o el nombre → lo actualiza
//   · eliminaste el gasto, lo diste de baja o le quitaste el día → lo borra del calendario
//   · con "Mes de fin" el evento se corta ahí (UNTIL)
// La comunicación pasa por la API de Google Calendar con el permiso `calendar.events`, que el
// usuario da una vez. Hace falta un "ID de cliente" de Google (lo crea el usuario: ver Config).
// Todo esto es preferencia, no dato financiero: va en localStorage llano, como el resto de
// los vencimientos. El token dura 1 hora; sin token vigente la app no pregunta sola: avisa que hay
// cambios sin enviar y se sincroniza al tocar el botón.

const GCAL_ID_KEY="fgcalid";        // ID de cliente OAuth
const GCAL_ON_KEY="fgcalon";        // "1" cuando el usuario ya conectó
const GCAL_MAPA_KEY="fgcalmapa";    // {clave: {id, h, f}}: qué evento de Google es cada vencimiento
const GCAL_TOKEN_KEY="fgcaltok";    // {t, exp}
const GCAL_ULTIMA_KEY="fgcalultima";
const GCAL_SCOPE="https://www.googleapis.com/auth/calendar.events";
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

// "FREQ=MONTHLY" en el día `dia`. Del 29 al 31 hay meses que no lo tienen: la regla toma "el último
// día entre el 28 y el `dia`", que es lo mismo que hace fechaVencimiento() (un 31 en febrero cae el 28).
function reglaMensual(dia, finISO){
  const d=diaValido(dia);
  if(d===null) return null;
  let r;
  if(d>28){
    const dias=[]; for(let i=28;i<=d;i++) dias.push(i);
    r=`FREQ=MONTHLY;BYMONTHDAY=${dias.join(",")};BYSETPOS=-1`;
  } else r=`FREQ=MONTHLY;BYMONTHDAY=${d}`;
  if(finISO) r+=`;UNTIL=${String(finISO).replace(/-/g,"")}`;
  return "RRULE:"+r;
}

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
  return JSON.stringify([e.titulo, e.descripcion, e.inicio, e.rrule||"", e.minutos]);
}

function nombreGastoFrecuente(m){
  return m.subcat && !SUBCAT_SIN_VALOR.includes(m.subcat) ? m.subcat : (m.cat||"Gasto frecuente");
}

// Cada elemento: {clave, tipo:"recurrente"|"unico", titulo, descripcion, inicio, rrule, minutos, fecha}.
// `clave` identifica al vencimiento para siempre (el id del gasto; o tarjeta+moneda+fecha del resumen).
function entradasCalendario(hoyISO, lista, listaTcs, vencTc, diasAviso){
  const hoyYM=String(hoyISO).slice(0,7);
  const minutos=minutosAvisoGcal(diasAviso);
  const out=[];
  const recurrente=(clave, titulo, descripcion, mesInicio, mesFin, dia)=>{
    const ym0=mesInicio>hoyYM ? mesInicio : hoyYM;
    out.push({clave, tipo:"recurrente", titulo, descripcion, inicio:fechaVencimiento(ym0, dia),
              rrule:reglaMensual(dia, mesFin ? fechaVencimiento(mesFin, dia) : null), minutos});
  };
  (lista||[]).forEach(m=>{
    if(m.tipo!=="Gasto" || !m.frecuente || !m.mesInicio) return;
    const dia=diaValido(m.diaVto);
    if(dia===null || (m.mesFin && m.mesFin<hoyYM)) return;     // sin día, o ya dado de baja
    const monto=getGastoFrecMontoEnMes(m, hoyYM);
    const montoTxt=m.moneda==="USD" ? `USD ${monto.toFixed(2)}` : fmtS(monto);
    recurrente(`g:${m.id}`, `🔁 ${nombreGastoFrecuente(m)} vence`,
      `Gasto frecuente · ${montoTxt} este mes. Cargado en Enola; si ya lo pagaste, ignorá el aviso.`,
      m.mesInicio, m.mesFin, dia);
  });
  (listaTcs||[]).forEach(t=>{
    if(!t.frecuente || !t.mesInicio) return;
    const dia=diaValido(t.diaVto);
    if(dia===null || (t.mesFin && t.mesFin<hoyYM)) return;
    const monto=getMontoEnMes(t, hoyYM);
    const montoTxt=t.moneda==="USD" ? `USD ${monto.toFixed(2)}` : fmtS(monto);
    recurrente(`t:${t.id}`, `🔁 ${t.desc||"Gasto frecuente"} vence`,
      `Con ${getTarjetaEnMes(t,hoyYM)||"tarjeta"} · ${montoTxt} este mes. Cargado en Enola; si ya lo pagaste, ignorá el aviso.`,
      t.mesInicio, t.mesFin, dia);
  });
  // Los resúmenes de tarjeta cambian de fecha todos los meses: eventos sueltos, de lo que viene.
  proximosVencimientos(hoyISO, lista, vencTc, 120, 3).filter(v=>v.tipo==="tarjeta" && v.dias>=0).forEach(v=>{
    out.push({clave:`r:${v.tarjeta||""}|${v.moneda}|${v.fecha}`, tipo:"unico",
      titulo:`💳 ${v.nombre} vence`,
      descripcion:`Resumen de la tarjeta · resta ${montoVenc(v)}. Cargado en Enola; si ya lo pagaste, ignorá el aviso.`,
      inicio:v.fecha, rrule:null, minutos, fecha:v.fecha});
  });
  return out;
}

// Qué hay que hacer para que el calendario quede como `deseado`, dado lo que ya se mandó (`mapa`).
function planSyncGcal(deseado, mapa, hoyISO){
  const crear=[], actualizar=[], borrar=[], olvidar=[];
  const claves=new Set(deseado.map(e=>e.clave));
  deseado.forEach(e=>{
    const s=mapa[e.clave];
    if(!s) crear.push(e);
    else if(s.h!==hashEntradaGcal(e)) actualizar.push({entrada:e, id:s.id});
  });
  Object.entries(mapa).forEach(([clave, s])=>{
    if(claves.has(clave)) return;
    // Un resumen que ya venció queda en el calendario como historia: solo se deja de seguir.
    if(s.f && s.f<hoyISO) olvidar.push(clave); else borrar.push({clave, id:s.id});
  });
  return {crear, actualizar, borrar, olvidar};
}
function planTieneCambios(p){ return !!(p.crear.length || p.actualizar.length || p.borrar.length); }

function cuerpoEventoGcal(e){
  const b={
    summary:e.titulo, description:e.descripcion,
    start:{date:e.inicio}, end:{date:diaSiguienteISO(e.inicio)},
    transparency:"transparent",
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
function gcalTokenGuardado(){
  const o=gcalLeer(GCAL_TOKEN_KEY,null);
  return o && o.t && o.exp>Date.now()+60000 ? o.t : null;
}
function gcalOlvidarToken(){ try{ localStorage.removeItem(GCAL_TOKEN_KEY); }catch(e){} }

// Devuelve un token vigente. Sin uno guardado y con `interactivo`, abre el permiso de Google (solo
// puede abrirse dentro de un toque del usuario).
async function gcalPedirToken(interactivo){
  const guardado=gcalTokenGuardado();
  if(guardado) return guardado;
  if(!interactivo) return null;
  await gcalCargarGIS();
  return new Promise(resolve=>{
    let listo=false;
    const fin=v=>{ if(!listo){ listo=true; resolve(v); } };
    const cliente=google.accounts.oauth2.initTokenClient({
      client_id:gcalClienteId(), scope:GCAL_SCOPE,
      callback:r=>{
        if(r && r.access_token){
          guardarPreferencia(GCAL_TOKEN_KEY, JSON.stringify({t:r.access_token, exp:Date.now()+(Number(r.expires_in)||3600)*1000}));
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

// Pone el calendario al día. Devuelve {ok, motivo?, creados, actualizados, borrados, errores}.
// `opts.interactivo`: puede abrir el permiso de Google (solo desde un botón). `opts.deps`: para tests.
async function sincronizarCalendario(opts){
  opts=opts||{};
  const deps={...GCAL_DEPS, ...(opts.deps||{})};
  const res={ok:true, creados:0, actualizados:0, borrados:0, errores:0};
  if(!gcalClienteId()) return {...res, ok:false, motivo:"sin-cliente"};
  if(gcalEnCurso) return {...res, ok:false, motivo:"en-curso"};
  const hoy=hoyLocal();
  const mapa=gcalMapa();
  // `vaciar` (al desconectar): no se desea ningún evento, así que se borran todos los que mandó la app.
  const plan=opts.vaciar ? planSyncGcal([], mapa, "0000-00-00")
                         : planSyncGcal(entradasCalendario(hoy, movs, tcs, leerVencTc(), leerDiasAviso()), mapa, hoy);
  plan.olvidar.forEach(c=>{ delete mapa[c]; });
  if(plan.olvidar.length) gcalGuardarMapa(mapa);
  if(!planTieneCambios(plan)) return res;

  gcalEnCurso=true;
  try{
    const token=await deps.token(!!opts.interactivo);
    if(!token) return {...res, ok:false, motivo:"sin-permiso"};
    let abortar=null;
    const revisar=r=>{
      if(r.status===401){ gcalOlvidarToken(); abortar="sin-permiso"; }
      else if(r.status===403){ abortar="api"; res.detalle=(r.json&&r.json.error&&r.json.error.message)||""; }
      return abortar!==null;
    };
    const guardarEvento=(e, id)=>{ mapa[e.clave]={id, h:hashEntradaGcal(e), ...(e.fecha?{f:e.fecha}:{})}; gcalGuardarMapa(mapa); };
    const crear=async e=>{
      // Si el mapa se perdió (otro celular, datos borrados) el evento puede existir: se busca por su clave.
      const busq=await gcalLlamar(deps, token, "GET", `/calendars/primary/events?maxResults=1&privateExtendedProperty=${encodeURIComponent("enola="+e.clave)}`);
      if(revisar(busq)) return;
      const previo=busq.json && Array.isArray(busq.json.items) && busq.json.items[0];
      if(previo && previo.id){
        const r=await gcalLlamar(deps, token, "PATCH", `/calendars/primary/events/${encodeURIComponent(previo.id)}`, cuerpoEventoGcal(e));
        if(revisar(r)) return;
        if(r.status>=200 && r.status<300){ guardarEvento(e, previo.id); res.actualizados++; return; }
      }
      const r=await gcalLlamar(deps, token, "POST", "/calendars/primary/events", cuerpoEventoGcal(e));
      if(revisar(r)) return;
      if(r.status>=200 && r.status<300 && r.json && r.json.id){ guardarEvento(e, r.json.id); res.creados++; } else res.errores++;
    };
    for(const e of plan.crear){ if(abortar) break; await crear(e); }
    for(const a of plan.actualizar){
      if(abortar) break;
      const r=await gcalLlamar(deps, token, "PATCH", `/calendars/primary/events/${encodeURIComponent(a.id)}`, cuerpoEventoGcal(a.entrada));
      if(revisar(r)) break;
      if(gcalNoExiste(r)){ await crear(a.entrada); continue; }     // lo borraron a mano del calendario: se vuelve a crear
      if(r.status>=200 && r.status<300){ guardarEvento(a.entrada, a.id); res.actualizados++; } else res.errores++;
    }
    for(const b of plan.borrar){
      if(abortar) break;
      const r=await gcalLlamar(deps, token, "DELETE", `/calendars/primary/events/${encodeURIComponent(b.id)}`);
      if(revisar(r)) break;
      if((r.status>=200 && r.status<300) || gcalNoExiste(r)){ delete mapa[b.clave]; gcalGuardarMapa(mapa); res.borrados++; } else res.errores++;
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
  return p.crear.length+p.actualizar.length+p.borrar.length;
}

// Después de cada guardado: si ya hay un permiso vigente, se manda solo (con una pausa para juntar
// varios cambios). Sin permiso vigente no se molesta: queda el aviso "hay cambios sin enviar".
let gcalTimer=null;
function programarSyncCalendario(){
  if(!gcalActivo()) return;
  clearTimeout(gcalTimer);
  if(!gcalTokenGuardado()){ gcalTimer=setTimeout(pintarAvisoCalendario, 400); return; }
  gcalTimer=setTimeout(async ()=>{
    await sincronizarCalendario({});
    pintarAvisoCalendario();
    if(typeof renderEstadoGcal==="function") renderEstadoGcal();
  }, 2500);
}

// La línea de Movimientos: "📅 3 cambios sin enviar a Google Calendar · Enviar".
function pintarAvisoCalendario(){
  const el=document.getElementById("gcal-aviso");
  if(!el) return;
  const n=calendarioPendientes();
  if(!n){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="block";
  el.innerHTML=`<div class="venc-franja"><div class="venc-fila"><span class="venc-nombre">📅 Google Calendar</span>
    <span class="venc-txt">${n} cambio${n===1?"":"s"} sin enviar</span>
    <button type="button" class="venc-ok" onclick="enviarAGoogleCalendar()">Enviar</button></div></div>`;
}
