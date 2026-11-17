// ═══════════════════════════════════════════
// MANUAL DE USO (Configuración › Ayuda y manual)
// ═══════════════════════════════════════════
// Preguntas frecuentes agrupadas por tema, con buscador. Cada respuesta es texto plano: `r` es el párrafo, `pasos` (opcional) los pasos numerados y `ir`
// (opcional) un botón que lleva a esa pantalla (MANUAL_IR). **así** se ve en negrita. Si cambia dónde está algo en la app, se corrige ACÁ.
const MANUAL=[
  {id:"inicio", icono:"🚀", titulo:"Primeros pasos", preguntas:[
    {p:"¿Cómo me muevo por la app?", r:"Con el menú **☰** (arriba a la izquierda): Movimientos, Tarjetas, Inversiones, Dashboard, Ahorros, Importar, Cerrar el mes y Configuración. El botón **+** de abajo a la derecha abre **Cargar** desde cualquier pantalla. En Movimientos, Tarjetas e Inversiones, las flechas **‹ ›** de arriba cambian de mes."},
    {p:"¿Dónde quedan guardados mis datos?", r:"En tu celular: la app no los manda a ningún servidor. Por eso conviene tener copias de seguridad (ver «Seguridad y copias»). Si activás el PIN, además quedan cifrados."},
    {p:"¿Qué es el «Balance del mes»?", r:"Es lo que te quedó disponible: **ingresos − gastos − lo que mandaste a ahorro**, más lo que sacaste de tus ahorros y quedó a mano. Las inversiones no se restan como gasto: del balance solo cuenta su **resultado** (ganancia o pérdida)."},
    {p:"¿Qué son las tarjetas de colores de Movimientos?", r:"Cada una resume una parte del mes (Ingresos, Gastos, Ahorrado, Frecuentes por pagar, Inversiones…). **Tocala** y la lista de abajo muestra solo esos movimientos; «Ver todos» vuelve a la lista completa. La de Inversiones abre el detalle de cada instrumento."}
  ]},
  {id:"cargar", icono:"✏️", titulo:"Cargar movimientos", preguntas:[
    {p:"¿Cómo cargo un gasto?", pasos:["Tocá **+** y elegí **↑ Gasto**.","Escribí el importe (ARS o USD).","Elegí categoría, subcategoría y cuenta.","Elegí la fecha (Hoy, Ayer, -2d, -7d o el calendario) y, si querés, una nota.","Tocá **Guardar gasto**."], ir:"cargarGasto"},
    {p:"¿Cómo cargo un ingreso (por ejemplo, el sueldo)?", r:"Igual que un gasto pero con **↓ Ingreso**. Si se repite todos los meses, tildá **Ingreso frecuente**: cada mes aparece en «Por cobrar» y lo marcás cobrado.", ir:"cargarIngreso"},
    {p:"¿Cómo cargo un gasto que se repite todos los meses (alquiler, servicios)?", r:"Cargalo como gasto y tildá **Gasto frecuente**; podés poner el día en que vence. Desde ese mes aparece solo en cada mes, en «Frecuentes por pagar», y lo marcás **pagado** tocando la etiqueta de la fila. Si sube de precio, editalo y usá **Registrar aumento** (pestaña Monto)."},
    {p:"¿Cómo cargo una compra con tarjeta en cuotas?", pasos:["Tocá **+** y elegí **▣ Tarj.**","Poné el importe total, la descripción, la tarjeta, la categoría y la cuenta.","Elegí las cuotas totales y el mes de la 1ª cuota.","Guardá: la app reparte cada cuota en su mes."], ir:"cargarTarjeta"},
    {p:"¿Y una suscripción con tarjeta (Netflix, Spotify, seguros)?", r:"En **▣ Tarj.** tildá **Gasto frecuente (mensual fijo)**: elegís mes de inicio, fin opcional y día de vencimiento. Si un mes cambia de tarjeta, editalo y usá la pestaña **Tarjeta**."},
    {p:"¿Cómo cargo una compra o venta de dólares?", r:"En **⇄ Cambio** elegí **Compro dólares** o **Vendo dólares**, poné los pesos, los dólares y el tipo de cambio. Si los dólares van a tu fondo de ahorro, tildá **Guardarlos en el fondo de ahorro**; si salen de ahí, **Sale de mis ahorros**.", ir:"cargarCambio"},
    {p:"¿Cómo mando plata a mi ahorro?", r:"Cargá un gasto con la categoría de tu fondo (por ejemplo, Fondo de Retiro) y tildá **Es un ahorro**. Suma al fondo y se descuenta de lo disponible del mes, porque esa plata ya no está a mano."},
    {p:"¿Cómo saco plata de mis ahorros?", r:"Cargá un gasto con la categoría del fondo y tildá **Sale de mis ahorros**. Si la usaste para gastar, dejalo así. Si solo la cambiaste de bolsillo (por ejemplo, la pasaste a una cuenta), tildá también **Es un traspaso**."},
    {p:"Pagué algo compartido y me van a devolver una parte, ¿cómo lo cargo?", r:"En el gasto, activá **Monto recuperable** y poné cuánto te devuelven. Aparece en la tarjeta «A recuperar» hasta que lo cobres."},
    {p:"¿Puedo cargar más rápido?", r:"Sí: en **Carga rápida** (arriba de Cargar) escribí algo como «nafta 15000 visa ayer» o tocá el 🎤 para dictarlo. La app completa importe, categoría, cuenta o tarjeta y fecha; lo revisás antes de guardar."},
    {p:"¿Cómo repito un movimiento (por ejemplo, el mismo gasto de la semana pasada)?", r:"Deslizá la fila hacia la **derecha** y tocá **🔁 Repetir**, o abrí el editor y usá «Repetir este movimiento». Se carga con la fecha de hoy."},
    {p:"Necesito una cuenta, tarjeta o categoría nueva", r:"Al lado de cada campo está **+ Nueva** (o + Cta / + Cat.). También podés crear, renombrar o quitar cuentas, tarjetas y categorías en Configuración › **Cuentas, tarjetas y categorías**."}
  ]},
  {id:"editar", icono:"🛠", titulo:"Editar, borrar y buscar", preguntas:[
    {p:"¿Cómo edito o borro un movimiento?", r:"Deslizá la fila hacia la **derecha** para **✎ Editar** (o Repetir) y hacia la **izquierda** para **🗑 Eliminar** (se toca dos veces para confirmar). Después de borrar aparece **Deshacer**, y lo borrado queda en la **Papelera** (Configuración › Exportar y mis datos)."},
    {p:"El editor tiene pestañas, ¿qué hay en cada una?", r:"Para no recorrer un formulario largo, el editor se ve por partes: **Datos** (importe, categoría, nota…), **Fecha y cuenta**, **Opciones** (ahorro, traspaso, frecuente…) y **Todo**. En los frecuentes: Datos, **Monto** (aumentos) y **Fechas** (inicio, fin, baja). Guardar lee todo, esté o no a la vista; si falta un dato, te lleva a su pestaña."},
    {p:"¿Cómo busco un movimiento?", r:"En Movimientos, la **🔍** busca por nota, categoría, cuenta, ticker o tarjeta. El **📅** filtra por un día, un rango, un mes o un año. Abajo de las tarjetas podés filtrar por **cuenta**, y arriba por **Todos, Gastos, Ingresos o Tarjetas**."},
    {p:"¿Cómo marco que ya pagué un gasto frecuente?", r:"En la fila del frecuente tocá la etiqueta de pago: queda **✓ Pagado**. También sirve para los frecuentes de tarjeta que pagás a mano. «Frecuentes por pagar» muestra lo que falta."}
  ]},
  {id:"inversiones", icono:"📈", titulo:"Inversiones", preguntas:[
    {p:"¿Cómo cargo una compra de una inversión (CEDEAR, acción, fondo)?", pasos:["Tocá **+** y elegí **◈ Inv.**","Elegí la categoría (FCI, CEDEARs, Acciones, Bonos…) y la operación (Compra o Suscripción).","Escribí el importe, el ticker y, si querés llevar tu cartera, la **cantidad** (nominales o cuotapartes).","Si es una compra de tu fondo de ahorro, tildá **Es de mi fondo de ahorro**: crea el depósito al fondo solo (se tilda sola si el ticker ya va a un fondo).","Guardá."], ir:"cargarInversion"},
    {p:"¿Cómo cargo una venta o un rescate?", r:"Igual, con la operación **Venta** o **Rescate**. Si la plata sale de tu fondo de ahorro, tildá **Sale de mis ahorros**: del fondo sale el capital y lo que ganaste cuenta como ganancia."},
    {p:"¿Cómo calcula la app si gané o perdí?", r:"Con la regla **«primero vuelve el capital»**: una venta devuelve lo que pusiste en ese ticker y lo que sobra es ganancia. Si rescatás un fondo y lo volvés a suscribir en el mismo mes, la diferencia es ganancia. Un **cupón** o un **dividendo** es ganancia entera. Una operación **MEP** (comprar o vender dólares con bonos) no es ganancia ni pérdida: tildá «Operación MEP»."},
    {p:"¿Dónde veo cómo rindió cada instrumento?", r:"En Movimientos, tocá la tarjeta **Inversiones**: ves cada instrumento con lo que pusiste, lo que cobraste y su resultado. Arriba elegís **Este mes** o **Todo el año**.", ir:"movimientos"},
    {p:"¿Cómo veo mi cartera como en el broker (nominales, precio promedio, rendimiento)?", r:"En Inversiones › **Cartera**, tocá un ticker. Con la **cantidad** de cada compra y venta ves nominales, precio promedio y valor inicial; si cargás el **precio de hoy**, también el valor actual, el rendimiento, los días de tenencia y la TNA.", ir:"cartera"},
    {p:"Tengo compras viejas sin cantidad, ¿las cargo una por una?", r:"No: en Cartera, la revisión o la hoja del ticker tienen **Completar cantidades**, una lista con todas las que faltan (sugiere la cantidad cuando la nota dice, por ejemplo, «Spy x 2»)."},
    {p:"El ticker se desdobló (split), ¿qué hago?", r:"En la hoja del ticker (Inversiones › Cartera › tocá el ticker), abrí **Desdoblamiento (split)** y poné el factor (por ejemplo 3) y la fecha. Las cantidades de antes se multiplican solas."},
    {p:"¿Qué es la «Revisión de tus inversiones»?", r:"Busca lo que puede hacer que tus números no sean reales: ventas contadas casi enteras como ganancia (falta la compra), compras cargadas dos veces sin vincular, nominales que no cierran y tickers escritos distinto. Cada cosa trae su arreglo, o «Está bien así». Aparece en Cartera y como aviso en el Dashboard.", ir:"revision"}
  ]},
  {id:"ahorros", icono:"🏦", titulo:"Ahorros y metas", preguntas:[
    {p:"¿Dónde veo cuánto tengo ahorrado?", r:"En **Ahorros**: arriba el disponible del fondo (en pesos y en dólares) y abajo la evolución (**Acumulado**, **Por mes** o **Por categoría**). Tocá una categoría para ver sus depósitos y retiros.", ir:"ahorros"},
    {p:"Mi fondo está invertido y hoy vale más, ¿cómo lo registro?", r:"En Ahorros › Por categoría, tocá el fondo y cargá su **Valor actual** (lo que ves en tu broker). La app muestra la ganancia **sin realizar**. No cambia tu balance: la ganancia cuenta cuando vendés."},
    {p:"¿Cómo creo una meta de ahorro?", r:"En Ahorros › **Mis metas** › **Nueva meta**: nombre, monto objetivo y, si querés, fecha. Si la atás a un fondo (🔗), avanza sola con su saldo."},
    {p:"¿Para qué sirve «Conciliar con el broker»?", r:"Compara tus compras y ventas de CEDEARs con los movimientos de tu fondo y te muestra lo que no coincide (montos, fechas o cantidades)."}
  ]},
  {id:"tarjetas", icono:"💳", titulo:"Tarjetas, Dashboard y cierre", preguntas:[
    {p:"¿Qué muestra la pantalla Tarjetas?", r:"El resumen de cada tarjeta en el mes (cuotas y gastos fijos), los vencimientos y cuánto va por tarjeta. Con **Pagar resumen** registrás el pago del resumen.", ir:"tarjetas"},
    {p:"¿Qué tengo en el Dashboard?", r:"**Resumen** del mes con avisos («Para tener en cuenta»), ingresos y gastos, gastos por categoría y saldo por cuenta; y **Año completo** para ver los doce meses.", ir:"dashboard"},
    {p:"¿Qué es «Cerrar el mes»?", r:"Un repaso guiado del mes (en el menú ☰) con lo que quedó pendiente: gastos fijos y resúmenes de tarjeta sin marcar como pagados, ingresos por cobrar, movimientos sin cuenta y vencimientos. Lo resolvés desde ahí antes de pasar al mes siguiente."},
    {p:"¿Puedo ponerme un presupuesto por categoría?", r:"Sí, en Configuración › **Cuentas, tarjetas y categorías** › Presupuestos. En Movimientos, solapa **Gastos**, ves cuánto llevás gastado de cada presupuesto en el mes."}
  ]},
  {id:"seguridad", icono:"🔐", titulo:"Seguridad y copias", preguntas:[
    {p:"¿Cómo protejo la app con PIN o huella?", r:"En Configuración › General › **Seguridad**: activás el PIN y, si tu celular lo permite, la huella. También elegís cuándo se bloquea sola (al salir de la app o después de un rato)."},
    {p:"¿Cómo hago una copia de seguridad?", r:"En Configuración › **Copias y Google**: descargá una **copia en archivo**, mirá las **copias automáticas** que guarda el celular o activá la **copia diaria en Google Drive**. Si tenés PIN, las copias salen cifradas con él."},
    {p:"¿Cómo recupero mis datos de una copia?", r:"En **Importar** › Restaurar backup JSON, elegí el archivo. Si está cifrado, te pide el PIN o código de cuando se hizo.", ir:"importar"},
    {p:"¿Cómo exporto mis movimientos a Excel o PDF?", r:"En Configuración › **Exportar y mis datos**: Excel (movimientos, inversiones y tarjetas, con ticker y cantidad), PDF del período y un CSV para herramientas de análisis."},
    {p:"¿Puedo importar movimientos desde un Excel?", r:"Sí, en **Importar** › Importar desde Excel. La app reconoce las columnas y te muestra lo que va a cargar antes de guardarlo.", ir:"importar"}
  ]},
  {id:"ayuda", icono:"✨", titulo:"Novedades y problemas comunes", preguntas:[
    {p:"¿Dónde veo qué hay de nuevo?", r:"Al abrir una versión nueva aparece una hoja con las **novedades** y un botón «Ver» que te lleva a cada una. Para verlas otra vez: Configuración › General › Versión de la app › **Ver novedades**.", ir:"novedades"},
    {p:"No veo un cambio que me dijeron que ya está", r:"Puede que el celular tenga la versión anterior guardada. Andá a Configuración › General › Versión de la app y tocá **Forzar actualización**; después cerrá la app y abrila de nuevo."},
    {p:"La huella dejó de funcionar", r:"Entrá con tu PIN: la app te ofrece reactivarla. En Configuración › General › Seguridad figura el motivo por el que se desactivó."},
    {p:"Un resultado de inversión me parece demasiado alto", r:"Casi siempre falta la compra que respalda una venta. Abrí la **Revisión de tus inversiones**: te muestra cuál es y cómo arreglarlo.", ir:"revision"},
    {p:"Cargué algo dos veces o borré algo sin querer", r:"Después de borrar o cambiar algo aparece **Deshacer** unos segundos. Si ya pasó, lo borrado está en la **Papelera** (Configuración › Exportar y mis datos) y se puede recuperar."},
    {p:"El saldo de mi fondo no coincide con lo que veo en el broker", r:"El fondo cuenta lo que pusiste; el broker, lo que vale hoy. La diferencia es ganancia (o pérdida) sin realizar: cargá el **Valor actual** del fondo en Ahorros para verla."}
  ]}
];
const MANUAL_IR={
  ...((typeof NOVEDADES_IR!=="undefined") ? NOVEDADES_IR : {}),
  cargarGasto:()=>{ irAPagina("cargar"); if(typeof setTipo==="function") setTipo("Gasto"); },
  cargarIngreso:()=>{ irAPagina("cargar"); if(typeof setTipo==="function") setTipo("Ingreso"); },
  cargarTarjeta:()=>{ irAPagina("cargar"); if(typeof setTipo==="function") setTipo("Tarjeta"); },
  cargarCambio:()=>{ irAPagina("cargar"); if(typeof setTipo==="function") setTipo("Cambio"); },
  tarjetas:()=>irAPagina("tc"),
  dashboard:()=>irAPagina("dash"),
  importar:()=>irAPagina("import"),
  novedades:()=>verTodasLasNovedades()
};
// **texto** → negrita, sobre texto ya escapado.
const manualTexto=t=>escapeHtml(t).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
// Pura. Las preguntas que contienen todas las palabras buscadas (en la pregunta o la respuesta, sin importar tildes ni mayúsculas), agrupadas por tema.
function buscarEnManual(texto, manual){
  const palabras=normalizarTexto(texto||"").split(/\s+/).filter(w=>w.length>1);
  return (manual||MANUAL).map(sec=>({...sec, preguntas:sec.preguntas.filter(q=>{
    if(!palabras.length) return true;
    const todo=normalizarTexto([q.p, q.r||"", ...(q.pasos||[])].join(" ").replace(/\*\*/g,""));
    return palabras.every(w=>todo.includes(w));
  })})).filter(sec=>sec.preguntas.length);
}
function renderManual(texto){
  const cont=document.getElementById("manual-contenido"); if(!cont) return;
  const secs=buscarEnManual(texto);
  const buscando=!!String(texto||"").trim();
  if(!secs.length){ cont.innerHTML=`<p class="txt-sm txt-muted" style="padding:12px 4px">No encontré nada con «${escapeHtml(texto)}». Probá con otra palabra (por ejemplo: cuotas, ahorro, dólares, copia).</p>`; return; }
  cont.innerHTML=secs.map(sec=>`<details class="man-sec"${buscando?" open":""}>
    <summary><span aria-hidden="true">${sec.icono}</span> ${escapeHtml(sec.titulo)} <span class="man-n">${sec.preguntas.length}</span></summary>
    ${sec.preguntas.map(q=>`<details class="man-q"${buscando && secs.reduce((n,s)=>n+s.preguntas.length,0)<=3?" open":""}>
      <summary>${manualTexto(q.p)}</summary>
      <div class="man-r">
        ${q.r?`<p>${manualTexto(q.r)}</p>`:""}
        ${q.pasos?`<ol>${q.pasos.map(x=>`<li>${manualTexto(x)}</li>`).join("")}</ol>`:""}
        ${q.ir && MANUAL_IR[q.ir]?`<button type="button" class="btn-sm" onclick="irDesdeManual(${attrJS(q.ir)})">Ir ahí</button>`:""}
      </div>
    </details>`).join("")}
  </details>`).join("");
}
function irDesdeManual(clave){ try{ MANUAL_IR[clave](); }catch(e){ console.warn("No se pudo abrir desde el manual:", e); } }
// Abre Configuración con el manual desplegado y el buscador listo.
function abrirManual(){
  irAPagina("config");
  const sec=document.getElementById("cfg-sec-ayuda"); if(sec) sec.open=true;
  renderManual(document.getElementById("manual-buscar")?.value||"");
  setTimeout(()=>{ if(sec && sec.scrollIntoView) sec.scrollIntoView({block:"start"}); }, 50);
}
document.addEventListener("DOMContentLoaded", ()=>renderManual(""));
