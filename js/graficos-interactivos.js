// ═══════════════════════════════════════════
// GRÁFICOS INTERACTIVOS
// ═══════════════════════════════════════════
// Dibuja una etiqueta del eje X centrada en x, pero sin dejar que se salga del canvas:
// la última queda sobre el borde derecho y se cortaba a la mitad ("02/2" en vez de "02/26").
function dibujarEtiquetaX(ctx, texto, x, y, W){
  const mitad=ctx.measureText(texto).width/2 + 2;
  ctx.fillText(texto, Math.min(Math.max(x, mitad), W-mitad), y);
}

// "2026-07" → "07/26". El eje mostraba solo el mes (label.slice(5)), así que en un histórico
// de varios años aparecían dos "01" y dos "02" sin forma de saber cuál era cuál.
function etiquetaMes(ym){
  const s=String(ym||"");
  return s.length>=7 ? `${s.slice(5,7)}/${s.slice(2,4)}` : s;
}

// Elige qué etiquetas del eje X dibujar: una cada N, más la última siempre.
// Si la última quedaría pegada a la anterior, se saca la anterior en vez de superponerlas
// (las etiquetas con año son casi el doble de anchas que las viejas, así que se tocan fácil).
function indicesDeEtiquetas(puntos, anchoMinimo){
  if(!puntos.length) return [];
  const step=Math.max(1, Math.ceil(puntos.length/6));
  const idxs=[];
  puntos.forEach((_,i)=>{ if(i%step===0) idxs.push(i); });
  const ultimo=puntos.length-1;
  if(idxs[idxs.length-1]!==ultimo){
    if(puntos[ultimo].x - puntos[idxs[idxs.length-1]].x < anchoMinimo) idxs.pop();
    idxs.push(ultimo);
  }
  return idxs;
}

// Índice del punto que el usuario tocó en el gráfico de línea (o de la barra, en el de barras).
// Viven ACÁ, fuera de la función que dibuja, porque cada tap la vuelve a llamar desde cero para
// redibujar con el marcador: una variable local se perdería en cada redibujo. null = todavía no
// se tocó nada, así que se usa por defecto el último punto (ver handoff de Ahorros: "la línea de
// lectura nunca queda vacía").
let seleccionLinea=null;
let seleccionBarra=null;

// La llama renderAhorroChart() al cambiar de vista o cuando cambian los datos: el punto que
// habías tocado ya no significa lo mismo (o directamente no existe) en el gráfico nuevo.
function limpiarSeleccionLinea(){
  seleccionLinea=null;
  seleccionBarra=null;
}

