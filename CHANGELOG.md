# Changelog de Enola

Historial de cambios de la app, del más reciente al más viejo. Se genera solo desde el historial de git con `node scripts/generar-changelog.js`.

**Versión actual: v248**

## Lo más importante, por etapas

**Septiembre 2026 · Inversiones y balance honesto**
- Importador del resumen de Balanz, posición inicial por ticker, resultado de inversiones realizado y no realizado.
- Un solo balance coherente entre Movimientos y Dashboard; comprar dólares (MEP) deja de contarse como gasto o inversión doble.
- Gastos frecuentes: marcar pagados mes a mes; promedios mensuales en el Dashboard.

**Octubre 2026 · Rediseño y vencimientos**
- Rediseño de todas las pantallas (Cargar, Movimientos, Tarjetas, Ahorros, Dashboard, Inversiones), calculadora flotante y resumen con mosaicos.
- El Balance del mes pasa a mostrar lo disponible (descuenta lo ahorrado). Pagar el resumen de la tarjeta y "Frecuentes por pagar".
- Vencimientos de tarjetas y gastos frecuentes, con aviso configurable, archivo de calendario y sincronización con Google Calendar (nunca borra nada).
- Copia de seguridad: copias automáticas en el celular, envío a Drive/WhatsApp y copia diaria en Google Drive con restauración.
- Metas atadas a un fondo de ahorro, con fecha objetivo; conciliación de CEDEARs con el broker.
- Deshacer y papelera, filtro por cuenta, cuenta en lote, banco por tarjeta, ingresos frecuentes, resumen y cierre guiado del mes, huella o rostro.
- Carga rápida por texto y por voz (gasto, ingreso, inversión, tarjeta y cambio de moneda) con "Guardar ahora"; atajos en el ícono de la app.
- Detector de aumentos en gastos fijos, ventas que salen de ahorros, decimales con coma en toda la app, selector de mes compacto, calendario privado y botón "Cobrar" para el monto recuperable.

---

## 12 de noviembre de 2026

- **v248** · Un 'Rendimiento' de fondo vuelve a devolver capital primero (la v245 inflaba el balance de octubre en $200.000); cupón y dividendo siguen siendo ganancia entera
- **v247** · Un fondo rescatado y vuelto a suscribir en el mes suma la diferencia como resultado de inversión (BMMA y BCAHA), aunque quede capital viejo
- **v246** · La tarjeta Resultado inv. no desaparece cuando da $0 con rescates o rendimientos: sigue visible y explica por qué
- **v245** · El resultado de inversiones cuenta como ganancia entera los rendimientos, cupones y dividendos (antes se descontaban del capital)
- **v244** · Configuración muestra por qué se desactivó la huella (motivo y fecha)
- **v243** · La huella ya no se borra por una espera de intentos fallidos u otro motivo ajeno, y se ofrece reactivarla cuando se pierde
- **v242** · Un ingreso puede salir de un fondo de ahorro (Cargar y editor): crea el retiro ligado y baja el fondo sin duplicar el balance

## 6 de noviembre de 2026

- **v241** · Ingresos frecuentes de meses que vienen figuran en Por cobrar, y el editor permite volver frecuente un gasto o ingreso común
- **v240** · Frecuentes por pagar (solo gastos) separado de Frecuentes por cobrar (ingresos frecuentes)
- **v239** · Mosaicos de Movimientos interactivos (tocar uno filtra la lista a lo que lo compone)
- **v238** · Marcar pagado un gasto frecuente de tarjeta desde Movimientos (por mes)

## 5 de noviembre de 2026

