# taxES — Guía para Claude Code

Contexto y convenciones del proyecto para futuras sesiones. Léelo al arrancar.

---

## Qué es esta app

Herramienta web para residentes fiscales en España que operan con **Interactive Brokers**. Importa el extracto anual de IBKR (hoy: CSV; HTML queda pendiente como fallback en ROADMAP) y produce un resumen "Renta Web ready" con los valores listos para meter en las casillas correspondientes de la declaración del IRPF, incluyendo:

- **Dividendos** (casilla **0029**): ingresos íntegros brutos en euros.
- **Retenciones españolas** en esa misma casilla (normalmente **0 €** con IBKR).
- **Intereses de cuentas** (casilla **0027**) si los hubiera (parser aún no emite `InterestEvent`; pendiente en ROADMAP).
- **Deducción por doble imposición internacional** (base del ahorro): rendimientos netos del capital mobiliario obtenidos en el extranjero + impuesto satisfecho en el extranjero, con el **límite del convenio** (USA 15 %, UK 10 %, DE 15 %, FR 15 %…).
- **Ganancias y pérdidas patrimoniales** por transmisiones de acciones/ETFs calculadas en **FIFO por ISIN** (art. 37.2 LIRPF), agregando extractos de años anteriores de la misma cuenta para construir la base de coste. Detecta patrones de la **regla anti-elusión** (art. 33.5.f, 2m mercado ES / 1a resto) y los flaguea sin diferir automáticamente.

La fuente de referencia con las notas detalladas del caso de uso está en `/Users/ernestortiz/Downloads/taxES.md`.

---

## Principios

1. **Privacidad como feature**: los extractos de IBKR nunca tocan el servidor. Todo el parseo corre en el lado cliente (main thread por ahora — el Web Worker se dejó para cuando haya archivos grandes que bloqueen la UI). El backend Express solo existe para servir el bundle en producción y un `/api/health`; ningún dato de usuario lo atraviesa.
2. **Trazabilidad**: cada total del resumen final debe ser auditable hasta la línea origen del extracto. No publicar cifras sin detalle clicable.
3. **Reglas fiscales separadas por ejercicio**: `src/lib/rules/rules_IRPF_YYYY.ts`. Las casillas se renumeran, la normativa cambia. Mantener tests de regresión por año para no romper declaraciones antiguas al tocar el código.
4. **Conservador por defecto**: aplicar lo que dice el Manual AEAT. Cualquier interpretación agresiva (optimizaciones, sentencias, criterios finos) se presenta como "posible optimización, consulta con asesor", nunca como valor calculado directo.
5. **Disclaimer siempre visible**: no es asesoramiento fiscal.

---

## Stack y arquitectura

- **Frontend**: Vite 7 + Vue 3 + TypeScript + Tailwind 4 + Pinia + vue-router + vee-validate/zod + axios + lucide-vue-next.
- **Backend**: Express en TypeScript (ejecutado con `tsx`), en el mismo proceso que Vite vía `server.ts`. Un único comando (`npm run dev`) levanta ambos. Solo sirve estáticos y `/api/health`. En `NODE_ENV=production` aplica `helmet` con CSP estricta (sin `unsafe-eval` en JS, `connect-src 'self'`); en dev se desactiva por compatibilidad con Vite middleware (HMR usa `eval`). No registra `express.json` — la única ruta no consume cuerpo.
- **Parser IBKR**: en `src/lib/parser/` (código puro, testable). Helpers compartidos en `src/lib/parser/ibkr/utils.ts` (`uuid`, `num`, `redactAccountId`, `normalizeIbkrDate`). Main thread por ahora.
- **Motor de reglas**: en `src/lib/rules/`, una función pura por ejercicio (`rules_IRPF_YYYY.ts`) que recibe el modelo interno más `priorDocs` opcionales y devuelve el resumen Renta Web. FIFO plusvalías en `src/lib/rules/fifo.ts` (puro, reutilizable). Las notices del FIFO se emiten **solo para el año declarable**; ventas en `priorDocs` solo aportan base de coste.
- **FX**: `src/lib/fx/bce-rates.json` con histórico del Banco Central Europeo (30 divisas, desde 2020). Refrescar con `npm run fx:update`.
- **Persistencia**: IndexedDB (`src/lib/storage/`), con multi-sesión por `(taxYear, accountId)`. Agregación automática por `accountId` en el store para alimentar FIFO multi-año sin re-subir CSV.
- **Cifrado**: `src/lib/crypto/envelope.ts` — envelope AES-GCM-256 + PBKDF2-SHA256 (600k iter) para el backup portable. AAD autentica `iterations + salt + iv` (manipular cualquiera rompe el descifrado). Passphrase mínima 12 chars (constante `MIN_PASSPHRASE_LENGTH`). Al importar, rechaza envelopes con `iterations < 100 000` (`WeakEnvelopeError`). 100 % Web Crypto nativa, sin dependencias.
- **Exports**: `src/lib/export/` — CSV (resumen por país · dividendos detalle · plusvalías FIFO) + JSON + backup cifrado.
- **Tests**: Vitest, 94 tests en `src/**/*.test.ts`. CI en GitHub Actions (`.github/workflows/ci.yml`).