// Línea con tap: dibuja curva acumulada y permite tocar para ver el valor de cada punto.
// Sin selección previa, arranca mostrando el último punto (el mes más reciente).
function drawInteractiveLine(canvas, labels, values, color, tipEl, fmtFn){
  if(!canvas||!values.length) return;
  if(seleccionLinea===null || seleccionLinea>=values.length) seleccionLinea=values.length-1;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||320, H=110;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.height=H+"px";
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const padL=44, padR=12, padT=10, padB=24;
  const cw=W-padL-padR, ch=H-padT-padB;
  const minV=Math.min(...values, 0);
  const maxV=Math.max(...values, 0);
  const range=maxV-minV||1;

  const isDark=document.documentElement.getAttribute("data-theme")==="dark";
  const gridColor=isDark?"rgba(255,255,255,.08)":"rgba(0,0,0,.06)";
  const textColor=isDark?"#9a9890":"#888780";

  // Grid horizontal y labels Y
  ctx.fillStyle=textColor;
  ctx.font="10px system-ui";
  ctx.textAlign="right";
  for(let i=0;i<=3;i++){
    const v=minV+(range*i/3);
    const y=padT+ch-(ch*i/3);
    ctx.strokeStyle=gridColor;
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(fmtAbbr(v), padL-4, y+3);
  }

  // Posiciones de los puntos
  const pts=values.map((v,i)=>({
    x: padL+(values.length>1?(cw*i/(values.length-1)):cw/2),
    y: padT+ch-((v-minV)/range)*ch,
    val:v, label:labels[i]
  }));

  // Área bajo la curva
  ctx.fillStyle=color+"22";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT+ch);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x, padT+ch);
  ctx.closePath();ctx.fill();

  // Línea
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.beginPath();
  pts.forEach((p,i)=>{i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});
  ctx.stroke();

  // Labels X (cada cierto step, con el año incluido)
  ctx.fillStyle=textColor;
  ctx.textAlign="center";
  indicesDeEtiquetas(pts, 34).forEach(i=>{
    dibujarEtiquetaX(ctx, etiquetaMes(pts[i].label), pts[i].x, H-6, W);
  });

  // ── Marcador del punto tocado ──
  // Se dibuja como parte del render normal, no parcheado encima después con un setTimeout.
  if(seleccionLinea!==null && pts[seleccionLinea]){
    const sel=pts[seleccionLinea];
    // Línea guía vertical, discreta: ancla el punto al eje X sin competir con la curva.
    ctx.strokeStyle=gridColor;
    ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(sel.x,padT);ctx.lineTo(sel.x,padT+ch);ctx.stroke();
    // OJO: las coordenadas van en píxeles CSS, SIN multiplicar por dpr. El contexto ya viene
    // escalado con ctx.scale(dpr,dpr) más arriba; volver a multiplicar mandaba el punto a dpr²
    // veces la posición correcta (9× en un celular con dpr 3), o sea afuera del canvas.
    ctx.fillStyle=color;
    // El aro va del color de la superficie, no "#fff" fijo: en tema oscuro un aro blanco canta.
    ctx.strokeStyle=themeColor('--surface');
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sel.x,sel.y,5,0,Math.PI*2);
    ctx.fill();ctx.stroke();
  }

  // Sin esto, la línea de lectura quedaba vacía hasta el primer tap. Ahora arranca mostrando
  // el punto seleccionado (el último mes, por defecto) y se actualiza igual al tocar otro.
  if(tipEl) tipEl.innerHTML=fmtFn(pts[seleccionLinea].label, pts[seleccionLinea].val);

  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    // Encontrar el punto más cercano
    let minDist=Infinity, idx=0;
    pts.forEach((p,i)=>{
      const d=Math.abs(p.x-x);
      if(d<minDist){minDist=d;idx=i;}
    });
    seleccionLinea=idx;
    // Se vuelve a llamar a ESTA función, no a renderAhorroChart(): esa limpia el tooltip como
    // primer paso, así que borraba el detalle recién escrito y el tap parecía no hacer nada.
    // El redibujo ya deja tipEl actualizado (ver arriba), así que no hace falta repetirlo acá.
    drawInteractiveLine(canvas, labels, values, color, tipEl, fmtFn);
  };
}