- **v237** · Quitar de la lista las cuentas y tarjetas de fábrica que no usás (y volver a mostrarlas)
- **v236** · Menores de la revisión (burbuja del balance, menos tipográfico, mes sin año partido, cierre de mes vacío, títulos del editor y de la zona de peligro)
- **v235** · Editar (renombrar) las cuentas por defecto y las propias, con propagación a los movimientos
- **v234** · El aviso de cierre de Movimientos nombra y abre el mes actual
- **v233** · Fechas de CSV leídas como dd/mm/aaaa y Cerrar el mes abre el mes actual
- **v232** · Arreglos de la revisión independiente (tanda 2 y 3)
  Signo en la lectura de Evolución en dólares, frase del balance con déficit en ambos lados, porcentajes y multiplicadores en es-AR (cierre, informe, imágenes), reporte para imprimir sin cifras ni columnas partidas, confirmación al eliminar categoría, Cerrar de la hoja de categoría como las demás, mosaicos USD sin cortar y selector de emoji en 7+7.
- **v231** · Frase del balance con signo opuesto al promedio, porcentajes y abreviaturas con puntos de miles

## 4 de noviembre de 2026

- **v230** · AAA configuración (manager de categorías, controles de 44 px, Borrar todo, nombres accesibles)
- AAA config: objetivos táctiles de 44 reales, administrador de categorías rehecho con clases, botón de borrar sin blanco en oscuro
- **v229** · AAA tarjetas (A pagar, línea de tiempo, compras, resúmenes y hojas de pago y fechas)
- **v228** · AAA inversiones (estados vacíos, cartera, detalle, conciliación, gráfico, flecha de mes)
- AAA tarjetas: cifra que se ajusta, línea de tiempo con aro, filas sin cortes, resúmenes y hojas con 44 px, vacío con salida
- **v227** · AAA ahorros (gráfico, metas, hoja Depositar, selector de emoji, estados vacíos)
- **v226** · AAA importar (reporte para imprimir, vista previa, zonas de carga, hojas)
- AAA inversiones: resumen que escala, filas sin cortes, vacíos con guía, hoja de detalle y conciliación con acciones fijas, flecha del mes deshabilitada, gráfico legible
  - Resumen: cifra principal que se achica para entrar (12 dígitos), texto centrado, sin 'Pusiste —'.
  - Filas de Este mes y Cartera: ticker/categoría con '…', etiqueta y monto nunca cortados, fecha siempre visible; tocar la fila edita; role/teclado/nombre accesible.
  - Cartera: barras alineadas (texto de % de ancho fijo), cerradas con aria-expanded y 44 px.
  - Evolución: eje Y compacto con margen adaptable y color --muted, role=img + aria-label, pills 44 reales, vacío con guía.
  - Borrar con confirmación: ya no queda en '?' ni '×'.
  - #inv-mes-next: disabled + aria-disabled y oculta en el mes actual. …
- AAA ahorros: franja de saldo y gráficos con cifras largas, estado vacío, selector de emoji, hojas y áreas táctiles
- AAA importar: zonas de carga, historial, vista previa, aviso de arrastre, hojas con Cerrar fijo y reporte imprimible responsive
- **v225** · AAA tanda 2 parcial (dashboard y año completo, informe y cierre)
- AAA anio: Año completo, Informe, Cierre del mes e imágenes compartibles
  - Cifras que se achican o pasan a columna (adiós desborde 402>390 con importes de 12 dígitos), variación con color de buena/mala noticia
  - Año sin movimientos: año actual + invitación, sin 'undefined'
  - Barras por categoría de 44 px con tokens (oscuro), detalle del mes en grilla, gráfico con meses sin rotar
  - Presets del informe envuelven (desborde a 360), botones de 44, notas con ícono en columna
  - Imágenes: alto medido (el pie ya no pisa el último renglón), tipografía de la app, importes largos achicados, contraste AA
  - Tests: 3 nuevos y uno actualizado por el estado vacío
