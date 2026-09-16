// ═══════════════════════════════════════════
// SERIE DE INFLACIÓN
// ═══════════════════════════════════════════
// El ajuste por inflación (deflactarARS, en dashboard.js) necesita la variación mensual del
// IPC mes a mes. Venía con 4 meses cargados a mano, así que en la práctica la comparación
// interanual no se mostraba nunca: la regla es no mostrar ningún porcentaje si falta un mes
// del tramo, porque un número que parece preciso y no lo es, en una app de plata, es peor
// que no decir nada.
//
// Acá se resuelve de dos formas, y las dos terminan en el mismo lugar:
//   · bajándola de una API pública (un toque, y queda guardada para usar sin conexión);
//   · pegándola a mano, si la API no responde o no deja llamarla desde el navegador.
//
// Sobre lo segundo: esta app es una PWA sin backend, así que el pedido sale desde el
// navegador del celular y la API tiene que mandar los headers de CORS. Abrir la URL en una
// pestaña NO prueba eso (una navegación no es un fetch cross-origin). Por eso actualizar
// informa fuente por fuente qué pasó, en vez de fallar con un "algo salió mal".

const INFLACION_KEY = "finflacion";

// De acá para atrás no interesa: la comparación del dashboard mira a lo sumo un par de años
// atrás, y guardar un siglo de serie es ocupar lugar al pedo.
const INFLACION_DESDE = "2016-01";

// Una variación mensual fuera de este rango es un dato roto, no un mes malo: el récord
// histórico argentino no llega a 200% mensual.
const INFLACION_MIN = -50;
const INFLACION_MAX = 200;

// Las fuentes que se prueban, en orden. Si una contesta algo válido, se corta ahí.
const FUENTES_INFLACION = [
  {
    nombre: "ArgentinaDatos",
    url: "https://api.argentinadatos.com/v1/finanzas/indices/inflacion",
    // Devuelve [{fecha:"YYYY-MM-DD", valor: <% del mes>}, ...]
    parsear: (json)=>parsearSerieFechaValor(json, "fecha", "valor")
  },
  {
    nombre: "datos.gob.ar",
    url: "https://apis.datos.gob.ar/series/api/series?ids=145.3_INGNACUAL_DICI_M_38&limit=5000&format=json",
    // Devuelve {data: [["YYYY-MM-DD", valor], ...]}
    parsear: (json)=>{
      if(!json || !Array.isArray(json.data)) return null;
      return parsearSerieFechaValor(json.data.map(f=>({fecha:f[0], valor:f[1]})), "fecha", "valor");
    }
  }
];

// ═══════════════════════════════════════════
// PARSEO Y VALIDACIÓN
// ═══════════════════════════════════════════

// Convierte una lista [{fecha:"YYYY-MM-DD", valor:N}] en la tabla {"YYYY-MM": N} que usa
// deflactarARS(). Devuelve null si el JSON no tiene la forma esperada — así una respuesta
// rara (una página de error, una API que cambió) no pisa la serie buena con basura.
function parsearSerieFechaValor(lista, campoFecha, campoValor){
  if(!Array.isArray(lista) || !lista.length) return null;
  const tabla={};
  let validos=0;
  lista.forEach(fila=>{
    if(!fila || typeof fila!=="object") return;
    const ym=String(fila[campoFecha]||"").slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(ym)) return;
    if(ym<INFLACION_DESDE) return;
    const v=Number(fila[campoValor]);
    if(!isFinite(v) || v<INFLACION_MIN || v>INFLACION_MAX) return;
    tabla[ym]=v;
    validos++;
  });
  return validos ? tabla : null;
}

// Una serie sirve si tiene meses seguidos: con agujeros, el ajuste no se puede encadenar y
// la comparación se oculta igual. Menos de 12 meses no alcanza ni para un año contra otro.
function serieUtil(tabla){
  const meses=Object.keys(tabla||{}).sort();
  if(meses.length<12) return false;
  return true;
}

// ═══════════════════════════════════════════
// ALMACENAMIENTO
// ═══════════════════════════════════════════
// Va por guardarPreferencia: si el disco está lleno, perder la serie no duele (se vuelve a
// bajar) y lo último que se quiere es que esto tape el aviso de un guardado de datos reales.

function leerSerieInflacion(){
  const guardado=leerJSONSeguro(INFLACION_KEY, "{}", "object");
  if(!guardado || typeof guardado.tabla!=="object" || !guardado.tabla) return null;
  return guardado;
}

