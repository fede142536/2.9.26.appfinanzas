// ═══════════════════════════════════════════
// EDITAR MOVIMIENTO
// ═══════════════════════════════════════════
let editingId=null;

function openEditModal(id){
  const m=movs.find(x=>x.id===id);
  if(!m) return;
  // Editar una sola pata de un cambio dejaría el tipo de cambio inconsistente (cambiás los
  // pesos y los dólares quedan como estaban). Se edita la operación entera.
  if(esPataDeCambio(m)) return openEditCambioModal(m.cambioId);
  editingId=id;
  document.getElementById("edit-form-content").innerHTML=renderEditForm(m);
  document.getElementById("modal-edit").classList.add("open");
  // Restaurar handler de guardar para movimientos (puede haber sido cambiado por openEditTcModal)
  const btnGuardar=document.querySelector("#modal-edit .btn-primary");
  if(btnGuardar) btnGuardar.setAttribute("onclick","guardarEdit()");
  // Llenar selectores de categoría si es Gasto/Ingreso
  if(m.tipo==="Gasto"||m.tipo==="Ingreso"){
    populateEditCatSelect(m.tipo,m.cat,m.subcat);
  }
}
// ═══════════════════════════════════════════
// EDITAR UN CAMBIO DE MONEDA
// ═══════════════════════════════════════════
// Mismo patrón que openEditTcModal: se reusa el modal de edición y se le cambia el handler
// del botón de guardar.
let editingCambioId=null;

function openEditCambioModal(cambioId){
  const info=leerCambio(patasDelCambio(cambioId, movs));
  if(!info){ showToast("No encontré las dos mitades de este cambio"); return; }
  editingCambioId=cambioId;
  const compra=info.sentido==="compra";
  document.getElementById("edit-form-content").innerHTML=`
    <div style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px;background:var(--accent-light);color:var(--accent);margin-bottom:10px">💱 ${compra?"COMPRA DE DÓLARES":"VENTA DE DÓLARES"}</div>
    <p class="txt-sm txt-muted mb-10">Se guardan las dos mitades juntas, así el tipo de cambio siempre cierra.</p>
    <div class="form-group"><label class="form-label" for="edit-cambio-ars">${compra?"Pesos que pagaste":"Pesos que recibiste"}</label>
      <input type="number" id="edit-cambio-ars" class="form-input" value="${info.montoARS}" inputmode="decimal" step="any" oninput="previsualizarEditCambio()"></div>
    <div class="form-group"><label class="form-label" for="edit-cambio-usd">${compra?"Dólares que recibiste":"Dólares que entregaste"}</label>
      <input type="number" id="edit-cambio-usd" class="form-input" value="${info.montoUSD}" inputmode="decimal" step="any" oninput="previsualizarEditCambio()"></div>
    <div id="edit-cambio-tc" class="inset mb-10"></div>
    <div class="form-group"><label class="form-label" for="edit-cambio-fecha">Fecha</label>
      <input type="date" id="edit-cambio-fecha" class="form-input" value="${escapeHtml(info.fecha||"")}"></div>
    <div class="form-group"><label class="form-label" for="edit-cambio-nota">Nota</label>
      <textarea id="edit-cambio-nota" class="form-textarea">${escapeHtml(info.nota||"")}</textarea></div>`;
  document.getElementById("modal-edit").classList.add("open");
  const btnGuardar=document.querySelector("#modal-edit .btn-primary");
  if(btnGuardar) btnGuardar.setAttribute("onclick","guardarEditCambio()");
  previsualizarEditCambio();
}

function previsualizarEditCambio(){
  const el=document.getElementById("edit-cambio-tc");
  if(!el) return;
  const tc=tipoDeCambio(parseFloat(document.getElementById("edit-cambio-ars").value)||0,
                        parseFloat(document.getElementById("edit-cambio-usd").value)||0);
  el.innerHTML=tc
    ? `<div class="seccion-label">Tipo de cambio</div><div style="font-size:18px;font-weight:600;color:var(--accent);margin-top:2px">${fmtS(tc)} por dólar</div>`
    : `<div class="txt-sm txt-muted">Poné los dos montos para ver el tipo de cambio.</div>`;
}