- AAA dashboard: selector de mes con tope deshabilitado, tarjetas accesibles (cabecera role=button, accion real), vacio con salida, ritmo y tokens
- **v224** · AAA tanda 1 (bloqueo, navegación, movimientos, cargar)
- Tests: el aviso del bloqueo con un solo botón cicla el foco (ajuste tras integrar navegación y bloqueo)
- Bloqueo (AAA r2): aviso de espera que persiste, teclado sin saltos, detalles apaisado y foco con error
- Navegación (AAA r2): cartel que no tapa menú ni hojas, perro que se repliega, hojas con nombre, íconos de trazo
- Cargar (AAA r2): ajuste de estilos pendiente
- Cargar (AAA ronda 2): decimales sin cortar, monto centrado y sin saltos, Tarjeta apilada, saldo del fondo, aria-pressed
  - ajustarTamanoMonto verifica contra el campo real (scrollWidth) y baja de a 1 px: 0 cortes en 1.008 casos (4 campos, 3 anchos, 2 temas, 1-14 dígitos, con y sin decimales).
  - Monto: min-width 44 centrado, altura fija 69 y sin transición (sin salto de layout), prefijo en la línea base, 'USD' a 8 px.
  - Franjas de cuota / tipo de cambio en una línea con fuente que se ajusta (con 12 dígitos partían la línea y movían el formulario).
  - Tarjeta/Categoría apiladas en celular; Fondo con nombre corto y el saldo en una línea de ayuda.
  - aria-pressed en tipo, moneda, fecha, sentido, cuotas y categorías de inversión; campos de fecha ocultos fuera del Tab. …
- Movimientos (AAA r2): hoja de fecha sin desborde, segmentado que no salta, vacíos con salida, swipe lado a lado y detalles
  - Hoja Buscar por fecha: columnas minmax(0,1fr) e inputs width:100% (Hasta desbordaba 14 px a 360); tabpanel/aria-controls/flechas; rango corto y SVG en vez de emoji.
  - Segmentado Todos/Gastos/Ingresos/Tarjetas arriba del resumen: ya no salta 252 px al tocar un filtro.
  - Fila: el badge baja de línea si no entra (el título dejaba de verse a 360 con 12 dígitos).
  - Vacíos: botón en las 5 variantes. Swipe: Editar/Repetir 66x60 lado a lado.
  - Editor: + de 44 px, Repetir sobre la barra, barra pegada al borde. Filas animan solo al cargar o cambiar de mes. Cifra de mosaico vuelve a 19 px.
- Bloqueo AAA: teclado físico, trampa de foco, espacio duro en la espera y apaisado
- Movimientos (AAA r1): entrada de filas en 300 ms con la curva del sistema
- Navegación: botones del aviso de error de 44 px
- Navegación: encabezado de una línea a 57 px (el ☰ de 44 cabe), aviso común no intercepta toques
- Movimientos (AAA r1): badges de fila siempre visibles, íconos de barra en trazo, aria de filtros y del rótulo del mes
  - El título de la fila se acorta con '…' pero DE AHORROS / TRASPASO / USD no se esconden.
  - Buscar y fecha: íconos SVG de trazo en vez de emoji a color (el calendario siempre decía 'July 17').
  - aria-pressed en el segmentado y los chips; el rótulo del mes es botón solo con filtro de fechas activo.
- Movimientos (AAA r1): cifras de 12 dígitos enteras, chips sin solape, franja de vencimientos, avisos, vacío con guía y hoja de fecha
  - Mosaicos y balance achican la cifra (cqw) en vez de cortarla con '…'; el título del mosaico baja a 2 líneas y las filas se alinean (subgrid).
  - Mosaicos neutros con superficie propia; chips de cuenta/categoría/tarjeta con caja real de 44 sin pisarse, nombre largo con '…' y cantidad legible en el chip activo.
  - Franja de vencimientos en dos líneas, botones tonales (el 'Cobrado' tenía texto marrón sobre verde, 1,9:1).
  - 'Ver' del aviso de cierre pasa a acción de texto; rótulo del filtro de fechas sin partirse; vacíos con guía y botón; búsqueda con contador.
  - Editor: barra Cancelar/Guardar fija al pie; hoja 'Buscar por fecha' con el segmentado de la pantalla. …