function guardarSerieInflacion(tabla, fuente){
  const meses=Object.keys(tabla).sort();
  const paquete={
    tabla,
    fuente: fuente||"manual",
    actualizado: new Date().toISOString(),
    desde: meses[0]||"",
    hasta: meses[meses.length-1]||""
  };
  guardarPreferencia(INFLACION_KEY, JSON.stringify(paquete));
  return paquete;
}

function borrarSerieInflacion(){
  localStorage.removeItem(INFLACION_KEY);
}

// La tabla que realmente se usa para deflactar: la descargada/pegada por encima de la que
// viene compilada en el código. El fallback se mantiene para que sacar la serie descargada
// no deje la app peor de lo que estaba antes de esta función.
function tablaInflacion(){
  const guardado=leerSerieInflacion();
  if(!guardado) return INFLACION_MENSUAL_ARS;
  return Object.assign({}, INFLACION_MENSUAL_ARS, guardado.tabla);
}

// ═══════════════════════════════════════════
// ACTUALIZAR DESDE INTERNET
// ═══════════════════════════════════════════

// Prueba las fuentes en orden y devuelve {ok, tabla, fuente, intentos:[{nombre, resultado}]}.
// `intentos` es lo que se le muestra al usuario: sin eso, un fallo de CORS y un celular sin
// señal se ven exactamente igual, y no hay forma de saber cuál de los dos fue.
async function bajarSerieInflacion(fetchFn){
  const traer = fetchFn || ((typeof fetch==="function") ? fetch.bind(window) : null);
  const intentos=[];
  if(!traer) return {ok:false, intentos:[{nombre:"—", resultado:"Este navegador no puede hacer pedidos de red."}]};

  for(const fuente of FUENTES_INFLACION){
    try{
      const resp=await traer(fuente.url, {cache:"no-store"});
      if(!resp || !resp.ok){
        intentos.push({nombre:fuente.nombre, resultado:`Respondió con error ${resp&&resp.status||"?"}`});
        continue;
      }
      const json=await resp.json();
      const tabla=fuente.parsear(json);
      if(!tabla){
        intentos.push({nombre:fuente.nombre, resultado:"Contestó, pero con un formato que no reconozco."});
        continue;
      }
      if(!serieUtil(tabla)){
        intentos.push({nombre:fuente.nombre, resultado:`Trajo solo ${Object.keys(tabla).length} meses, muy pocos para comparar.`});
        continue;
      }
      intentos.push({nombre:fuente.nombre, resultado:`${Object.keys(tabla).length} meses ✓`});
      return {ok:true, tabla, fuente:fuente.nombre, intentos};
    }catch(err){
      // Un fetch bloqueado por CORS tira exactamente el mismo TypeError que un celular sin
      // señal, así que no se puede distinguir desde acá: se nombran las dos posibilidades en
      // vez de inventar una.
      const esRed = err && (err.name==="TypeError" || /fetch/i.test(String(err.message||"")));
      intentos.push({nombre:fuente.nombre, resultado: esRed
        ? "No se pudo conectar: puede ser que no tengas internet, o que esta API no permita llamadas desde la app (CORS)."
        : `Falló: ${err&&err.message||err}`});
    }
  }
  return {ok:false, intentos};
}

// ═══════════════════════════════════════════
// PEGAR A MANO
// ═══════════════════════════════════════════
// Acepta el JSON tal cual sale de la API, o líneas sueltas "2026-07  2,11" / "2026-07,2.11".
// La coma decimal es la forma natural de escribirlo en Argentina y pedirle al usuario que
// use punto es pedirle que se acuerde de algo que no tiene por qué.
function parsearSeriePegada(texto){
  const crudo=String(texto||"").trim();
  if(!crudo) return null;

  if(crudo.startsWith("[") || crudo.startsWith("{")){
    let json;
    try { json=JSON.parse(crudo); } catch(e){ return null; }
    if(Array.isArray(json)) return parsearSerieFechaValor(json, "fecha", "valor");
    if(json && Array.isArray(json.data)){
      return parsearSerieFechaValor(json.data.map(f=>({fecha:f[0], valor:f[1]})), "fecha", "valor");
    }
    return null;
  }

  const filas=[];
  crudo.split(/\r?\n/).forEach(linea=>{
    const m=String(linea).match(/(\d{4}-\d{2})(?:-\d{2})?\s*[,;\t ]\s*(-?[\d.,]+)/);
    if(!m) return;
    // "2,11" es 2.11 y "1.234,5" es 1234.5: se saca el punto de miles antes de cambiar la coma.
    const num=m[2].includes(",") ? m[2].replace(/\./g,"").replace(",",".") : m[2];
    filas.push({fecha:m[1]+"-01", valor:Number(num)});
  });
  return parsearSerieFechaValor(filas, "fecha", "valor");
}