// Bar chart con tap: una barra por mes, coloreada según si es la seleccionada, un retiro o un
// mes sin movimiento. Sin selección previa, arranca mostrando el último mes (ver seleccionBarra).
function drawInteractiveBars(canvas, labels, values, tipEl, fmtFn){
  if(!canvas||!values.length) return;
  if(seleccionBarra===null || seleccionBarra>=values.length) seleccionBarra=values.length-1;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||320, H=110;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.height=H+"px";
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const padL=44, padR=12, padT=10, padB=24;
  const cw=W-padL-padR, ch=H-padT-padB;
  const minV=Math.min(...values, 0);
  const maxV=Math.max(...values, 0);
  const range=(maxV-minV)||1;
  const zeroY=padT+ch-((0-minV)/range)*ch;

  const isDark=document.documentElement.getAttribute("data-theme")==="dark";
  const gridColor=isDark?"rgba(255,255,255,.08)":"rgba(0,0,0,.06)";
  const textColor=isDark?"#9a9890":"#888780";

  // Grid + labels Y
  ctx.fillStyle=textColor;
  ctx.font="10px system-ui";
  ctx.textAlign="right";
  for(let i=0;i<=3;i++){
    const v=minV+(range*i/3);
    const y=padT+ch-(ch*i/3);
    ctx.strokeStyle=gridColor;
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(fmtAbbr(v), padL-4, y+3);
  }

  const barW=cw/values.length*0.7;
  const gap=cw/values.length*0.3;

  const bars=values.map((v,i)=>{
    const x=padL+(cw*i/values.length)+gap/2;
    // Un mes en $0 no puede quedar invisible: se le da un nub mínimo de 3px.
    const h=Math.max(Math.abs((v/range)*ch), v===0?3:0);
    const y=v>=0?padT+ch-h:zeroY;
    return {x,y,h,val:v,label:labels[i]};
  });

  // Colores: retiro siempre en --danger (la selección no lo tapa), $0 en --border, el mes
  // seleccionado en --save y el resto de los depósitos atenuados — igual que el prototipo.
  bars.forEach((b,i)=>{
    const color = b.val===0 ? themeColor('--border')
      : b.val<0 ? themeColor('--danger')
      : i===seleccionBarra ? themeColor('--save')
      : themeColorMix('--save', 40, '--surface');
    ctx.fillStyle=color;
    drawBarRounded(ctx, b.x, b.y, barW, b.h, 3, b.val>=0?"top":"bottom");
  });

  // Línea cero
  ctx.strokeStyle=textColor;
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(padL,zeroY);ctx.lineTo(W-padR,zeroY);ctx.stroke();

  // Labels X (con el año incluido); el mes seleccionado va destacado.
  ctx.textAlign="center";
  const centros=bars.map(b=>({x:b.x+barW/2, label:b.label}));
  indicesDeEtiquetas(centros, 34).forEach(i=>{
    ctx.fillStyle = i===seleccionBarra ? themeColor('--text') : textColor;
    ctx.font = i===seleccionBarra ? "700 10px system-ui" : "10px system-ui";
    dibujarEtiquetaX(ctx, etiquetaMes(centros[i].label), centros[i].x, H-6, W);
  });

  // Igual que en la línea: sin esto la lectura quedaba vacía hasta el primer tap.
  if(tipEl) tipEl.innerHTML=fmtFn(bars[seleccionBarra].label, bars[seleccionBarra].val);

  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    let minDist=Infinity, idx=0;
    bars.forEach((b,i)=>{
      const cx=b.x+barW/2;
      const d=Math.abs(cx-x);
      if(d<minDist){minDist=d;idx=i;}
    });
    seleccionBarra=idx;
    // Se redibuja para que la barra tocada pase a --save: antes el color era fijo por signo y
    // tocar un mes no cambiaba nada visualmente, solo el texto de abajo.
    drawInteractiveBars(canvas, labels, values, tipEl, fmtFn);
  };
}

// ── METAS ──
// id de la meta que se está editando (null = el modal #modal-meta está creando una nueva).
let editingMetaId=null;

function openMetaModal(){
  editingMetaId=null;
  document.getElementById("meta-modal-title").textContent="Nueva meta de ahorro";
  document.getElementById("meta-nombre").value="";
  document.getElementById("meta-objetivo").value="";
  document.getElementById("meta-emoji").value="🎯";
  document.getElementById("btn-guardar-meta").textContent="Crear meta";
  document.getElementById("modal-meta").classList.add("open");
}
function closeMetaModal(){document.getElementById("modal-meta").classList.remove("open");}

// Tocar una tarjeta de meta abre la hoja para editarla en vez de crear una: reusa el mismo
// formulario y botón, solo cambian el título y qué hace "Guardar".
function openEditMetaModal(id){
  const m=metas.find(x=>x.id===id);
  if(!m) return;
  editingMetaId=id;
  document.getElementById("meta-modal-title").textContent="Editar meta";
  document.getElementById("meta-nombre").value=m.nombre;
  document.getElementById("meta-objetivo").value=m.objetivo;
  document.getElementById("meta-emoji").value=iconoSeguro(m.emoji)||"🎯";
  document.getElementById("btn-guardar-meta").textContent="Guardar cambios";
  document.getElementById("modal-meta").classList.add("open");
}

function guardarMeta(){
  const nombre=document.getElementById("meta-nombre").value.trim();
  const objetivo=parseFloat(document.getElementById("meta-objetivo").value)||0;
  const emoji=iconoSeguro(document.getElementById("meta-emoji").value) || "🎯";
  if(!nombre||objetivo<=0){showToast("Completá nombre y objetivo");return;}
  const editando=editingMetaId;
  if(editando){
    const m=metas.find(x=>x.id===editando);
    if(m){ m.nombre=nombre; m.objetivo=objetivo; m.emoji=emoji; }
  } else {
    metas.push({id:Date.now(),nombre,objetivo,actual:0,emoji});
  }
  editingMetaId=null;
  save();closeMetaModal();
  document.getElementById("meta-nombre").value="";
  document.getElementById("meta-objetivo").value="";
  showToast(editando?"Meta actualizada ✓":"Meta creada ✓");
  renderMetas();
}

