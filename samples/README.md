# samples/

Carpeta para extractos reales de IBKR usados como fixtures de desarrollo.

**El contenido está gitignoreado**: nunca se comitea. Solo este README y el `.gitignore` se versionan.

## Qué dejar aquí

Cualquiera de estos fichero, con el nombre que prefieras:

- `DividendReport.csv` — informe fiscal de dividendos (fuente primaria).
- `ActivityStatement.csv` (o `Informe de Actividad.csv`) — actividad completa del año.

## Cómo usarlos

El script de verificación los busca automáticamente:

```bash
npm run parse:sample
```

O con ruta explícita:

```bash
npm run parse:sample -- samples/mi-extracto.csv
```
