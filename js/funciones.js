// ═══════════════════════════════════════════
// FUNCIONES QUE SE PUEDEN OCULTAR
// ═══════════════════════════════════════════
// La app fue sumando herramientas que no todos usan. Cada una de estas se puede ocultar desde
// Configuración › General › Funciones de la app: desaparece de la pantalla (no se borra nada) y
// se vuelve a mostrar con el mismo interruptor. Las más avanzadas vienen ocultas, salvo que ya
// las estés usando.
//
// Cómo se oculta: el <body> lleva la clase "sin-f-<id>" y styles.css esconde todo lo que tenga
// data-funcion="<id>". Lo que no es un elemento (un aviso que se arma por código) pregunta
// funcionActiva(id). Es una preferencia de vista: localStorage llano.

const FUNCIONES_KEY="ffunciones";
const FUNCIONES=[
  {id:"google", ico:"☁️", titulo:"Google: calendario y copia en Drive", desc:"Vencimientos en tu calendario y copia diaria en Drive (pide configurar una cuenta de Google).",
    def:()=>{ try{ return (typeof gcalActivo==="function" && gcalActivo()) || localStorage.getItem("fdrivebk")==="1"; }catch(e){ return false; } }},
  {id:"bi", ico:"📊", titulo:"Exportar para BI (CSV)", desc:"Un archivo para Power BI, Looker Studio o Python. Con el Excel alcanza para la mayoría.", def:()=>false},
  {id:"voz", ico:"🎤", titulo:"Carga por voz", desc:"El micrófono de la carga rápida, para dictar un movimiento.", def:()=>false},
  {id:"anual", ico:"🎉", titulo:"Resumen anual e informe de otro período", desc:"El aviso de fin de año en Movimientos y «Otro período» en el año completo. Compartir el año queda.", def:()=>false},
  {id:"alertas", ico:"💡", titulo:"«Para tener en cuenta» en el año completo", desc:"Avisos que ya ves en Movimientos (gastos que se repiten, aumentos, vencimientos).", def:()=>false},
  {id:"reparar", ico:"🧰", titulo:"Reparar datos (en Importar)", desc:"Duplicados, montos raros, borrar por fechas, dólares y traspasos sin completar.", def:()=>true},
  {id:"recuperable", ico:"🤝", titulo:"Gastos compartidos", desc:"«Monto recuperable» al cargar un gasto: lo que te devuelven después.", def:()=>true},
  {id:"metas", ico:"🎯", titulo:"Metas de ahorro", desc:"Las metas arriba de Ahorros.", def:()=>true},
  {id:"aumentos", ico:"📈", titulo:"Avisos de aumentos", desc:"Gastos fijos que suelen actualizarse o que subieron.", def:()=>true},
  {id:"simulador", ico:"🧮", titulo:"Simulador de cuotas", desc:"«¿Me lo banco?» al cargar una compra en cuotas.", def:()=>true},
  {id:"cambio", ico:"⇄", titulo:"Cambio de moneda", desc:"El tipo «Cambio» en Cargar, para comprar o vender dólares.", def:()=>true}
];

function leerFuncionesGuardadas(){
  try{ const o=JSON.parse(localStorage.getItem(FUNCIONES_KEY)||"{}"); return o && typeof o==="object" && !Array.isArray(o) ? o : {}; }
  catch(e){ return {}; }
}
function funcionActiva(id){
  const f=FUNCIONES.find(x=>x.id===id);
  if(!f) return true;
  const g=leerFuncionesGuardadas();
  if(typeof g[id]==="boolean") return g[id];
  try{ return !!f.def(); }catch(e){ return true; }
}
function aplicarFunciones(){
  if(typeof document==="undefined" || !document.body) return;
  FUNCIONES.forEach(f=>document.body.classList.toggle("sin-f-"+f.id, !funcionActiva(f.id)));
}
function setFuncion(id, on){
  if(!FUNCIONES.some(f=>f.id===id)) return;
  const g=leerFuncionesGuardadas(); g[id]=!!on;
  guardarPreferencia(FUNCIONES_KEY, JSON.stringify(g));
  aplicarFunciones();
  renderFuncionesConfig();
  // Lo que se arma por código (avisos, el año completo) se vuelve a dibujar con la elección nueva.
  if(typeof refrescarVistas==="function") refrescarVistas();
  if(typeof renderDash==="function"){ try{ renderDash(); }catch(e){ /* el dashboard puede no estar dibujado */ } }
  showToast(on ? "Se muestra de nuevo ✓" : "Oculta: la volvés a mostrar desde acá");
}
function renderFuncionesConfig(){
  const el=document.getElementById("funciones-lista");
  if(!el) return;
  el.innerHTML=FUNCIONES.map(f=>{
    const on=funcionActiva(f.id);
    return `<label class="opt-row" style="--chk:var(--accent)">
      <span class="opt-icon">${f.ico}</span>
      <span class="opt-text"><span class="opt-title">${escapeHtml(f.titulo)}</span><span class="opt-sub">${escapeHtml(f.desc)}</span></span>
      <input type="checkbox" class="chk-custom" ${on?"checked":""} aria-label="Mostrar ${escapeHtml(f.titulo)}" onchange="setFuncion('${f.id}', this.checked)">
    </label>`;
  }).join("");
}

aplicarFunciones();

// "Reparar datos" (Importar): un solo desplegable. El resumen avisa si hay algo para completar, y en ese caso se abre solo.
function resumenRepararDatos(){
  const d=document.getElementById("imp-reparar"), sub=document.getElementById("imp-reparar-sub");
  if(!d || !sub) return;
  const visible=id=>{ const e=document.getElementById(id); return !!e && e.style.display!=="none"; };
  const pend=[visible("card-traspasos") ? "plata que quizás no gastaste" : "", visible("card-migrar-cambios") ? "compras de dólares sin completar" : ""].filter(Boolean);
  sub.textContent=pend.length ? `Para revisar: ${pend.join(" y ")}` : "Duplicados, montos raros, borrar por fechas";
  sub.style.color=pend.length ? "var(--warning)" : "";
  if(pend.length) d.open=true;
}
