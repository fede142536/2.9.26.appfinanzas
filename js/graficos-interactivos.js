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

// Índice del punto que el usuario tocó en el gráfico de línea. Vive ACÁ, fuera de la función
// que dibuja, porque cada tap la vuelve a llamar desde cero para redibujar con el marcador:
// una variable local se perdería en cada redibujo.
let seleccionLinea=null;

// La llama renderAhorroChart() al cambiar de vista o cuando cambian los datos: el punto que
// habías tocado ya no significa lo mismo (o directamente no existe) en el gráfico nuevo.
function limpiarSeleccionLinea(){
  seleccionLinea=null;
}

// Línea con tap: dibuja curva acumulada y permite tocar para ver el valor de cada punto.
function drawInteractiveLine(canvas, labels, values, color, tipEl, fmtFn){
  if(!canvas||!values.length) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||320, H=180;
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
    drawInteractiveLine(canvas, labels, values, color, tipEl, fmtFn);
    if(tipEl) tipEl.textContent=fmtFn(pts[idx].label, pts[idx].val);
  };
}

// Bar chart con tap: barras pueden ser positivas (verde) o negativas (rojo)
function drawInteractiveBars(canvas, labels, values, tipEl, fmtFn){
  if(!canvas||!values.length) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||320, H=180;
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
    const y=v>=0?padT+ch-((v-minV)/range)*ch:zeroY;
    const h=Math.abs((v/range)*ch);
    return {x,y,h,val:v,label:labels[i]};
  });

  bars.forEach(b=>{
    ctx.fillStyle=b.val>=0?themeColor('--save'):themeColor('--danger');
    drawBarRounded(ctx, b.x, b.y, barW, b.h, 3, b.val>=0?"top":"bottom");
  });

  // Línea cero
  ctx.strokeStyle=textColor;
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(padL,zeroY);ctx.lineTo(W-padR,zeroY);ctx.stroke();

  // Labels X (con el año incluido)
  ctx.fillStyle=textColor;
  ctx.textAlign="center";
  const centros=bars.map(b=>({x:b.x+barW/2, label:b.label}));
  indicesDeEtiquetas(centros, 34).forEach(i=>{
    dibujarEtiquetaX(ctx, etiquetaMes(centros[i].label), centros[i].x, H-6, W);
  });

  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    let minDist=Infinity, idx=0;
    bars.forEach((b,i)=>{
      const cx=b.x+barW/2;
      const d=Math.abs(cx-x);
      if(d<minDist){minDist=d;idx=i;}
    });
    if(tipEl) tipEl.textContent=fmtFn(bars[idx].label, bars[idx].val);
  };
}

// Barras horizontales por categoría (vista "categoria")
function drawInteractiveCatBars(canvas, entries, tipEl){
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||320;
  // Altura dinámica: 28px por categoría + padding
  const rowH=28;
  const H=Math.max(120, entries.length*rowH+20);
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.height=H+"px";
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  if(!entries.length){
    if(tipEl) tipEl.textContent="Sin datos por categoría";
    return;
  }
  const isDark=document.documentElement.getAttribute("data-theme")==="dark";
  const textColor=isDark?"#e8e6e0":"#1a1a18";

  const maxV=Math.max(...entries.map(([_,v])=>Math.abs(v)));
  const labelW=110;
  const valW=70;
  const barX=labelW+5;
  const barMaxW=W-labelW-valW-15;

  ctx.font="12px system-ui";
  ctx.textBaseline="middle";

  const rects=[];
  entries.forEach(([cat,val],i)=>{
    const y=10+i*rowH+rowH/2;
    const w=Math.round(Math.abs(val)/maxV*barMaxW);
    const color=val>=0?themeColor('--save'):themeColor('--danger');

    // Label
    ctx.fillStyle=textColor;
    ctx.textAlign="left";
    const icon=getIcon(cat,"🏦");
    ctx.fillText(`${icon} ${cat}`.slice(0,15), 4, y);

    // Barra
    ctx.fillStyle=color+"33";
    drawBarRoundedH(ctx, barX, y-9, barMaxW, 18, 9, "full");
    ctx.fillStyle=color;
    drawBarRoundedH(ctx, barX, y-9, w, 18, 9);

    // Valor
    ctx.fillStyle=textColor;
    ctx.textAlign="right";
    ctx.fillText(fmtAbbr(val), W-6, y);

    rects.push({y0:y-rowH/2, y1:y+rowH/2, cat, val});
  });

  canvas.onclick=(e)=>{
    const rect=canvas.getBoundingClientRect();
    const y=e.clientY-rect.top;
    const hit=rects.find(r=>y>=r.y0&&y<=r.y1);
    if(hit && tipEl) tipEl.textContent=`${hit.cat}: ${fmtS(hit.val)}`;
  };
}


// ── METAS ──
function openMetaModal(){document.getElementById("modal-meta").classList.add("open");}
function closeMetaModal(){document.getElementById("modal-meta").classList.remove("open");}
function guardarMeta(){
  const nombre=document.getElementById("meta-nombre").value.trim();
  const objetivo=parseFloat(document.getElementById("meta-objetivo").value)||0;
  const emoji=document.getElementById("meta-emoji").value||"🎯";
  if(!nombre||objetivo<=0){showToast("Completá nombre y objetivo");return;}
  metas.push({id:Date.now(),nombre,objetivo,actual:0,emoji});
  save();closeMetaModal();
  document.getElementById("meta-nombre").value="";
  document.getElementById("meta-objetivo").value="";
  showToast("Meta creada ✓");renderMetas();
}
function renderMetas(){
  const el=document.getElementById("metas-list");
  const depCard=document.getElementById("depositar-card");
  if(!metas.length){el.innerHTML=`<div class="empty" style="padding:24px"><div class="empty-icon">🎯</div>Creá tu primera meta</div>`;depCard.style.display="none";return;}
  depCard.style.display="block";
  document.getElementById("dep-meta").innerHTML=metas.map(m=>`<option value="${m.id}">${m.emoji} ${escapeHtml(m.nombre)}</option>`).join("");
  el.innerHTML=metas.map(m=>{
    const pct=Math.min(100,Math.round((m.actual/m.objetivo)*100));
    const resta=Math.max(0,m.objetivo-m.actual);
    return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:14px;font-weight:600">${m.emoji} ${escapeHtml(m.nombre)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${fmt(m.actual)} de ${fmt(m.objetivo)} · ${pct}% logrado</div>
          ${resta>0?`<div style="font-size:11px;color:var(--save)">Faltan ${fmt(resta)}</div>`:`<div style="font-size:11px;color:var(--success);font-weight:600">✓ Meta alcanzada!</div>`}
        </div>
        <button class="btn-sm" style="color:var(--danger)" onclick="borrarMeta(${m.id})">×</button>
      </div>
      <div class="goal-bar-wrap"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}
function depositarMeta(){
  const id=parseInt(document.getElementById("dep-meta").value);
  const monto=parseFloat(document.getElementById("dep-monto").value)||0;
  if(monto<=0){showToast("Ingresá un monto");return;}
  const m=metas.find(x=>x.id===id);
  if(m){m.actual=Math.round((m.actual+monto)*100)/100;save();showToast("Depósito registrado ✓");renderMetas();document.getElementById("dep-monto").value="";}
}
function borrarMeta(id){metas=metas.filter(m=>m.id!==id);save();renderMetas();}