- Movimientos (AAA r1): editor con etiquetas ligadas a sus campos e interruptores en vez de casillas nativas
  Cada <label> del editor (movimiento y compra con tarjeta) lleva for=; el textarea de Nota
  ya tiene nombre accesible. Las casillas de ahorro, saldo de ahorros, traspaso y 'solo ese mes'
  usan .chk-custom como el resto de la app.
- Navegación: tests del foco en hojas, avisos y diálogos; registro de capas creadas después del arranque
- Bloqueo AAA: pantalla de PIN, bienvenida y clave de diálogos
  Teclas de 64x88 con borde visible, Entrar con relleno, error con role=alert + sacudón sin movimiento
  en prefers-reduced-motion + puntos rojos, cuenta atrás de la espera, safe areas, teclado virtual y
  pantallas bajas/apaisadas sin cortes, bienvenida sin saltos entre pasos, Mostrar con halo de 44.
- Navegación AAA: aviso abajo y legible en oscuro, perro que se esconde al bajar, foco atrapado en hojas/menú, diálogos y cartel rediseñados
  - Toast: abajo (no tapa la barra superior), superficie inversa legible en claro y oscuro, región status aria-live atómica, se vacía al irse, Deshacer de 44 px, pausa con foco/mouse, Esc.
  - FAB del perro: se esconde al bajar y vuelve al subir (no tapa importes ni Pagar); calculadora de Cargar sube a la barra de arriba.
  - Hojas: se cierran animadas, overscroll contenido, pantalla bloqueada detrás, 90dvh, swipe cierra por el cierre real de cada hoja.
  - Foco: trap robusto con Tab/Shift+Tab, foco entra y vuelve al botón que abrió, Esc; menú lateral con role/aria y oculto al Tab cuando está cerrado. …
- Cargar (AAA ronda 1): monto que entra entero, calculadora en el encabezado, categorías apiladas y chips de 44
  - Monto protagonista: label táctil, fuente que baja para que entren 12 dígitos sin '…' (ajustarTamanoMonto), placeholder visible.
  - Calculadora: botón de 44 en el encabezado fijo (ya no tapa el 📅/Guardar), visor que no corta la cuenta, 'Usar este resultado' con el color del tipo.
  - Categoría y Subcategoría en una columna en celular (con 2 columnas se cortaban 12 de 120 subcategorías a 390 px).
  - Simulador de cuotas sin importes partidos; chips de cuotas/categorías/tickers/sentido con alto táctil.
  - Barra Guardar pegada al borde, aviso de frecuentes plegable, sugerencia de categoría bajo la nota.
  - Diálogos con nombre accesible; selector de ícono sin estilos en línea ni ícono repetido.
- Sistema (ronda 3, cierre): texto oscuro en botones ámbar y reparto 1,5/1 de Categoría y Subcategoría
- Sistema (ronda 3): sin texto cortado en Cargar, ritmo de chips, foco del importe, selects, alineación y contraste
  - Selector de tipo de Cargar: se quita el word-spacing global (cortaba "Cambio" a 360 px); solo "↑ Gasto/↓ Ingreso/◈ Inv./▣ Tarj." llevan .2em.
  - Chips y pestañas: caja de 44 con borde transparente de 8,5 px y margen negativo igual; paso de 33 px y hueco de 6 px como en la base; mismo ancho (padding lateral compensa el borde); presets del informe sin +8 px.
  - Importe de Cargar: el anillo de foco va en .amount-hero (:has(:focus-visible)), alrededor de "$" y cifra, sin el halo viejo del input.
  - Selects: padding-right 24 px, flecha a 8 px; Categoría/Subcategoría en 1,7/1 (entra "Supermercado ⭐" a 360 px). …

## 3 de noviembre de 2026

