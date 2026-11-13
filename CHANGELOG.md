# Changelog de Enola

Historial de cambios de la app, del más reciente al más viejo. Se genera solo desde el historial de git con `node scripts/generar-changelog.js`.

**Versión actual: v249**

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

## 13 de noviembre de 2026

- **v249** · El editor de un gasto frecuente de tarjeta tiene filtros de vista (Datos, Tarjeta, Fechas, Monto, Todo) para no recorrer un formulario larguísimo

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

- **v197** · Dictado - une los retoques de la misma frase y entiende miles a la inglesa
  El reconocedor del celular entregaba la misma frase varias veces retocada ('recibí 25', 'recibí', 'recibí 25,000'); se concatenaban y quedaba '25' de monto y '25,000' de nota. Ahora los retoques se reemplazan entre sí y '25,000' (miles a la inglesa) se lee como 25 mil.
- **v196** · Decimales con coma en toda la app
  - Los montos en dólares (USD 113,09), las abreviaturas (,1M) y todo texto numérico usan coma decimal y punto de miles (fmtNum2); ya no se usa toFixed() en pantalla (un test lo vigila).
  - Los campos numéricos decimales (aumentos, monto base, USD, objetivo de meta, presupuesto…) muestran y aceptan coma, y un punto tipeado se vuelve coma; el código sigue leyéndolos con punto. Los placeholders también.
- **v195** · Selector de mes compacto (ene, feb… dic + año) y sección de aumento rediseñada
  Los <input type=month> se muestran como dos listas chicas (mes abreviado y año) en toda la app, sin cambiar cómo se lee o asigna su valor. En las hojas de aumento de precio (movimientos y tarjetas) el mes y el nuevo monto van uno debajo del otro, con el monto grande.

## 23 de octubre de 2026

- **v194** · 'Guardar ahora' en la carga rápida y por voz, con Deshacer
  Cuando la carga rápida (escrita o dictada) entendió todo, el aviso trae un botón que guarda con el mismo Guardar de siempre y ofrece deshacer unos segundos. Con una advertencia no se ofrece.
- **v193** · Dictado por voz más paciente y que entiende los montos dichos en voz alta
  - Sigue escuchando si no decís nada (hasta 20 s) y da la frase por terminada 3 s después de la última palabra, en vez de cortar a los 2-3 s.
  - Une los miles partidos o mezclados ('12 838', '12 mil 838', '1 200 000') en un solo monto: antes cargaba 838 y dejaba '12' en la nota.
  - Decir 'gasto' o 'ingreso' elige el tipo; 'pesos' ya no queda en la descripción.
  - Muestra lo que escuchó, junto con lo que entendió.

## 22 de octubre de 2026

- **v192** · Lo sacado de un fondo de ahorro vía venta/rescate suma a lo disponible del mes
  El retiro ligado a una venta (Sale de mis ahorros) ahora cuenta en el Balance del mes (resumenDePeriodo.retiradoAMano), con su mosaico en Movimientos, nota en el cierre y línea en el Dashboard. Esa venta ya no cuenta además como ganancia reconocida para no sumar dos veces.
- **v191** · La venta de una inversión puede salir de un fondo de ahorro y lo descuenta
  Casilla 'Sale de mis ahorros' en las ventas (Cargar › Inversión): crea un retiro ligado (traspaso) que baja el fondo sin contar como gasto. Editar o borrar la venta acompaña al retiro. La carga rápida reconoce 'de mis ahorros' / 'del fondo de retiro'.
- **v190** · Atajos en el ícono, carga rápida por voz y detector de aumentos en gastos fijos
  - Atajos del ícono (manifest shortcuts): Cargar gasto, Cargar ingreso, Carga rápida y Cerrar el mes.
  - Botón 🎤 en la carga rápida (reconocimiento de voz del navegador, es-AR) con números dichos en palabras.
  - Aviso y hoja para registrar aumentos: fijos que venías actualizando cada mes y este mes no, fijos con 6+ meses sin cambio (con inflación) y gastos mensuales que subieron.
- **v189** · Carga rápida - cambio de moneda (vendí mep 30) y categorías propias por nombre (dinero extra)
  - Comprar o vender dólares (operación + usd/dólares/mep/blue) abre el formulario de Cambio con sentido, dólares, tipo de cambio o pesos si los dijiste.
  - Si el texto nombra una categoría tuya, manda; una categoría que solo existe como ingreso vuelve la frase un ingreso (salvo que digas 'pagué', 'transferí', etc.).
- **v188** · Carga rápida - rescates ('recuperé', 'retiré', 'saqué') y categoría reciente
  - Recuperar/retirar/sacar plata de una inversión es una venta/rescate; poner/invertir es una compra. El verbo no queda en la descripción.
  - La categoría de la nota sale primero de los últimos 150 días, después de las reglas de comercios y solo al final del historial completo: un 'Pan' de un viaje viejo ya no manda el pan de hoy a Vacaciones. 'pan' es Supermercado.
- **v187** · La carga rápida reconoce los ingresos dichos con verbo ('tany me transfirió 45000 a galicia')
  Con 'me transfirió/depositó/pagó…', 'recibí', o formas de tercera persona del pasado, es un ingreso; el verbo y el 'al' no quedan en la descripción, así la categoría sale de 'Tany'. Pagar o transferir uno mismo sigue siendo gasto.
- **v186** · La carga rápida reconoce inversiones (compra/venta de acciones, CEDEARs, FCI, tickers conocidos)
  'venta accion ypf 45000' caía en la sugerencia de la nota y quedaba como un gasto de vacaciones. Ahora: ticker conocido o activo nombrado + operación → Inversión con ticker, categoría y la subcategoría de la operación (incluye 'Acciones Venta'). Avisa si no encuentra la operación.
- **v185** · La conciliación explica qué compara y usa títulos más claros
- **v184** · CEDEARs que no pasan por el fondo se pueden sacar de la conciliación
  Cada faltante trae 'X no pasa por mi fondo' (por ticker); lo excluido deja de compararse y se ve aparte con 'Volver a incluir'. Es una preferencia: no cambia ningún movimiento. Va en el backup.
- **v183** · Los 4 'registros incompletos' eran falsos: las inversiones en USD guardan en importeUSD
  El detector buscaba importeOrig (de gastos e ingresos) en las inversiones en dólares, y daba por rotas las ventas de AL30 importadas de Balanz. Ahora mira importeUSD, y el aviso identifica el registro (qué, ticker y fecha).
- **v182** · Desbloqueo con huella o rostro
  Atajo para el PIN con passkey + extensión PRF de WebAuthn: el celular da un secreto propio solo tras la huella o el rostro, con el que se guarda el PIN cifrado. El PIN y el cifrado de los datos no cambian. Se activa desde Configuración (pide el PIN), se ofrece en la pantalla de bloqueo y se desactiva solo al cambiar o quitar el PIN. Si el celular no soporta PRF, no se activa y lo avisa.
- **v181** · Resumen del mes y cierre guiado
  Hoja 'Cerrar el mes' (menú lateral): resumen con ingresos, gastos, ahorro, comparación con el mes anterior, en qué se fue la plata y qué subió; chequeo con botones que llevan a cada pendiente (gastos fijos, tarjetas, sin cuenta, metas, vencimientos, datos, backup); compartir el resumen como imagen; marca de mes cerrado y aviso a principio de mes.
- **v180** · Se quita el fondo de emergencia
- **v179** · Ingresos frecuentes, carga rápida por texto y fondo de emergencia
  - Ingresos frecuentes: un sueldo o alquiler cobrado se carga una vez y se repite cada mes (aumentos, baja, día de cobro). Entra al balance cuando llega su día o al marcarlo cobrado; los pendientes figuran en 'Por cobrar este mes'.
  - Carga rápida: una frase ('nafta 15000 visa ayer') rellena el formulario de Cargar (tipo, monto, moneda, fecha, cuenta/tarjeta, cuotas, categoría) sin guardar.
  - Fondo de emergencia: meses de gastos que cubre tu ahorro, con objetivo y ahorros que cuentan configurables.
- **v178** · Deshacer y papelera, y filtro por cuenta en Movimientos
  - Todo lo que se elimina (movimientos, compras con tarjeta, metas, cambios de moneda, frecuentes) va a una papelera de 30 días y el aviso trae 'Deshacer'. Los cambios en lote (marcar como ahorro, asignar cuenta, dar de baja un frecuente) también se pueden deshacer. La papelera se cifra con el PIN.
  - Movimientos: chips por cuenta en Todos/Gastos/Ingresos y resumen de lo que salió y entró en esa cuenta.

## 21 de octubre de 2026

- **v177** · Cuenta en lote para movimientos sin cuenta y gastos administrativos de la tarjeta
  - Configuración → Movimientos sin cuenta: sugiere la cuenta por categoría/subcategoría según lo que ya tiene cuenta; se asigna por grupo o todo junto, con confirmación y copia de seguridad.
  - Tarjetas: la diferencia entre lo pagado y las compras cargadas se muestra como gastos administrativos de la tarjeta, mes a mes y total del año (ya están en el pago cargado: no cambia el balance).
- **v176** · Banco asociado a cada tarjeta
  Cada tarjeta puede asociarse a una cuenta (Configuración → Tarjetas). El banco se ve en las compras con tarjeta de Movimientos, en las barras, resúmenes y compras del mes de Tarjetas; la cuenta cargada en la compra, si hay, gana. Va en el backup y acompaña al renombrar la tarjeta. La etiqueta de cuenta ya no se corta en filas largas.
- **v175** · Cada fila de Movimientos muestra la cuenta (banco) del movimiento
  Los pagos de tarjeta figuraban solo como 'Tarjeta de crédito'. Ahora se ve el banco o la billetera, y en compras con tarjeta la tarjeta/cuenta si el subtítulo no la dice. 'Cuentas' (sin elegir) no se muestra.
- **v174** · 'Marcar pagado' de una tarjeta se vincula al gasto ya cargado, sin tocar el balance
  La hoja pregunta cuál de los gastos de 'Tarjeta de crédito' fue el pago (o solo marcarlo). Es una referencia: no carga ni cambia gastos. La fila muestra con qué gasto se pagó y la diferencia contra las compras cargadas; si se borra ese gasto, el resumen vuelve a figurar sin pagar.
- **v173** · Alertas de vencimientos sin pagar y fecha objetivo en las metas
  - Los vencimientos que pasaron y siguen sin marcarse como pagados se avisan en rojo en la franja de Movimientos, en el Dashboard y con un diálogo al abrir la app (una vez por día), hasta 45 días atrás y un aviso por ítem.
  - Cada meta puede tener fecha objetivo: muestra cuánto ahorrar por mes y, si está atada a un ahorro, compara con el ritmo de los últimos 90 días y estima cuándo llega.
- **v172** · Una categoría atada a una meta tilda sola 'Es un ahorro' y se pueden marcar los gastos ya cargados
  Antes un gasto en la categoría de una meta no sumaba si no se marcaba como ahorro. Ahora el formulario lo tilda y avisa a qué meta suma, y el editor de metas avisa de los gastos sin marcar y los marca con confirmación y copia de seguridad.
- **v171** · Una meta puede atarse a otro ahorro, a una subcategoría o a cualquier categoría
- **v170** · Lápiz visible para editar cada meta y enlazarla a un ahorro
  Antes editar exigía mantener apretada la tarjeta; tocar una meta atada llevaba a cargar un ahorro y una manual abría el depósito, así que parecía que no se podía editar.
- **v169** · La conciliación usa el CEDEAR y la descripción de cada movimiento
  Empareja por ticker/nota ("Spy x 4"), marca cantidades distintas, muestra la
  descripción de cada movimiento y permite filtrar por CEDEAR. Sigue siendo solo lectura.
- **v168** · Meta atada al fondo y conciliación con el broker (versión de prueba)
  Meta atada al fondo: cada meta puede tomar su monto del saldo en pesos de una categoría de ahorro (fondoCat),
  así nunca se desfasa; el editor ofrece 'Lo cargo a mano' o 'Saldo de <categoría>', al arrancar se atan solas las
  metas que el usuario ya igualaba a mano a UN fondo (con aviso), tocar una meta atada lleva a cargar un ahorro, y
  pasar a 'a mano' conserva el monto y no vuelve a atarse. Las tarjetas muestran 🔗 y el total suma el monto atado.

  Conciliar con el broker (PRUEBA, solo lectura): empareja las inversiones de CEDEARs con los depósitos/retiros del
  fondo (hasta 7 días y 3% de diferencia) y muestra diferencias de monto/fecha, lo que falta o sobra en el fondo, …

## 20 de octubre de 2026