// Tocar una meta deposita; mantenerla apretada (o el menú contextual) edita o elimina — ver
// metaCardDown/metaCardContextMenu más abajo. Reemplaza a la × que antes estaba siempre visible.
function renderMetas(){
  const el=document.getElementById("metas-list");
  const depCard=document.getElementById("depositar-card");
  // #depositar-card ya no se muestra como card: queda como contenedor oculto de #dep-meta, que
  // openDepositoSheet() sigue necesitando para saber a qué meta depositarle (ver handoff).
  if(depCard) depCard.style.display="none";
  document.getElementById("dep-meta").innerHTML=metas.map(m=>`<option value="${m.id}">${iconoSeguro(m.emoji)||"🎯"} ${escapeHtml(m.nombre)}</option>`).join("");

  const sumEl=document.getElementById("metas-sum");
  if(sumEl){
    const total=metas.reduce((s,m)=>s+m.actual,0);
    sumEl.textContent = metas.length ? `${fmtTotal(total)} en ${metas.length} ${metas.length===1?"meta":"metas"}` : "";
  }

  const nueva=`<button type="button" class="meta-card-nueva" onclick="openMetaModal()" aria-label="Nueva meta">
      <span style="font-size:22px">＋</span><span style="font-size:12px;font-weight:600">Nueva meta</span>
    </button>`;

  if(!metas.length){
    el.innerHTML=`<div class="meta-card-nueva" style="grid-column:1/-1" onclick="openMetaModal()">
      <span style="font-size:22px">＋</span><span style="font-size:12px;font-weight:600">Creá tu primera meta</span>
    </div>`;
    return;
  }

  el.innerHTML=metas.map(m=>{
    const pct=Math.min(100,Math.round((m.actual/m.objetivo)*100));
    const cumplida=pct>=100;
    const emoji=iconoSeguro(m.emoji)||"🎯";
    const falta=Math.max(0,m.objetivo-m.actual);
    const aria=`${m.nombre}, ${pct}%, ${cumplida?"meta cumplida":"faltan "+fmtTotal(falta)}. Depositar`;
    return `<button type="button" class="meta-card" aria-label="${escapeHtml(aria)}"
        onpointerdown="metaCardDown(${m.id})" onpointerup="metaCardUp()" onpointerleave="metaCardUp()"
        oncontextmenu="metaCardContextMenu(event,${m.id})" onclick="metaCardClick(${m.id})">
      <span class="meta-ring" style="background:conic-gradient(var(--save) ${pct*3.6}deg,var(--border) 0)">
        <span class="meta-ring-inner${cumplida?' cumplida':''}">${cumplida?"✓":escapeHtml(emoji)}</span>
      </span>
      <span class="meta-nombre">${escapeHtml(m.nombre)}</span>
      <span class="meta-pct">${pct}%</span>
      <span class="meta-falta">${cumplida?"¡Meta cumplida!":"Faltan "+fmtTotal(falta)}</span>
    </button>`;
  }).join("")+nueva;
}

// ── Tocar vs. mantener apretado ──
// Un tap corto deposita; 500ms sostenido (o el menú contextual del botón derecho/táctil) abre
// Editar/Eliminar. metaMenuRecienAbierto evita que, al soltar después del menú, el click que
// dispara el navegador igual abra la hoja de depósito encima.
let metaPressTimer=null;
let metaMenuRecienAbierto=false;
function metaCardDown(id){
  clearTimeout(metaPressTimer);
  metaPressTimer=setTimeout(()=>{ metaMenuRecienAbierto=true; openMetaMenu(id); }, 500);
}
function metaCardUp(){
  clearTimeout(metaPressTimer);
}
function metaCardContextMenu(e,id){
  e.preventDefault();
  clearTimeout(metaPressTimer);
  metaMenuRecienAbierto=true;
  openMetaMenu(id);
}
function metaCardClick(id){
  if(metaMenuRecienAbierto){ metaMenuRecienAbierto=false; return; }
  openDepositoSheet(id);
}

