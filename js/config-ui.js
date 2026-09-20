// ═══════════════════════════════════════════
// INPUT MASKING: formateo de miles en vivo en los campos de monto
// ═══════════════════════════════════════════
// Inserta puntos de miles cada 3 dígitos desde la derecha, preservando como mucho una
// coma decimal (máx. 2 decimales). Ej: "1500000" -> "1.500.000", "1500,5" -> "1.500,5"
function formatearNumeroConMiles(str){
  let limpio=String(str||"").replace(/[^\d,]/g,"");
  const partes=limpio.split(",");
  let entero=partes[0]||"";
  const decimal = partes.length>1 ? partes.slice(1).join("").slice(0,2) : undefined;
  entero=entero.replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return decimal!==undefined ? `${entero},${decimal}` : entero;
}
// Igual que formatearNumeroConMiles, pero soporta expresiones con +/- (para #inp-importe,
// que permite tipear algo como "1500+200"): separa por operador, enmascara cada número
// por separado, y vuelve a unir conservando los signos.
function formatearConMiles(valorCrudo){
  const partes=String(valorCrudo||"").split(/([+-])/);
  return partes.map(p=> (p==="+"||p==="-") ? p : formatearNumeroConMiles(p)).join("");
}
// Aplica un formateador al valor de un input, preservando la posición del cursor
// (se ajusta por la diferencia de longitud que agregan/quitan los puntos de miles).
function aplicarMascaraMiles(input, formateador){
  const cursorViejo=input.selectionStart;
  const valorViejo=input.value;
  const nuevoValor=formateador(valorViejo);
  if(nuevoValor===valorViejo) return;
  const diff=nuevoValor.length-valorViejo.length;
  input.value=nuevoValor;
  const nuevoCursor=Math.max(0, (cursorViejo||0)+diff);
  input.setSelectionRange(nuevoCursor, nuevoCursor);
}
// Limpia un valor formateado con puntos de miles y coma decimal para poder parsearlo:
// quita los puntos (son separador de miles, no decimal) y convierte la coma en punto decimal.
function limpiarImporte(str){
  return String(str||"").replace(/\./g,"").replace(/,/g,".");
}

function evalImporte(str){
  if(typeof str !== "string") str = String(str||"");
  str = limpiarImporte(str).replace(/\s/g, "");
  if(!str) return 0;
  // Solo dígitos, puntos, + y -
  if(!/^[\d+\-.]+$/.test(str)) return parseFloat(str)||0;
  // Si solo hay un número, devolvemos directo
  if(!/[+\-]/.test(str.replace(/^-/, ""))) return parseFloat(str)||0;
  // Evaluación manual segura (sin eval): partimos por + y -
  try {
    // Reemplazo "-" intermedio por "+-" para split unificado
    const normalized = str.replace(/(?<=\d)-/g, "+-");
    const parts = normalized.split("+").filter(Boolean);
    let total = 0;
    for(const p of parts){
      const n = parseFloat(p);
      if(isNaN(n)) return 0;
      total += n;
    }
    return Math.round(total*100)/100;
  } catch(e){
    return parseFloat(str)||0;
  }
}
// Mostrar resultado en vivo si hay operaciones
function updateImporteCalc(){
  const inp=document.getElementById("inp-importe");
  const prev=document.getElementById("importe-calc-preview");
  if(!inp||!prev) return;
  const v=inp.value||"";
  if(/[+\-].*\d/.test(v.replace(/^-/, ""))){
    const total=evalImporte(v);
    if(total>0){
      prev.textContent=`= ${fmt(total)}`;
      prev.style.display="block";
    } else {
      prev.style.display="none";
    }
  } else {
    prev.style.display="none";
  }
}

