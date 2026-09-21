// ═══════════════════════════════════════════
// IMPORTAR
// ═══════════════════════════════════════════
let importPreview=[];
function renderImportHistory(){
  const el=document.getElementById("import-history");
  if(!importHistory.length){el.innerHTML=`<p style="font-size:13px;color:var(--muted);padding:6px 0">Sin importaciones aún</p>`;return;}
  el.innerHTML=importHistory.slice(0,12).map((h,idx)=>{
    // Contar cuántos movimientos de esta importación siguen existiendo (si tiene id)
    const vivos=h.id ? movs.filter(m=>m._importId===h.id).length : 0;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0"><div class="txt-md txt-strong">${escapeHtml(h.nombre)}</div><div class="txt-xs txt-muted">${h.fecha} · ${h.registros} registros${h.id&&vivos>0?` · ${vivos} en la app`:""}</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:11px;background:var(--success-light);color:var(--success);padding:3px 9px;border-radius:12px">✓</span>
        <button class="tx-del" style="color:var(--danger);font-size:18px" onclick="eliminarImport(${idx})" title="Eliminar esta importación">×</button>
      </div>
    </div>`;
  }).join("");
}

// Elimina una entrada del historial de importación.
// Si la importación tiene movimientos asociados (importId), pregunta si también
// se quieren borrar esos movimientos de la app.
async function eliminarImport(idx){
  const h=importHistory[idx];
  if(!h) return;
  const vivos=h.id ? movs.filter(m=>m._importId===h.id).length : 0;
  if(vivos>0){
    const op=await mostrarConfirm(`"${h.nombre}" importó ${vivos} movimientos que siguen en la app.\n\n¿Querés borrar también esos ${vivos} movimientos?`, {titulo:"Eliminar importación", textoOk:`Borrar los ${vivos}`, textoCancelar:"Solo el historial", peligroso:true});
    if(op){
      // Borrar movimientos asociados + entrada del historial
      movs=movs.filter(m=>m._importId!==h.id);
      importHistory.splice(idx,1);
      save();
      setSensitiveRaw("fimphist3",JSON.stringify(importHistory));
      showToast(`Importación y ${vivos} movimientos eliminados`);
      renderImportHistory();
      return;
    }
    // Si cancela, igual preguntamos si quiere quitar del historial
    if(!await mostrarConfirm("¿Querés quitar solo la entrada del historial? Los movimientos se mantienen.", {textoOk:"Quitar del historial"})) return;
  } else {
    // Sin movimientos asociados (import viejo sin tracking, o ya borrados)
    if(!await mostrarConfirm(`"${h.nombre}" es una importación anterior al sistema de seguimiento, así que no puedo identificar exactamente qué movimientos trajo.\n\nPara borrar esos movimientos usá "Borrar movimientos por rango de fechas" más abajo.\n\n¿Querés quitar igual esta entrada del historial?`, {textoOk:"Quitar del historial"})) return;
  }
  importHistory.splice(idx,1);
  setSensitiveRaw("fimphist3",JSON.stringify(importHistory));
  showToast("Entrada eliminada del historial");
  renderImportHistory();
}

// Borra TODOS los movimientos que fueron importados (los que tienen _importId).
// Preserva los cargados manualmente. Los imports viejos sin tracking no se tocan acá.
async function borrarMovsImportados(){
  const importados=movs.filter(m=>m._importId);
  if(!importados.length){
    await mostrarAlerta("No hay movimientos con seguimiento de importación.\n\nLos movimientos importados antes de la última actualización no quedaron marcados. Usá 'Borrar por rango de fechas' para esos.");
    return;
  }
  if(!await mostrarConfirm(`Se van a borrar ${importados.length} movimientos importados (los cargados a mano se mantienen).\n\n¿Continuar?`, {textoOk:"Continuar", peligroso:true})) return;
  if(!await mostrarConfirm("⚠️ Esta acción no se puede deshacer. ¿Confirmás?", {textoOk:"Sí, borrar", peligroso:true})) return;
  movs=movs.filter(m=>!m._importId);
  // Vaciar también el historial de importaciones (ya no tienen movimientos)
  importHistory=[];
  save();
  setSensitiveRaw("fimphist3",JSON.stringify(importHistory));
  showToast(`${importados.length} movimientos importados eliminados`);
  renderImportHistory();
  renderMovs();
}

// Borra movimientos en un rango de meses (sirve para limpiar imports viejos).
async function borrarMovsPorRango(){
  // tipoInput "month" da el selector de mes nativo del celular: se evita que el usuario
  // tenga que tipear el formato a mano (y los errores de formato de abajo).
  const desde=await mostrarPrompt("Borrar movimientos DESDE el mes:", {titulo:"Borrar por rango", tipoInput:"month", textoOk:"Siguiente"});
  if(!desde) return;
  if(!/^\d{4}-\d{2}$/.test(desde.trim())){await mostrarAlerta("Formato inválido. Usá AAAA-MM, por ejemplo 2026-01");return;}
  const hasta=await mostrarPrompt("HASTA el mes:", {titulo:"Borrar por rango", tipoInput:"month", valorInicial:desde.trim(), textoOk:"Siguiente"});
  if(!hasta) return;
  if(!/^\d{4}-\d{2}$/.test(hasta.trim())){await mostrarAlerta("Formato inválido. Usá AAAA-MM, por ejemplo 2026-05");return;}
  const d=desde.trim(), h=hasta.trim();
  if(d>h){await mostrarAlerta("El mes 'desde' no puede ser posterior al 'hasta'");return;}
  // Filtra TODOS los movimientos con fecha en el rango, incluyendo frecuentes.
  // El frecuente se evalúa por su fecha original (cuando fue creado), no por sus apariciones mensuales.
  const afectados=movs.filter(m=>{
    const ym=String(m.fecha||"").slice(0,7);
    return ym>=d && ym<=h;
  });
  if(!afectados.length){await mostrarAlerta(`No hay movimientos entre ${d} y ${h}.`);return;}
  const cantFrec=afectados.filter(m=>m.frecuente).length;
  const aviso=cantFrec>0
    ? `Se van a borrar ${afectados.length} movimientos entre ${d} y ${h}.\n\n⚠️ Incluye ${cantFrec} gasto${cantFrec===1?"":"s"} frecuente${cantFrec===1?"":"s"} (con todo su historial). ¿Continuar?`
    : `Se van a borrar ${afectados.length} movimientos entre ${d} y ${h}.\n\n¿Continuar?`;
  if(!await mostrarConfirm(aviso, {textoOk:"Continuar", peligroso:true})) return;
  if(!await mostrarConfirm("⚠️ Esta acción no se puede deshacer. ¿Confirmás?", {textoOk:"Sí, borrar", peligroso:true})) return;
  const ids=new Set(afectados.map(m=>m.id));
  movs=movs.filter(m=>!ids.has(m.id));
  save();
  showToast(`${afectados.length} movimientos eliminados`);
  renderMovs();
}

// Detecta gastos con importes inusualmente altos (probables pruebas o errores de carga).
// Calcula la mediana de los gastos y muestra los que superan 10x ese valor.
// Incluye gastos frecuentes (para detectar también los que se cargaron como prueba).
async function detectarMovsAtipicos(){
  const gastos=movs.filter(m=>m.tipo==="Gasto" && !m.usaAhorro && (m.importe||0)>0);
  if(!gastos.length){await mostrarAlerta("No hay gastos cargados.");return;}
  // La mediana se calcula sobre los NO frecuentes para no sesgarla con valores extraños
  const noFrec=gastos.filter(m=>!m.frecuente);
  const importesBase=noFrec.length ? noFrec.map(m=>m.importe).sort((a,b)=>a-b) : gastos.map(m=>m.importe).sort((a,b)=>a-b);
  const mediana = importesBase[Math.floor(importesBase.length/2)] || 1;
  // Umbral: 10x la mediana (o $5M, lo que sea mayor)
  const umbral = Math.max(mediana*10, 5_000_000);
  const atipicos = gastos.filter(m=>m.importe >= umbral).sort((a,b)=>b.importe-a.importe);
  if(!atipicos.length){
    await mostrarAlerta(`No se encontraron gastos atípicos.\n\nMediana de gastos: ${fmtS(mediana)}\nUmbral usado: ${fmtS(umbral)}`);
    return;
  }
  // Mostrar lista y ofrecer borrarlos
  const lista = atipicos.slice(0,15).map((m,i)=>{
    const fecha=(m.fecha||"").split("-").reverse().join("/").slice(0,10);
    const desc=m.frecuente?`🔁 ${m.cat}`:`${m.cat}${m.subcat?" / "+m.subcat:""}`;
    return `${i+1}. ${fmtS(m.importe)} · ${desc} · ${fecha}${m.nota?" · "+m.nota.slice(0,20):""}`;
  }).join("\n");
  const masTexto = atipicos.length>15?`\n\n...y ${atipicos.length-15} más`:"";
  const confirma = await mostrarConfirm(
    `Encontré ${atipicos.length} gastos atípicos (mayores a ${fmtS(umbral)}):\n\n${lista}${masTexto}\n\n¿Querés borrar TODOS estos gastos?`,
    {titulo:"Gastos atípicos", textoOk:"Borrarlos", peligroso:true}
  );
  if(!confirma) return;
  if(!await mostrarConfirm(`⚠️ Vas a eliminar ${atipicos.length} gastos. Esta acción no se puede deshacer. ¿Confirmás?`, {textoOk:"Sí, borrar", peligroso:true})) return;
  const ids=new Set(atipicos.map(m=>m.id));
  movs=movs.filter(m=>!ids.has(m.id));
  save();
  showToast(`${atipicos.length} gastos atípicos eliminados`);
  renderMovs();
}

// Busca operaciones de Inversion repetidas (ver duplicadosExactosInversion en
// tarjetas-inversiones.js). Solo ofrece borrar las EXACTAS: mismo ticker, fecha, categoría,
// subcategoría e importe. Las que solo se PARECEN se muestran aparte, como aviso, para que el
// usuario las revise a mano — no se borran solas porque pueden ser dos operaciones reales.
// Cubre los tres tipos que viven en `movs` (Gasto, Ingreso, Inversion — Tarjeta es otra
// lista y tiene su propio editor). Un doble toque en "Guardar" crea el mismo duplicado
// exacto sea cual sea el tipo, así que hacía falta lo mismo mirar todo, no solo Inversiones.
function lineaMov(m){
  const fecha=(m.fecha||"").split("-").reverse().join("/").slice(0,10);
  if(m.tipo==="Inversion"){
    const monto=(m.importeUSD||0)>0 ? `USD ${m.importeUSD.toFixed(2)}` : fmtS(m.importe||0);
    return `${m.ticker||"?"} · ${m.subcat||m.cat||""} · ${monto} · ${fecha}`;
  }
  const monto=m.moneda==="USD" ? `USD ${(m.importeOrig||0).toFixed(2)}` : fmtS(m.importe||0);
  const desc=`${m.cat||""}${m.subcat?" / "+m.subcat:""}`;
  return `${desc} · ${monto} · ${fecha}${m.nota?" · "+m.nota.slice(0,20):""}`;
}

async function detectarDuplicados(){
  const grupos=[...duplicadosExactosInversion(movs), ...duplicadosExactosGastoIngreso(movs)];
  // Los "parecidos" (no exactos) solo tienen sentido para Inversiones: ahí el ticker acota
  // tanto el universo que un parecido vale la pena mirarlo. En Gasto/Ingreso, dos compras de
  // monto similar en la misma categoría son moneda corriente (dos changos de supermercado,
  // por ejemplo) y avisar de esos pares sería puro ruido — por eso no hay equivalente acá.
  const similares=similaresInversion(movs);
  if(!grupos.length){
    const avisoSim = similares.length
      ? `\n\nOjo: encontré ${similares.length} ${similares.length===1?"par parecido":"pares parecidos"} en Inversiones (mismo ticker, fecha cercana, monto casi igual) que no cuento como duplicados porque pueden ser dos operaciones reales. Convendría que los revises vos:\n\n`
        + similares.slice(0,8).map(([a,b])=>`• ${lineaMov(a)}\n  ${lineaMov(b)}`).join("\n")
        + (similares.length>8?`\n\n...y ${similares.length-8} pares más`:"")
      : "";
    await mostrarAlerta(`No encontré duplicados exactos.${avisoSim}`);
    return;
  }
  const aBorrar=grupos.flatMap(g=>g.slice(1));   // se queda el más viejo de cada grupo
  const lista = aBorrar.slice(0,15).map((m,i)=>`${i+1}. ${lineaMov(m)}`).join("\n");
  const masTexto = aBorrar.length>15?`\n\n...y ${aBorrar.length-15} más`:"";
  const avisoSim = similares.length
    ? `\n\nAdemás hay ${similares.length} ${similares.length===1?"par parecido":"pares parecidos"} en Inversiones que no cuento acá porque no son exactamente iguales — convendría revisarlos vos.`
    : "";
  const confirma = await mostrarConfirm(
    `Encontré ${grupos.length} ${grupos.length===1?"operación repetida":"operaciones repetidas"} (mismos datos, calcada). Se conserva la más vieja de cada una y se ${aBorrar.length===1?"borra esta copia":"borran estas "+aBorrar.length+" copias"}:\n\n${lista}${masTexto}${avisoSim}\n\n¿Querés borrar${aBorrar.length===1?" la copia":" las copias"}?`,
    {titulo:"Duplicados en Movimientos", textoOk:"Borrar copias", peligroso:true}
  );
  if(!confirma) return;
  if(!await mostrarConfirm(`⚠️ Vas a eliminar ${aBorrar.length} movimientos. Esta acción no se puede deshacer. ¿Confirmás?`, {textoOk:"Sí, borrar", peligroso:true})) return;
  const ids=new Set(aBorrar.map(m=>m.id));
  movs=movs.filter(m=>!ids.has(m.id));
  save();
  showToast(`${aBorrar.length} duplicados eliminados`);
  renderMovs();
}

// Botón nuclear: borra TODOS los movimientos. Útil para resetear todo.
async function borrarTodosMovimientos(){
  if(!movs.length){await mostrarAlerta("No hay movimientos para borrar.");return;}
  const total=movs.length;
  if(!await mostrarConfirm(`⚠️ Vas a eliminar TODOS los ${total} movimientos cargados (incluyendo frecuentes e importados).\n\nEsta acción no se puede deshacer.\n\n¿Continuar?`, {titulo:"Borrar todo", textoOk:"Continuar", peligroso:true})) return;
  if(!await mostrarConfirm(`Última confirmación. ¿Eliminar los ${total} movimientos?`, {titulo:"Borrar todo", textoOk:`Eliminar ${total}`, peligroso:true})) return;
  movs=[];
  importHistory=[];
  save();
  setSensitiveRaw("fimphist3", JSON.stringify(importHistory));
  showToast(`${total} movimientos eliminados`);
  renderMovs();
  renderImportHistory();
}

// La librería XLSX se carga con defer desde un CDN: puede no estar todavía (recién abriste
// la app) o no estar nunca (sin internet, CDN caído). Sin este chequeo el usuario tocaba
// "Importar" y no pasaba absolutamente nada, sin ninguna explicación.
function xlsxDisponible(){
  if(typeof XLSX!=="undefined") return true;
  showToast("La librería de Excel todavía no cargó. Revisá tu conexión y probá de nuevo en unos segundos.");
  return false;
}

function handleXlsx(input){
  const file=input.files[0];if(!file)return;
  if(!xlsxDisponible()){ setXlsxStatus("❌ Librería de Excel no disponible (sin conexión?)","var(--danger)"); input.value=""; return; }
  setXlsxStatus("⏳ Leyendo archivo...","var(--muted)");
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      // raw:true para recibir valores originales (fechas como serial, números como number)
      // cellDates:true → fechas como Date objects (más confiable)
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true});
      if(!rows.length){setXlsxStatus("❌ Archivo vacío","var(--danger)");return;}
      const keys=Object.keys(rows[0]);
      const fc=(...ns)=>keys.find(k=>ns.some(n=>k.toLowerCase()===n.toLowerCase()))
                     ||keys.find(k=>ns.some(n=>k.toLowerCase().includes(n.toLowerCase())));
      const cFecha  =fc("fecha","date","día","dia");
      const cTipo   =fc("ingreso/gasto","tipo","type");
      const cImporte=fc("ars","importe","monto","amount","valor");
      const cCat    =fc("categoría","categoria","categ");
      const cSubcat =fc("subcategorías","subcategorias","subcat");
      const cNota   =fc("nota","descrip","detalle","concepto");
      const cMoneda =fc("moneda","currency");
      const cCuenta =fc("cuenta","account");

      const parsed=[];
      rows.forEach((r,i)=>{
        // ── FECHA ──────────────────────────────────────────────────────
        let fecha="";
        if(cFecha){
          const raw=r[cFecha];
          // Helper: formatear Date como "YYYY-MM-DD" usando UTC (las fechas de Excel
          // se interpretan como medianoche UTC, así que UTC es el formato correcto acá)
          const toYMD = (d) => d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
          if(raw instanceof Date){
            fecha=toYMD(raw);
          } else if(typeof raw==="number" && raw>40000){
            // Serial numérico Excel (días desde 1900-01-00)
            const d=new Date(Math.round((raw-25569)*86400*1000));
            fecha=toYMD(d);
          } else {
            const s=String(raw||"").trim();
            // DD/MM/YYYY HH:mm:ss o DD/MM/YYYY (formato argentino)
            const dmY=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
            // YYYY-MM-DD con o sin hora
            const iso=s.match(/^(\d{4}-\d{2}-\d{2})/);
            // MM/DD/YYYY (formato americano)
            const mdY=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if(dmY)      fecha=`${dmY[3]}-${dmY[2].padStart(2,"0")}-${dmY[1].padStart(2,"0")}`;
            else if(iso) fecha=iso[1];
            else if(mdY) fecha=`${mdY[3]}-${mdY[1].padStart(2,"0")}-${mdY[2].padStart(2,"0")}`;
            else if(s.length>=10) fecha=s.slice(0,10);
          }
        }
        if(!fecha || fecha.length<7) return;

        // ── TIPO ──────────────────────────────────────────────────────
        const tipoRaw=cTipo?String(r[cTipo]||"").trim():"Gasto";
        if(tipoRaw==="Dinero gastado") return; // duplicado contable
        let tipo="Gasto";
        if(tipoRaw==="Ingreso") tipo="Ingreso";
        else if(tipoRaw.includes("nvers")) tipo="Inversion";

        // ── IMPORTE ───────────────────────────────────────────────────
        let importe=0;
        if(cImporte){
          const raw=r[cImporte];
          if(typeof raw==="number"){
            importe=Math.abs(raw);
          } else {
            let iv=String(raw||"").replace(/[$\s]/g,"").trim();
            const lC=iv.lastIndexOf(","), lD=iv.lastIndexOf(".");
            if(lC>lD) iv=iv.replace(/\./g,"").replace(",",".");
            else iv=iv.replace(/,/g,"");
            importe=Math.abs(parseFloat(iv)||0);
          }
        }
        if(importe===0) return;

        const moneda=cMoneda?String(r[cMoneda]||"ARS").trim():"ARS";
        parsed.push({
          id:Date.now()+i,
          tipo,importe,moneda,
          cat:   cCat   ?(String(r[cCat]   ||"").trim()||"Otros")  :"Otros",
          subcat:cSubcat?(String(r[cSubcat]||"").trim()||"Varios")  :"Varios",
          cuenta:cCuenta?String(r[cCuenta]||"").trim()              :"",
          fecha,
          nota:  cNota  ?String(r[cNota]  ||"").trim()              :"",
          _source:"excel"
        });
      });

      if(!parsed.length){
        setXlsxStatus("❌ 0 movimientos detectados. Revisá que el archivo tenga columnas: Fecha, Ingreso/Gasto, ARS (o Importe).","var(--danger)");
        return;
      }
      setXlsxStatus(`✓ ${parsed.length} movimientos detectados`,"var(--success)");
      openImportPreview(parsed,`Excel: ${file.name}`);
    }catch(err){
      setXlsxStatus("❌ Error: "+err.message,"var(--danger)");
    }
  };
  reader.readAsArrayBuffer(file);input.value="";
}
function setXlsxStatus(msg,color){const el=document.getElementById("xlsx-status");el.textContent=msg;el.style.color=color;}

function openImportPreview(items, title){
  importPreview = items;
  document.getElementById("import-modal-title").textContent = title;
  document.getElementById("import-count-badge").textContent = `${items.length} registros`;
  renderImportPreviewList();
  document.getElementById("modal-import").classList.add("open");
}
function closeImportModal(){document.getElementById("modal-import").classList.remove("open");importPreview=[];}
function removeImportItem(idx){importPreview.splice(idx,1);document.getElementById("import-count-badge").textContent=`${importPreview.length} registros`;if(!importPreview.length){closeImportModal();return;}renderImportPreviewList();}
function renderImportPreviewList(){
  const el=document.getElementById("import-preview-list");
  const C={Gasto:"var(--danger)",Ingreso:"var(--success)",Inversion:"var(--invest)"};
  el.innerHTML=importPreview.map((m,i)=>`
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div class="u-flex1 u-min0">
        <div style="display:flex;gap:6px;align-items:center"><span style="font-size:11px;font-weight:600;color:${C[m.tipo]||"var(--muted)"}">${m.tipo}</span><span class="txt-xs txt-muted">${m.fecha}</span></div>
        <div style="font-size:13px;font-weight:600;margin-top:2px">${escapeHtml(m.cat)} · ${escapeHtml(m.subcat)}</div>
        ${m.nota?`<div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.nota)}</div>`:""}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:13px;font-weight:600;color:${C[m.tipo]||"var(--text)"}">${fmt(m.importe)}</div>
        <button onclick="removeImportItem(${i})" style="background:none;border:none;color:#ccc;font-size:15px;cursor:pointer">×</button>
      </div>
    </div>`).join("");
}
async function confirmarImport(){
  if(!importPreview.length)return;
  const nombre=document.getElementById("import-modal-title").textContent;
  // Detectar duplicados: mismo tipo, fecha, importe (con margen de centavos), categoría, nota
  // Hash compacto para comparar rápido
  const hashOf=(m)=>`${m.tipo}|${(m.fecha||"").slice(0,10)}|${Math.round((m.importe||0)*100)}|${m.cat||""}|${(m.nota||"").trim().slice(0,40)}`;
  const existentes=new Set(movs.map(hashOf));
  const nuevos=importPreview.filter(m=>!existentes.has(hashOf(m)));
  const duplicados=importPreview.length-nuevos.length;
  if(duplicados>0){
    const msg=duplicados===importPreview.length
      ? `Todos los ${duplicados} registros ya estaban cargados. No se importó nada.`
      : `${duplicados} ${duplicados===1?"registro está":"registros están"} ya cargado${duplicados===1?"":"s"} y se ${duplicados===1?"omitirá":"omitirán"}.\n\nSe importarán ${nuevos.length} ${nuevos.length===1?"registro nuevo":"registros nuevos"}. ¿Continuar?`;
    if(duplicados===importPreview.length){
      showToast(`⚠ ${duplicados} duplicados omitidos`);
      closeImportModal();
      document.getElementById("xlsx-status").textContent="";
      return;
    }
    if(!await mostrarConfirm(msg, {titulo:"Importar", textoOk:"Importar"})){return;}
  }
  const cantidad=nuevos.length;
  if(!cantidad){closeImportModal();return;}
  // ID único de esta importación, para poder revertirla luego
  const importId="imp_"+Date.now();
  movs=[...nuevos.map(m=>({...m, _importId:importId})),...movs];
  const histLabel=duplicados>0?`${nombre} (${duplicados} dup. omitidos)`:nombre;
  importHistory.unshift({id:importId, nombre:histLabel, fecha:new Date().toLocaleDateString("es-AR"), registros:cantidad});
  if(importHistory.length>20)importHistory=importHistory.slice(0,20);
  save();setSensitiveRaw("fimphist3",JSON.stringify(importHistory));
  closeImportModal();showToast(`${cantidad} registros importados ✓`);
  document.getElementById("xlsx-status").textContent="";
  renderImportHistory();
}

// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════
function renderExportStats(){
  const ing=movs.filter(m=>m.tipo==="Ingreso").reduce((s,m)=>s+m.importe,0);
  const gas=movs.filter(m=>m.tipo==="Gasto").reduce((s,m)=>s+m.importe,0);
  document.getElementById("export-stats").innerHTML=`
    <div style="display:flex;flex-direction:column;gap:9px;font-size:14px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Movimientos</span><strong>${movs.length}</strong></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Registros tarjeta</span><strong>${tcs.length}</strong></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Total ingresos</span><strong style="color:var(--success)">${fmt(ing)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Total gastos</span><strong style="color:var(--danger)">${fmt(gas)}</strong></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:9px"><span style="color:var(--muted)">Balance neto</span><strong style="color:${ing-gas>=0?"var(--success)":"var(--danger)"}">${fmt(ing-gas)}</strong></div>
    </div>`;
}
function exportarExcel(rangoAbierto){
  if(!xlsxDisponible()) return;
  try {
  let desde=document.getElementById("exp-desde").value;
  let hasta=document.getElementById("exp-hasta").value;

  // Si rangoAbierto=true (botón "Exportar todo") o algún campo vacío, usamos
  // un rango que cubra desde el primer movimiento/tarjeta hasta el último
  if(rangoAbierto||!desde||!hasta){
    const allYM=[];
    movs.forEach(m=>{const ym=(m.fecha||"").slice(0,7);if(ym&&ym.length===7)allYM.push(ym);});
    tcs.forEach(t=>{
      if(t.mesInicio) allYM.push(t.mesInicio);
      if(t.fecha) allYM.push(String(t.fecha).slice(0,7));
      if(t.mesFin) allYM.push(t.mesFin);
      if(t.mesInicio&&t.cuotasTotal){
        const ult=addMonths(t.mesInicio,t.cuotasTotal-1);
        if(ult) allYM.push(ult);
      }
    });
    if(!allYM.length){showToast("Sin datos para exportar");return;}
    allYM.sort();
    desde=desde||allYM[0];
    hasta=hasta||allYM[allYM.length-1];
    // Si frecuentes activos van más allá de hasta, los acotamos a hoy + 12 meses
    const hoyMas12=addMonths(currentYM(),12);
    if(hasta<hoyMas12&&tcs.some(t=>t.frecuente&&!t.mesFin)) hasta=hoyMas12;
  }

  // DIAGNÓSTICO: contamos qué hay realmente
  const totalMovs=movs.length;
  const totalInvs=movs.filter(m=>m.tipo==="Inversion").length;
  const totalTcs=tcs.length;
  console.log("[Export] Estado:",{totalMovs,totalInvs,totalTcs,desde,hasta});

  const inRange=movs.filter(m=>{const ym=(m.fecha||"").slice(0,7);return ym>=desde&&ym<=hasta;});
  console.log("[Export] inRange:",inRange.length,"movs");
  console.log("[Export] inRange por tipo:", {
    Gasto:inRange.filter(m=>m.tipo==="Gasto").length,
    Ingreso:inRange.filter(m=>m.tipo==="Ingreso").length,
    Inversion:inRange.filter(m=>m.tipo==="Inversion").length
  });

  const wb=XLSX.utils.book_new();

  // ── HOJA 1: GASTOS / INGRESOS ──
  const movsSinInv=inRange.filter(m=>m.tipo==="Gasto"||m.tipo==="Ingreso");
  if(movsSinInv.length){
    const rows=movsSinInv.map(m=>{
      const moneda=m.moneda||"ARS";
      const importeARS = moneda==="ARS" ? (m.importe||0) : 0;
      const importeUSD = moneda==="USD" ? (m.importeOrig||0) : 0;
      let etiqueta="";
      if(m.esAhorro) etiqueta="Ahorro";
      else if(m.usaAhorro) etiqueta="Retiro de ahorros";
      return {
        Fecha: (m.fecha||"").slice(0,10),
        Tipo: m.tipo,
        Etiqueta: etiqueta,
        Categoría: m.cat||"",
        Subcategoría: m.subcat||"",
        Nota: m.nota||"",
        Cuenta: m.cuenta||"",
        Moneda: moneda,
        ARS: importeARS,
        USD: importeUSD,
        Recuperable: m.recuperable||0
      };
    });
    const ws=XLSX.utils.json_to_sheet(rows);
    ws["!cols"]=[{wch:12},{wch:9},{wch:18},{wch:22},{wch:22},{wch:28},{wch:14},{wch:8},{wch:13},{wch:11},{wch:12}];
    XLSX.utils.book_append_sheet(wb,ws,"Movimientos");
  }

  // ── HOJA 2: INVERSIONES ──
  const invs=inRange.filter(m=>m.tipo==="Inversion");
  if(invs.length){
    const rows=invs.map(m=>{
      const salida=isInvSalida(m);
      return {
        Fecha: (m.fecha||"").slice(0,10),
        Tipo: salida?"Salida":"Entrada",
        Operación: m.subcat||m.cat||"",
        Categoría: m.cat||"",
        Ticker: m.ticker||"",
        ARS: (m.importe||0)*(salida?-1:1),
        USD: (m.importeUSD||0)*(salida?-1:1),
        Nota: m.nota||""
      };
    });
    const ws=XLSX.utils.json_to_sheet(rows);
    ws["!cols"]=[{wch:12},{wch:8},{wch:24},{wch:18},{wch:10},{wch:13},{wch:11},{wch:28}];
    XLSX.utils.book_append_sheet(wb,ws,"Inversiones");
  }

  // ── HOJA 3: TARJETAS (cuotas y frecuentes expandidos por mes) ──
  // Generamos una fila por cada cuota/mes que cae dentro del rango exportado.
  // Si una tarjeta no tiene mesInicio (datos viejos), usamos t.fecha como fallback.
  const tcRows=[];
  let tcSkipped=0;
  tcs.forEach(t=>{
    // Resolver mes de inicio con fallback robusto
    let mesIni=t.mesInicio;
    if(!mesIni&&t.fecha) mesIni=String(t.fecha).slice(0,7);
    if(!mesIni){tcSkipped++;return;}
    const cuotasTot=t.cuotasTotal||1;

    if(t.frecuente){
      // Frecuentes: una fila por cada mes activo dentro del rango
      let cur=mesIni;
      let safety=0;
      while(cur && cur<=hasta && safety<240){
        if(t.mesFin && cur>t.mesFin) break;
        if(cur>=desde){
          tcRows.push({
            Mes: cur,
            Tipo: "Frecuente",
            Descripción: t.desc||"",
            Tarjeta: t.tarjeta||"",
            Categoría: t.cat||"",
            Moneda: t.moneda||"ARS",
            "Cuota": "—",
            "Importe del mes": getMontoEnMes(t,cur),
            "Total": "—",
            Nota: t.nota||""
          });
        }
        cur=addMonths(cur,1);
        safety++;
      }
    } else {
      // Cuotas: expandir cada cuota dentro del rango
      const valorCuota=Math.round((t.total/cuotasTot)*100)/100;
      for(let i=0;i<cuotasTot;i++){
        const ym=addMonths(mesIni,i);
        if(!ym) break;
        if(ym<desde||ym>hasta) continue;
        tcRows.push({
          Mes: ym,
          Tipo: "Cuota",
          Descripción: t.desc||"",
          Tarjeta: t.tarjeta||"",
          Categoría: t.cat||"",
          Moneda: t.moneda||"ARS",
          "Cuota": (i+1)+"/"+cuotasTot,
          "Importe del mes": valorCuota,
          "Total": t.total,
          Nota: t.nota||""
        });
      }
    }
  });
  // Ordenar por mes y descripción
  tcRows.sort((a,b)=>(a.Mes||"").localeCompare(b.Mes||"")||(a.Descripción||"").localeCompare(b.Descripción||""));
  if(tcRows.length){
    const ws=XLSX.utils.json_to_sheet(tcRows);
    ws["!cols"]=[{wch:9},{wch:11},{wch:24},{wch:14},{wch:18},{wch:8},{wch:9},{wch:14},{wch:14},{wch:24}];
    XLSX.utils.book_append_sheet(wb,ws,"Tarjetas");
  }

  // ── HOJA 4: RESUMEN MENSUAL ──
  // Combina ingresos / gastos / inversiones / tarjetas por mes
  const porMes={};
  function ensureMes(ym){
    if(!porMes[ym]) porMes[ym]={Mes:ym,"Ingresos ARS":0,"Gastos ARS":0,"Ahorros":0,"Retiros":0,"Ingresos USD":0,"Gastos USD":0,"Inversión neta ARS":0,"Inversión neta USD":0,"Tarjetas":0};
  }
  inRange.forEach(m=>{
    const ym=(m.fecha||"").slice(0,7);
    if(!ym) return;
    ensureMes(ym);
    if(m.tipo==="Ingreso"){
      if(m.moneda==="USD") porMes[ym]["Ingresos USD"]+=m.importeOrig||0;
      else porMes[ym]["Ingresos ARS"]+=m.importe||0;
    } else if(m.tipo==="Gasto"){
      const moneda=m.moneda||"ARS";
      const monto=moneda==="USD"?(m.importeOrig||0):(m.importe||0);
      if(m.esAhorro) porMes[ym]["Ahorros"]+=monto;
      else if(m.usaAhorro) porMes[ym]["Retiros"]+=monto;
      else if(moneda==="USD") porMes[ym]["Gastos USD"]+=monto;
      else porMes[ym]["Gastos ARS"]+=monto;
    } else if(m.tipo==="Inversion"){
      const sg=isInvSalida(m)?-1:1;
      porMes[ym]["Inversión neta ARS"]+=(m.importe||0)*sg;
      porMes[ym]["Inversión neta USD"]+=(m.importeUSD||0)*sg;
    }
  });
  // Sumar tarjetas (cuotas + frecuentes) por mes
  tcRows.forEach(r=>{
    ensureMes(r.Mes);
    porMes[r.Mes]["Tarjetas"]+=r["Importe del mes"]||0;
  });
  const resumenArr=Object.values(porMes)
    .sort((a,b)=>a.Mes.localeCompare(b.Mes))
    .map(r=>({
      ...r,
      "Balance ARS": Math.round((r["Ingresos ARS"]-r["Gastos ARS"]-r["Ahorros"])*100)/100,
      "Balance USD": Math.round((r["Ingresos USD"]-r["Gastos USD"])*100)/100
    }));
  if(resumenArr.length){
    const ws=XLSX.utils.json_to_sheet(resumenArr);
    ws["!cols"]=[{wch:9},{wch:14},{wch:13},{wch:11},{wch:11},{wch:13},{wch:12},{wch:18},{wch:18},{wch:11},{wch:13},{wch:13}];
    XLSX.utils.book_append_sheet(wb,ws,"Resumen mensual");
  }

  if(!wb.SheetNames.length){showToast("Sin datos para exportar");return;}

  // ── HOJA EXTRA: DIAGNÓSTICO ──
  // Lista qué hay en memoria para verificar que las cargas estén OK
  const diag=[
    {Concepto:"Movimientos totales en memoria",Valor:totalMovs},
    {Concepto:"  · de los cuales son Inversion",Valor:totalInvs},
    {Concepto:"  · de los cuales son Gasto",Valor:movs.filter(m=>m.tipo==="Gasto").length},
    {Concepto:"  · de los cuales son Ingreso",Valor:movs.filter(m=>m.tipo==="Ingreso").length},
    {Concepto:"Tarjetas en memoria (tcs.length)",Valor:totalTcs},
    {Concepto:"  · cuotas con mesInicio",Valor:tcs.filter(t=>!t.frecuente&&t.mesInicio).length},
    {Concepto:"  · cuotas SIN mesInicio (skipped)",Valor:tcs.filter(t=>!t.frecuente&&!t.mesInicio&&!t.fecha).length},
    {Concepto:"  · gastos frecuentes",Valor:tcs.filter(t=>t.frecuente).length},
    {Concepto:"Rango usado · desde",Valor:desde},
    {Concepto:"Rango usado · hasta",Valor:hasta},
    {Concepto:"En rango · movs (gasto+ing)",Valor:movsSinInv.length},
    {Concepto:"En rango · inversiones",Valor:invs.length},
    {Concepto:"En rango · filas de tarjetas",Valor:tcRows.length}
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(diag),"Diagnóstico");

  const fname=`enola_${desde}_${hasta}.xlsx`;
  XLSX.writeFile(wb,fname);
  // Aviso si quedaron tarjetas afuera por falta de mesInicio
  if(tcSkipped>0){
    setTimeout(()=>showToast(`⚠ ${tcSkipped} tarjeta(s) sin mes de inicio se omitieron`), 800);
  }
  // Resumen detallado de qué se exportó (movs/inv/tcs)
  const partes=[];
  partes.push(`${movsSinInv.length} movs`);
  partes.push(`${invs.length} inv`);
  partes.push(`${tcRows.length} cuotas`);
  showToast(`✓ Exportado: ${partes.join(" · ")}`);
  console.log("[Export] OK:", {movs:movsSinInv.length, inv:invs.length, tc:tcRows.length, hojas:wb.SheetNames});
  } catch(err){
    console.error("[Export] ERROR:", err);
    showToast("❌ Error: "+(err.message||"desconocido").slice(0,60));
  }
}