- Sistema: foco visible en todos los campos, select con flecha y elipsis, tacto real y estado deshabilitado
  - Foco: input/select/textarea:focus-visible con anillo 2 px (>=6,8:1) también en Cargar (usa --tema-color) y búsqueda.
  - Select: flecha propia, texto largo con puntos suspensivos (no más 'Supermercadc').
  - Tacto: se corrige el patrón ::after, que no funciona dentro de overflow. Chips, 'Pagar', enlaces de cierre y acciones de insight pasan a caja real de 44 px; el resto conserva el halo. Área real medida con elementFromPoint: 6 controles <44 (antes 12).
  - [aria-disabled=true] y :disabled con estilo propio. Glifo x alineado, .btn-sm con borde suave, texto grande ámbar.
- Sistema: ámbar más cálido, --muted-on-tint y adopción de tokens en los componentes base
  - --warning ocre naranja #924f00 (6,3:1); botón ámbar con texto oscuro (--warning-solid/--on-warning-solid); --warning-fill para barras.
  - --muted-on-tint, --border-mid, --banner-bg/-fg y --surface-2 documentados.
  - Componentes base (.header, .card, .form-*, .btn-*, .nav-btn, .badge, .chip-label, utilidades .txt-*) usan --fs-*, --sp-*, --dur-* y --ease; .badge, .chip-label e .inv-row-badge ya no bajan de 10 px.
- Sistema: cartel de versión y zona de soltar archivo con tokens (contraste >=4,5:1 en claro y oscuro)
  - #version-vieja: de #ba7517/#fff (3,72:1) a --banner-bg/--banner-fg con fallback (6,3:1 claro, 9:1 oscuro); botón Actualizar de 44 px.
  - #drop-overlay: de azul crudo rgba(28,108,168,.88) a --accent y texto --on-solid.
- Sistema: limpieza de reglas sin efecto
- Sistema: reglas globales de tacto, foco, estados y controles
  - Objetivos táctiles de 44 px: botones-ícono reales; chips, píldoras y enlaces con área clicable invisible de 44 (::after).
  - :focus-visible sin pisar radios, borde de controles >=3:1, interruptor 46x28, controles nativos con la tipografía de la app (el textarea salía monoespaciado).
  - Estados :active parejos, :disabled, selección, scrollbars, safe areas en modal/toast/botones flotantes.
  - Red de seguridad para botones con color:#fff escrito en línea.
- Sistema: tokens documentados y contraste AA/AAA en claro y oscuro
  - Guía de tokens al inicio de styles.css (color, forma, sombra, movimiento, espaciado, tipografía, táctil).
  - --muted y los 6 tonos semánticos oscurecidos/aclarados para llegar a >=4,5:1 sobre fondo, tarjeta y fondos suaves (la mayoría >=6,5:1 y >=7:1 sobre blanco).
  - Nuevos tokens: --on-solid, --border-strong, --surface-2, --warning-fill, radios, sombras, curvas, escala de espaciado y tipográfica, safe areas.
  - color:#fff sobre rellenos semánticos pasa a var(--on-solid) (en oscuro los rellenos son claros).