// ── Menú Editar/Eliminar ──
let metaMenuId=null;
function openMetaMenu(id){
  const m=metas.find(x=>x.id===id);
  if(!m) return;
  metaMenuId=id;
  document.getElementById("meta-menu-nombre").textContent=`${iconoSeguro(m.emoji)||"🎯"} ${m.nombre}`;
  document.getElementById("modal-meta-menu").classList.add("open");
}
function closeMetaMenu(){
  document.getElementById("modal-meta-menu").classList.remove("open");
}
function metaMenuEditar(){
  const id=metaMenuId;
  closeMetaMenu();
  openEditMetaModal(id);
}
function metaMenuEliminar(){
  const id=metaMenuId;
  closeMetaMenu();
  borrarMeta(id);
}
async function borrarMeta(id){
  const m=metas.find(x=>x.id===id);
  if(!m) return;
  if(!await mostrarConfirm(`¿Eliminar la meta "${m.nombre}"? Se pierde el progreso guardado.`, {textoOk:"Eliminar", peligroso:true})) return;
  metas=metas.filter(x=>x.id!==id);
  save();
  showToast("Meta eliminada");
  renderMetas();
}

// ── Hoja "Depositar en meta" ──
function openDepositoSheet(id){
  const m=metas.find(x=>x.id===id);
  if(!m) return;
  document.getElementById("dep-meta").value=id;
  document.getElementById("deposito-emoji").textContent=iconoSeguro(m.emoji)||"🎯";
  document.getElementById("deposito-nombre").textContent="Depositar en "+m.nombre;
  document.getElementById("deposito-sub").textContent=`Tenés ${fmtTotal(m.actual)} de ${fmtTotal(m.objetivo)}`;
  const montoEl=document.getElementById("dep-monto");
  montoEl.value="";
  actualizarPreviewDeposito();
  document.getElementById("modal-depositar").classList.add("open");
  setTimeout(()=>montoEl.focus(),250);
}
function closeDepositoSheet(){
  document.getElementById("modal-depositar").classList.remove("open");
}
function depositoChipAdd(monto){
  const el=document.getElementById("dep-monto");
  const actual=parseFloat(limpiarImporte(el.value))||0;
  el.value=formatearNumeroConMiles(String(actual+monto));
  actualizarPreviewDeposito();
}
function depositoChipCompletar(){
  const id=parseInt(document.getElementById("dep-meta").value);
  const m=metas.find(x=>x.id===id);
  if(!m) return;
  const falta=Math.max(0, m.objetivo-m.actual);
  document.getElementById("dep-monto").value=formatearNumeroConMiles(String(falta));
  actualizarPreviewDeposito();
}
function actualizarPreviewDeposito(){
  const id=parseInt(document.getElementById("dep-meta").value);
  const m=metas.find(x=>x.id===id);
  const previewEl=document.getElementById("deposito-preview");
  const btn=document.getElementById("btn-depositar");
  if(!m||!previewEl) return;
  const monto=parseFloat(limpiarImporte(document.getElementById("dep-monto").value))||0;
  if(monto>0){
    const llega=m.actual+monto;
    const pct=Math.min(100,Math.round(llega/m.objetivo*100));
    previewEl.textContent=`Vas a llegar a ${fmtTotal(llega)} · ${pct}% de la meta`;
  } else {
    previewEl.textContent=`Te faltan ${fmtTotal(Math.max(0,m.objetivo-m.actual))}`;
  }
  if(btn) btn.style.opacity = monto>0 ? "1" : ".5";
}
function depositarMeta(){
  const id=parseInt(document.getElementById("dep-meta").value);
  const monto=parseFloat(limpiarImporte(document.getElementById("dep-monto").value))||0;
  if(monto<=0){showToast("Ingresá un monto");return;}
  const m=metas.find(x=>x.id===id);
  if(m){
    m.actual=Math.round((m.actual+monto)*100)/100;
    save();
    showToast("Depósito registrado ✓");
    closeDepositoSheet();
    renderMetas();
  }
}

