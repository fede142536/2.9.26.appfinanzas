# Librerías de terceros

La app no baja nada de internet para funcionar: estas dos librerías viven acá, en una versión fija. Antes se bajaban de un CDN sin verificar
(una versión flotante de Chart.js y SheetJS 0.18.5, que tiene fallas conocidas al abrir archivos manipulados).

| Archivo | Qué es | Versión | Licencia | SHA-256 |
|---|---|---|---|---|
| `chart.umd.js` | Chart.js (los gráficos) | 4.4.7 | MIT (`LICENSE-chartjs.md`) | `2812cb8825fdc57469eb2f7bb055e9429244e599920511ee477e828499b632cb` |
| `xlsx.full.min.js` | SheetJS (leer y escribir Excel) | 0.20.3 | Apache-2.0 (`LICENSE-sheetjs.txt`) | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |

## De dónde salieron

- **Chart.js 4.4.7**: `npm pack chart.js@4.4.7`, archivo `dist/chart.umd.js` del paquete oficial (npm verifica la integridad con el registro).
- **SheetJS 0.20.3**: SheetJS ya no publica sus versiones nuevas en npm (el paquete `xlsx` quedó en 0.18.5) sino en `cdn.sheetjs.com`. Este archivo salió de dos
  republicaciones independientes de la versión 0.20.3 en npm (`@e965/xlsx` y `xlsx-republish`, de dos autores distintos): `dist/xlsx.full.min.js` es
  **idéntico byte a byte** en las dos. No tiene `eval` ni pedidos de red (solo nombres de espacios de nombres XML).
  Si querés partir de la fuente oficial, bajá `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`, compará el SHA-256 y reemplazalo.

## Para actualizar

1. Bajá la versión nueva, reemplazá el archivo y actualizá la versión y el SHA-256 de esta tabla.
2. Subí la versión de la app (`node scripts/subir-version.js`) para que los celulares tomen el archivo nuevo.