- **v167** · El HTML y sus estilos/scripts son siempre de la misma versión (URLs con ?v=)
  Con HTML nuevo (se baja fresco) y styles.css/.js viejos (cache-first del service worker anterior), la pantalla
  quedaba sin estilos o con código viejo hasta el próximo arranque: se vio en Configuración tras la v166.
  Ahora index.html pide styles.css y cada js/*.js con ?v=<versión>, el service worker los precachea con esa
  misma URL y scripts/subir-version.js los sube junto con el meta y CACHE_VERSION. Un archivo nuevo es otra URL,
  así que nunca sale de la caché vieja. Tests nuevos verifican que el HTML y el precache coinciden.
- **v166** · Configuración en secciones plegables y 'Tus datos' sin totales falsos
  - Las 16 tarjetas de Configuración pasan a 5 secciones plegables (General; Copias y Google; Cuentas, tarjetas y
    categorías; Exportar y mis datos; Zona de peligro), cerradas al empezar y recordando cuáles quedaron abiertas.
  - 'Resumen total' pasa a 'Tus datos': cuenta movimientos, registros de tarjeta, gastos frecuentes y período.
    Deja de mostrar ingresos, gastos y balance neto, que sumaban todo sin la regla única de la app y contradecían
    a Movimientos y al Dashboard.
- **v165** · Configuración ordenada tras Google y la copia en Drive
  - Una copia subida a Drive (o restaurada desde Drive) cuenta como backup hecho: el estado y el recordatorio
    ya no marcan 'nunca' con la copia diaria andando.
  - La conexión con Google (calendario y copia en Drive) pasa a su propia tarjeta, antes de Vencimientos.
  - El archivo .ics de calendario (agregar vencimientos y alerta de prueba) se oculta con Google conectado y, sin
    conectar, queda plegado como alternativa.
  - La tarjeta de copia manual se reescribe: ya no dice que es la única copia ni el consejo viejo.
- **v164** · Si la Google Drive API no está habilitada, la app lo explica y abre la página de habilitación
  En vez del texto crudo de Google (en inglés y cortado en el aviso), un diálogo en español con un botón que abre
  la página de la Drive API del proyecto del ID de cliente.
- **v163** · Copia de seguridad automática en Google Drive, con restauración
  Una copia por día (si hubo cambios) en la carpeta 'Enola backups' del Drive del usuario, con las últimas 14
  (solo se borran copias viejas creadas por la app en esa carpeta). Reutiliza la conexión de Google del
  calendario (mismo ID de cliente y un solo permiso) más el alcance drive.file: la app solo ve lo que ella crea.
  Se sube sola si el permiso sigue vigente; si no, el aviso de Movimientos pasa a decir 'copia en Drive
  pendiente' y 'Enviar' manda calendario y copia juntos. Desde Config se activa, se sube una copia en el acto,
  y se ven las copias de Drive para restaurar (con copia de seguridad local antes), también en un celular nuevo.
  Nunca sube una app vacía. …
- **v162** · Google Calendar se agrega y se actualiza solo lo que cambia (nunca borra)
  Se vuelve a incluir la sincronización con la API de Google Calendar, ahora SOLO crea y actualiza: un gasto
  frecuente nuevo agrega su evento; un cambio de día, monto, nombre o de días de aviso actualiza únicamente
  ese evento; eliminar o dar de baja un gasto NO borra nada del calendario. Los eventos son mensuales y sin
  fin, con los mismos UID del archivo .ics (eventosParaCalendario es la única fuente). Desconectar no
  borra los eventos. Pasos de configuración actualizados en Config.
- **v161** · Se reparan los movimientos con el mismo id
  Una importación vieja dejó 12 pares de movimientos con el mismo id: editar, borrar o marcar uno tocaba
  siempre el primero. repararIdsDuplicados() renumera cada repetido con el primer id libre; conserva el id
  la pata de un cambio de moneda (si la hay) o, si no, el primero. Corre al arrancar (con copia de seguridad
  previa, junto con la reparación de dólares), al restaurar un backup y al importar un archivo.
- **v160** · Se quita la conexión con la API de Google; los vencimientos van al calendario como eventos mensuales sin fin
  Se elimina la sincronización con Google Calendar (y con ella el borrado automático): se vuelve al
  archivo .ics, pero ahora cada gasto frecuente con día de vencimiento (de gastos o de tarjeta) y cada
  tarjeta con día habitual salen como UN evento mensual con RRULE y sin fecha de fin, que dura hasta
  que el usuario lo borre de su calendario. UID estable: volver a mandar el archivo actualiza.
  Los resúmenes con fecha distinta de la habitual siguen como eventos sueltos.

## 19 de octubre de 2026

- **v159** · Sincronización con Google Calendar (eventos mensuales que se borran con el gasto)
  Cada gasto frecuente (de gastos o de tarjeta) con día de vencimiento queda como un evento mensual
  que se repite sin fin (RRULE, con UNTIL si tiene mes de fin); cada resumen de tarjeta con fecha, como
  un evento suelto. La app compara lo que debería haber en el calendario con lo que ya mandó y corrige
  la diferencia: crea, actualiza y BORRA (gasto eliminado, dado de baja o sin día). Se reutiliza el
  evento si el mapa se perdió (propiedad privada enola) y se vuelve a crear si lo borraron a mano.

  Permiso calendar.events por Google Identity Services con un ID de cliente que crea el usuario (instrucciones
  en Config). …
- **v158** · Alerta de prueba para ver cómo llega el aviso al calendario
  Config > Vencimientos > 'Mandar una alerta de prueba': crea un evento que empieza en 10 minutos con
  recordatorio 5 minutos antes (hora local del celular, UID único), por el menú de compartir o descarga.
  El envío al calendario se unificó en enviarArchivoCalendario().
- **v157** · Aviso de vencimientos de 2 días (configurable), vencimiento propio en frecuentes de tarjeta y envío al calendario
  - El aviso pasa de 7 a 2 días por defecto y se elige en Config (el mismo día, 1, 2, 3, 5 o 7 días).
    El ajuste viaja en el backup.
  - Los gastos frecuentes de tarjeta pueden tener su día de vencimiento: avisan por su cuenta, se
    marcan pagados por mes (sin tocar el resumen de la tarjeta) y se ven en la fila de Tarjetas.
  - Config: 'Agregar vencimientos al calendario' genera un .ics con un evento por vencimiento de los
    próximos 3 meses y recordatorio a las 9:00 con la anticipación elegida; sirve con la app cerrada.
    UID estable: volver a importarlo actualiza en vez de duplicar.

## 18 de octubre de 2026

- **v156** · Gastos frecuentes de tarjeta pueden cambiar de tarjeta por mes sin alterar el historial
  Cada gasto frecuente guarda sus cambios de tarjeta (tarjetas:[{desde,tarjeta}]) igual que los
  aumentos de precio: cada mes usa el último cambio que ya rige y antes del primero vale la tarjeta
  original. El editor permite elegir 'Tarjeta desde el mes' y 'Solo ese mes' (el siguiente vuelve a la
  anterior), muestra el historial y deja borrar un cambio. Los resúmenes, el Dashboard, Movimientos y
  la exportación leen la tarjeta de cada mes. Renombrar o borrar una tarjeta considera el historial.

## 16 de octubre de 2026

- **v155** · Ahorros suma solo pesos en las cuentas en pesos y repara dólares con el monto duplicado
- **v154** · Tipo MEP explícito en las inversiones y tests automáticos en cada push
  MEP explícito: las inversiones tienen un campo `mep` que se elige con una casilla
  "Operación MEP" al cargarlas (se tilda sola al elegir la categoría MEP) y al
  editarlas (el formulario se redibuja sin perder lo tipeado). La conversión a
  compra de dólares y la lista de cambios por completar usan ese campo en vez de
  adivinar por el texto de la categoría o la nota. Las inversiones de antes del
  campo se marcan una vez al arrancar, al restaurar un backup y al importar, solo
  si no tienen el campo: una que el usuario desmarcó no vuelve a marcarse.

  CI: GitHub Action (.github/workflows/tests.yml) que corre la suite en Chromium sin …
- **v153** · Fechas de cierre y vencimiento con calendario, y "Marcar pagado" en vez de "Pagar"
  Cada resumen de tarjeta tiene sus fechas reales de cierre y de vencimiento del
  mes, que se cargan con el calendario del sistema desde una hoja (opcionalmente
  "repetir estos días los meses siguientes" deja un día habitual para los meses sin
  carga). El formato anterior (solo un día) sigue funcionando.

  Se saca el botón "Pagar" y su hoja: el pago real lo carga el usuario como un gasto
  común, porque no siempre coincide con el resumen (gastos de emisión, intereses).
  En su lugar, "Marcar pagado" por tarjeta y moneda (con Deshacer), que es solo una
  marca. Los pagos ligados a un resumen creados con la versión anterior siguen …
- **v152** · Vencimientos de tarjetas y gastos frecuentes
  Cada tarjeta puede tener su día de vencimiento (se carga desde su resumen en
  Tarjetas) y cada gasto frecuente un día opcional (en el alta, al tildar
  "Gasto frecuente", y en el editor). La app avisa de lo que sigue sin pagar y
  vence en los próximos 7 días o venció hace menos de 10:

  - Movimientos ("Todos", mes actual): franja "Vencimientos" con lo más urgente
    primero ("Visa vence en 2 días · resta $100.000"), que se actualiza sola al
    tildar un frecuente como pagado.
  - Tarjetas: cada resumen sin pagar muestra cuándo vence y permite editar el día.
  - Dashboard: tarjeta con el próximo vencimiento y el resto en el detalle. …
- **v151** · Un solo balance en Movimientos, Dashboard y reporte PDF
  El balance real es el "Balance del mes" de Movimientos (disponible: ingresos con
  retiros del fondo y ganancia, menos gastos con pérdida, menos lo ahorrado). Esa
  cuenta pasa a vivir en resumenDePeriodo() (estado-categorias.js) y la usan
  Movimientos, el Dashboard y el reporte PDF, para que no puedan divergir.

  Dashboard: el balance de cada mes (titular, insights, gráfico, promedios) es el
  disponible; el titular agrega "ahorraste X"; los KPIs del año suman los balances
  de cada mes y muestran Ahorrado (para que ingresos − gastos − ahorrado = balance
  se lea en pantalla); el detalle del mes también. La tarjeta de cada cuenta y su …
- **v150** · Copias automáticas en el celular y envío del backup a Drive/WhatsApp
  Copias automáticas: al abrir la app (y al volver a ella), si hubo cambios, se
  guarda una copia del día en IndexedDB (gratis, sin cuentas ni conexión). Se
  conservan las últimas 14 más 3 de seguridad. Con PIN se guardan cifradas con la
  clave de la sesión, y al activar/cambiar/quitar el PIN se descartan y se arma
  una nueva (en claro quedarían expuestas; con la clave anterior no se abrirían).
  Restaurar una copia pide confirmación y deja antes una copia de seguridad de los
  datos actuales.

  Enviar copia afuera: nuevo botón que abre el menú de compartir del celular
  (Drive, WhatsApp, mail) con el archivo de backup, con caída a la descarga si el
  navegador no lo soporta. …
- **v149** · Pagar el resumen de la tarjeta y "Frecuentes por pagar" en Movimientos
  Tarjetas: cada mes muestra un resumen por tarjeta y moneda con su estado (sin
  pagar / pagaste X, resta Y / pagado) y un botón para pagarlo. La hoja "Pagar
  resumen" viene con el monto que resta, fecha, cuenta y la casilla "Sale de mis
  ahorros". El pago es un gasto común (cat Tarjeta de crédito / Pago total)
  ligado al resumen (pagoTarjeta: ym, tarjeta, moneda): baja el balance una sola
  vez y se puede deshacer desde Tarjetas. En el flujo USD del Dashboard, un
  resumen pagado cuenta por lo pagado y de la tarjeta solo se suma lo que resta,
  así no se descuenta dos veces.

  Movimientos: nuevo mosaico "Frecuentes por pagar" (Todos y Gastos) con lo que
  falta pagar de los gastos frecuentes del período. …

## 15 de octubre de 2026

- **v148** · El balance del mes en Movimientos muestra lo disponible (descuenta lo ahorrado)
  El número grande del filtro "Todos" pasa a ser el balance menos lo que se
  mandó al fondo de ahorro, con una línea que lo explica. El mosaico "Ahorrado"
  sigue mostrando cuánto se ahorró. Las inversiones no se descuentan: solo
  cuenta su resultado, igual que antes. Se agregan 3 tests (con ahorro, sin
  ahorro y disponible negativo en rojo).
- **v147** · Cargar los dólares de una compra MEP desde el editor de la inversión
  Al editar una inversión que es una compra MEP en pesos, aparece el campo
  "Dólares que recibiste" y la casilla "Guardarlos en el fondo de ahorro". Si se
  cargan los dólares, la compra pasa a ser una compra de dólares de dos patas
  (reusa completarCambioDesde y crearDepositoAhorroUSD): los USD entran al flujo
  USD del Dashboard y a "Mis dólares", y si se tilda el fondo suman al Fondo USD
  de Ahorros. Pagar la tarjeta con esos dólares es un Gasto en USD (con "Sale de
  mis ahorros" si salen del fondo) y resta del fondo / cash USD sin tocar el
  balance en pesos.

  La pata nueva busca un id libre: los ids de un import vienen consecutivos y
  cambioId+1 pisaba al movimiento siguiente. …

## 9 de octubre de 2026

- **v146** · Movimientos - resumen con mosaicos en lugar de barras (design_handoff_movimientos)
  Reemplaza las barras de progreso + leyenda del resumen de #page-mov por una
  grilla de mosaicos de color (2 columnas, el impar ocupa todo el ancho),
  según la opción 3b del handoff. Aplica a los 4 filtros (Todos/Gasto/Ingreso/
  Tarjeta): cada uno arma su propia lista de mosaicos combinando la tabla base
  del README con los chips informativos condicionales que ya existían (Resultado
  inv., Recuperado, Neto inversión, etc.), ahora mostrados como mosaicos en vez
  de texto suelto. Se da de baja el desglose por tarjeta y por categoría dentro
  del resumen (ya duplicaban la vista de la pestaña Tarjetas y los sub-filtros
  de categoría).

  En las filas de inversión, el ticker y la operación corta (p. ej. …
- **v145** · Ícono de la calculadora roto en Android (emoji sin soporte)
  🖩 (calculadora de bolsillo, U+1F5A9) es un emoji poco cubierto por las fuentes de
  emoji de Android/Samsung: en el teléfono real aparecía como el cuadrito de "glifo
  faltante" en vez de un ícono. Se reemplaza por el signo "=" como texto plano (no
  emoji) en el botón flotante y en el título de la hoja — un carácter ASCII básico
  que cualquier fuente del sistema dibuja bien, sin depender de cobertura de emoji.

  Versión enola-v145 (index.html + sw.js). Suite completa: 433/433 OK.
- **v144** · Orden y estilo de la calculadora, igual a la del teléfono
  El grid-row/grid-column con span que usaba para agrandar "=" y "0" corría esos dos
  botones antes de tiempo (el navegador ubica primero los que tienen una posición fija
  y recién después los que no tienen ninguna), así que "=" terminaba arriba a la
  izquierda en vez de abajo a la derecha. Se saca el span: ahora el orden es el mismo
  de cualquier calculadora de teléfono, sin excepciones — C ⌫ ÷ × / 7 8 9 − / 4 5 6 +
  / 1 2 3 = / 0 , — y cada tecla ocupa una sola celda.

  También se simplifica el color: los operadores ya no tienen un fondo propio, solo el
  texto en el color del tipo activo (--tema-color), igual que en la calculadora nativa;
  "=" sigue siendo el único con relleno sólido. …
- **v143** · Importe único en Inversión, calculadora flotante en Cargar, cuotas por defecto
  - Inversión (Cargar): el par de campos ARS/USD se reemplaza por un único importe +
    pills ARS/USD, igual patrón que Gasto/Ingreso (currency-pills + select oculto).
    guardarSinFreno() escribe en importe o importeUSD según la moneda elegida, nunca
    los dos a la vez. Se da de baja la grilla .dual-amount-* (sin más usos).

  - Calculadora flotante (🧮) en toda la pantalla de Cargar: botón + hoja con suma,
    resta, multiplicación y división (sin paréntesis, "cuentas simples"). "Usar este
    resultado" lo escribe en el campo de importe que tenías enfocado (si no tocaste
    ninguno, en el principal del tipo activo) y dispara su oninput de siempre, así la …

## 8 de octubre de 2026

- **v142** · Rediseño de "Inversiones" (mes primero, perspectiva cartera)
  Implementa design_handoff_inversiones/README.md, opción 1c "Mes primero", en #page-inv.

  Cambio de lectura más importante: la pantalla pasa de leerse desde el bolsillo
  (invSignoCash, compras en rojo como "GASTO") a leerse desde la cartera (invSigno/
  sumInvNeto/sumInvNetoUSD, ya existentes): lo que pusiste suma, lo que cobraste resta
  con "+" en verde. invSignoCash/sumInvCash no se tocan: el Dashboard los sigue usando.

  - Header igual que Movimientos/Tarjetas (.mov-topbar), con el mes y › deshabilitado
    en el mes en curso.
  - Número grande (#inv-summary): neto del mes en pesos con los dólares debajo, 3
    estados de rótulo (sumaste/sacaste/sin movimientos). …

## 7 de octubre de 2026

- **v141** · Rediseño de "Dashboard" (el mes contado en frases, opción narrativa)
  Implementa design_handoff_dashboard/README.md, opción 2a "Narrativo":

  - Nuevo resumen que abre la pestaña: header unificado (☰ + ‹ RESUMEN / mes ›),
    un titular de 22px que resume el mes ("Octubre viene en positivo: te
    quedaron $690k." / "...cerró en negativo: gastaste $X más de lo que
    entró.") y una lista de tarjetas de un hallazgo cada una.
  - Motor de frases (construirInsights): balance del mes, gastos del mes, la
    categoría que más se desvió para arriba y para abajo (≥10%/≤−10% contra
    su propio promedio del año), el mejor mes del año (con ≥3 meses de datos)
    y, parado en el mes en curso, una tarjeta por cada aviso de renderAlertas. …

## 6 de octubre de 2026

- **v140** · Rediseño de "Ahorros" (metas primero, anillo de avance, hoja de depósito)
  Implementa design_handoff_ahorros/README.md, opción 1d "Metas primero":

  - Header unificado (igual al de Movimientos/Tarjetas): ☰ + "Ahorros" centrado, sin
    navegación de mes (Ahorros es acumulado).
  - Franja de saldo (#fondo-kpis): Disponible en pesos + Fondo USD a la derecha,
    reemplaza los tres chips Disponible/Depositado/Retirado de antes.
  - La pantalla pasa a abrir con las metas: grilla de 2 columnas con anillo de avance
    (conic-gradient), "¡Meta cumplida!" al 100%, y una tarjeta "Nueva meta" fija al
    final. Tocar una meta deposita; mantenerla apretada (o el menú contextual) abre
    Editar/Eliminar, reemplazando la × que antes estaba siempre visible. …
- **v139** · Rediseño de "Tarjetas" (línea de tiempo, barras por tarjeta/categoría, Compras de este mes)
  Implementa design_handoff_tarjetas/README.md, opción 1c "Línea de tiempo":

  - Nueva línea de tiempo de meses (#tc-timeline) arriba de #page-tc, que reemplaza
    .month-nav y la proyección futura de "Cuotas pendientes": tocar cualquier mes
    —pasado, presente o futuro— lo selecciona (irAMesTc), con barra por mes, punto
    USD, trama para montos incompletos y scroll horizontal a la columna elegida.
  - El header reusa el de Movimientos 2a (.mov-topbar): ☰, flechas, "TARJETAS" +
    mes en dos líneas.
  - "Balance del mes" (#tc-balance) pasa a mostrar un total único más grande con
    subtítulo "+ USD x · N en cuotas · M fijos", y un selector Por tarjeta/Por …

## 3 de octubre de 2026

- **v138** · Rediseño de "Movimientos" (barra unificada, resumen número+barras, filtro segmentado)
  Reemplaza las cinco franjas apiladas de #page-mov (header, nav de mes, filtros, buscador,
  chips) por el sistema del handoff:

  - Header + nav de mes en una sola barra sticky (.mov-topbar), con ☰ adentro y el buscador
    detrás de una lupa (toggleMovSearch) en vez de siempre visible.
  - #mov-summary pasa de una grilla de chips a un número grande + barras entra/sale + leyenda,
    en los 4 filtros (Todos/Gasto/Ingreso/Tarjeta) — reusa exactamente los mismos totales que ya
    calculaba renderMovs(), solo cambia cómo se pintan.
  - Selector segmentado (#mov-filtros) con la cantidad de movimientos al lado de cada filtro, …

## 2 de octubre de 2026

- **v137** · Rediseño de "Cargar movimiento" (escala unificada, switches, barra fija)
  Reemplaza los 9 campos a ancho completo y las casillas de colores de #page-cargar
  por el sistema del handoff: selector de tipo fuera de la card, una card de monto con
  degradé y pill ARS/USD, pares de campos en dos columnas, fecha por chips + calendario
  nativo, opciones como interruptores (switch, no checkbox con tilde) y botón Guardar en
  una barra fija con fondo glass. Cubre los 5 tipos:

  - Gasto/Ingreso: categoría+subcategoría en dos columnas, nota de una línea, card de
    opciones con un switch nuevo para "Monto recuperable" (antes era un input siempre
    visible).
  - Tarjeta: franja de "valor por cuota" siempre visible, chips de cuotas en vez del …

## 29 de septiembre de 2026

- **v136** · Ingresos/Gastos/Balance consistentes entre pestañas de Movimientos
  Bug reportado con capturas: "Ingresos" mostraba un número distinto en
  "Todos" ($3.383.056) que en la pestaña "Ingresos" ($3.389.219) para el
  mismo mes — una diferencia de exactamente $6.163, el resultado reconocido
  de inversión del mes. Y en "Todos", Ingresos−Gastos tampoco cerraba con el
  Balance mostrado.

  Causa: "Todos" nunca sumaba el resultado de inversión (ganancia/pérdida
  reconocida, gananciaInvDelMes) a Ingresos/Gastos — solo lo mostraba como
  texto informativo aparte ("◈ Resultado: +$X") — mientras que la pestaña
  "Ingresos" sí lo sumaba a su total. Mismo mes, misma plata, contada
  distinto en cada pestaña. Y el Balance de "Todos" sumaba en cambio el …

## 24 de septiembre de 2026

- **v135** · Promedio mensual también al tocar una categoría en el Dashboard
  Pedido del usuario: extender el promedio de v134 (que hoy solo se ve en el
  total del gráfico principal) a cada categoría individual — tocar "Auto",
  "Sueldo", etc. en "Gastos por categoría" / "Ingresos por categoría" y ver
  también su promedio mensual ahí.

  Se extrae promedioDeCategoria(movsCat), función pura que agrupa por mes y
  calcula el promedio — mismo criterio que promedioMensualHTML() del gráfico
  general (v134): solo cuentan los meses en los que ESA categoría tuvo algún
  movimiento. Un mes sin gastos de "Auto" no es un mes de $0 en Auto, es un
  mes en que no se tocó esa categoría, y contarlo diluiría el promedio.

  showCatDetail() (la pantalla que ya se abre al tocar una categoría, tanto …
- **v134** · Promedio mensual de ingresos y gastos en el Dashboard
  Pedido del usuario: en la card "Ingresos, gastos y balance" del Dashboard,
  un total del año dice poco si no sabés a cuántos meses corresponde. Se
  agrega una línea "Promedio mensual (N meses): $X ingresos · $Y gastos"
  arriba del gráfico, con los mismos colores verde/rojo que ya usa el resto
  de la app para ingreso/gasto.

  Solo promedia meses CON datos, mismo criterio que comparativaMes() en
  analisis.js: un mes en $0 no es un mes flojo, es un mes que no se cargó (o
  que todavía no pasó), y contarlo hundiría el promedio.

  Se agrega promedioMensualHTML(yearData) como función pura en dashboard.js
  (mismo patrón que la ya existente detalleMesHTML) y se conecta en …

## 22 de septiembre de 2026

- **v133** · "Sale de mis ahorros" al vender dólares del fondo
  Pedido del usuario: la contraparte de v132 (guardar en el fondo al comprar)
  para cuando vende — marcar que los dólares que vende salen del fondo de
  ahorro, no de su cash.

  Nuevo checkbox "💸 Sale de mis ahorros (resta del fondo)" en Cambio → Vendo
  dólares (mismo texto que ya usa esa casilla en un Gasto común), y su
  contraparte en el editor. A diferencia de v132, acá NO hace falta un
  movimiento aparte: la pata que sale en una venta YA es un Gasto en USD, así
  que alcanza con ponerle usaAhorro:true directamente — el mismo mecanismo
  que "Sale de mis ahorros" en cualquier otro gasto (ver estado-categorias.js
  y ahorros.js), que ya resta del fondo y no toca el cash gastable. …
- **v132** · Guardar los dólares de una compra MEP directo en el fondo de ahorro
  Pedido del usuario: comprar dólares (MEP) para guardarlos, no para gastarlos,
  y poder corregir el monto al día siguiente (cuando liquida) sin perder esa
  marca.

  Nuevo checkbox "Guardarlos en el fondo de ahorro" en Cambio → Compro dólares
  (y en su editor). Al tildarlo se arma un movimiento MÁS —un Gasto en USD con
  esAhorro:true, el mismo mecanismo que ya usa cualquier otro depósito al
  fondo USD (ver ahorros.js)— en vez de darle un significado nuevo a la pata
  "entra" del cambio (que sigue siendo un Ingreso normal). No comparte
  cambioId con las dos patas —eso rompería leerCambio/guardarEditCambio, que
  asumen exactamente 2—: se liga por el nuevo campo `origenCambioId`.

  Con esto: …
- **v131** · No mezclar ARS y USD al detectar gastos habituales (Dashboard)
  Bug reportado: la alerta "gastos habituales que todavía no aparecen" en
  "Para tener en cuenta" mostraba montos sin sentido, tipo "Spotify ($1,29)".

  Causa: detectarRecurrentes() agrupaba por nota SIN separar por moneda. Un
  movimiento en USD guarda 0 en `importe` a propósito (el monto real vive en
  `importeOrig`, mismo criterio ya usado en registrosIncompletos) — al mezclar
  esos ceros con los meses pagados en ARS en la misma mediana, el "monto
  típico" resultante no era ni un monto en pesos ni en dólares real.

  Ahora se agrupa por nota + moneda (una suscripción se cobra siempre en la
  misma moneda, así que en la práctica esto no separa nada que debiera ir …

## 21 de septiembre de 2026

- **v130** · No romper el scroll por lotes al marcar pago/impago en meses viejos
  Bug reportado con captura: en un mes viejo con muchos movimientos (la lista
  se carga por lotes de 25 a medida que se scrollea, ver "LAZY LOADING"),
  tocar el badge de pago/impago de un gasto frecuente llamaba a renderMovs(),
  que reconstruye toda la lista desde el primer lote y arma un centinela de
  carga nuevo arriba de donde el usuario ya había scrolleado. Como ya lo había
  pasado de largo, el centinela nunca volvía a activarse: la lista quedaba
  "colgada" sin poder seguir cargando el resto del mes.

  toggleFrecPagado ya no llama a renderMovs(): ahora actualizarFilaFrecPagado()
  repinta en el lugar solo la fila <tx-item> que corresponde a ese gasto y ese …
- **v129** · Que el badge de un gasto frecuente invite a marcarlo pagado, no solo lo informe
  El usuario pagó un gasto frecuente durante el mes pero lo seguía viendo en
  rojo como "Impago": el toque para cambiarlo (agregado en v128) ya funcionaba,
  pero un badge que solo INFORMA el estado ("Impago") no deja claro que se
  puede tocar para cambiarlo — mismo problema de fondo que el filtro de fecha
  de v127, ahora en otro lugar de la app.

  En estado impago el texto pasa a ser la acción, no el estado: "🔁 Marcar
  pagado" en vez de "🔁 Impago". En estado pago no hace falta invitar a nada,
  así que se mantiene informativo: "✓ Pagado". También se agranda un poco el
  badge (era el tamaño de un badge meramente informativo) para que sea más …
- **v128** · Marcar gastos frecuentes como pagados o impagos, mes a mes
  El usuario pidió poder marcar si un gasto frecuente (alquiler, suscripciones)
  ya se pagó ese mes o no. El badge fijo "🔁 FRECUENTE" de la fila pasa a ser un
  botón: verde "🔁 Pagado" o rojo "🔁 Impago" según el estado, tocable para
  cambiarlo. El estado se guarda por mes (g.pagos = {ym: true/false}) en el
  gasto base, separado del importe y de los aumentos cargados: pagar o no pagar
  no cambia cuánto vale la cuota, y cambiar de mes no pisa el historial de los
  meses anteriores.

  No toca el cálculo de gastos/balance del mes: el gasto sigue contando como
  comprometido esté pagado o no, solo cambia el indicador visual. El toggle se …
- **v127** · Hacer visible el tap para volver al mes actual tras filtrar por fecha
  El usuario reportó que al filtrar Movimientos por fecha, la app no volvía
  sola al mes original: había que reabrir el modal y elegir el mes actual a
  mano. La lógica de estado ya era correcta (mesActual nunca se toca al
  aplicar un filtro, así que limpiarFiltroFecha() lo recupera intacto) y ya
  existía un toque sobre la etiqueta de fecha para volver, pero sin ningún
  indicio visual de que fuera tocable, por eso nunca se descubría solo.

  En vez de agregar el doble-toque sugerido (un gesto nuevo, menos
  descubrible y sin precedente en el resto de la app), se hace visible el
  toque simple que ya funcionaba: al aplicar un filtro, la etiqueta ahora …
- **v126** · Freno de doble toque al guardar, y duplicados en toda la lista
  Dos mejoras a pedido del usuario tras revisar el hallazgo de duplicados en
  Inversiones (v124): identificar la causa real, y no dejar el resto de los
  movimientos con el mismo problema sin cubrir.

  1. El botón "Guardar" no se bloqueaba mientras guardaba. Dos toques
     rápidos —común en un botón que tarda un instante en responder, o
     simplemente por costumbre— creaban dos movimientos IDÉNTICOS: es
     probablemente el origen real de los duplicados que aparecían en
     Inversiones, sin que hiciera falta ni un PDF. Pasaba en los cinco tipos
     (Gasto, Ingreso, Inversión, Tarjeta, Cambio), porque los cinco comparten
     el mismo guardar(). Ahora hay una guarda de fondo (una variable, no …
- **v125** · El botón de cargar usa la foto del perro en vez del +
  Pedido del usuario, con la foto que mandó. Recorte cuadrado centrado en la
  cara (ojo y hocico), reducido a 240×240 y comprimido a JPEG (~10KB) — no
  tiene sentido servir varios MB de una foto de teléfono para un botón de
  56px, y esta app ya es cuidadosa con el peso de lo que carga.

  El elemento sigue siendo el mismo <button id="fab-cargar"> con el mismo
  onclick: solo cambió lo que se ve. Sin <img> ni alt: es el fondo de un
  botón, no una imagen de contenido, y aria-label ya lo describe para quien
  usa lector de pantalla — ahora es lo ÚNICO que lo describe, así que se
  verificó que sigue estando.

  La foto se agrega también al ASSETS de sw.js: si no quedaba precacheada, …
- **v124** · Buscar duplicados en Inversiones
  Pedido del usuario: verificar si quedaron movimientos de inversión repetidos
  en la app, de cuando existió por un tiempo el importador de PDF de Balanz
  (v133-137, ya descartado al volver a v120). Ese código no está más en el
  repo, así que no hay nada que arreglar en el importador — pero los datos que
  haya cargado con él en ese momento siguen en el teléfono, porque volver a
  v120 cambió el código, no los datos guardados.

  No tengo acceso al teléfono del usuario para revisar sus datos reales, así
  que en vez de pedirle un backup para mirarlo yo, se agrega la herramienta a
  la app: "🔁 Buscar duplicados en Inversiones", en Limpieza de datos
  (Importar), al lado de "Buscar gastos atípicos". …
- **v123** · Estética: Dashboard sin la card vacía y con el gráfico ya con datos
  Dos ajustes al repasar el Dashboard con la misma vara que el resto de la app.

  1. "Para tener en cuenta" quedaba visible con un renglón "Nada para
     destacar" del mismo tamaño que las demás cards: la única que podía estar
     vacía y ocupar el mismo lugar que una con contenido real. Ahora, sin
     alertas, la card entera se oculta —título incluido—, igual que ya hacía
     #dash-usd-card cuando no hay dólares en el año. No hay nada que perder
     ocultándola: se vuelve a calcular sola en cada render.

  2. El recuadro de arriba del gráfico ("mes · ingresos · gastos · balance")
     arrancaba siempre con "Tocá un mes para ver el detalle" y se quedaba así …
- **v122** · Estética: lista diferenciada por tipo y separadores con más peso
  Sigue el repaso visual pedido: puntos 6 y 7.

  6. Con 20-30 movimientos en el mes la lista era una pared de tarjetas casi
     idénticas —mismo círculo, mismo borde gris, mismo tamaño— y había que leer
     cada una para saber qué era. Cada fila ya se coloreaba por tipo en dos
     lugares (el círculo del ícono y el monto), con un if/else calcado en cada
     uno; ahora esa clasificación vive en una sola función, claseTipoDeMov(), y
     se usa en los tres lugares: ícono, monto y un borde izquierdo nuevo en la
     fila entera. No se inventó ningún color: son las mismas cinco variables
     que ya pintaban el círculo (--danger/--success/--invest/--warning/--save).

  2. …
- **v121** · Estética: menú con íconos consistentes y casillas propias
  Tres ajustes del repaso visual pedido, sobre v120 (la versión a la que se
  volvió) y no sobre la línea v121-138 abandonada.

  1. El menú lateral mezclaba dos idiomas visuales: símbolos geométricos finos
     (≡ ▣ ◈ ◎ ⬆ ⚙) y un solo emoji real (🏦 Ahorros), cuando el resto de la
     app —categorías, chips, títulos de card— es emoji de punta a punta.
     Tarjetas e Inversiones pasan a 💳 y 📈, que ya eran sus íconos en otras
     pantallas (Cuentas, Inflación, la vista Acumulado de Ahorros): se
     reutilizan en vez de inventar otro par.

  2. Las casillas "Es un ahorro", "Sale de mis ahorros", "Es un traspaso" y
     "Gasto frecuente" (x2) vivían dentro de un label ya rediseñado —pill de …

## 20 de septiembre de 2026

- Volver a v120
  Pedido del usuario. De v121 a v138 entró todo en un día y medio —inversiones,
  posición inicial, pérdidas, valuaciones, MEP, importador de Balanz, unificar
  tickers, Disponible— y la app dejó de ser entendible para quien la usa, que es
  el único criterio que importa acá.

  El árbol queda idéntico al de v120 (1c568f2, viernes 18/09 16:39). No se
  reescribe historia: los commits de v121 a v138 siguen en la rama y este es un
  commit más encima, así que volver es un solo paso.

  Los datos no se tocan. Los movimientos conservan los campos que agregaron las
  versiones nuevas (refBalanz, tickerOrig, cierraPosicion, cambioId): v120 los
  ignora sin romperse. La posición inicial (fposini) y las valuaciones …
- Movimientos: una fila de chips que se suma a ojo y dice ganancia o pérdida
  Pedido: que la pantalla sea simple, que el resultado de inversiones diga
  "ganancia" o "pérdida" con todas las letras, y que el número grande sea la
  plata que se tiene AHORA para usar.

  ── Disponible ──
  El balance que había mide PATRIMONIO: guardar en el fondo no lo baja, porque
  la plata sigue siendo tuya. Es cierto y responde "¿crecí este mes?". Pero no
  responde "¿cuánto tengo para usar?", que es la pregunta de todos los días.

  Se agrega `disponible` al modelo, al lado de `balance` y sin reemplazarlo:

    Disponible = Ingresos − Gastos + Consumo pagado del fondo − Guardado − Invertido

  El término del medio es el que evita contar dos veces: una compra pagada con …
- No duplicar lo que ya cargaste a mano
  La card prometía "nunca duplica ni pisa nada" y era falso. Reconocer una
  operación por fecha + ticker + importe exactos alcanza para el PDF contra sí
  mismo, pero contra lo cargado a mano casi nunca coincide todo, y cada desajuste
  metía una copia. Probados los cuatro casos reales, los cuatro duplicaban:
  anotaste el bruto y el resumen trae el neto (XLK: $12.863,82 contra
  $12.794,29), pusiste la fecha en que se liquidó y el PDF usa la de
  concertación, redondeaste el monto, o le pusiste al fondo el nombre que usás
  vos en vez del de Balanz.

  La copia además no se nota: unificar tickers junta después las dos posiciones
  en una sola, así que una suscripción de $261.414,64 terminaba figurando como …
- Corregir el importe de los boletos: se estaba leyendo la fecha
  Con el resumen de mayo, que tiene bonos, AL30 entraba con importes como
  $2.052.026, $1.952.026 y $2.252.026. No eran montos: eran las fechas 20/5/2026,
  19/5/2026 y 22/5/2026 sin las barras. Tres bugs distintos del mismo origen.

  1. El umbral de kerning estaba mal puesto. El corte entre columnas era -400, y
     en mayo dos columnas venían separadas por 389,72, así que el monto y la
     comisión quedaban pegados ("55.025,00275,13"): eso corría todas las columnas
     y lo que se leía como importe era otra cosa. Medido sobre los resúmenes de
     mayo y agosto, los 184 saltos que caen DENTRO de una palabra son ajustes
     ópticos de la fuente y ninguno llega a 1; los saltos entre columnas arrancan …
- Importar varios resúmenes de una vez, sin perder operaciones repetidas
  Recuperar el histórico son doce resúmenes mensuales y de a uno es un trámite,
  así que el selector acepta varios PDF juntos: se leen en orden, un archivo
  ilegible se cuenta y se avisa sin cancelar a los demás, y la vista previa
  resume cuántas operaciones nuevas hay por mes en vez de listar cien filas.

  Importar meses viejos destapó un problema en el control de duplicados que con
  un solo mes no se veía. Se comparaba fecha + ticker + importe y se marcaba la
  clave como vista, pero eso no es una identidad: dos rescates de $20.000 el
  mismo día son dos operaciones reales, y quedaba uno solo. Ahora se usa el
  número de operación de Balanz —el boleto, o la liquidación del FCI— que es …
- Unificar tickers: el mismo instrumento con dos nombres
  Balanz usa sus propios nombres: al money market le dice BMMA y en la app está
  cargado como BCMMA; a la acción de YPF le dice YPFD. Importando el resumen
  quedan dos posiciones de la misma plata, y ninguna de las dos dice la verdad:
  las compras quedan bajo un ticker y las ventas bajo el otro, así que la venta
  no encuentra capital detrás y el modelo la cuenta entera como ganancia. Con
  $100.000 comprados como BCMMA y $62.575 vendidos como BMMA, la app mostraba
  $165.646 invertidos y $62.575 de ganancia; lo correcto es $103.071 y cero.

  Unificar renombra el ticker en todos los movimientos de inversión y junta lo
  que colgaba de él: la posición inicial se suma —es capital de la misma …
- Importador del resumen mensual de Balanz
  Cargar las operaciones a mano no escala, y el cruce contra el broker mostró meses
  enteros sin cargar. Ahora se sube el PDF del "Resumen mensual Comitente" y se leen las
  compras, ventas, suscripciones y rescates del mes.

  Sin ninguna librería: el PDF se lee con DecompressionStream, que es nativa. Tres cosas
  había que descubrir para poder parsearlo:

   1. La fuente usa un encoding propio desplazado 29 lugares ("%ROHWR" es "Boleto"). Los
      dígitos caen en caracteres de control, por eso el PDF parece no tener números cuando
      se lo mira crudo — están, invisibles.
   2. Las columnas NO se separan por espacios sino por el kerning del array TJ. Sin eso, …
- Cargar a mano la posición inicial de cualquier ticker
  Cruzando la app contra el resumen de Balanz apareció el hueco: la detección automática
  solo propone tickers con una venta sin ninguna compra detrás. Un ticker cuyas compras
  VIEJAS no están cargadas no tiene cómo delatarse solo.

  SPY es el caso: el broker dice 38 CEDEARs por $772.160 y en la app hay una sola compra
  de $236.402,86. Al 31/07 el broker ya mostraba 48 CEDEARs, o sea que casi toda la
  posición se compró antes de lo que está cargado. Nada de eso lo detecta la app.

  - Botón "Cargar a mano cualquier posición" en la card de posición inicial, con un modal
    que lista TODOS los tickers con movimientos. Debajo de cada uno dice el capital que …
- El chip Invertido mostraba en positivo algo que resta
  Tenías razón. `totales.invertido` es lo que pusiste menos lo que rescataste, así que
  poner plata da POSITIVO — y el chip mostraba "+$296.189" en abril 2026, un mes en que el
  balance BAJABA por esos mismos $296.189. Un número positivo que resta no se puede leer.

  El chip pasa a llevar el signo del EFECTO sobre el balance, que es el opuesto: invertir
  se ve en negativo, como cualquier plata que se va, y rescatar en positivo.

      Abril    Ingresos $3.250.598 · Gastos $3.093.609 · Invertido -$296.189 → -$139.201
      Junio    Ingresos $3.251.186 · Gastos $3.942.408 · Invertido +$794.391 →  $103.169

  La aritmética no cambió, solo cómo se lee: los cuatro chips ahora se suman de corrido. …
- Chip "Invertido": el balance vuelve a ser la plata que te queda a mano
  El balance pasa a ser de CAJA, con sus tres partes a la vista en la fila de chips:

      Balance = Ingresos − Gastos − Invertido

  Antes el término que faltaba —lo invertido— estaba repartido en las barras por ticker
  de abajo, así que mirando INGRESOS, GASTOS y BALANCE no había forma de llegar al número.
  Ahora los cuatro chips cierran la cuenta solos.

  - totalesDePlata() devuelve `invertido` (lo que pusiste menos lo que rescataste) y el
    balance sale de ahí. Sigue habiendo UNA sola definición: el Dashboard usa la misma, y
    las dos pantallas coinciden en los ocho meses con datos.
  - La ganancia reconocida ya no se suma al balance: entra sola cuando rescatás, porque …
- Movimientos y el Dashboard daban balances distintos del mismo mes
  Auditando la pantalla número por número: había DOS definiciones de Balance conviviendo.

    Dashboard   (totalesDePlata): Ingresos + resultado de inversiones − Gastos
    Movimientos (propia):         Ingresos − Gastos + Σ(flujo neto por ticker),
                                  y además le sumaba a Ingresos los retiros del
                                  fondo que se habían gastado.

  Con los datos reales: seis meses en desacuerdo, y en junio 2026 los dos con SIGNOS
  OPUESTOS — el Dashboard decía −$578.680 y Movimientos +$623.552, el mismo mes.

  La del modelo es la correcta, por lo mismo que ya vale para el ahorro, el traspaso y el …
- Comprar dólares no es gastar
  Auditando por qué los resultados del mes no se movían apareció esto: un cambio de
  moneda contaba como GASTO del mes. Era el único caso así. Guardar en el fondo,
  traspasar entre bolsillos y poner plata en una inversión ya salían de Gastos y se
  mostraban en un chip aparte, porque esa plata la seguís teniendo. Comprar dólares es
  exactamente lo mismo, y quedaba adentro.

  Con los datos reales eran $1.042.184 en once meses contados como gastados; diciembre
  2025 solo, $305.947. Y empeoraba con el MEP: unir las dos patas sacaba los pesos de
  "capital invertido" y los metía en Gastos.

  Había un test que fijaba el comportamiento viejo —el balance leído como un balance EN …
- El MEP no son dos inversiones, es un cambio de moneda
  Auditando el cálculo contra los datos reales apareció de dónde salía el número
  equivocado: $60.902,20 de "capital invertido" que no existen.

  Un MEP se carga como DOS movimientos de inversión con tickers distintos: la compra del
  bono en pesos (AL30) y su venta en dólares (AL30D). No son dos inversiones, es UN cambio
  de moneda. Contadas por separado mienten en direcciones opuestas: los pesos quedan como
  capital puesto en un ticker que nunca se vende, y los dólares como una venta sin ninguna
  compra detrás, o sea ganancia pura.

  cambio-moneda.js ya sabía representar un cambio, pero solo ofrecía completar la pata en …
- Cuánto vale hoy: el resultado no realizado
  El resultado era solo el REALIZADO: lo que ganaste o perdiste en operaciones ya
  cerradas. De una posición abierta la app sabe cuánto pusiste y nada más. Con los datos
  reales, si SPY —$158.486 puestos— hoy vale $140.000, esos $18.486 perdidos no aparecían
  en ninguna pantalla.

  La app no busca precios en ningún lado ni los va a buscar: el valor lo carga el usuario,
  que es el único que puede mirarlo en el broker.

  - js/valuaciones.js: por ticker, cuánto vale hoy y desde cuándo. El no realizado es
    valor − capital, por ticker y total.
  - Card "💰 Cuánto vale hoy" en Inversiones, con una fila por posición abierta, y un
    modal para cargarlas todas de una. Vaciar los dos campos borra el valor. …
- El modelo no podía expresar una pérdida
  Vender por menos de lo comprado dejaba la diferencia como "capital invertido" para
  siempre. Ninguna pérdida podía aparecer nunca: todo resultado salía positivo o cero.

  Con los datos reales, MCD —comprado a $54.238,57 y vendido a $53.581,03— figuraba con
  $657,54 "todavía invertidos" en la cartera, cuando la posición estaba cerrada y esos
  $657,54 son lo que se perdió. El resultado acumulado estaba inflado en esa misma plata.

  La app guarda montos, no cantidades, así que una venta más chica que el capital es
  ambigua: puede ser que vendiste todo a pérdida o que vendiste una parte (SPY tiene una
  venta de $77.916 sobre $236.403 puestos, que es vender un tercio). Esas dos no se …

## 19 de septiembre de 2026

- Un solo cuadro del mes para las dos pantallas que lo miran
  Movimientos encabezaba con "Resultado en Septiembre 2026 +$15.042" y la pestaña
  Inversiones, con los MISMOS movimientos del MISMO mes, con "Gasto neto en Septiembre
  2026 −$110.918". Una llamaba a las compras "invertido en el mes" y la otra "Gastos";
  una las pintaba de violeta y la otra de rojo. Los números por ticker coincidían exacto:
  lo que no coincidía eran las palabras.

  La pestaña Inversiones se había quedado con el marco anterior a todo el trabajo del
  modelo, el que trata una compra como un gasto.

  - cuadroMesInversionesHTML() en render-comun.js: un único renderizador para las dos
    pantallas. El de Inversiones agrega el desglose por categoría y nada más. …
- Movimientos mira el mes, Inversiones mira la cartera
  El cuadro de Movimientos mostraba el acumulado de toda la historia en una pantalla que
  se navega mes a mes: dos escalas mezcladas, que es lo mismo que venía confundiendo
  antes. Cada pantalla se queda con lo suyo.

  - Movimientos · "Inversiones del mes": el número grande pasa a ser el RESULTADO del
    mes, y las barras por ticker el movimiento del mes (negativo = pusiste plata y no la
    sacaste, en color de inversión y no en rojo de gasto). Un mes sin operar ya no
    muestra el cuadro: tener plata invertida es cartera, no un hecho del mes.
  - Inversiones · "Invertido hoy": card nueva con todo lo acumulado — cuánto sigue puesto, …
- Posición inicial: lo que ya tenías antes de empezar a usar la app
  "Primero recuperás capital, después ganás" necesita saber cuánto pusiste, y eso sale
  de las compras cargadas. Lo que compraste ANTES de usar la app no está en ninguna
  parte: el capital da 0 y la venta entera se cuenta como ganancia. En los datos reales
  son USD 666,53 así contados, y ESTRA1A sola aporta USD 551,21 en una sola venta de
  mayo — suficiente para que el mes figure mejor de lo que fue.

  - js/posicion-inicial.js: se guarda por ticker y por moneda cuánto valía lo que ya
    tenías, y se siembra como capital al arrancar el recorrido. No se carga como una
    compra falsa: eso ensuciaría los totales del mes, la lista y los chips de invertido. …
- Movimientos: un cuadro que dice cuánto tenés invertido, no cuánto moviste
  La pantalla mostraba el movimiento de inversiones del mes y en ningún lado cuánto
  seguía puesto. Con un fondo de liquidez que se suscribe y se rescata todo el tiempo,
  las dos cifras no se parecen: en septiembre 2026, $2.866.732 movidos hacia inversiones
  contra $385.692 realmente invertidos. Mirando solo el movimiento, el número grande se
  lee como si fuera la posición.

  - Cuadro "Inversiones" en la vista Todos: arriba lo invertido al cierre del período,
    abajo lo que se movió dentro de él y el resultado que dejó, cada cosa con su nombre.
    Una barra por ticker con el capital que sigue puesto.
  - capitalInvertidoHasta(ym) / capitalPorTickerHasta(ym) en resultado-inversiones.js: …

## 18 de septiembre de 2026

- Editar Gasto/Ingreso: paridad de campos con el alta, y un bug de corrupción
  El modal de Editar no tenía tres cosas que sí están al cargar un movimiento nuevo. La
  más grave era invisible hasta que se la buscaba a propósito.

  1. NO HABÍA SELECTOR DE MONEDA (bug de corrupción de datos)

  El alta siempre deja elegir ARS/USD. Editar un Gasto o Ingreso frecuente sí tenía ese
  selector, pero uno NORMAL no — y sin selector, guardarEdit() igual escribía el número
  en `importe` sin tocar `importeOrig` ni `moneda`.

  Reproducido: abrir un gasto en USD 54,21 y tocar "Guardar cambios" SIN CAMBIAR NADA
  dejaba el registro con importe=54.21 e importeOrig=54.21 A LA VEZ, moneda="USD" — el
  mismo monto contado en las dos monedas. …

## 17 de septiembre de 2026

- El detalle de "Resultado inversiones" decía $15.4M donde la barra decía $179K
  Bug mío de v110: al agregar la categoría no revisé su pantalla de detalle, y showCatDetail()
  la trataba como una categoría común. Sumaba TODOS los movimientos de inversión del año como
  si fueran ingresos, sin distinguir poner plata de sacarla:

    la barra del dashboard:  $176.669,61
    el detalle al tocarla:   $15.424.748,78   ← suscripciones + rescates, todos en positivo

  Y el desglose no decía nada: "FCI Suscripción $5,2M" al lado de "FCI Rescate capital $5,2M",
  los dos en el mismo color y el mismo signo. Es la misma plata yendo y volviendo.

  AHORA TIENE SU PROPIA PANTALLA

    GANANCIA RECONOCIDA 2026
    +$176.669,61        ← el mismo número que la barra …
- Los números cuentan, el mes se desliza, y los gráficos respetan el sistema
  Las tres que quedaron pendientes, más una corrección de algo que propuse mal.

  1. LOS NÚMEROS GRANDES CUENTAN

  animarNumero() existía pero solo se usaba en los chips de Movimientos y Dashboard. Ahora
  también cuenta el número grande de "A pagar este mes" en Tarjetas y los tres chips de
  Ahorros (Disponible, Depositado, Retirado), que estaban quietos.

  Se resuelve con un atributo data-animar y no con un id por número: los chips se generan en
  lote, y con ids habría que inventar uno por chip y acordarse de cablearlo. data-animar-fmt
  elige el formateador.

  Un importe roto no se toca: el render ya puso "—" ahí, y animarlo sería trabajo al pedo.

  2. EL MES SE DESLIZA HACIA DONDE FUISTE …
- Las barras crecen, las cards entran en cascada, y el toque responde
  Cuatro cambios chicos de movimiento. Ninguno se interpone con leer un número: todos duran
  menos de 600 ms y terminan quietos.

  LAS BARRAS CRECEN DESDE CERO

  .bar-fill tenía `transition:width .4s` que NUNCA se disparaba: el div nace con su ancho
  final puesto inline, así que no hay valor previo desde el cual transicionar. Era una
  animación muerta desde siempre. Ahora entra con un keyframe, y se ve en todos lados: gastos
  por categoría, por tarjeta, el ranking de ahorros, los top tickers.

  Va por scaleX y no por width a propósito: width recalcula layout en cada cuadro, scaleX lo
  resuelve la GPU. En un celular la diferencia se nota.

  LAS CARDS ENTRAN EN CASCADA …
- Un backup ajeno ya no puede ejecutar código con tus datos abiertos
  restaurarBackup() copia iconsCustom y el emoji de las metas TAL CUAL del archivo, y esos
  valores se interpolaban en innerHTML en más de quince lugares sin escapar. Un backup
  preparado a mala fe traía, en vez de un emoji, código que se ejecutaba al dibujar
  cualquier pantalla — con la app ya desbloqueada y los datos descifrados en memoria.

  Verificado de punta a punta en la app real, con el payload que dejaría ese backup:

    antes:  código ejecutado SÍ · 4 etiquetas inyectadas · "onerror" vivo en el DOM
    ahora:  código ejecutado NO · 0 etiquetas · nada de eso en el DOM

  DÓNDE SE CORTA

  En iconoSeguro(), dentro de getIcon(), y no en cada interpolación. Escapar en dieciséis …
- "Sí lo gasté" y "No es un cambio" no hacían nada si tenés PIN
  La lista de "no me lo muestres más" se ESCRIBÍA en localStorage y se LEÍA con
  leerJSONSeguro(), que pasa por getSensitiveRaw(). Con el PIN activo los datos no viven en
  localStorage: viven en encCache. Así que el descarte se guardaba donde nadie lo busca, el
  movimiento volvía a aparecer al instante y desde afuera el botón parecía muerto.

  Reproducido con datos reales y el cifrado activo:

    antes:  "Sí lo gasté" → candidatos 4 → 4 ✗   (quedó en localStorage: [1787842154033])
    ahora:  "Sí lo gasté" → candidatos 4 → 3 ✓   (queda en encCache, que es donde se lee)

  Sin PIN funcionaba, y por eso no lo agarré: todas mis pruebas corrían sin cifrado. …
- El botón "Completar" de las compras de dólares no hacía nada
  Reproducido con datos reales: tocar "Completar" en una fila de "$0,00", cargar el monto y
  aceptar dejaba el movimiento igual. Son dos bugs míos, de la versión pasada.

  1. UNA VENTA DE BONOS NO ES UNA COMPRA DE DÓLARES

  Al abrir la migración de cambios a los movimientos de tipo Inversion (para las compras MEP),
  entraron también las "Bonos USD / Bonos USD Venta": el texto tiene AL30 y USD, así que
  matchean las pistas. Pero vender un bono no es cambiar moneda, y se ofrecía completarlas con
  un monto en pesos que nunca existió. Ahora solo entran las compras, no las ventas, y solo si
  tienen un monto propio desde el cual completar.

  2. LA MONEDA SALÍA DE m.moneda, QUE EN UNA INVERSIÓN NO LA DICE …
- Un chip por ticker, e Ingresos y Gastos limpios de inversiones
  Los montos de inversión son de otra escala que el sueldo y el supermercado: mezclados en
  Ingresos y Gastos tapaban la lectura que se mira todos los días. Ahora van aparte.

    Ingresos = ingresos puros + los retiros del fondo que se consumieron
    Gastos   = consumo
    Balance  = Ingresos − Gastos + Σ (neto de cada ticker)

  Un chip por cada ticker operado en el mes, con neto = rescates − suscripciones, ordenados
  de mayor a menor por monto en juego. Positivo va en verde con signo +; negativo va en
  color de inversión y no en rojo de gasto, porque poner plata en algo no es perderla:
  significa que está puesta ahí, todavía sin rescatar.

  Con datos reales, agosto 2026: …
- Traspasos: plata que cambia de bolsillo no es un gasto
  A la app le faltaba un concepto. La casilla "💸 Sale de mis ahorros" está pensada para
  una COMPRA pagada con plata del fondo —unas vacaciones, por ejemplo— y eso sí es
  consumo. Pero al no haber otra opción, sacar plata del fondo para ponerla en CEDEARs se
  marcaba igual, y esa plata figuraba gastada aunque la seguís teniendo.

  En los datos reales son cuatro movimientos "Fondo de Retiro / Cedears" por $1.040.321,
  y caen justo en los meses que daban rojo:

    Junio    −$579.688  →   −$59.306    (traspasado: $520.382)
    Julio    +$173.607  →  +$408.436    (traspasado: $234.829)
    Agosto   −$745.231  →  −$460.121    (traspasado: $285.110) …
- El chip de una categoría filtrada vuelve a ser la suma de lo que se ve
  Bug mío, introducido ayer con el cambio de inversiones.

  Al filtrar por una categoría, el chip le sumaba la ganancia de inversión DEL MES ENTERO.
  Filtrando "Salario" en agosto 2026, con un único movimiento de $1.607.621,32, el chip
  decía $1.655.232: los $47.610 de más eran la ganancia del FCI, que no tiene nada que ver
  con el salario. Lo mismo con "SALARIO USD 1,17", que era la ganancia del AL30D.

  Ahora, con una categoría elegida, el chip suma exactamente los movimientos que se ven en
  la lista. Si dice "Salario", es tu salario. Sin filtro sigue respondiendo "cuánto entró de
  verdad": ingresos + ganancia. …
- Las inversiones dejan de ser ingreso y gasto: solo cuenta el resultado
  Comprar una inversión no es un gasto y venderla no es un ingreso: es la misma plata
  cambiando de lugar. Lo único que mueve tu patrimonio es el resultado.

  Contarlas enteras inflaba los dos totales en cada rotación. Con los datos reales de
  2026: $7.566.837 sumados como "ingreso por inversiones" cuando lo ganado fueron
  $176.670 — de cada $100 que figuraban como ingreso, $2,30 eran reales.

  Pero lo peor no eran los totales: era que daba vuelta el orden de los meses. Junio
  figuraba +$545.675 y julio −$790.624. En realidad junio fue −$579.688 y julio
  +$173.607. Los dos con el signo cambiado, en el número que se mira para saber cómo
  viene el mes. …

## 16 de septiembre de 2026

- Vuelve "Por categoría" en Ahorros y llega a Tarjetas
  Dos cosas pedidas, y una que apareció en el camino.

  ── AHORROS ──

  Sacar la vista "Por categoría" fue un error mío: dejaba la tarjeta con dos vistas
  que, si ahorrás más o menos lo mismo todos los meses, cuentan la misma historia
  ("vengo ahorrando") y ninguna responde la que importa, que es dónde está la plata.
  El ranking sí la respondía, pero vivía abajo de todo, fuera de la pantalla.

  Vuelve el botón, pero sin la duplicación que había antes. El desglose por categoría
  ES el ranking, no un dibujo aparte en canvas: el canvas mezclaba pesos con dólares
  en un solo número y cortaba el nombre de la categoría a 15 caracteres. Ahora el botón …
- Sacar la vista "Por categoría" de Ahorros
  La tarjeta "Mis ahorros" tenía tres botones de vista, y el tercero mostraba lo mismo
  que el ranking que está tres centímetros más abajo — pero peor:

  - Sumaba pesos y dólares en un solo número. El ranking los separa, que es lo correcto:
    ARS y USD nunca se mezclan en un mismo total.
  - Cortaba el nombre de la categoría a 15 caracteres, el mismo problema que acabamos de
    arreglar en las barras del dashboard.
  - Había que acordarse de tocar el botón. El ranking se ve siempre.
  - El ranking además trae el ícono, el % del total, la cantidad de movimientos, el
    desglose depositado/retirado y se toca para ver el detalle. La vista no traía nada
    de eso. …
- Un solo gráfico para ingresos, gastos y balance
  El dashboard tenía dos tarjetas seguidas con el mismo dato contado dos veces: las
  barras de "Ingresos vs Gastos" y, abajo, una línea de "Balance mensual". Pero el
  balance es exactamente ingreso − gasto, sobre los mismos meses y en la misma unidad
  (pesos), así que había que mirar dos gráficos y estimar a ojo cómo se relacionaban.

  Ahora la línea del balance va encima de las barras, contra el mismo eje Y. Un solo
  eje, no dos escalas superpuestas: superponer dos escalas distintas alinea las series
  de forma arbitraria e inventa relaciones que los datos no tienen. Acá las tres series
  comparten unidad, así que la comparación es real: se ve de una que la línea cae …
- Etiquetas de barras: no truncar el nombre de la categoría, envolverlo
  .bar-label cortaba con "…" a los 108px de ancho fijo. En cualquier
  categoría, tarjeta o ticker con nombre largo ("Vacaciones Gastos",
  "Gastos propios de la casa") el texto quedaba "Vacaciones Gas…" y no
  había forma de saber cuál era la categoría real sin ir a buscarla a
  otro lado (Configuración → Categorías, o tocar la barra).

  Se saca white-space:nowrap / overflow:hidden / text-overflow:ellipsis
  y se deja que el texto envuelva a la línea siguiente. La fila se hace
  más alta cuando el nombre no entra en una línea, pero el dato nunca se
  pierde. El ancho fijo de 108px se mantiene: es lo que alinea las barras
  de todas las filas en la misma columna. …
- Un número roto deja de verse como "$0"
  fmtTotal(NaN) devolvía "$0", igual que fmtTotal(0). Pero un cero es un
  DATO ("este mes no gastaste nada") y un NaN es la AUSENCIA de dato.
  Mostrarlos igual es lo que escondió durante meses el saldo USD mal
  calculado: una tarjeta sin `total` daba NaN, el total del mes daba NaN, y
  la pantalla decía "$0" como si estuviera todo bien.

  Ahora los cuatro formatos de plata (fmt, fmtTotal, fmtAbbr, fmtMoneda)
  devuelven "—" cuando el valor no es un número, y "$0" cuando es un cero de
  verdad. Se unificó el chequeo en numeroRoto(): `isFinite(Number(x))` cubre
  NaN e Infinity, y las comparaciones explícitas con null y "" hacen falta …
- Avisar cuando la app quedó con una versión vieja, y poder deshacer un descarte
  EL PROBLEMA, visto hoy en el celular: el label decía "enola-v103" mientras
  en pantalla estaba la card de Inflación, que es de v104. Pasa por diseño
  del service worker — index.html se pide SIEMPRE a la red, pero los .js se
  sirven primero desde caché — así que HTML nuevo convive con JavaScript
  viejo sin ningún indicio.

  Es peor que un bug común porque hace parecer que OTROS arreglos no
  funcionan: en ese estado, bajar la serie de inflación la habría guardado
  bien y el dashboard la habría ignorado, sin una sola señal.

  EL AVISO: index.html ahora declara qué versión espera
  (<meta name="enola-version">) y al arrancar la compara con la que reporta
  el service worker. …
- Inflación: bajar la serie de una API pública, o pegarla a mano
  INFLACION_MENSUAL_ARS tenía 4 meses cargados a mano de los ~30 que hacen
  falta, así que la comparación interanual no se mostraba nunca: la regla es
  no mostrar ningún porcentaje si falta un mes del tramo. Una función entera
  de la app estaba apagada.

  NUEVO js/inflacion.js — parseo, validación, almacenamiento y descarga.
  Puro, sin DOM, salvo el render del final.

  DE DÓNDE SALE: se prueban en orden api.argentinadatos.com y
  apis.datos.gob.ar, y se usa la primera que conteste algo válido. Quedaba
  un riesgo que no se puede resolver desde acá: esta app es una PWA sin
  backend, así que el pedido sale del navegador y la API tiene que mandar …
- Guardado: dejar de perder el último cambio cuando el disco está lleno
  Si el almacenamiento se llenaba, localStorage.setItem() tiraba
  QuotaExceededError y NO había un solo try/catch alrededor de save() en
  toda la app. El cambio quedaba solo en memoria —o sea, se veía en la
  lista como si estuviera guardado— salía un banner rojo con texto técnico,
  y al recargar no estaba. Reproducido: memoria 2, disco 1.

  CÓMO SE RESUELVE SIN PERDER NADA: el backup se arma desde la MEMORIA, no
  desde el disco (ver exportarBackup), así que se puede bajar aunque no
  entre un byte más. Cuando un guardado falla, entonces:

  1. Se devuelven a disco las claves que sí llegaron a escribirse. save()
     escribe 4; si reventaba en la segunda, la primera quedaba con datos …
- Movimientos: ordenar la lista también en Gastos, Ingresos y Tarjetas
  Solo la solapa "Todos" ordenaba por fecha. Las otras tres usaban
  mesMovs.filter(...) tal cual, o sea el orden del array `movs`, que es el
  orden en que fuiste cargando los movimientos. Como uno nuevo se agrega al
  final del array, aparecía al FONDO de la lista en vez de arriba bajo
  "Hoy", y con la carga por lotes quedaba directamente fuera de la primera
  pantalla. Los encabezados de fecha, que se arman recorriendo la lista en
  orden, salían además salteados y repetidos.

  Reproducido con 4 gastos cargados del 1 al 15 más uno de hoy:
    Todos  → Hoy · Ayer · 12 · 5 · 1     (bien)
    Gastos → 1 · 5 · 12 · Ayer · Hoy     (al revés, y "Hoy" último) …
- Cambio de moneda: que las dos patas se lean bien en la lista de movimientos
  Lo pedido —la pata en pesos entre los gastos y la de dólares entre los
  ingresos— ya funcionaba: cada pata es un movimiento normal, así que la de
  ARS es tipo Gasto (roja, con "-") y la de USD es tipo Ingreso (verde, con
  "+"), y los filtros Gastos/Ingresos las separan solas. Lo que estaba mal
  era cómo se veían:

  - El ícono era una "C", la inicial de "Cambio de moneda", porque no había
    ninguna regla que le diera emoji. Ahora es 💱, y la regla cubre también
    las categorías propias que se usan para lo mismo (MEP, dólar, blue, CCL).
  - El tipo de cambio no aparecía en ningún lado de la fila: había que abrir
    el editor para saber a cuánto compraste. Ahora va en el subtítulo …
- Cambio de moneda: comprar dólares deja de contar como gasto dos veces
  EL PROBLEMA: comprar dólares toca DOS monedas, pero un movimiento guarda
  una sola (si es USD, la columna en pesos queda en 0). Cargándolo en pesos,
  los dólares no quedan registrados; cargándolo en dólares, los pesos no
  salen. Y como después el gasto se vuelve a cargar al usar esos dólares,
  la misma plata terminaba contada dos veces. De paso, eso explicaba por
  qué el "Saldo neto USD" siempre daba negativo: nunca había un ingreso en
  dólares, así que todo lo que la app veía en USD eran salidas.

  LA SOLUCIÓN: un cambio se guarda como DOS movimientos ligados por
  `cambioId`, uno por cada pata:

    Compra de dólares          Venta de dólares
    ├─ sale : Gasto   en ARS   ├─ sale : Gasto   en USD …
- Dashboard USD: arreglar el saldo, que restaba dos veces, y mostrar los movimientos
  EL BUG: una compra pagada con dólares del fondo de ahorro se descontaba
  dos veces. Una sola compra de USD 500 hacía figurar un saldo de USD -1000.

  La fórmula era:
    neto = ing - gas + aho - ret + invEntrada - invSalida - tcUSD
  `ret` (compras pagadas con el fondo) y `aho` (depósitos al fondo) son los
  dos esGasto(), así que ya venían restados dentro de `gas`; restar `ret`
  aparte lo contaba por segunda vez. Ahora se usa la misma regla que el
  resto de la app (totalesDePlata):
    neto = ing + ret + invEntrada - gasTotal - invSalida - tcUSD
  Con eso: un retiro queda neutro (sacás dólares del fondo y los gastás en
  el mismo acto), un depósito resta, un gasto resta y un ingreso suma. …
- Análisis local: mejor categorización, alertas proactivas y simulador de cuotas
  Los tres puntos que se podían hacer sin pagar nada. Todo se calcula en el
  dispositivo con los movimientos ya cargados: no sale nada a internet, no
  hace falta ninguna clave de API y funciona sin conexión.

  NUEVO ARCHIVO js/analisis.js — funciones puras, sin DOM, para poder
  probarlas de verdad; el render vive al final, separado.

  1) CATEGORIZACIÓN (punto 1)
  buscarSugerencia() ahora delega en sugerirCategoriaPara(), que mejora lo
  que había en cuatro cosas:
  - Normaliza el texto: saca acentos y puntuación, y colapsa la ñ a n, así
    "Almacén" y "almacen" son la misma clave (antes no).
  - Descarta palabras vacías. Antes "pago de la nafta" y "pago de la pizza" …

## 15 de septiembre de 2026

- Cuotas pendientes: arrancar en el mes siguiente al que estás mirando
  El mes en curso aparecía dos veces: detallado en "Balance del mes" y
  otra vez como primera cajita de "Cuotas pendientes", donde tocarla
  mostraba la misma lista. Ahora la grilla arranca en mesTc+1, así cada
  mes aparece una sola vez: arriba lo que pagás este mes (con desglose
  por tarjeta y los gastos de mayor a menor), abajo lo que viene después.

  El encabezado pasa de "8 meses por delante · $X en total" a "Después de
  Septiembre 2026 · 7 meses · $Y en total". Dice desde cuándo cuenta para
  que el total más chico no parezca plata perdida, y el conteo de meses
  ahora es cierto: antes contaba como "por delante" el mes que estás
  pagando. El vacío también se aclara: "Nada pendiente después de X". …
- Tarjetas: quitar la fila de chips del resumen
  Los cuadritos de arriba (Total ARS, Total USD, Gastos, Pendiente ARS,
  Pendiente USD) repetían números que ya están en las dos cards, y con
  cinco chips la fila se partía en dos renglones antes de mostrar nada
  útil. Nada se pierde:

  - Total ARS / Total USD y la cantidad de gastos → "Balance del mes"
    ("A pagar este mes ... + USD X" y "N gastos en este mes").
  - Pendiente ARS / Pendiente USD → "Cuotas pendientes", que ya encabeza
    con "N meses por delante · $X + USD Y en total".

  Con los chips se va el código que solo los alimentaba: `activas` y el
  cálculo de saldoPendienteARS/saldoPendienteUSD.

  sw.js: CACHE_VERSION → enola-v96.

  110 tests en verde. …
- Tarjetas: quitar también "Completados" — la solapa termina en Cuotas pendientes
  Después de Cuotas pendientes no va nada más, a pedido. "Completados" era
  el otro desglose por compra cargada; editar o borrar una tarjeta se hace
  desde Movimientos.

  - index.html: se va el contenedor #tc-completas. La solapa queda con dos
    cards: Balance del mes y Cuotas pendientes.
  - tarjetas-inversiones.js: se va el bloque de render y el filtro
    `completas`, que queda sin usos. `activas` sí se sigue calculando: de
    ahí salen los chips "Pendiente ARS"/"Pendiente USD" del resumen.
  - borrarTc() queda sin usos y se elimina. Movimientos borra tarjetas con
    confirmarBorrarTc(), que es otra función. openEditTcModal() se queda:
    la sigue usando Movimientos. …
- Tarjetas: quitar la sección "Activas"
  La solapa Tarjetas queda con Balance del mes + Cuotas pendientes +
  Completados. "Activas" mostraba una card por compra cargada (balances,
  barra de progreso, contador de cuotas), un desglose movimiento por
  movimiento que ya está cubierto por la card de Cuotas pendientes —
  proyección mes a mes con desglose al tocar — más el Balance del mes.

  - index.html: se va el contenedor #tc-activas.
  - tarjetas-inversiones.js: se va el bloque de render. `activas` se
    sigue calculando porque de ahí salen los chips "Pendiente ARS" y
    "Pendiente USD" del resumen.
  - calcTotalFrecuente() queda sin usos (solo la llamaba la card de
    gasto frecuente de Activas) y se elimina. …
- Tarjetas: las cards "Activas" quedan solo con balances y progreso
  A pedido, se sacó de cada card en Activas todo lo que no fuera números:
  - El bloque "Próximas cuotas" / "Próximos meses": mostraba lo mismo que la
    card de Cuotas pendientes agregada esta misma sesión, con otro formato.
  - El historial de "Aumentos" de un gasto frecuente.
  - Los botones Editar y Eliminar.

  Queda: nombre y tarjeta, el badge de cuota (o "FRECUENTE"), los balances
  (Por cuota / Total gasto / Saldo pendiente / Última cuota, o el equivalente
  para gasto frecuente: Monto actual / Meses activos / Total pagado /
  Vigencia), la barra de progreso y "N pagadas / M restantes".

  Confirmado explícitamente antes de sacar los botones: openEditTcModal() y …
- Recordatorio de backup: línea de estado + aviso emergente con cooldown
  La función de backup ya existía (exportar/restaurar) y funciona, pero nada
  avisaba si hacía mucho que no se usaba. Dos piezas:

  1. Línea de estado en Configuración → Copia de seguridad, siempre visible:
     "Último backup: hace 12 días" / "hoy" / "ayer" / "Todavía no hiciste
     ningún backup." En amarillo a partir de 30 días, en rojo si nunca se hizo
     uno. Se actualiza sola al exportar o restaurar (restaurar deja los datos
     iguales a un archivo que YA existe afuera, así que para este propósito
     cuenta igual que un backup recién hecho).

  2. Aviso emergente al abrir la app (con el sistema de diálogos propio, no uno
     nativo), pero con dos frenos para no ser molesto: …
- Ocultar % de inflación sin datos completos, y blindar la carga de datos guardados
  Dos hallazgos de la última revisión, más uno que apareció verificándolos.

  1. LOS PORCENTAJES DEL DASHBOARD MENTÍAN. INFLACION_MENSUAL_ARS tiene 4 meses
     cargados a propósito (documentado: "completar con el resto"), y
     deflactarARS() trata cada mes sin dato como 0%. Resultado: gastaste lo
     MISMO en términos reales en 2025 y 2026, y la app mostraba "▲ 84%".

     inflacionCompleta(ymOrigen, ymDestino) dice si el tramo tiene TODOS los
     meses cargados. compAnioAnterior() ahora recibe ese dato y, si falta algún
     mes, no muestra ningún porcentaje — mejor no decir nada que mostrar un
     número que parece preciso y no lo es. "nuevo" no se ve afectado: no …
- Tarjetas: card de cuotas pendientes por mes, con desglose al tocar
  Después del balance del mes va una card nueva con una caja por mes: el monto
  que queda por pagar y cuántas cuotas lo componen. Al tocar una caja se abre
  abajo el desglose de las compras que arman ese monto, con su tarjeta y su
  número de cuota. Tocarla de nuevo lo cierra.

  Reemplaza el recuadro fijo de "Próximos meses", que mostraba 3 meses y no se
  podía tocar. Ahora llega hasta la última cuota: con una compra en 12 cuotas
  desde mayo, proyecta los 8 meses que faltan.

  Un gasto mensual fijo (Netflix, una suscripción) aparece DENTRO de cada mes
  porque también lo vas a pagar, pero no define hasta dónde llega la proyección: …
- Poner Tarjetas en el menú: la pantalla existía pero era inalcanzable
  page-tc estaba construida (renderTarjetas(), 239 líneas: total del mes, desglose
  por tarjeta, detalle de cuotas, próximos meses y una tarjeta por compra con su
  línea de tiempo) y showPage() la contemplaba, pero NINGÚN botón navegaba a ella.
  El menú lateral tenía 6 ítems y Tarjetas no estaba. Era una pantalla entera
  terminada que no se podía abrir.

  Ahora está en el menú, entre Movimientos e Inversiones.

  De paso, dos cosas que aparecieron al verificar:

  1. En el refactor de estilos borré .seccion-label-sep del CSS pero dejé los 10
     usos apuntando a una clase inexistente: esos rótulos perdieron su margen sin
     que nada avisara. Pasan a .mb-6. El test que debía atajarlo comparaba contra …
- Precisión de números, íconos, badge "nuevo" y despeje del botón +
  Los cuatro pendientes de la auditoría.

  PRECISIÓN. En la misma pantalla convivían "$14.236.967,97" y "$2.1M": tres
  precisiones distintas. Los centavos en una cifra de ocho dígitos son dos
  dígitos que nadie usa y que hacen más lento leer el número. fmtTotal() los
  saca de los 20 chips de resumen y de los balances destacados; fmtS() los
  mantiene donde sirven, en el importe de un movimiento.

  ÍCONOS. El mapa ICONS son las 25 categorías con las que arrancó la app
  ("Enola", "Tany", "Alquiler Lujan"): cualquier categoría creada después
  quedaba con un puntito gris, indistinguible de todas las otras categorías
  nuevas en una lista. Ahora 33 reglas adivinan un ícono por el nombre …
- Sacar los estilos repetidos a clases
  El diseño vivía dentro de strings: 629 style="" repartidos entre los .js y el
  HTML, contra 85 clases CSS. Cambiar un espaciado o un color era buscar y
  reemplazar en cientos de lugares, y por eso el mismo componente había derivado
  en versiones distintas según el archivo.

  El caso más claro: el badge (AHORRO, DE AHORROS, 🔁 FRECUENTE, USD…) estaba
  escrito inline 21 veces con NUEVE ortografías distintas — padding 1px 5px vs
  1px 6px, radio 6px vs 8px, con y sin font-weight. Se veían apenas distintos
  según la pantalla. El rótulo de sección en mayúsculas tenía seis variantes,
  que solo diferían en el margen.

  Ahora hay una clase por componente (.badge + color, .seccion-label, .inset), …
- Compactar la lista de movimientos
  Cada fila repetía dos cosas que ya estaban en pantalla: la fecha, que vive en
  el encabezado del grupo justo arriba ("24 de septiembre"), y "Otros", la
  subcategoría por defecto, idéntica en casi todos los renglones. El subtítulo
  decía "Otros · 28/09/2026 · Pedido ya"; ahora dice "Pedido ya".

  Medido sobre un mes de 13 movimientos en un celular de 412x915:

    antes:  60px de fila + 28px de separador = 88px por movimiento
    ahora:  50px de fila + 20px de separador = 70px por movimiento   (-20%)

  Entran 9 movimientos en pantalla sin achicar la tipografía de los importes.

  subtituloFila() junta solo las partes que aportan algo, así que no quedan …
- Una sola definición de gasto, y arreglar el balance inflado
  La regla de qué cuenta como gasto estaba escrita a mano en 55 lugares y no
  todos decían lo mismo. Peor: la mayoría estaba mal.

  Un movimiento con usaAhorro es UNA compra pagada con plata del fondo. Los
  totales del mes, el balance por cuenta, el gráfico anual y el flujo USD lo
  sumaban como ingreso ("la plata vuelve a la mano") y NUNCA lo restaban como
  gasto. Con sueldo 1.000.000, un gasto de 200.000 y una compra de 300.000
  pagada con ahorros:

    antes:  Ingresos 1.300.000 · Gastos 200.000 · Balance 1.100.000
    ahora:  Ingresos 1.300.000 · Gastos 500.000 · Balance   800.000

  El balance venía inflado en exactamente la plata que sacabas del fondo. Y el …
- Hacer legible la vista Acumulado de Ahorros
  Tres cambios sobre cómo se dibuja; no se toca cómo se calculan los datos.

  1. El eje X ahora es tiempo real. Antes solo se dibujaban los meses CON
     movimiento, repartidos parejo, así que diez meses sin ahorrar ocupaban el
     mismo ancho que uno y la curva parecía crecimiento sostenido donde en
     realidad había una meseta. Con un caso de ahorro irregular en dos años
     eran 14 meses de calendario metidos en 5 puntos; ahora son 14 puntos y el
     parate se ve como lo que es. rellenarMesesSinMovimiento() completa con 0,
     o sea el acumulado los arrastra plano, y el saldo final no cambia: sigue
     siendo el mismo que muestra el chip "Disponible". …
- Arreglar el tap en la curva de ahorros
  Dos bugs en drawInteractiveLine(), los dos en la vista "Acumulado", que es la
  que ves al entrar a Ahorros.

  1. El tap no mostraba nada. El handler escribía el detalle en el tooltip y
     acto seguido llamaba a renderAhorroChart(), cuya primera acción es limpiar
     ese mismo texto. Capturado en orden con un MutationObserver:
       1. renderAhorroChart() -> limpia el tooltip
       2. tooltip ahora = ""
     Las vistas "Por mes" y "Por categoría" andaban porque no re-renderizan.
     Ahora el tap redibuja llamando a drawInteractiveLine() directamente, y el
     detalle se escribe después del redibujo. renderAhorroChart() sigue …
- Cada pestaña recuerda dónde la dejaste
  El commit anterior mandaba toda pestaña arriba de todo al cambiar. Arreglaba
  el formulario de carga, pero te hacía perder el lugar en la lista de
  movimientos cada vez que ibas al Dashboard y volvías.

  Ahora showPage() anota el scroll de la pestaña que estás dejando, antes de
  ocultarla, y repone el de la que abrís. "Cargar" es la excepción declarada en
  PAGINAS_SIEMPRE_ARRIBA: es un formulario, no una lista, así que siempre se
  abre arriba con el Importe a la vista — que era el problema original.

  Dos detalles de implementación que importan:
  - El scroll se repone al FINAL de showPage(), después de los render. Si se
    hace antes, la página todavía tiene el alto viejo y el navegador recorta la …
- Abrir "Nuevo movimiento" arriba de todo, no a mitad del formulario
  Las pestañas son divs en el mismo documento que se muestran y ocultan con
  una clase, así que comparten UN solo scroll. showPage() nunca lo reseteaba:
  si venías scrolleado en la lista de movimientos y tocabas el + para cargar
  uno nuevo, entrabas al formulario con ese mismo scroll y el campo Importe
  quedaba arriba del borde de la pantalla. Había que scrollear para arriba
  para poder escribir el monto.

  Reproducido con un celular de 412x915: scrollY=700 en la lista, al abrir
  Cargar quedaba en 302 y el Importe en -122px. Ahora arranca en 0 y el
  Importe queda a 180px, a la vista.

  Segundo caso, del mismo flujo: después de guardar, resetForm() le daba foco …

## 14 de septiembre de 2026

- Cerrar los 6 hallazgos de la revisión de código
  Seguridad del cifrado:
  - Sobre cerrado atómico: salt, iv y datos se guardan juntos en "fencblob"
    (v2). Antes el salt vivía en una clave aparte y un fallo a mitad de camino
    podía dejar los datos ilegibles para siempre. Se sigue leyendo el formato
    viejo al abrir.
  - Estando bloqueada, la app ya no escribe en claro: setSensitiveRaw lanza
    error en vez de mandar los datos a localStorage sin cifrar.
  - setupPin() guarda el sobre anterior y lo restaura si la activación falla.
  - Se vuelca el guardado pendiente en "pagehide", así cerrar la app de golpe
    dentro de los 400 ms del debounce no pierde el último cambio.

  XSS en atributos onclick: …
- Accesibilidad: etiquetas, teclado y semantica; y sacar un </style> colado en el CSS
  La app era practicamente inusable sin mouse ni con lector de pantalla:
  37 campos de formulario sin una sola etiqueta asociada, 10 botones que
  se anunciaban sin nombre (solo un simbolo o emoji), y elementos que
  actuan como botones hechos con <div>/<span>, imposibles de alcanzar
  con el teclado.

  - 43 campos quedan asociados a su etiqueta con `for`, mas aria-label en
    los que no tienen una etiqueta visible propia (montos, busqueda) y
    aria-labelledby en el input del dialogo generico. Los checkbox y los
    file input ya estaban envueltos en <label>, que asocia igual.
  - aria-label en los 10 botones de solo icono (‹ › ⌫ 📅 + ×). …
- Agregar suite de tests y hacer visibles los errores no atrapados
  Los dos puntos que quedaban de la revision, motivados por lo que costo
  diagnosticar el bug del PIN.

  1) tests.html — suite de 29 tests, sin dependencias ni tooling: se abre
     en el navegador (tambien desde el celular) y muestra verde/rojo.
     Cubre lo que mas duele si se rompe: cifrado ida y vuelta, plata
     (parser de importes con separador de miles y decimales), matematica
     de cuotas y meses, extraccion de etiquetas, completitud del backup y
     los dialogos.

     Incluye especificamente el caso que fallo hoy: cifrar 4000
     movimientos (~800 KB). Verificado que la suite SIRVE: reintroduciendo
     a proposito el bug de bytesToB64, dos tests pasan a rojo con …
- Reemplazar los dialogos nativos por modales propios y desbloquear la carga de los CDN
  Dos arreglos de robustez, motivados por el bug que dejo al usuario sin
  poder entrar a su propia app.

  1) Dialogos propios en vez de alert/confirm/prompt nativos (46 llamadas
     en 9 archivos). En una PWA instalada (modo standalone, sin barra de
     navegador) los dialogos nativos pueden no tener donde renderizarse y
     quedan bloqueando la ejecucion a la espera de una interaccion
     imposible: es exactamente lo que colgaba la pantalla de PIN. Quedaban
     otras 49 llamadas del mismo tipo repartidas por toda la app, 11 de
     ellas prompt() (las peores: sin el cuadro no hay forma de escribir).

     Se agrega mostrarAlerta/mostrarConfirm/mostrarPrompt en …
- Corregir RangeError al cifrar datos reales (stack overflow en base64)
  encryptBlob hacia btoa(String.fromCharCode(...new Uint8Array(cipher))).
  El spread pasa CADA byte como un argumento separado, asi que con un
  volumen de datos real (anos de movimientos = cientos de miles de
  bytes) explota con "RangeError: Maximum call stack size exceeded" y
  la migracion del PIN a cifrado nunca podia completarse. Con los datos
  chicos de las pruebas anteriores (un movimiento) nunca se acercaba al
  limite, por eso no se habia detectado.

  Se agrega bytesToB64(), que convierte de a bloques de 32 KB, y se usa
  tanto para el IV/salt como para el ciphertext.

  Verificado con una prueba nueva de volumen realista (4000 movimientos, …
- Mostrar el mensaje de error real al fallar el cifrado/descifrado del PIN
  El try/catch agregado en el commit anterior ya evita que la app quede
  colgada, pero mostraba un texto generico ("Error al activar el
  cifrado. Proba de nuevo.") que no alcanza para diagnosticar por que
  falla en un dispositivo real sin acceso a su consola. Se muestra
  ahora err.name + err.message directamente en pantalla en ambas ramas
  (descifrado normal y migracion de PIN legado).

  Se sube tambien CACHE_VERSION (v74->v75) para que este cambio llegue
  de verdad: el bug anterior fue justamente no bumpear esta version.
- Subir version de cache del service worker para forzar la actualizacion
  El commit anterior (366cb08, fix del bug de PIN colgado) solo tocaba
  js/seguridad-pin.js sin modificar sw.js. El navegador solo revisa si
  hay una version nueva del service worker cuando el propio archivo
  sw.js cambia de bytes: como no cambio, el celular del usuario siguio
  sirviendo para siempre, desde su cache "cache-first", la version
  VIEJA (con el bug) de seguridad-pin.js sin importar cuantas veces
  cerrara y reabriera la app o la abriera en una pestaña normal del
  mismo navegador (comparten el mismo Service Worker/Cache Storage por
  origen).

  Se sube CACHE_VERSION a enola-v74 para que el navegador detecte bytes
  nuevos en sw.js, instale la version nueva (que vuelve a descargar …
- Corregir traba al desbloquear un PIN viejo (pre-cifrado) en PWA instalada
  La primera vez que un usuario con un PIN configurado ANTES del cifrado
  lo ingresaba correctamente, checkPin() migraba los datos a cifrado y al
  final mostraba un alert() de aviso. En una PWA instalada (modo
  standalone, sin barra de navegador) los dialogos nativos alert()/
  confirm()/prompt() pueden no tener donde renderizarse y quedar
  colgados esperando una interaccion que nunca llega: la linea que
  ocultaba la pantalla de bloqueo nunca se ejecutaba, dejando al usuario
  trabado para siempre aunque el PIN fuera correcto.

  Se reordena para ocultar el lock-screen y resolver el desbloqueo ANTES
  de avisar, y se cambia el alert() bloqueante por showToast() (no …
- Modularizar index.html en archivos separados por dominio
  El archivo tenia ~7500 lineas de HTML/CSS/JS todo en uno. Se extrae:

  - El CSS a styles.css (link en vez de <style> inline).
  - El JS a 15 archivos en js/, agrupados por dominio (estado y
    categorias, formulario de carga, movimientos, tarjetas e
    inversiones, dashboard, ahorros, importar/exportar, cuentas y
    categorias custom, presupuestos, seguridad/PIN, arranque), cargados
    con <script src> clasicos en el mismo orden original.

  No es una migracion a ES modules: los <script> clasicos comparten el
  mismo scope global entre si (igual que antes), asi que no hace falta
  tocar los cientos de onclick="..." del HTML generado ni exponer nada
  a window a mano. …
- Corregir bug de TDZ en setupPin() del cifrado ligado al PIN
  El checkpoint anterior (WIP) declaraba `const confirm=prompt(...)` dentro
  de setupPin(), lo que por temporal dead zone rompía las nuevas llamadas a
  confirm() agregadas al principio de la misma función (backup forzado antes
  de activar el PIN por primera vez). Se renombra la variable local a
  pinConfirmado. Verificado con node --check sobre el <script> principal.
- Cifrado de datos ligado al PIN (WIP, en progreso)
  Checkpoint intermedio del agente en background implementando cifrado
  AES-GCM de los datos sensibles derivado del PIN, con backup forzado
  en la primera activacion. Todavia no probado end-to-end.
- Sanitizar XSS: escapar HTML en datos de usuario interpolados
  Se agrega la funcion helper escapeHtml() y se aplica en todas las
  interpolaciones via innerHTML de texto libre ingresado por el usuario
  (o proveniente de archivos importados): notas de movimientos, nombres
  de categorias/subcategorias/cuentas/tarjetas custom, tickers de
  inversion, nombres de metas de ahorro, nombres de archivos del
  historial de importacion y la vista previa de importacion. Tambien se
  aplica en exportarPDF (document.write) y se reemplazan escapes
  ad-hoc/parciales existentes (replace de < o de comillas) por el
  helper consistente. Sin cambios de comportamiento funcional.

## 12 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 11 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Update index.html
- Update sw.js
- Update manifest.json
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 10 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 9 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 8 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 7 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html

## 6 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
- Delete sw.js
- Delete index.html
- Delete manifest.json

## 2 de septiembre de 2026

- Add files via upload
- Delete sw.js
- Delete manifest.json
- Delete index.html
- Add files via upload
