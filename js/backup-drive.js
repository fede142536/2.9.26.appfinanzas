// ═══════════════════════════════════════════
// COPIA DE SEGURIDAD AUTOMÁTICA EN GOOGLE DRIVE
// ═══════════════════════════════════════════
// Una copia por día —si hubo cambios— en una carpeta "Enola backups" de TU Drive. Es la única que te
// salva si perdés o formateás el celular (las copias de IndexedDB viven en el mismo aparato), y desde
// un celular nuevo se restaura desde acá mismo (Config → Ver copias en Drive).
//
// Usa la misma conexión de Google que el calendario (el mismo ID de cliente y el mismo permiso) más
// el permiso `drive.file`: la app solo ve los archivos que ella misma creó, nunca el resto de tu Drive.
// Hace falta habilitar también la "Google Drive API" en el proyecto de Google Cloud.
//
// "Automático" acá significa "cuando abrís la app y el permiso de Google sigue vigente" (dura 1 hora y
// una app web no puede renovarlo sola): si no, queda el aviso "copia en Drive pendiente" con su botón.
// La copia va SIN cifrar, igual que el archivo de backup: se guarda en tu Drive, que es tuyo.
// Se conservan las últimas 14 copias: las más viejas que creó la app se borran de esa carpeta.

const DRIVE_ON_KEY="fdrivebk";           // "1" si la copia diaria está activada
const DRIVE_CARPETA_KEY="fdrivecarpeta"; // id de la carpeta, para no buscarla cada vez
const DRIVE_ULT_KEY="fdriveult";         // {dia, hash, ts, nombre} de la última copia subida
const DRIVE_CARPETA="Enola backups";
const DRIVE_API="https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD="https://www.googleapis.com/upload/drive/v3";
const DRIVE_CONSERVAR=14;
const RE_BACKUP_DRIVE=/^enola-backup-\d{4}-\d{2}-\d{2}\.json$/;

function driveBackupActivo(){ try{ return localStorage.getItem(DRIVE_ON_KEY)==="1"; }catch(e){ return false; } }
function driveActivo(){ return gcalActivo() && driveBackupActivo(); }

function nombreBackupDrive(hoyISO){ return `enola-backup-${hoyISO}.json`; }

// ¿Hay que subir una copia ahora? Una por día, y solo si los datos cambiaron desde la última.
function tocaBackupDrive(ult, hash, hoyISO){
  if(!hash) return false;
  if(!ult) return true;
  if(ult.dia===hoyISO) return false;
  return ult.hash!==hash;
}

// ¿Falta subir la copia de hoy? Barato: no arma el backup si ya se subió una hoy.
function backupDrivePendiente(){
  if(!driveActivo()) return false;
  if(!movs.length && !tcs.length) return false;
  const ult=gcalLeer(DRIVE_ULT_KEY,null), hoy=hoyLocal();
  if(ult && ult.dia===hoy) return false;
  return tocaBackupDrive(ult, hashDatos(JSON.stringify(armarBackup().datos)), hoy);
}