// ═══════════════════════════════════════════
// RENDER (pantalla de Configuración)
// ═══════════════════════════════════════════

function renderInflacion(){
  const el=document.getElementById("inflacion-estado");
  if(!el) return;
  const guardado=leerSerieInflacion();
  const compilados=Object.keys(INFLACION_MENSUAL_ARS).length;

  if(!guardado){
    el.innerHTML=`<div class="inset">
      <div class="txt-md">Sin serie cargada. Están solo los ${compilados} meses que vienen en la app, así que la comparación contra el año pasado no se muestra.</div>
      <div class="txt-xs txt-muted" style="margin-top:4px">Bajala de internet o pegala abajo. Después funciona sin conexión.</div>
    </div>`;
    return;
  }
  const n=Object.keys(guardado.tabla).length;
  const cuando=guardado.actualizado ? new Date(guardado.actualizado).toLocaleDateString("es-AR") : "?";
  // El INDEC publica con unas semanas de atraso, así que lo normal es tener hasta el mes
  // pasado. Más atrás que eso y la comparación se va a seguir ocultando: hay que decirlo,
  // porque si no la pantalla dice "126 meses cargados ✓" mientras la función no funciona.
  const mesEsperado=addMonths(currentYM(),-1);
  const atrasada=guardado.hasta && guardado.hasta<mesEsperado;
  const faltan=atrasada ? mesesEntre(guardado.hasta, currentYM()) : 0;
  el.innerHTML=`<div class="inset">
    <div class="txt-md txt-strong">${n} meses cargados</div>
    <div class="txt-xs txt-muted" style="margin-top:3px">De ${escapeHtml(mesLbl(guardado.desde))} a ${escapeHtml(mesLbl(guardado.hasta))} · ${escapeHtml(guardado.fuente)} · ${escapeHtml(cuando)}</div>
    ${atrasada?`<div class="txt-xs" style="color:var(--warning);margin-top:6px">Le ${faltan===1?"falta el último mes":`faltan los últimos ${faltan} meses`}. Hasta que estén, la comparación contra el año pasado se sigue ocultando para los meses recientes.</div>`:""}
  </div>`;
}

async function actualizarInflacionDesdeInternet(){
  const btn=document.getElementById("btn-inflacion-bajar");
  if(btn){ btn.disabled=true; btn.textContent="Buscando…"; }
  let r;
  try { r=await bajarSerieInflacion(); }
  finally { if(btn){ btn.disabled=false; btn.textContent="🌐 Actualizar desde internet"; } }

  const detalle=r.intentos.map(i=>`· ${i.nombre}: ${i.resultado}`).join("\n");
  if(!r.ok){
    await mostrarAlerta(`No pude bajar la serie.\n\n${detalle}\n\nPodés pegarla a mano abajo: sirve el JSON tal cual sale de la API.`,
      "No se pudo actualizar");
    return;
  }
  guardarSerieInflacion(r.tabla, r.fuente);
  renderInflacion();
  marcarDatosSucios();
  showToast(`✓ Serie actualizada (${Object.keys(r.tabla).length} meses)`);
}

async function guardarInflacionPegada(){
  const ta=document.getElementById("inflacion-pegar");
  if(!ta) return;
  const tabla=parsearSeriePegada(ta.value);
  if(!tabla){
    await mostrarAlerta('No pude leer nada de ahí.\n\nSirve el JSON de la API, o una línea por mes tipo "2026-07, 2,11".',
      "Formato no reconocido");
    return;
  }
  const n=Object.keys(tabla).length;
  if(!serieUtil(tabla)){
    if(!await mostrarConfirm(`Leí ${n} ${n===1?"mes":"meses"}. Con menos de 12 la comparación contra el año pasado va a seguir oculta.\n\n¿Los guardo igual?`,
      {titulo:"Pocos meses", textoOk:"Guardar igual"})) return;
  }
  guardarSerieInflacion(tabla, "pegada a mano");
  ta.value="";
  renderInflacion();
  marcarDatosSucios();
  showToast(`✓ ${n} meses guardados`);
}

async function borrarInflacion(){
  if(!await mostrarConfirm("Se borra la serie descargada y vuelven a quedar solo los meses que trae la app.",
    {titulo:"Borrar la serie", textoOk:"Borrar", peligroso:true})) return;
  borrarSerieInflacion();
  renderInflacion();
  marcarDatosSucios();
  showToast("Serie borrada");
}
