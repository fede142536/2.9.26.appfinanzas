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
// `grupo`: dónde está, para ordenar la lista. `def`: si arranca visible (las avanzadas, ocultas).
const FUNCIONES_GRUPOS=["Cargar","Movimientos","Dashboard y Ahorros","Avisos","Configuración y herramientas"];
const FUNCIONES=[
  // Cargar
  {id:"cargarapida", grupo:"Cargar", ico:"⚡", titulo:"Carga rápida", desc:"Escribir «nafta 15000 visa ayer» y que la app complete el formulario.", def:()=>true},
  {id:"voz", grupo:"Cargar", ico:"🎤", titulo:"Carga por voz", desc:"El micrófono de la carga rápida, para dictar un movimiento.", def:()=>false},
  {id:"reglas", grupo:"Cargar", ico:"🪄", titulo:"Reglas automáticas", desc:"La categoría que se pone sola según la nota. Ocultas, dejan de aplicarse.", def:()=>true},
  {id:"recuperable", grupo:"Cargar", ico:"🤝", titulo:"Gastos compartidos", desc:"«Monto recuperable» al cargar un gasto: lo que te devuelven después.", def:()=>true},
  {id:"simulador", grupo:"Cargar", ico:"🧮", titulo:"Simulador de cuotas", desc:"«¿Me lo banco?» al cargar una compra en cuotas.", def:()=>true},
  {id:"cambio", grupo:"Cargar", ico:"⇄", titulo:"Cambio de moneda", desc:"El tipo «Cambio» en Cargar, para comprar o vender dólares.", def:()=>true},
  // Movimientos
  {id:"findemes", grupo:"Movimientos", ico:"🔮", titulo:"Fin de mes", desc:"La estimación de con cuánto terminás el mes.", def:()=>true},
  {id:"presupuestos", grupo:"Movimientos", ico:"📊", titulo:"Presupuestos", desc:"Topes por categoría: el resumen en Gastos y su bloque en Configuración.", def:()=>true},
  {id:"vencimientos", grupo:"Movimientos", ico:"🗓", titulo:"Vencimientos", desc:"La franja de lo que vence, el aviso de lo vencido al abrir y su ajuste en Configuración.", def:()=>true},
  {id:"cierre", grupo:"Movimientos", ico:"✅", titulo:"Cerrar el mes", desc:"El repaso guiado del mes: su aviso y su lugar en «Más».", def:()=>true},
  {id:"anual", grupo:"Movimientos", ico:"🎉", titulo:"Resumen anual e informe de otro período", desc:"El aviso de fin de año y «Otro período» en el año completo. Compartir el año queda.", def:()=>false},
  // Dashboard y Ahorros
  {id:"patrimonio", grupo:"Dashboard y Ahorros", ico:"💎", titulo:"Tu patrimonio", desc:"La tarjeta de arriba del Dashboard con todo lo que tenés.", def:()=>true},
  {id:"usd", grupo:"Dashboard y Ahorros", ico:"💵", titulo:"Dólares del año", desc:"La tarjeta de lo que moviste en dólares, en el año completo.", def:()=>true},
  {id:"alertas", grupo:"Dashboard y Ahorros", ico:"💡", titulo:"«Para tener en cuenta»", desc:"Avisos del año completo que ya ves en Movimientos.", def:()=>false},
  {id:"metas", grupo:"Dashboard y Ahorros", ico:"🎯", titulo:"Metas de ahorro", desc:"Las metas arriba de Ahorros.", def:()=>true},
  // Avisos
  {id:"repetidos", grupo:"Avisos", ico:"🔁", titulo:"Gastos que se repiten", desc:"Te ofrece pasar a frecuente lo que cargás todos los meses.", def:()=>true},
  {id:"aumentos", grupo:"Avisos", ico:"📈", titulo:"Avisos de aumentos", desc:"Gastos fijos que suelen actualizarse o que subieron.", def:()=>true},
  {id:"novedades", grupo:"Avisos", ico:"✨", titulo:"Novedades al abrir", desc:"La hoja con lo nuevo de cada versión. Siempre las podés ver desde «Más».", def:()=>true},
  // Configuración y herramientas
  {id:"inflacion", grupo:"Configuración y herramientas", ico:"📉", titulo:"Inflación", desc:"La serie del INDEC (y su actualización sola) para comparar en plata de hoy.", def:()=>true},
  {id:"reparar", grupo:"Configuración y herramientas", ico:"🧰", titulo:"Reparar datos (en Importar)", desc:"Duplicados, montos raros, borrar por fechas, dólares y traspasos sin completar.", def:()=>true},
  {id:"google", grupo:"Configuración y herramientas", ico:"☁️", titulo:"Google: calendario y copia en Drive", desc:"Vencimientos en tu calendario y copia diaria en Drive (pide configurar una cuenta de Google).",
    def:()=>{ try{ return (typeof gcalActivo==="function" && gcalActivo()) || localStorage.getItem("fdrivebk")==="1"; }catch(e){ return false; } }},
  {id:"bi", grupo:"Configuración y herramientas", ico:"🗃", titulo:"Exportar para BI (CSV)", desc:"Un archivo para Power BI, Looker Studio o Python. Con el Excel alcanza para la mayoría.", def:()=>false}
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
let funcionesGrupoAbierto=null;   // el grupo desplegado: se mantiene al tocar un interruptor
function renderFuncionesConfig(){
  const el=document.getElementById("funciones-lista");
  if(!el) return;
  const fila=f=>{
    const on=funcionActiva(f.id);
    return `<label class="opt-row" style="--chk:var(--accent)">
      <span class="opt-icon">${f.ico}</span>
      <span class="opt-text"><span class="opt-title">${escapeHtml(f.titulo)}</span><span class="opt-sub">${escapeHtml(f.desc)}</span></span>
      <input type="checkbox" class="chk-custom" ${on?"checked":""} aria-label="Mostrar ${escapeHtml(f.titulo)}" onchange="setFuncion('${f.id}', this.checked)">
    </label>`;
  };
  // Agrupadas por pantalla, cada grupo plegable (de a uno, con su flecha), con cuántas están a la vista.
  el.innerHTML=FUNCIONES_GRUPOS.map(g=>{
    const del=FUNCIONES.filter(f=>f.grupo===g);
    if(!del.length) return "";
    const vis=del.filter(f=>funcionActiva(f.id)).length;
    const abierto=funcionesGrupoAbierto===g;
    return `<details class="fun-grupo" data-grupo="${escapeHtml(g)}"${abierto?" open":""} ontoggle="if(this.open) funcionesGrupoAbierto=this.dataset.grupo; else if(funcionesGrupoAbierto===this.dataset.grupo) funcionesGrupoAbierto=null;">
      <summary class="fun-grupo-sum"><span>${escapeHtml(g)}</span><span class="fun-grupo-n">${vis} de ${del.length} visibles</span></summary>
      ${del.map(fila).join("")}
    </details>`;
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
