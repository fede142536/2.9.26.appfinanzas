// ═══════════════════════════════════════════
// DECIMALES CON COMA EN LOS CAMPOS NUMÉRICOS
// ═══════════════════════════════════════════
// Un <input type="number"> muestra el separador decimal según el idioma del navegador: en unos celulares sale coma y en otros punto, y
// el placeholder siempre sale con punto. En toda la app los decimales van con COMA. Cada <input type="number" inputmode="decimal">
// pasa a ser un campo de texto con teclado numérico que muestra y acepta coma (un punto tipeado se vuelve coma). Por dentro el campo
// sigue entregando y recibiendo el número con PUNTO ("22618.99"), así que el código que hace parseFloat(campo.value) o campo.value=n
// anda igual. Los campos de enteros (día, cuotas) no se tocan.

// Pura. Lo que se muestra: coma decimal, sin puntos de miles. "22618.99" → "22618,99"; "1.234,56" → "1234,56"; 5 → "5".
function decimalParaMostrar(v){
  if(v===null || v===undefined) return "";
  const s=String(v);
  return s.includes(",") ? s.replace(/\./g,"") : s.replace(".",",");
}
// Pura. Lo que lee el código: punto decimal. "22618,99" → "22618.99".
function decimalParaCodigo(v){ return String(v==null ? "" : v).replace(",","."); }
// Pura. Deja solo lo que puede tener un monto al tipear: dígitos, una sola coma (el punto se toma como coma) y un "-" inicial.
function limpiarDecimalTipeado(v){
  let s=String(v||"").replace(/\./g,",").replace(/[^\d,-]/g,"");
  const neg=s.startsWith("-");
  s=s.replace(/-/g,"");
  const i=s.indexOf(",");
  if(i>=0) s=s.slice(0,i+1)+s.slice(i+1).replace(/,/g,"");
  return (neg?"-":"")+s;
}

function mejorarCampoDecimal(input){
  if(!input || input.dataset.decimalComa || input.type!=="number" || input.getAttribute("inputmode")!=="decimal") return false;
  const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  const inicial=desc.get.call(input);
  input.dataset.decimalComa="1";
  input.type="text"; input.removeAttribute("step"); input.removeAttribute("min"); input.removeAttribute("max");
  input.setAttribute("autocomplete","off");
  const ph=input.getAttribute("placeholder");
  if(ph && /^-?\d+\.\d+$/.test(ph)) input.setAttribute("placeholder", decimalParaMostrar(ph));
  Object.defineProperty(input,"value",{configurable:true,
    get(){ return decimalParaCodigo(desc.get.call(this)); },
    set(v){ desc.set.call(this, decimalParaMostrar(v)); }});
  desc.set.call(input, decimalParaMostrar(inicial));
  input.addEventListener("input", ()=>{
    const crudo=desc.get.call(input), limpio=limpiarDecimalTipeado(crudo);
    if(limpio===crudo) return;
    const pos=input.selectionStart; desc.set.call(input, limpio);
    try{ const p=Math.max(0, (pos||limpio.length)-(crudo.length-limpio.length)); input.setSelectionRange(p,p); }catch(e){ /* sin cursor */ }
  });
  return true;
}
function mejorarCamposDecimales(raiz){
  (raiz||document).querySelectorAll('input[type="number"][inputmode="decimal"]').forEach(mejorarCampoDecimal);
}
mejorarCamposDecimales(document);
if(typeof MutationObserver!=="undefined" && document.body){
  new MutationObserver(muts=>{
    muts.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType!==1) return;
      if(n.matches && n.matches('input[type="number"][inputmode="decimal"]')) mejorarCampoDecimal(n);
      else if(n.querySelectorAll) mejorarCamposDecimales(n);
    }));
  }).observe(document.body,{childList:true, subtree:true});
}