### Comandos

```bash
npm install
npm run dev        # Vite + Express en un solo proceso (http://localhost:5173)
npm run build      # Compila el SPA a dist/
npm start          # Producción: sirve dist/ + /api/health
npm run typecheck  # vue-tsc --noEmit
npm test           # Suite Vitest
npm run fx:update  # Refresca los tipos BCE
```

### Flujo de datos

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

---

## Convenciones del repo

- **Versionado**: SemVer. Primer release estable etiquetado en `CHANGELOG.md` como `1.0.0` (MVP cerrado). Trabajo posterior va en `## [Unreleased]` hasta nuevo tag.
- **Licencia**: `AGPL-3.0-or-later` (archivo `LICENSE`, campo `license` en `package.json`).
- **CHANGELOG.md**: formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), entradas en **español**, secciones `### Feature / Fix / UX / Docs / Refactor / Decisiones`.
- **ROADMAP.md**: lista **solo lo pendiente**, agrupado por tema (Parser / FX / UX / Futuro…). Al completar, se mueve a `CHANGELOG.md`.
- **CONTRIBUTING.md**: guía técnica (setup, arquitectura, tareas comunes, reglas de código).
- **Commits**: en español, imperativo (`añade`, `corrige`, `refactoriza`). Mencionar la casilla o concepto fiscal si aplica.
- **Alias Vite**: `@`, `@components`, `@composables`, `@layouts`, `@lib`, `@pages`, `@schemas`, `@services`, `@stores`, `@types`, `@utils`, `@workers`.

---

## Casuística conocida de IBKR a recordar

Etiquetar aparte en el parser y avisar en la UI:

- **Payment-in-lieu**: pagos sustitutorios por préstamo de acciones. No son dividendos técnicamente; fiscalidad puede diferir. *(Etiquetado pendiente en parser — ROADMAP.)*
- **ADR fees**: comisiones de custodio de ADRs (negativas). No son retenciones. *(Ya clasificadas por el parser como `feeType: 'adr-fee'`.)*
- **Scrip dividends** (script en IBKR): dividendo en acciones. Fiscalidad especial en algunos casos.
- **Dividend reinvestment (DRIP)**: aunque se reinvierta, tributa como dividendo bruto. *(Etiquetado pendiente — ROADMAP.)*
- **Withholding refund**: reembolsos parciales de retención. Netear con la retención del mismo valor/año. *(Tipo `WithholdingRefundEvent` definido; parser pendiente — ROADMAP.)*
- **Retención en origen > límite convenio** (p.ej. USA 30 % por no tener W-8BEN): la diferencia **no es recuperable vía IRPF**; se reclama al broker o en origen. *(Motor emite warning `withholding-exceeds-treaty` con excedente por país.)*
- **Return of Capital**: ya detectado en el parser (split automático del Summary + RevenueComponent). No tributa como rendimiento; **además reduce la base FIFO** del ISIN (propagado por `fifo.ts`).
- **Acciones corporativas** (splits, spinoffs, fusiones): fuera de alcance v1. FIFO emite info `fifo-corporate-actions-oos` recordando revisión manual si las hubo.

---

## Referencias

- Documento de notas del autor: `/Users/ernestortiz/Downloads/taxES.md` (incluye ejemplo práctico con Enagás, Clipper, uso de Renta Web, W-8BEN).
- Proyecto de referencia para convenciones de estructura/docs: `/Users/ernestortiz/Sites/[gits]/cooperafy`.

## Fixtures y datos reales

- **Tests automatizados**: usan `src/lib/__fixtures__.ts` con cuenta ficticia `U00001234`. Sintéticos, committeables, cubren los escenarios clave (ES, USA, BE con exceso de convenio, ROC parcial, 100 % ROC, out-of-year).
- **Desarrollo local con datos reales**: `samples/`. La carpeta lleva un `.gitignore` interno (`*` + `!.gitignore` + `!README.md`) que ignora TODO su contenido excepto los dos archivos de documentación. Los scripts `parse:sample`, `parse:activity`, `render:irpf` buscan por defecto en `samples/` primero. **Nunca escribir datos de usuario (reales) al fixture sintético ni al repo.**
- El directorio `ibkr/` está también gitignored en la raíz; fue el directorio de trabajo inicial con los datos reales del autor mientras se validaba el parser. Puede eliminarse una vez migrados los CSV a `samples/`.
