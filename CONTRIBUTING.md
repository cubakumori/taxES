# Contribuir a taxES

Guía técnica para contribuciones y mantenimiento. Si tienes una duda concreta sobre normativa fiscal o el proyecto en general, abre un *issue* antes de mandar un PR.

---

## Setup local

```bash
git clone <repo-url> taxES
cd taxES
npm install
npm run dev       # Vite + Express en http://localhost:5173
```

Requisitos:
- **Node 20+** (usamos `tsx` para ejecutar TypeScript directo, sin build step en dev).
- **npm** (no yarn/pnpm en la configuración actual, aunque debería funcionar).

---

## Comandos que usarás

```bash
npm run dev         # Servidor de desarrollo con HMR
npm run build       # Build de producción → dist/
npm start           # Sirve dist/ + /api/health en modo producción
npm run typecheck   # vue-tsc --noEmit (tipos estrictos)
npm test            # Suite Vitest (94 tests actualmente)
npm run test:watch  # Tests en watch mode
npm run fx:update   # Refresca src/lib/fx/bce-rates.json desde el BCE
npm run parse:sample      # Parsea un DividendReport.csv de samples/
npm run parse:activity    # Parsea un Informe de Actividad.csv de samples/
npm run render:irpf       # Imprime por consola el resumen IRPF contra samples/
```

---

## Arquitectura en una página

```
Archivo IBKR (CSV)  →  parser cliente  →  StatementDocument (normalizado)
                                            ↓
                                      merger (opcional, si hay 2 archivos)
                                            ↓
                   priorDocs (mismo accountId, años anteriores en IDB)
                                            ↓
                                      motor de reglas (rules_IRPF_YYYY)
                                         ├─ dividendos + doble imposición
                                         └─ FIFO plusvalías/minusvalías
                                            ↓
                                      IrpfSummary (casillas + avisos)
                                            ↓
                UI + PDF (Print) + export JSON/CSV + backup cifrado
```

Capas:

| Capa | Carpeta | Qué contiene |
|---|---|---|
| Parser | `src/lib/parser/` | Tokenizer CSV + parsers específicos por broker + merger |
| Motor de reglas | `src/lib/rules/` | `rules_IRPF_YYYY.ts` (una por ejercicio fiscal), `fifo.ts` (plusvalías FIFO), convenios, country names |
| FX | `src/lib/fx/` | Tipos de cambio del BCE (JSON bundleado + lookup con fallback a día hábil anterior) |
| Storage | `src/lib/storage/` | Wrapper de IndexedDB + CRUD de sesiones |
| Crypto | `src/lib/crypto/` | Envelope AES-GCM + PBKDF2 para el backup portable (Web Crypto, sin deps) |
| Export | `src/lib/export/` | Generadores CSV (resumen por país · dividendos · plusvalías) |
| UI | `src/components/`, `src/pages/` | Vue 3 Composition API + Pinia + Tailwind 4 |
| Composables | `src/composables/` | Hooks reactivos reutilizables (p. ej. `useAnnualChecklist` persiste el checklist anual por `(taxYear, accountId)` vía IDB) |

---

## Código: reglas que seguimos

### General
- **TypeScript estricto** (`strict: true` en `tsconfig.json`). No usar `any`; si no hay más remedio, explicar en comentario.
- **Imports ordenados** y usando los alias definidos (`@/`, `@components/`, `@lib/`, etc.).
- **No comments del tipo "this function does X"** si el nombre ya lo dice. Comentar solo el *por qué* cuando es no-obvio.

### Vue
- **Composition API con `<script setup lang="ts">`**.
- Nombrado: componentes en `PascalCase.vue`, páginas en `src/pages/`, componentes reutilizables en `src/components/`.
- Estado compartido en **Pinia**, preferentemente con sintaxis composition (`defineStore('x', () => { ... })`).

### Tailwind 4
- Directamente en el template. Sin `<style>` scoped salvo para cosas muy específicas (vista imprimible de `Print.vue`, por ejemplo).
- Variantes útiles del proyecto: `sm:`, `lg:`, `print:`, `hover:`, `focus:`.

### Tests
- **Vitest**. Ubicación: al lado del módulo, `foo.ts` + `foo.test.ts`.
- Para UI, por ahora no hay tests de componentes (toda la suite es de lógica pura). Si añades componentes con lógica compleja, `@vue/test-utils` encaja.
- Fixtures sintéticos en `src/lib/__fixtures__.ts` (cuenta ficticia `U00001234`). **Nunca uses datos reales en tests.**

### Commits y PRs
- Mensajes en **español**, imperativo: *"añade parser de Degiro"*, *"corrige redondeo en doble imposición"*, *"refactoriza tokenizer CSV"*.
- Si tu cambio afecta a un concepto fiscal (casilla, convenio, ROC, etc.), menciónalo en el mensaje.
- Actualiza `CHANGELOG.md` con tu entrada bajo `## [Unreleased]`. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
- Si añades funcionalidad visible, considera también actualizar la página que corresponda según el tipo de contenido: `Concepts.vue` (teoría fiscal española), `PreparacionIbkr.vue` (operativa y documentos del broker), `RentaWeb.vue` (guía paso a paso para el formulario oficial).

---

## Tareas comunes

### Añadir un ejercicio fiscal nuevo (p. ej. IRPF 2026)

