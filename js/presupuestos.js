// ═══════════════════════════════════════════
// PRESUPUESTOS MENSUALES POR CATEGORÍA
// ═══════════════════════════════════════════
// NOTA: la variable `presupuestos` se declara arriba, junto al resto del estado global,
// porque renderMovs() la usa y necesita existir antes del primer render de la app.

function savePresup(){
  setSensitiveRaw("fpresup", JSON.stringify(presupuestos));
  marcarDatosSucios();
}

let editingPresupCat=null;

function openPresupModal(catEdit){
  editingPresupCat=catEdit||null;
  // Llenar select de categorías de Gasto
  const cats=getCats("Gasto");
  const sel=document.getElementById("presup-cat");
  sel.innerHTML=Object.keys(cats).map(c=>`<option ${c===catEdit?"selected":""}>${escapeHtml(c)}</option>`).join("");
  if(catEdit) sel.value=catEdit;
  document.getElementById("presup-modal-title").textContent=catEdit?`Editar presupuesto: ${catEdit}`:"Nuevo presupuesto";
  document.getElementById("presup-monto").value=catEdit?(presupuestos[catEdit]||""):"";
  if(catEdit) sel.disabled=true; else sel.disabled=false;
  document.getElementById("modal-presup").classList.add("open");
}
function closePresupModal(){
  document.getElementById("modal-presup").classList.remove("open");
  document.getElementById("presup-cat").disabled=false;
  editingPresupCat=null;
}
function guardarPresup(){
  const cat=document.getElementById("presup-cat").value;
  const monto=parseFloat(document.getElementById("presup-monto").value)||0;
  if(monto<=0){showToast("Ingresá un monto válido");return;}
  presupuestos[cat]=Math.round(monto*100)/100;
  savePresup();
  closePresupModal();
  renderPresupManager();
  renderMovs();
  showToast("Presupuesto guardado ✓");
}
function borrarPresup(cat){
  if(!confirm(`¿Eliminar el presupuesto de "${cat}"?`)) return;
  delete presupuestos[cat];
  savePresup();
  renderPresupManager();
  renderMovs();
  showToast("Presupuesto eliminado");
}

// Renderiza la lista de presupuestos en Config con barra de progreso del mes actual
function renderPresupManager(){
  const el=document.getElementById("presup-manager");
  if(!el) return;
  const cats=Object.keys(presupuestos);
  if(!cats.length){
    el.innerHTML=`<p style="font-size:13px;color:var(--muted);padding:8px 0">Sin presupuestos cargados</p>`;
    return;
  }
  // Calcular gasto del mes actual por categoría
  const ymHoy=currentYM();
  const gastoMes={};
  movs.forEach(m=>{
    if(m.tipo!=="Gasto"||m.esAhorro) return;
    const ym=String(m.fecha||"").slice(0,7);
    if(ym===ymHoy) gastoMes[m.cat]=(gastoMes[m.cat]||0)+m.importe;
  });
  el.innerHTML=cats.sort().map(cat=>{
    const tope=presupuestos[cat];
    const gastado=gastoMes[cat]||0;
    const pct=Math.min(100, Math.round(gastado/tope*100));
    const restante=Math.max(0, tope-gastado);
    let color="var(--success)";
    if(pct>=100) color="var(--danger)";
    else if(pct>=80) color="var(--warning)";
    return `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13px;font-weight:600">${getIcon(cat)} ${escapeHtml(cat)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="openPresupModal('${cat.replace(/'/g,"\\'")}')">Editar</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="borrarPresup('${cat.replace(/'/g,"\\'")}')">×</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:var(--muted)">${fmtS(gastado)} / ${fmtS(tope)}</span>
        <span style="color:${color};font-weight:600">${pct}%</span>
      </div>
      <div style="background:var(--bg);height:8px;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${pct>=100?`⚠ Excedido por ${fmtS(gastado-tope)}`:`Restante este mes: ${fmtS(restante)}`}</div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════
// RENOMBRAR CATEGORÍA (edición masiva)
// ═══════════════════════════════════════════
function openRenameModal(){
  // Lista todas las categorías que aparecen en movimientos (no solo las predefinidas)
  const usadas=new Set();
  movs.forEach(m=>{if(m.cat) usadas.add(m.cat);});
  const cats=Array.from(usadas).sort();
  if(!cats.length){showToast("No hay categorías cargadas todavía");return;}
  document.getElementById("rename-cat-from").innerHTML=cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
  document.getElementById("rename-cat-to").value="";
  updateRenameInfo();
  document.getElementById("modal-rename").classList.add("open");
}
function closeRenameModal(){
  document.getElementById("modal-rename").classList.remove("open");
}
function updateRenameInfo(){
  const cat=document.getElementById("rename-cat-from").value;
  const cant=movs.filter(m=>m.cat===cat).length;
  document.getElementById("rename-info").textContent=`${cant} ${cant===1?"movimiento":"movimientos"} con esta categoría`;
}
function aplicarRename(){
  const from=document.getElementById("rename-cat-from").value;
  const to=document.getElementById("rename-cat-to").value.trim();
  if(!to){showToast("Ingresá el nuevo nombre");return;}
  if(to===from){closeRenameModal();return;}
  let cant=0;
  movs.forEach(m=>{
    if(m.cat===from){m.cat=to;cant++;}
  });
  // Si había presupuesto para la cat vieja, lo migramos
  if(presupuestos[from]){
    presupuestos[to]=presupuestos[from];
    delete presupuestos[from];
    savePresup();
  }
  save();
  closeRenameModal();
  showToast(`✓ ${cant} movimientos renombrados`);
  renderMovs();
  renderPresupManager();
  renderCatManager();
}

function confirmarBorrarTodo(){
  // Two-step confirmation
  const el = document.querySelector('[onclick="confirmarBorrarTodo()"]');
  if(el.dataset.confirm !== "1"){
    el.textContent = "⚠ Tocá de nuevo para confirmar";
    el.style.background = "var(--danger)";
    el.style.color = "#fff";
    el.dataset.confirm = "1";
    setTimeout(()=>{
      el.textContent = "🗑 Borrar todos los movimientos";
      el.style.background = "#fff";
      el.style.color = "var(--danger)";
      el.dataset.confirm = "0";
    }, 3000);
    return;
  }
  movs = [];
  tcs = [];
  importHistory = [];
  save();
  setSensitiveRaw("fimphist3", JSON.stringify([]));
  showToast("Todos los movimientos eliminados");
  renderExportStats();
}

