# Changelog de Enola

Historial de cambios de la app, del más reciente al más viejo. Se genera solo desde el historial de git con `node scripts/generar-changelog.js`.

**Versión actual: v205**

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

## 28 de octubre de 2026

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
- **v116** · Merge: un backup ajeno ya no puede ejecutar código