// Cuerpo "multipart/related" de la API de subida: los datos del archivo y su contenido.
function cuerpoMultipartDrive(meta, contenido, limite){
  return `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
       + `--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`;
}

async function driveLlamar(deps, token, metodo, url, cuerpo, tipo){
  const headers={"Authorization":"Bearer "+token};
  if(tipo) headers["Content-Type"]=tipo; else if(cuerpo!==undefined) headers["Content-Type"]="application/json";
  const res=await deps.fetch(url, {method:metodo, headers, body: cuerpo===undefined ? undefined : (tipo ? cuerpo : JSON.stringify(cuerpo))});
  let texto=null, json=null;
  try{ texto=await res.text(); json=JSON.parse(texto); }catch(e){ /* una respuesta vacía (204) o no JSON */ }
  return {status:res.status, json, texto};
}
const driveOk=r=>r.status>=200 && r.status<300;
// Por qué falló una llamada: sin permiso (token rechazado), API no habilitada / permiso denegado, o red.
function driveMotivo(r){
  if(r.status===401){ gcalOlvidarToken(); return "sin-permiso"; }
  if(r.status===403) return "api";
  return "red";
}
const driveDetalle=r=>(r.json && r.json.error && r.json.error.message) || "";

// La carpeta de las copias: la que se guardó, o la que ya exista con ese nombre (un celular nuevo), o una nueva.
async function driveAsegurarCarpeta(deps, token){
  const guardada=(()=>{ try{ return localStorage.getItem(DRIVE_CARPETA_KEY)||""; }catch(e){ return ""; } })();
  if(guardada){
    const r=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files/${encodeURIComponent(guardada)}?fields=id,trashed`);
    if(driveOk(r) && r.json && !r.json.trashed) return {id:guardada};
    if(r.status===401 || r.status===403) return {error:r};
  }
  const q=`name='${DRIVE_CARPETA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const b=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  if(!driveOk(b)) return {error:b};
  let id=b.json && b.json.files && b.json.files[0] && b.json.files[0].id;
  if(!id){
    const c=await driveLlamar(deps, token, "POST", `${DRIVE_API}/files?fields=id`, {name:DRIVE_CARPETA, mimeType:"application/vnd.google-apps.folder"});
    if(!driveOk(c) || !c.json || !c.json.id) return {error:c};
    id=c.json.id;
  }
  guardarPreferencia(DRIVE_CARPETA_KEY, id);
  return {id};
}

let driveEnCurso=false;

// Sube la copia de hoy a Drive. Devuelve {ok, subido, motivo?, detalle?}.
//   opts.forzar: sube aunque ya haya una de hoy o no haya cambios (el botón "Subir copia ahora").
//   opts.interactivo: puede abrir el permiso de Google (solo desde un botón).  opts.deps: para tests.
async function subirBackupDrive(opts){
  opts=opts||{};
  const deps={...GCAL_DEPS, ...(opts.deps||{})};
  const res={ok:true, subido:false};
  if(!driveActivo()) return {...res, ok:false, motivo:"inactivo"};
  if(!movs.length && !tcs.length) return {...res, motivo:"vacio"};   // nunca se sube una app recién instalada y vacía
  if(driveEnCurso) return {...res, ok:false, motivo:"en-curso"};
  const hoy=hoyLocal();
  const ult=gcalLeer(DRIVE_ULT_KEY,null);
  if(!opts.forzar && ult && ult.dia===hoy) return res;
  const backup=armarBackup();
  const hash=hashDatos(JSON.stringify(backup.datos));
  if(!opts.forzar && !tocaBackupDrive(ult, hash, hoy)) return res;

  driveEnCurso=true;
  try{
    const token=await deps.token(!!opts.interactivo, [GCAL_SCOPE, DRIVE_SCOPE]);
    if(!token) return {...res, ok:false, motivo:"sin-permiso"};
    const carpeta=await driveAsegurarCarpeta(deps, token);
    if(carpeta.error) return {...res, ok:false, motivo:driveMotivo(carpeta.error), detalle:driveDetalle(carpeta.error)};
    const nombre=nombreBackupDrive(hoy);
    const texto=JSON.stringify(backup);
    // Si ya hay una de hoy (se forzó), se actualiza esa en vez de duplicarla.
    const qHoy=`'${carpeta.id}' in parents and name='${nombre}' and trashed=false`;
    const previo=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files?q=${encodeURIComponent(qHoy)}&fields=files(id)&pageSize=1`);
    if(!driveOk(previo)) return {...res, ok:false, motivo:driveMotivo(previo), detalle:driveDetalle(previo)};
    const idPrevio=previo.json && previo.json.files && previo.json.files[0] && previo.json.files[0].id;
    let r;
    if(idPrevio) r=await driveLlamar(deps, token, "PATCH", `${DRIVE_UPLOAD}/files/${encodeURIComponent(idPrevio)}?uploadType=media`, texto, "application/json");
    else{
      const limite="enola"+Date.now().toString(36);
      r=await driveLlamar(deps, token, "POST", `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
        cuerpoMultipartDrive({name:nombre, parents:[carpeta.id], mimeType:"application/json"}, texto, limite), `multipart/related; boundary=${limite}`);
    }
    if(!driveOk(r)) return {...res, ok:false, motivo:driveMotivo(r), detalle:driveDetalle(r)};
    guardarPreferencia(DRIVE_ULT_KEY, JSON.stringify({dia:hoy, hash, ts:Date.now(), nombre, bytes:texto.length}));
    await podarBackupsDrive(deps, token, carpeta.id);
    return {...res, subido:true, nombre};
  }catch(e){
    return {...res, ok:false, motivo:"red", detalle:String(e&&e.message||e)};
  }finally{ driveEnCurso=false; }
}

// Deja las últimas DRIVE_CONSERVAR copias. Solo toca archivos de la carpeta de la app con el nombre de las copias.
async function podarBackupsDrive(deps, token, carpetaId){
  try{
    const lista=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files?q=${encodeURIComponent(`'${carpetaId}' in parents and trashed=false`)}&orderBy=name%20desc&pageSize=200&fields=files(id,name)`);
    if(!driveOk(lista) || !lista.json || !Array.isArray(lista.json.files)) return 0;
    const viejas=lista.json.files.filter(f=>RE_BACKUP_DRIVE.test(f.name)).sort((a,b)=>b.name.localeCompare(a.name)).slice(DRIVE_CONSERVAR);
    for(const f of viejas) await driveLlamar(deps, token, "DELETE", `${DRIVE_API}/files/${encodeURIComponent(f.id)}`);
    return viejas.length;
  }catch(e){ return 0; }
}