function guardarEditCambio(){
  const patas=patasDelCambio(editingCambioId, movs);
  const info=leerCambio(patas);
  if(!info){ showToast("No encontré las dos mitades de este cambio"); return; }
  const ars=parseFloat(document.getElementById("edit-cambio-ars").value)||0;
  const usd=parseFloat(document.getElementById("edit-cambio-usd").value)||0;
  const fecha=document.getElementById("edit-cambio-fecha").value;
  if(ars<=0||usd<=0){ showToast("Los dos montos tienen que ser mayores a cero"); return; }
  if(!fecha){ showToast("Poné la fecha"); return; }
  const nota=document.getElementById("edit-cambio-nota").value.trim();
  const compra=info.sentido==="compra";
  patas.forEach(m=>{
    m.fecha=fecha; m.nota=nota;
    const esPataARS = compra ? (m.cambioPata==="sale") : (m.cambioPata==="entra");
    if(esPataARS){ m.importe=Math.round(ars*100)/100; m.importeOrig=null; }
    else { m.importe=0; m.importeOrig=Math.round(usd*100)/100; }
  });
  save();
  closeEditModal();
  showToast(`Cambio actualizado · ${fmtS(tipoDeCambio(ars,usd))} por dólar ✓`);
  renderMovs();
}

function closeEditModal(){
  document.getElementById("modal-edit").classList.remove("open");
  editingId=null;
  editingCambioId=null;
}
function renderEditForm(m){
  if(m.tipo==="Gasto"||m.tipo==="Ingreso"){
    const esFrec=m.tipo==="Gasto" && m.frecuente;
    const hoyYM=currentYM();
    const cambios=esFrec && Array.isArray(m.cambios) ? m.cambios.slice() : [];
    const montoVigente = esFrec ? getGastoFrecMontoEnMes(m, hoyYM) : 0;
    return `
      <div style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px;background:${m.tipo==="Gasto"?"var(--danger-light)":"var(--success-light)"};color:${m.tipo==="Gasto"?"var(--danger)":"var(--success)"};margin-bottom:10px">${esFrec?"🔁 GASTO FRECUENTE":m.tipo.toUpperCase()}</div>
      ${esFrec?`
        <div class="inset">
          <div class="seccion-label mb-6">Monto vigente este mes</div>
          <div style="font-size:18px;font-weight:600;color:var(--danger)">${fmtMoneda(montoVigente, m.moneda)}</div>
        </div>
      `:""}
      <div class="form-group"><label class="form-label">${esFrec?"Monto base":(m.moneda==="USD"?"Importe (USD)":"Importe (ARS)")}</label>
        <div class="amount-wrap"><span class="amount-prefix">${m.moneda==="USD"?"USD":"$"}</span>
          <input type="number" id="edit-importe" class="form-input amount-input" value="${m.moneda==="USD"?(m.importeOrig||0):(m.importe||0)}" inputmode="decimal" step="any">
        </div>
        ${esFrec?'<p style="font-size:10px;color:var(--muted);margin-top:4px">Monto inicial. Si querés actualizarlo desde un mes en adelante, usá "Registrar aumento" más abajo.</p>':""}
      </div>
      ${esFrec?`
        <div class="form-group"><label class="form-label">Moneda</label>
          <select id="edit-moneda-frec" class="form-select" onchange="document.querySelectorAll('.edit-prefix-frec').forEach(p=>p.textContent=this.value==='USD'?'USD':'$')">
            <option value="ARS" ${(m.moneda||'ARS')==='ARS'?'selected':''}>🇦🇷 Pesos (ARS)</option>
            <option value="USD" ${m.moneda==='USD'?'selected':''}>🇺🇸 Dólares (USD)</option>
          </select>
        </div>
      `:""}
      <div class="form-group"><label class="form-label">Categoría</label>
        <select id="edit-cat" class="form-select" onchange="updateEditSubcats()"></select>
      </div>
      <div class="form-group"><label class="form-label">Subcategoría</label>
        <select id="edit-subcat" class="form-select"></select>
      </div>
      <div class="form-group"><label class="form-label">Cuenta</label>
        <div class="u-row">
          <select id="edit-cuenta" class="form-select u-flex1">
            ${getCuentas().map(c=>`<option ${m.cuenta===c?'selected':''}>${escapeHtml(c)}</option>`).join("")}
            ${m.cuenta && !getCuentas().includes(m.cuenta)?`<option selected>${escapeHtml(m.cuenta)}</option>`:""}
          </select>
          <button type="button" class="btn-sm" onclick="agregarCuentaRapida('edit-cuenta')" title="Agregar cuenta nueva">+ Cta</button>
        </div>
      </div>
      ${esFrec?`
        <div class="two-col">
          <div class="form-group"><label class="form-label">Mes de inicio</label>
            <input type="month" id="edit-frec-inicio" class="form-input" value="${m.mesInicio||currentYM()}">
          </div>
          <div class="form-group"><label class="form-label">Mes de fin (opcional)</label>
            <input type="month" id="edit-frec-fin" class="form-input" value="${m.mesFin||''}">
          </div>
        </div>
        <div style="background:var(--warning-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">📈 Registrar aumento de precio</div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:8px">El nuevo monto se aplicará desde el mes elegido en adelante.</p>
          <div class="two-col">
            <div class="form-group"><label class="form-label">Desde el mes</label>
              <input type="month" id="edit-frec-aum-mes" class="form-input" value="${hoyYM}">
            </div>
            <div class="form-group"><label class="form-label">Nuevo monto</label>
              <div class="amount-wrap"><span class="amount-prefix edit-prefix-frec">${m.moneda==='USD'?'USD':'$'}</span>
                <input type="number" id="edit-frec-aum-monto" class="form-input amount-input" placeholder="${montoVigente}" inputmode="decimal" step="any">
              </div>
            </div>
          </div>
        </div>
        ${cambios.length?`
          <div class="seccion-label mb-6">Historial de aumentos</div>
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:12px">
            ${cambios.sort((a,b)=>a.desde.localeCompare(b.desde)).map((c,i)=>`
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0;${i<cambios.length-1?'border-bottom:1px solid var(--border)':''}">
                <span>${mesLbl(c.desde)}: <strong>${fmtMoneda(c.monto, m.moneda)}</strong></span>
                <button class="tx-del" style="color:var(--danger)" onclick="borrarCambioFrec(${i})" title="Eliminar este aumento">×</button>
              </div>
            `).join("")}
          </div>`:""}
        <div style="background:var(--danger-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--danger)">🛑 Dar de baja</div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:8px">Deja de aparecer desde el próximo mes. Los meses anteriores quedan en el historial.</p>
          <button type="button" class="btn-sm" style="color:var(--danger);width:100%" onclick="darDeBajaFrecGasto(${m.id})">Dar de baja desde ${mesLbl(mesActual)}</button>
        </div>
      `:`
      <div class="form-group"><label class="form-label">Fecha</label>
        <input type="date" id="edit-fecha" class="form-input" value="${(m.fecha||'').slice(0,10)}">
      </div>`}
      <div class="form-group"><label class="form-label">Nota</label>
        <textarea id="edit-nota" class="form-textarea">${escapeHtml(m.nota)}</textarea>
      </div>
      ${m.tipo==="Gasto" && !esFrec?`
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm);margin-bottom:6px">
          <input type="checkbox" id="edit-ahorro" ${m.esAhorro?"checked":""} style="width:18px;height:18px;cursor:pointer;accent-color:var(--save)" onchange="onEditAhorroToggle()">
          <span style="color:var(--save);font-weight:500">🏦 Es un ahorro (suma al fondo)</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--save-light);border-radius:var(--radius-sm)">
          <input type="checkbox" id="edit-usa-ahorro" ${m.usaAhorro?"checked":""} style="width:18px;height:18px;cursor:pointer;accent-color:var(--save)" onchange="onEditUsaAhorroToggle()">
          <span style="color:var(--save);font-weight:500">💸 Sale de mis ahorros (resta del fondo)</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:10px 12px;background:var(--accent-light);border-radius:var(--radius-sm);margin-top:6px">
          <input type="checkbox" id="edit-traspaso" ${m.traspaso?"checked":""} style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent)">
          <span style="color:var(--accent);font-weight:500">↔️ Es un traspaso (cambia de bolsillo, no lo gastaste)</span>
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Monto recuperable (opcional)</label>
        <div class="amount-wrap"><span class="amount-prefix">$</span>
          <input type="number" id="edit-recup" class="form-input amount-input" value="${m.recuperable||0}" inputmode="decimal" step="any">
        </div>
      </div>`:""}
    `;
  }
  if(m.tipo==="Inversion"){
    return `
      <div style="display:inline-block;font-size:10px;font-weight:600;padding:3px 9px;border-radius:10px;background:var(--invest-light);color:var(--invest);margin-bottom:10px">INVERSIÓN · ${escapeHtml(m.subcat)}</div>
      <div class="form-group"><label class="form-label">Ticker / Fondo</label>
        <input type="text" id="edit-ticker" class="form-input" value="${escapeHtml(m.ticker)}">
      </div>
      <div class="two-col">
        <div class="form-group"><label class="form-label">Importe ARS</label>
          <div class="amount-wrap"><span class="amount-prefix">$</span>
            <input type="number" id="edit-ars" class="form-input" style="padding-left:26px" value="${m.importe||0}" inputmode="decimal" step="any">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Importe USD</label>
          <div class="amount-wrap"><span class="amount-prefix" style="font-size:11px;left:8px">USD</span>
            <input type="number" id="edit-usd" class="form-input" style="padding-left:40px" value="${m.importeUSD||0}" inputmode="decimal" step="any">
          </div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Fecha</label>
        <input type="date" id="edit-fecha" class="form-input" value="${(m.fecha||'').slice(0,10)}">
      </div>
      <div class="form-group"><label class="form-label">Cuenta</label>
        <div class="u-row">
          <select id="edit-cuenta" class="form-select u-flex1">
            ${getCuentas().map(c=>`<option ${m.cuenta===c?'selected':''}>${escapeHtml(c)}</option>`).join("")}
            ${m.cuenta && !getCuentas().includes(m.cuenta)?`<option selected>${escapeHtml(m.cuenta)}</option>`:""}
          </select>
          <button type="button" class="btn-sm" onclick="agregarCuentaRapida('edit-cuenta')" title="Agregar cuenta nueva">+ Cta</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Nota</label>
        <textarea id="edit-nota" class="form-textarea">${escapeHtml(m.nota)}</textarea>
      </div>
    `;
  }
  return `<p style="color:var(--muted)">Tipo de movimiento no editable.</p>`;
}
function populateEditCatSelect(tipoMov,currentCat,currentSubcat){
  const cats=getCats(tipoMov);
  const keys=ordenarCats(tipoMov, cats);
  let opts=keys.map(c=>`<option value="${escapeHtml(c)}" ${c===currentCat?"selected":""}>${getIcon(c)} ${escapeHtml(c)}</option>`);
  // Si la categoría actual no está en las opciones (ej: vino del Excel con otro nombre), agregarla
  if(currentCat && !cats[currentCat]){
    opts.unshift(`<option value="${escapeHtml(currentCat)}" selected>${escapeHtml(currentCat)}</option>`);
  }
  document.getElementById("edit-cat").innerHTML=opts.join("");
  // Subcategorías
  const subList=cats[currentCat]||[];
  let subOpts=subList.map(s=>`<option ${s===currentSubcat?"selected":""}>${escapeHtml(s)}</option>`);
  if(currentSubcat && !subList.includes(currentSubcat)){
    subOpts.unshift(`<option selected>${escapeHtml(currentSubcat)}</option>`);
  }
  if(!subOpts.length) subOpts.push("<option>Otros</option>");
  document.getElementById("edit-subcat").innerHTML=subOpts.join("");
}
function updateEditSubcats(){
  const m=movs.find(x=>x.id===editingId);
  if(!m) return;
  const cat=document.getElementById("edit-cat").value;
  const cats=getCats(m.tipo);
  const subList=cats[cat]||["Otros"];
  document.getElementById("edit-subcat").innerHTML=subList.map(s=>`<option>${escapeHtml(s)}</option>`).join("");
}
function guardarEdit(){
  const m=movs.find(x=>x.id===editingId);
  if(!m){closeEditModal();return;}
  if(m.tipo==="Gasto"||m.tipo==="Ingreso"){
    const imp=parseFloat(document.getElementById("edit-importe").value)||0;
    if(imp<=0){showToast("Ingresá un importe válido");return;}
    // Para frecuentes guardamos en importe (ARS) o importeOrig (USD) según moneda elegida
    const monedaFrecEl=document.getElementById("edit-moneda-frec");
    if(m.frecuente && monedaFrecEl){
      const nuevaMoneda=monedaFrecEl.value;
      m.moneda=nuevaMoneda;
      const isUSD=nuevaMoneda==="USD";
      m.importe = isUSD ? 0 : Math.round(imp*100)/100;
      m.importeOrig = isUSD ? Math.round(imp*100)/100 : null;
    } else {
      m.importe=Math.round(imp*100)/100;
    }
    m.cat=document.getElementById("edit-cat").value;
    m.subcat=document.getElementById("edit-subcat").value;
    const cuentaEl=document.getElementById("edit-cuenta");
    if(cuentaEl) m.cuenta=cuentaEl.value;
    // Si es frecuente: guardar mesInicio/mesFin y procesar aumento si está cargado
    if(m.frecuente){
      const ini=document.getElementById("edit-frec-inicio").value;
      const fin=document.getElementById("edit-frec-fin").value||null;
      if(!ini){showToast("Indicá el mes de inicio");return;}
      if(fin&&fin<ini){showToast("El mes de fin no puede ser antes del inicio");return;}
      m.mesInicio=ini;
      m.mesFin=fin;
      const aumMes=document.getElementById("edit-frec-aum-mes").value;
      const aumMonto=parseFloat(document.getElementById("edit-frec-aum-monto").value)||0;
      if(aumMes && aumMonto>0){
        if(!Array.isArray(m.cambios)) m.cambios=[];
        const existIdx=m.cambios.findIndex(c=>c.desde===aumMes);
        if(existIdx>=0) m.cambios[existIdx].monto=Math.round(aumMonto*100)/100;
        else m.cambios.push({desde:aumMes, monto:Math.round(aumMonto*100)/100});
      }
    } else {
      m.fecha=document.getElementById("edit-fecha").value;
    }
    m.nota=document.getElementById("edit-nota").value.trim();
    if(m.tipo==="Gasto" && !m.frecuente){
      m.esAhorro=document.getElementById("edit-ahorro").checked;
      m.usaAhorro=document.getElementById("edit-usa-ahorro").checked;
      m.traspaso=document.getElementById("edit-traspaso").checked;
      // No pueden ser ambos
      if(m.esAhorro && m.usaAhorro) m.usaAhorro=false;
      m.recuperable=parseFloat(document.getElementById("edit-recup").value)||0;
    }
  } else if(m.tipo==="Inversion"){
    const ars=parseFloat(document.getElementById("edit-ars").value)||0;
    const usd=parseFloat(document.getElementById("edit-usd").value)||0;
    if(ars<=0&&usd<=0){showToast("Ingresá al menos un importe");return;}
    m.ticker=document.getElementById("edit-ticker").value.trim();
    m.importe=Math.round(ars*100)/100;
    m.importeUSD=Math.round(usd*100)/100;
    m.fecha=document.getElementById("edit-fecha").value;
    const cuentaInvEl=document.getElementById("edit-cuenta");
    if(cuentaInvEl) m.cuenta=cuentaInvEl.value;
    m.nota=document.getElementById("edit-nota").value.trim();
  }
  save();
  vibrar([15,50,15]);
  closeEditModal();
  showToast("Movimiento actualizado ✓");
  renderMovs();
  if(m.tipo==="Inversion") renderInv();
  if(m.tipo==="Gasto" && (m.esAhorro||m.usaAhorro)) renderAhorro();
  if(document.getElementById("dash-cuentas")) renderDashCuentas();
}

