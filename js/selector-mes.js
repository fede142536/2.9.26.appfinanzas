// ═══════════════════════════════════════════
// SELECTOR DE MES COMPACTO
// ═══════════════════════════════════════════
// El selector nativo de <input type="month"> muestra "noviembre de 2026" y en el celular se corta o ocupa media pantalla. Acá cada
// <input type="month"> se reemplaza a la vista por dos listas chicas: mes abreviado (ene, feb… dic) y año. El input original queda
// oculto y sigue siendo la fuente de verdad: todo el código que lee `.value` ("2026-11"), lo asigna o escucha `change` anda igual.
// Si el campo es opcional se puede elegir "—" (vacío). Funciona también con los que se crean después (hojas, formularios).

const MESES_CORTOS=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// Pura. "2026-11" → {a:2026, m:11}; cualquier otra cosa → null.
function partesDeMes(v){
  const x=/^(\d{4})-(\d{2})$/.exec(String(v||""));
  if(!x) return null;
  const m=Number(x[2]);
  return m>=1 && m<=12 ? {a:Number(x[1]), m} : null;
}
// Pura. "2026-11" → "nov 2026" ("" si no es un mes).
function etiquetaMesCorta(v){
  const p=partesDeMes(v);
  return p ? `${MESES_CORTOS[p.m-1]} ${p.a}` : "";
}
// Pura. Los años que se ofrecen: unos atrás y unos adelante de hoy, y siempre el que ya tiene el campo.
function aniosDelSelector(valorActual, hoyAnio){
  const p=partesDeMes(valorActual);
  const desde=Math.min(hoyAnio-5, p?p.a:hoyAnio), hasta=Math.max(hoyAnio+8, p?p.a:hoyAnio);
  const out=[]; for(let a=desde;a<=hasta;a++) out.push(a);
  return out;
}

const SELECTOR_MES_ATTR="data-mes-corto";
function mejorarSelectorMes(input){
  if(!input || input.hasAttribute(SELECTOR_MES_ATTR) || input.type!=="month") return null;
  input.setAttribute(SELECTOR_MES_ATTR,"1");
  const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  const etiqueta=input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
  const nombre=etiqueta ? etiqueta.textContent.trim() : "";
  const wrap=document.createElement("div"); wrap.className="mes-corto";
  const selMes=document.createElement("select"), selAnio=document.createElement("select");
  selMes.className=selAnio.className="form-select";
  selMes.setAttribute("aria-label", (nombre?nombre+": ":"")+"mes"); selAnio.setAttribute("aria-label", (nombre?nombre+": ":"")+"año");
  selMes.innerHTML=`<option value="">—</option>`+MESES_CORTOS.map((n,i)=>`<option value="${String(i+1).padStart(2,"0")}">${n}</option>`).join("");
  wrap.append(selMes, selAnio);
  const hoyAnio=new Date().getFullYear();
  const pintar=()=>{
    const v=desc.get.call(input), p=partesDeMes(v);
    const anios=aniosDelSelector(v, hoyAnio);
    selAnio.innerHTML=anios.map(a=>`<option value="${a}">${a}</option>`).join("");
    selMes.value=p ? String(p.m).padStart(2,"0") : "";
    selAnio.value=String(p ? p.a : (Number(selAnio.dataset.ultimo)||hoyAnio));
  };
  const alElegir=()=>{
    selAnio.dataset.ultimo=selAnio.value;
    desc.set.call(input, selMes.value ? `${selAnio.value}-${selMes.value}` : "");
    input.dispatchEvent(new Event("input",{bubbles:true}));
    input.dispatchEvent(new Event("change",{bubbles:true}));
  };
  selMes.addEventListener("change", alElegir); selAnio.addEventListener("change", alElegir);
  // Quien asigna `.value` por código (resetForm, editores, filtros) también tiene que ver el cambio en pantalla.
  Object.defineProperty(input,"value",{configurable:true, get(){ return desc.get.call(this); }, set(v){ desc.set.call(this,v); pintar(); }});
  input.style.display="none"; input.setAttribute("aria-hidden","true"); input.tabIndex=-1;
  input.insertAdjacentElement("afterend", wrap);
  pintar();
  return wrap;
}
function mejorarSelectoresDeMes(raiz){
  (raiz||document).querySelectorAll('input[type="month"]').forEach(mejorarSelectorMes);
}
mejorarSelectoresDeMes(document);
// Lo que se crea después (hojas de edición, formularios armados con innerHTML).
if(typeof MutationObserver!=="undefined" && document.body){
  new MutationObserver(muts=>{
    muts.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType!==1) return;
      if(n.matches && n.matches('input[type="month"]')) mejorarSelectorMes(n);
      else if(n.querySelectorAll) mejorarSelectoresDeMes(n);
    }));
  }).observe(document.body,{childList:true, subtree:true});
}