// Toggles "Es ahorro" y "Sale de ahorros" son mutuamente excluyentes
function onAhorroToggle(){
  if(document.getElementById("inp-ahorro").checked){
    document.getElementById("inp-usa-ahorro").checked=false;
    // Frecuente y ahorro tampoco se mezclan: si activás ahorro, desactiva frecuente
    const frec=document.getElementById("inp-frecuente");
    if(frec) frec.checked=false;
  }
}
function onUsaAhorroToggle(){
  if(document.getElementById("inp-usa-ahorro").checked){
    document.getElementById("inp-ahorro").checked=false;
    const frec=document.getElementById("inp-frecuente");
    if(frec) frec.checked=false;
  }
}
// Frecuente es excluyente con ahorro/retiro: si activás frecuente, desmarca ambos
function onFrecuenteToggle(){
  if(document.getElementById("inp-frecuente").checked){
    document.getElementById("inp-ahorro").checked=false;
    document.getElementById("inp-usa-ahorro").checked=false;
  }
}

// Mismo comportamiento en el modal de edición
function onEditAhorroToggle(){
  const a=document.getElementById("edit-ahorro");
  const u=document.getElementById("edit-usa-ahorro");
  if(a&&u&&a.checked) u.checked=false;
}
function onEditUsaAhorroToggle(){
  const a=document.getElementById("edit-ahorro");
  const u=document.getElementById("edit-usa-ahorro");
  if(a&&u&&u.checked) a.checked=false;
}

// Atajos de fecha rápidos para los formularios
function setFechaQuick(inputId, deltaDays){
  vibrar(15);
  // Uso hora LOCAL para evitar bug UTC: en Argentina (UTC-3) a la noche
  // toISOString() puede devolver el día siguiente.
  const d=new Date();
  d.setDate(d.getDate()+deltaDays);
  const ymd = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  document.getElementById(inputId).value=ymd;
}

// ═══════════════════════════════════════════
// TEMA (claro / oscuro / auto)
// ═══════════════════════════════════════════
function setTheme(t){
  guardarPreferencia("ftheme",t);
  applyTheme();
  // Actualizar botones activos
  document.querySelectorAll(".theme-btn").forEach(b=>{
    b.style.background=b.dataset.theme===t?"var(--accent)":"";
    b.style.color=b.dataset.theme===t?"#fff":"";
  });
}
function applyTheme(){
  const t=localStorage.getItem("ftheme")||"auto";
  if(t==="auto"){
    const dark=window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark?"dark":"light");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
  // Marcar botones activos al entrar
  setTimeout(()=>{
    document.querySelectorAll(".theme-btn").forEach(b=>{
      b.style.background=b.dataset.theme===t?"var(--accent)":"";
      b.style.color=b.dataset.theme===t?"#fff":"";
    });
  },50);
}
// Aplicar al inicio
applyTheme();
// Reaccionar a cambios del sistema cuando esté en auto
if(window.matchMedia){
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{
    if((localStorage.getItem("ftheme")||"auto")==="auto") applyTheme();
  });
}