- Sistema: theme-color claro/oscuro, color-scheme, tema antes del primer dibujo, zoom habilitado y manifest alineado
  - theme-color y color de arranque del manifest = fondo de la app (#f7f6f2 claro, #000 oscuro); applyTheme() actualiza el meta si se fuerza un tema.
  - Script mínimo en el head que fija data-theme antes del primer dibujo (sin destello blanco al abrir en oscuro).
  - Se quita maximum-scale=1.0 del viewport (accesibilidad: se puede hacer zoom).
  - manifest: dir y categories.
- **v221** · La tipografía vive en la app
  Plus Jakarta Sans (400, 500, 600 y 700, licencia OFL) se sirve desde fonts/: la app ya no hace ningún pedido a Google Fonts, no hay parpadeo de letra al abrir y funciona igual sin conexión. La política de seguridad queda más cerrada (font-src solo 'self').
- **v220** · Política de seguridad de contenido
  La app declara a qué puede conectarse: solo ella misma, Google (Calendar, Drive e inicio de sesión), las dos fuentes de inflación y las tipografías de Google. Aunque algún día se colara un script, no podría mandar los datos a otro sitio (fetch, imágenes y formularios quedan cortados). Se probó la app entera con la política puesta (gráficos, descargas, importación de Excel, reporte para imprimir, service worker) sin ninguna violación, y que el envío a un sitio ajeno sí se bloquea. Un test verifica que cada pedido de red del código esté permitido.
- **v219** · Los backups y los nombres nuevos se validan antes de usarse
  Restaurar un backup (archivo, Drive o copia del celular) limpia lo que un archivo armado a mano o dañado podría traer: registros que no son objetos, movimientos de un tipo desconocido, importes que no son números, textos larguísimos y etiquetas mal formadas. Los nombres reservados (__proto__, constructor, toString…) en categorías, cuentas, tarjetas y tickers, que hacían desaparecer plata de los totales, llevan un guion bajo al entrar desde un backup, un Excel o al escribirlos a mano. Un backup normal pasa sin cambios.

## 2 de noviembre de 2026

- **v218** · Chart.js y SheetJS viven en la app, en versión fija
  La app ya no baja código de ningún CDN: Chart.js 4.4.7 y SheetJS 0.20.3 están en js/vendor (con sus licencias y un LEEME con la versión, el origen y el SHA-256). SheetJS pasa de 0.18.5 a 0.20.3, que corrige la contaminación de prototipos y el ReDoS al abrir archivos de Excel manipulados. Funcionan sin conexión (el service worker las precachea) y un test verifica que index.html no cargue scripts de afuera y que la huella de cada archivo coincida con el LEEME.
- **v217** · Los backups salen cifrados con el PIN o código
  Con un PIN activo, el archivo de backup, lo que se manda por el menú de compartir y la copia diaria de Drive salen cifrados con la clave del PIN (el encabezado trae la sal y las vueltas para derivarla, y nada de los datos). Se abren con el PIN o código que había cuando se hizo, en este celular (sin pedirlo) o en otro. Restaurar desde archivo, arrastrando el archivo o desde Drive detecta el cifrado y lo pide, con hasta 5 intentos. Hay un interruptor en Configuración para dejarlos sin cifrar.
- **v216** · Mostrar lo que se escribe al poner o cambiar la clave
  Los diálogos que piden una clave (activar, confirmar, cambiar y desactivar el PIN, activar la huella) traen un botón Mostrar/Ocultar dentro del campo. Se abre siempre escondido y, al cerrar, la clave no queda escrita en la pantalla.
- **v215** · Código alfanumérico de 8 a 12 caracteres como alternativa al PIN
  Además del PIN de 6 dígitos, se puede usar un código de 8 a 12 letras y números (con al menos una letra y un número, sin espacios ni símbolos; las mayúsculas cuentan; se rechazan los repetidos y los más comunes). El sobre anota el modo, y la pantalla de bloqueo muestra un campo de texto con Mostrar y Entrar (acepta Enter) en vez del teclado de números. Se puede pasar de un modo al otro desde Cambiar PIN.
- **v214** · PIN de 6 dígitos que no se puede adivinar al instante y bloqueo automático
  El PIN pasa a 6 dígitos (se rechazan los repetidos, las escaleras y los más comunes) y deja de guardarse un hash: se comprueba abriendo el sobre cifrado, que ahora usa 1.000.000 de vueltas de PBKDF2 guardadas en el propio sobre. Los PIN de 4 dígitos siguen entrando, se migran y se ofrece subirlos (una vez por día). Desde el 5º intento fallido hay que esperar. La app vuelve a pedir el PIN al salir o tras 1, 5 o 15 minutos sin usarla (configurable en Configuración).
- **v213** · Correcciones de seguridad (XSS por datos importados, CSV, caché)
  Auditoría de seguridad: se escapan las cuentas y tarjetas de los selectores, los tickers recientes (el onclick era inyectable), los tickers de la conciliación y el tipo y el título del reporte para imprimir. El CSV exportado ya no deja que una celda se ejecute como fórmula en Excel. El service worker solo guarda respuestas buenas y el workflow de tests pasa a permisos de solo lectura.
- **v212** · Ver todos los vencimientos de la franja de Movimientos
  El 'y N más' de la franja de vencimientos pasa a ser un botón que despliega todos los que no entraban, con 'Ver menos' para volver a esconderlos.
- **v211** · Hoja Pagar resumen más simple y con la cuenta de la tarjeta
  La hoja muestra solo el monto, un interruptor de gastos administrativos y el botón con el total; fecha, cuenta y 'sale de mis ahorros' quedan resumidos en una línea que se abre con Cambiar. La cuenta viene puesta según la tarjeta (su banco asignado, si no la del último pago, si no la que más usan sus compras).

## 1 de noviembre de 2026

- **v210** · Pagar el resumen de la tarjeta, con la pregunta de los gastos administrativos
  El botón Pagar de Tarjetas (y el de la franja de vencimientos) abre una hoja que carga sola el Pago total: toma el monto del resumen y pregunta si tiene gastos administrativos. Con No, el gasto es el monto del resumen; con Sí, se ingresan los gastos y el movimiento lleva la suma, anotando cuánto fueron. En dólares viene tildado que sale del fondo USD. Queda vinculado al resumen (Gastos administrativos de las tarjetas lo cuenta) y se puede deshacer. 'Ya lo cargué yo' sigue permitiendo vincular un gasto ya cargado.

## 29 de octubre de 2026

- **v209** · Año completo no repite datos
  Se quitan de 'Para recordar' el gasto promedio por mes (ya está en la línea de promedio del gráfico) y el resultado de las inversiones (ya está en Ingresos por categoría). La imagen para compartir mantiene el promedio.
- **v208** · El resumen del año se une a Año completo
  La cabecera de Año completo pasa a ser el resumen del año (disponible, ingresos, gastos y ahorrado con % contra el año anterior) con botones para compartir como imagen y para abrir el informe de otro período, y 'Para recordar' queda al pie. El Dashboard tiene un solo enlace; el aviso de fin de año abre la misma pantalla. Se quita la hoja aparte 'Mi año'.
- **v207** · El informe se comparte como imagen, con el estilo del resumen del mes
  Compartir informe arma un PNG de 1080 px (disponible, ingresos/gastos/ahorrado, resultado sin créditos ni inversiones, barras mes a mes, categorías principales y hallazgos) y lo manda por el menú de compartir o lo descarga. El texto queda como opción aparte (Como texto).

## 28 de octubre de 2026

- **v206** · Los meses del informe llevan el año en forma corta (Ene ’23)
  En la tabla mes a mes y en los textos del informe, cada mes se muestra con el año abreviado (Ene ’23, Oct ’26) en vez de solo el nombre, para que se distingan los meses de distintos años sin escribir 'Enero 2023'.
- **v205** · Informe de un período dentro de la app
  Un análisis de cualquier rango de meses (con atajos 'Antes de usar la app', 'Este año' y 'Últimos 6 meses'): disponible, mes a mes, separando lo operativo (sin créditos, inversiones ni MEP) de lo financiero, en qué se fue la plata con su variación contra el año anterior y subcategorías, de dónde entró, mayores gastos, ahorro e inversión, y hallazgos en palabras (déficit cubierto con deuda, sueldo o gastos fijos que cambiaron, peso de la tarjeta, calidad de los datos). Se abre desde el Dashboard y se comparte como texto.
- **v204** · El resumen del año pasa del menú al Dashboard
  Se saca 'Resumen del año' del menú hamburguesa y se agrega '🎉 Mi 2026 en Enola' al pie del resumen del Dashboard, debajo de 'Ver el año completo'; abre el resumen del año del mes que se está mirando. El aviso de fin de año en Movimientos sigue igual.
- **v203** · Repetir un movimiento con un toque y resumen del año
  - Repetir: deslizando una fila hacia la derecha (o desde el editor) aparece '🔁 Repetir': lleva a Cargar con el mismo movimiento (tipo, monto, categoría, cuenta, nota, ahorro/retiro/recuperable, ticker y cuotas) con la fecha de hoy, sin guardar nada.
  - Resumen del año: ingresos, gastos, ahorrado y lo que quedó disponible mes a mes, categorías más fuertes, mejor y peor mes, gasto más grande y comparación con el año anterior; con aviso al cerrar el año, entrada en el menú y para compartir como imagen.

## 27 de octubre de 2026

- **v202** · Las ventas ya cargadas como retiro del fondo se unen en vez de duplicarse, y se detectan ventas repetidas
  La hoja de ventas que salieron de ahorros ahora busca el retiro que ya estaba cargado a mano (ticker en la nota, hasta 10 días y 5% de diferencia): 'Unir con ese retiro' deja un solo registro (el retiro toma el monto y la fecha de la venta y deja de contar como gasto e ingreso). Si dos ventas del mismo ticker, día y cuenta tienen casi el mismo monto se marca la segunda como posible repetida, con opción de eliminarla (papelera, con Deshacer) o confirmar que son dos.
- **v201** · Revisar ventas que salieron de ahorros, cobros parciales del monto recuperable y recordatorios sin detalle
  - Ventas ya cargadas que parecen haber salido de un fondo (el ticker figura en sus notas): hoja en Configuración y aviso en el Dashboard para vincularlas con un toque (con copia de seguridad y Deshacer) o descartarlas; el editor de una venta ahora tiene la casilla 'Sale de mis ahorros'.
  - Cobrar el monto recuperable pregunta cuánto te devolvieron: se puede cobrar en partes (cada cobro es un ingreso), el botón muestra 'Faltan $X' y el mosaico 'A recuperar' cuenta lo que falta.
  - Interruptor 'Recordatorios sin detalle': los eventos del calendario (Google y .ics) dicen 'Vence un gasto fijo' sin nombres ni montos.
- Changelog: CHANGELOG.md generado desde el historial de git
  scripts/generar-changelog.js arma CHANGELOG.md (un cambio por commit, agrupado por día, del más nuevo al más viejo) y scripts/changelog-hitos.md tiene el resumen por etapas que va arriba.

## 26 de octubre de 2026

- **v200** · Botón 'Cobrar' en los gastos con monto recuperable
  Debajo del monto aparece '🔁 Cobrar $25K' (como 'Marcar pagado' de los frecuentes): al tocarlo registra la devolución como ingreso (Dinero extra › Devoluciones, misma cuenta, fecha de hoy) y pasa a '✓ Cobrado'; tocarlo de nuevo la deshace. El mosaico 'A recuperar' cuenta solo lo que falta cobrar. Borrar el gasto se lleva su devolución y editar el monto la actualiza.

## 25 de octubre de 2026

- **v199** · Los avisos largos (p. ej. al sincronizar con Google) se ven enteros
  El aviso (toast) iba en una sola línea y se cortaba en el celular. Ahora ocupa varias líneas dentro de la pantalla y dura más cuanto más largo es el texto.
- **v198** · Calendario - eventos privados, sin invitados, y se muestra a qué cuenta de Google se mandan
  Los eventos de Google Calendar se crean con visibilidad privada, sin invitados ni permisos para terceros (los ya enviados se actualizan solos), el .ics marca CLASS:PRIVATE y la app muestra la cuenta conectada. Tests de que las credenciales no viajan en el backup.

## 24 de octubre de 2026

- Merge: v197 - dictado: retoques de una misma frase y miles a la inglesa