1. Copiar `src/lib/rules/rules_IRPF_2025.ts` a `rules_IRPF_2026.ts`. Cambiar nombre de la constante `RULES_VERSION`.
2. Revisar `src/lib/rules/treaty-rates.ts`: si algún convenio cambió con un protocolo, crear `treaty-rates_2026.ts` y usarlo desde el nuevo motor.
3. Actualizar la lógica según el Manual de Renta del ejercicio (casillas nuevas, tramos, etc.).
4. **Duplicar los tests** en `rules_IRPF_2026.test.ts` con fixtures adaptadas.
5. En el store, seleccionar el motor según `doc.taxYear` (requeriría refactor: hoy está hardcoded a 2025).
6. El motor FIFO (`src/lib/rules/fifo.ts`) es agnóstico al ejercicio y se reutiliza; si cambia la regla anti-elusión (ventanas 2m / 1a) sí tocaría parametrizarlo.

### Añadir un broker nuevo (p. ej. Degiro)

1. Crear `src/lib/parser/<broker>/<broker>-statement.ts` que emita un `StatementDocument` con los eventos equivalentes.
2. Extender `detectIbkrFileType` (o crear un `detectFileType` genérico) para reconocer el nuevo formato.
3. Si el broker da el EUR ya calculado: úsalo. Si no: `getBceRateToEur()`.
4. Ajustar `Merger` para combinar fuentes de brokers distintos si es necesario.
5. Tests con fixture sintético.

### Añadir un artículo al acápite Conceptos

1. Añade la entrada en el array `groups` de `src/pages/Concepts.vue`.
2. Añade un `<article id="...">` con el contenido.
3. Respeta el estilo existente (breve, enlaces a fuentes oficiales AEAT/Hacienda, sin interpretar normativa).

### Actualizar los tipos BCE

```bash
npm run fx:update
```

Descarga `eurofxref-hist.zip` del ECB, filtra a las 30 divisas que usamos y a desde 2020. Regenera `src/lib/fx/bce-rates.json`. Commitea el JSON.

### Añadir un formato de export

1. Crea el generador en `src/lib/export/` (p. ej. `session-xlsx.ts`). Convenciones: una función pura por formato, sin acceso al DOM.
2. Expón un método en el store (`src/stores/session.ts`: `exportXxxFoo(): string | null`).
3. Añade entrada al menú de `ResultsView.vue`, usando `downloadTextFile` del módulo `csv.ts` o un helper análogo.
4. Tests del generador en `src/lib/export/xxx.test.ts`.

### Tocar el backup portable cifrado

El envelope está en `src/lib/crypto/envelope.ts`. Si cambias el formato:

- Sube `v` en el envelope y `PARSER_VERSION` de sesión no — cada uno versiona su esfera.
- Mantén `decryptEnvelope` retro-compatible con v1 al menos un ciclo (los usuarios tienen backups en Drive).
- El AAD canónico incluye `iterations + salt + iv`. Si añades campos, mete los nuevos en `buildAad()`; los backups antiguos seguirán funcionando porque la cadena se construye con los mismos campos en el mismo orden.
- No cambies de PBKDF2 → Argon2 sin plan de migración: los backups antiguos dejarían de abrirse.
- No bajes `MIN_PASSPHRASE_LENGTH` (12) ni `PBKDF2_MIN_ITERATIONS_ON_IMPORT` (100 000): son límites de seguridad mínima, no recomendaciones.
- Nunca loguees la passphrase ni el plaintext (evitar `console.log`).

---

## CI

`.github/workflows/ci.yml` corre en cada push/PR contra `main`:
1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Un PR con ✗ roja no debería mergearse. Si el fallo es genuino, arréglalo antes de pedir review.

---

## Despliegue

taxES soporta dos canales de distribución que comparten el mismo build de Vite:

### A) Self-host con Express (`npm start`)

```bash
NODE_ENV=production npm start    # sirve dist/ + /api/health en :5173
```

`server.ts` aplica `helmet` con CSP estricta. Apto para VPS propios o cualquier hosting Node.

### B) Hosting estático (Cloudflare Pages, Netlify, S3+CloudFront…)

Build command `npm run build`, publish directory `dist`. Los ficheros `public/_headers` y `public/_redirects` se copian automáticamente y aportan:

- La **misma CSP** que helmet (replicada como cabeceras estáticas).
- `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva.
- SPA fallback `/* /index.html 200` para que `vue-router` (modo history) no devuelva 404 al recargar rutas.

Cloudflare Pages: variable de entorno `NODE_VERSION=20`, framework preset `None`, build command `npm run build`, output `dist`. Sin más config.

### Regla importante

**`server.ts` (helmet) y `public/_headers` deben mantenerse sincronizados.** Cualquier cambio en una directiva (CSP, XFO, Referrer-Policy…) tiene que reflejarse en el otro fichero, o el comportamiento divergirá entre los dos canales y un usuario que mueva sesiones entre uno y otro lo notaría como bugs sutiles. Hay un comentario al inicio de cada fichero recordando esta regla.

---

## Seguridad y privacidad (importante)

- La app **nunca debe enviar datos de extracto a un servidor**. El backend Express que hay es para servir estáticos y endpoints triviales.
- Si añades cualquier funcionalidad que implique consulta externa (IA, sync, etc.), **debe ser opt-in explícito** y respetar el argumento privacy-first.
- **No comitear datos reales**: usa `samples/` (gitignored) para pruebas locales con extractos reales.

---

## Dudas

- Para dudas **técnicas**: abre un issue en GitHub.
- Para dudas **fiscales** (qué casilla, qué convenio…): no son dudas del código; consulta el Manual AEAT o un asesor fiscal. La app implementa lo que el Manual dice de forma conservadora; cualquier interpretación agresiva se debate con un asesor, no se añade por defecto.

---

## Licencia

[AGPL-3.0-or-later](LICENSE). Cualquier contribución se acepta bajo esa misma licencia. Si el proyecto se desplegase como servicio en red, la licencia obliga a ofrecer el código fuente modificado a los usuarios del servicio.