// Genera un HTML imprimible que se puede guardar como PDF desde el navegador
function exportarPDF(){
  const desde=document.getElementById("exp-desde").value;
  const hasta=document.getElementById("exp-hasta").value||desde;
  if(!desde){showToast("Indicá el mes en 'Desde'");return;}
  // Filtrar movimientos en el rango
  const inRange=movs.filter(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    return ym>=desde && ym<=hasta;
  }).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));

  if(!inRange.length){showToast("Sin movimientos en ese rango");return;}

  const ing=inRange.filter(m=>m.tipo==="Ingreso").reduce((s,m)=>s+m.importe,0);
  const gas=inRange.filter(esGasto).reduce((s,m)=>s+m.importe,0);
  const aho=inRange.filter(esDepositoAhorro).reduce((s,m)=>s+m.importe,0);
  const inv=inRange.filter(m=>m.tipo==="Inversion").reduce((s,m)=>s+m.importe,0);
  const balance=ing-gas-aho;

  // Por categoría (gastos)
  const porCat={};
  inRange.filter(esGasto).forEach(m=>{
    porCat[m.cat]=(porCat[m.cat]||0)+m.importe;
  });
  const catSorted=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);

  const titulo=desde===hasta?mesLbl(desde):`${mesLbl(desde)} – ${mesLbl(hasta)}`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${titulo}</title>
  <style>
    body{font-family:-apple-system,Helvetica,sans-serif;padding:30px;max-width:800px;margin:auto;color:#222}
    h1{margin:0 0 4px;font-size:24px}.sub{color:#666;font-size:14px;margin-bottom:24px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
    .kpi{padding:12px;border:1px solid #ddd;border-radius:8px}
    .kpi-label{font-size:11px;color:#666;text-transform:uppercase}
    .kpi-val{font-size:18px;font-weight:600;margin-top:4px}
    .pos{color:#2d7a3a}.neg{color:#a32d2d}.inv{color:#534ab7}.save{color:#1a6b6b}
    h2{font-size:16px;margin:24px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
    th{font-size:10px;text-transform:uppercase;color:#666;background:#fafafa}
    .right{text-align:right}
    @media print{body{padding:15mm}}
  </style></head><body>
  <h1>Reporte de Enola</h1>
  <div class="sub">${titulo} · Generado el ${new Date().toLocaleDateString("es-AR")}</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Ingresos</div><div class="kpi-val pos">${fmtS(ing)}</div></div>
    <div class="kpi"><div class="kpi-label">Gastos</div><div class="kpi-val neg">${fmtS(gas)}</div></div>
    <div class="kpi"><div class="kpi-label">Ahorrado</div><div class="kpi-val save">${fmtS(aho)}</div></div>
    <div class="kpi"><div class="kpi-label">Balance</div><div class="kpi-val ${balance>=0?"pos":"neg"}">${fmtS(balance)}</div></div>
  </div>
  ${inv>0?`<p style="font-size:12px;color:#534ab7;margin-bottom:20px">◈ Inversiones del período: ${fmtS(inv)}</p>`:""}
  ${catSorted.length?`<h2>Gastos por categoría</h2>
  <table><thead><tr><th>Categoría</th><th class="right">Total</th><th class="right">% del total</th></tr></thead><tbody>
    ${catSorted.map(([c,v])=>`<tr><td>${escapeHtml(c)}</td><td class="right neg">${fmtS(v)}</td><td class="right">${gas>0?Math.round(v/gas*100):0}%</td></tr>`).join("")}
  </tbody></table>`:""}
  <h2>Detalle de movimientos (${inRange.length})</h2>
  <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Nota</th><th class="right">Importe</th></tr></thead><tbody>
    ${inRange.map(m=>{
      const cls=m.tipo==="Ingreso"?"pos":m.tipo==="Inversion"?"inv":m.esAhorro?"save":"neg";
      const sign=m.tipo==="Ingreso"?"+":"-";
      return `<tr>
        <td>${(m.fecha||"").split("-").reverse().slice(0,3).join("/")}</td>
        <td>${m.tipo}${m.esAhorro?" 🏦":""}</td>
        <td>${escapeHtml(m.cat||"")}</td>
        <td style="font-size:11px;color:#666">${escapeHtml((m.nota||"").slice(0,40))}</td>
        <td class="right ${cls}">${sign}${fmtS(m.importe)}</td>
      </tr>`;
    }).join("")}
  </tbody></table>
  <p style="margin-top:30px;font-size:11px;color:#999;text-align:center">Para guardar como PDF: Menú del navegador → Imprimir → Guardar como PDF</p>
  </body></html>`;
  // Abrimos en una ventana nueva e imprimimos
  const win=window.open("","_blank");
  if(!win){showToast("Permití ventanas emergentes para exportar a PDF");return;}
  win.document.write(html);
  win.document.close();
  setTimeout(()=>{win.print();},500);
}

// Exporta un CSV plano y desnormalizado (una fila por movimiento y por mes de cuota/frecuente
// ya "desenrollado") pensado para abrir directo en Power BI, Looker Studio o pandas/Python.
// Reusa getMesMov()/getTcMovsEnMes() —la misma lógica de expansión mensual que ya usa el resto
// de la app— así que cuotas y gastos frecuentes salen exactamente como los ve el usuario en pantalla.
function exportarDatosBI(){
  // Rango: desde el mes más viejo con datos hasta el mes actual
  let minYM=currentYM();
  movs.forEach(m=>{
    const ym=m.frecuente ? m.mesInicio : String(m.fecha||"").slice(0,7);
    if(ym && ym.length===7 && ym<minYM) minYM=ym;
  });
  tcs.forEach(t=>{
    if(t.mesInicio && t.mesInicio.length===7 && t.mesInicio<minYM) minYM=t.mesInicio;
  });
  const hoyYM=currentYM();

  const filas=[];
  let ym=minYM, guard=0;
  while(ym<=hoyYM && guard<1200){ // guard-rail anti loop-infinito (100 años de meses)
    guard++;
    getMesMov(ym).forEach(m=>{
      filas.push({
        id:m.id, tipo:m.tipo, fecha:m.fecha||ym+"-01",
        anio:ym.slice(0,4), mes:ym.slice(5,7),
        categoria:m.cat||"", subcategoria:m.subcat||"",
        cuenta:m.cuenta||"", tarjeta:"",
        moneda:m.moneda||"ARS",
        importe_ars: m.moneda==="USD" ? 0 : (m.importe||0),
        importe_usd: m.moneda==="USD" ? (m.importeOrig||0) : (m.importeUSD||0),
        ticker:m.ticker||"", cuota_actual:"", cuotas_totales:"",
        es_frecuente: m.frecuente?1:0, es_ahorro: m.esAhorro?1:0, usa_ahorro: m.usaAhorro?1:0,
        nota:(m.nota||"").replace(/[\r\n]+/g," "), tags:extraerTags(m.nota).join(";")
      });
    });
    getTcMovsEnMes(ym).forEach(t=>{
      filas.push({
        id:t.id, tipo:"Tarjeta", fecha:t.fecha||ym+"-01",
        anio:ym.slice(0,4), mes:ym.slice(5,7),
        categoria:t.cat||"", subcategoria:t.tarjeta||"",
        cuenta:"", tarjeta:t.tarjeta||"",
        moneda:t.moneda||"ARS",
        importe_ars: t.moneda==="USD" ? 0 : (t.importe||0),
        importe_usd: t.moneda==="USD" ? (t.importe||0) : 0,
        ticker:"", cuota_actual:t.nCuota||"", cuotas_totales:t.frecuente?"":(t.cuotasTotal||""),
        es_frecuente: t.frecuente?1:0, es_ahorro:0, usa_ahorro:0,
        nota:(t.nota||t.desc||"").replace(/[\r\n]+/g," "), tags:extraerTags(t.nota||"").join(";")
      });
    });
    ym=addMonths(ym,1);
  }

  if(!filas.length){ showToast("No hay datos para exportar"); return; }

  const columnas=["id","tipo","fecha","anio","mes","categoria","subcategoria","cuenta","tarjeta","moneda","importe_ars","importe_usd","ticker","cuota_actual","cuotas_totales","es_frecuente","es_ahorro","usa_ahorro","tags","nota"];
  const escapeCSV=v=>{
    const s=String(v===undefined||v===null?"":v);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const lineas=[columnas.join(",")];
  filas.forEach(f=>lineas.push(columnas.map(c=>escapeCSV(f[c])).join(",")));
  const csv="\uFEFF"+lineas.join("\r\n"); // BOM: Excel/Power BI detectan UTF-8 (tildes, ñ) sin romper

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const ts=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`misgastos-bi-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast(`✓ CSV para BI exportado · ${filas.length} filas`);
}

// ═══════════════════════════════════════════
// RECORDATORIO DE BACKUP
// ═══════════════════════════════════════════
// La fecha del último backup no es un dato sensible en sí (es una fecha, no plata): se
// guarda en localStorage llano, igual que el tema visual — no hace falta el PIN para verla,
// y no tiene sentido que desaparezca si la app está bloqueada.
const DIAS_PARA_AVISAR=30;   // a partir de cuánto sin backup se considera "viejo"
const DIAS_ENTRE_AVISOS=7;   // no insistir más seguido que esto, aunque abras la app todos los días

function marcarBackupHecho(){
  guardarPreferencia("fultimobackup", new Date().toISOString());
}

// Días completos desde una fecha ISO guardada. Infinity para "nunca" (null) y para
// cualquier basura que no parsee como fecha — así "nunca hiciste backup" y "hace 30 años que
// no hacés uno" caen del mismo lado de cualquier comparación con un umbral, sin casos aparte.
// Una fecha en el FUTURO (reloj del dispositivo mal puesto) también cuenta como Infinity: no
// tiene sentido creer un backup que "todavía no pasó".
function diasDesde(isoFecha){
  if(!isoFecha) return Infinity;
  const ms=Date.now()-new Date(isoFecha).getTime();
  if(!isFinite(ms) || ms<0) return Infinity;
  return Math.floor(ms/86400000);
}

function textoUltimoBackup(){
  const d=diasDesde(localStorage.getItem("fultimobackup"));
  if(d===Infinity) return "Todavía no hiciste ningún backup.";
  if(d===0) return "Último backup: hoy.";
  if(d===1) return "Último backup: ayer.";
  return `Último backup: hace ${d} días.`;
}

// Línea de estado en Configuración: siempre visible, sin condiciones ni cooldown (a
// diferencia del aviso emergente de abajo, que sí se hace notar solo de vez en cuando).
function renderEstadoBackup(){
  const el=document.getElementById("backup-estado");
  if(!el) return;
  const d=diasDesde(localStorage.getItem("fultimobackup"));
  el.style.color = d===Infinity ? "var(--danger)" : d>=DIAS_PARA_AVISAR ? "var(--warning)" : "var(--muted)";
  el.textContent=textoUltimoBackup();
}

// Decide si CORRESPONDE avisar ahora, sin tocar la UI: separado de avisarSiFaltaBackup()
// para poder probar la regla (30 días sin backup, 7 entre avisos, solo si hay algo cargado)
// sin depender del sistema de diálogos.
function tocaAvisarBackup(){
  if(!movs.length) return false;                                    // nada que perder todavía
  if(diasDesde(localStorage.getItem("fultimobackup"))<DIAS_PARA_AVISAR) return false;
  if(diasDesde(localStorage.getItem("fultimoavisobackup"))<DIAS_ENTRE_AVISOS) return false;
  return true;
}

// Se llama una vez al arrancar la app (bootApp, con un pequeño delay para no competir con el
// primer render). Si corresponde, ofrece hacer el backup ahí mismo en vez de solo avisar.
async function avisarSiFaltaBackup(){
  if(!tocaAvisarBackup()) return;
  guardarPreferencia("fultimoavisobackup", new Date().toISOString());
  const dias=diasDesde(localStorage.getItem("fultimobackup"));
  const cuando = dias===Infinity
    ? "Todavía no hiciste ningún backup de tus datos."
    : `Hace ${dias} días que no hacés un backup.`;
  const hacerlo=await mostrarConfirm(
    `${cuando} Es un archivo chico (suele pesar menos de 1 MB) que podés guardar donde quieras.`,
    {titulo:"💾 Recordatorio de backup", textoOk:"Hacer backup ahora", textoCancelar:"Más tarde"}
  );
  if(hacerlo) exportarBackup();
}

function exportarBackup(){
  const backup={
    version:1,
    fecha:new Date().toISOString(),
    app:"Enola",
    datos:{
      movs,
      tcs,
      custom,
      metas, // ya está en memoria (loadSensitiveIntoMemory), no hace falta releer localStorage
      importHistory,
      cuentasCustom,
      tarjetasCustom,
      presupuestos,
      catOrder,
      iconsCustom,
      posicionInicial,
      valuaciones
    }
  };
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const ts=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`misgastos-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  marcarBackupHecho();
  renderEstadoBackup();
  showToast("✓ Backup descargado");
}

function restaurarBackup(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=async (e)=>{
    try{
      const backup=JSON.parse(e.target.result);
      if(!backup.datos||!Array.isArray(backup.datos.movs)){
        showToast("❌ Archivo inválido");
        input.value="";
        return;
      }
      const cant=backup.datos.movs.length;
      const cantTc=(backup.datos.tcs||[]).length;
      if(!await mostrarConfirm(`Restaurar backup del ${(backup.fecha||"").slice(0,10)}?\n\n• ${cant} movimientos\n• ${cantTc} tarjetas\n\nEsto reemplaza TODOS los datos actuales.`, {textoOk:"Restaurar", peligroso:true})){
        input.value="";
        return;
      }
      movs=backup.datos.movs||[];
      tcs=backup.datos.tcs||[];
      custom=backup.datos.custom||{Gasto:{},Ingreso:{},Inversion:{},Tarjeta:{}};
      // Migración: si custom no tiene la clave Tarjeta
      if(!custom.Tarjeta) custom.Tarjeta={};
      importHistory=backup.datos.importHistory||[];
      // Metas (van a su propia key)
      if(Array.isArray(backup.datos.metas)){
        metas=backup.datos.metas;
        setSensitiveRaw("fmetas",JSON.stringify(metas));
      }
      // Campos agregados junto con el cifrado ligado al PIN: pueden no estar presentes
      // en backups viejos, en cuyo caso se conservan los valores actuales.
      if(Array.isArray(backup.datos.cuentasCustom)){
        cuentasCustom=backup.datos.cuentasCustom;
        saveCuentasCustom();
      }
      if(Array.isArray(backup.datos.tarjetasCustom)){
        tarjetasCustom=backup.datos.tarjetasCustom;
        saveTarjetasCustom();
      }
      if(backup.datos.catOrder && typeof backup.datos.catOrder==="object"){
        catOrder=backup.datos.catOrder;
        saveCatOrder();
      }
      if(backup.datos.presupuestos && typeof backup.datos.presupuestos==="object"){
        presupuestos=backup.datos.presupuestos;
        setSensitiveRaw("fpresup", JSON.stringify(presupuestos));
      }
      if(backup.datos.iconsCustom && typeof backup.datos.iconsCustom==="object"){
        iconsCustom=backup.datos.iconsCustom;
        setSensitiveRaw("ficons", JSON.stringify(iconsCustom));
      }
      if(backup.datos.posicionInicial && typeof backup.datos.posicionInicial==="object"){
        posicionInicial=backup.datos.posicionInicial;
        setSensitiveRaw("fposini", JSON.stringify(posicionInicial));
      }
      if(backup.datos.valuaciones && typeof backup.datos.valuaciones==="object"){
        valuaciones=backup.datos.valuaciones;
        setSensitiveRaw("fvaluaciones", JSON.stringify(valuaciones));
      }
      save();
      setSensitiveRaw("fimphist3",JSON.stringify(importHistory));
      // Restaurar deja los datos actuales idénticos a un archivo que YA existe afuera:
      // para el propósito del recordatorio, es lo mismo que acabar de hacer un backup.
      marcarBackupHecho();
      renderEstadoBackup();
      showToast(`✓ Restaurados ${cant} movimientos`);
      // Refrescar vistas
      renderExportStats();
      renderCatManager();
      buildCats();
      buildTcCats();
      buildInvCats();
      input.value="";
    }catch(err){
      showToast("❌ Error al leer el archivo");
      console.error(err);
      input.value="";
    }
  };
  reader.readAsText(file);
}