// Las copias que hay en Drive, la más nueva primero: [{id, nombre, dia, bytes}].
async function listarBackupsDrive(opts){
  opts=opts||{};
  const deps={...GCAL_DEPS, ...(opts.deps||{})};
  try{
    const token=await deps.token(!!opts.interactivo, [GCAL_SCOPE, DRIVE_SCOPE]);
    if(!token) return {ok:false, motivo:"sin-permiso", copias:[]};
    const carpeta=await driveAsegurarCarpeta(deps, token);
    if(carpeta.error) return {ok:false, motivo:driveMotivo(carpeta.error), detalle:driveDetalle(carpeta.error), copias:[]};
    const r=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files?q=${encodeURIComponent(`'${carpeta.id}' in parents and trashed=false`)}&pageSize=200&fields=files(id,name,size)`);
    if(!driveOk(r)) return {ok:false, motivo:driveMotivo(r), detalle:driveDetalle(r), copias:[]};
    const copias=((r.json&&r.json.files)||[]).filter(f=>RE_BACKUP_DRIVE.test(f.name))
      .map(f=>({id:f.id, nombre:f.name, dia:f.name.slice(13,23), bytes:Number(f.size)||0}))
      .sort((a,b)=>b.nombre.localeCompare(a.nombre));
    return {ok:true, copias};
  }catch(e){ return {ok:false, motivo:"red", detalle:String(e&&e.message||e), copias:[]}; }
}

// Baja una copia de Drive y la devuelve ya leída (o {motivo}). No toca los datos.
async function leerBackupDrive(id, opts){
  opts=opts||{};
  const deps={...GCAL_DEPS, ...(opts.deps||{})};
  try{
    const token=await deps.token(!!opts.interactivo, [GCAL_SCOPE, DRIVE_SCOPE]);
    if(!token) return {ok:false, motivo:"sin-permiso"};
    const r=await driveLlamar(deps, token, "GET", `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`);
    if(!driveOk(r)) return {ok:false, motivo:driveMotivo(r), detalle:driveDetalle(r)};
    const backup=r.json;
    if(!backup || !backup.datos || !Array.isArray(backup.datos.movs)) return {ok:false, motivo:"invalida"};
    return {ok:true, backup};
  }catch(e){ return {ok:false, motivo:"red", detalle:String(e&&e.message||e)}; }
}

function mensajeDrive(r){
  if(r.ok) return r.subido ? "✓ Copia subida a tu Drive" : (r.motivo==="vacio" ? "No hay datos para copiar todavía" : "✓ Tu copia de hoy en Drive ya estaba al día");
  if(r.motivo==="sin-permiso") return "No se dio el permiso de Google para Drive. Probá de nuevo.";
  if(r.motivo==="api") return `Google rechazó el pedido. ¿Habilitaste la Google Drive API en tu proyecto y diste el permiso de Drive?${r.detalle?` (${r.detalle})`:""}`;
  if(r.motivo==="invalida") return "Esa copia no se puede leer";
  if(r.motivo==="en-curso") return "Ya se está subiendo…";
  return `No pude conectar con Drive${r.detalle?`: ${r.detalle}`:""}`;
}
