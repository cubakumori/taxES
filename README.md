# taxES

Prepara tu declaración de la renta española (IRPF) a partir del extracto anual de **Interactive Brokers**. Client-side puro: los datos nunca salen de tu navegador.

Foco: dividendos, retenciones, deducción por doble imposición internacional, y **plusvalías/minusvalías FIFO** por transmisión de valores. El resumen te da los importes exactos listos para volcar en las casillas de Renta Web, con el desglose por país, los avisos de retenciones por encima del convenio, y una guía paso a paso para el formulario oficial.

---

## Qué hace

- Parsea el `DividendReport.csv` y/o el `Informe de Actividad.csv` anual de IBKR.
- Calcula **Casilla 0029** (ingresos íntegros + retenciones practicadas en España).
- Calcula la **deducción por doble imposición internacional** (base del ahorro), aplicando el tope del convenio bilateral con cada país. Destaca el excedente no recuperable.
- Calcula **ganancias y pérdidas patrimoniales FIFO** por transmisión de valores, agregando multi-año por `accountId`: una venta en 2025 puede consumir lotes cargados en la sesión de 2024 sin re-subir los CSV. Flags de **regla anti-elusión** (2 meses ES / 1 año resto) y **base de coste incompleta** cuando faltan compras previas.
- Separa correctamente el **Return of Capital** (no tributa; reduce coste de adquisición) del dividendo ordinario, y propaga el ajuste ROC a la base FIFO.
- Detecta eventos fuera del ejercicio (pay date en enero del año siguiente) por criterio de caja AEAT.
- Valida cruzadamente los totales entre ambos informes cuando subes los dos.
- Convierte divisas no-EUR a EUR usando tipos del **BCE** (histórico bundleado, 30 divisas desde 2020).
- Persiste múltiples sesiones (años, cuentas) en IndexedDB del navegador.
- **Exports**: JSON (sesión reimportable), CSV (resumen por país · dividendos detalle · plusvalías FIFO) y **backup cifrado portable** (AES-GCM-256 con passphrase, PBKDF2-SHA256 600k iter) para guardar en Drive / USB.
- Vista imprimible optimizada → guardar como PDF desde el navegador.
- Acápite didáctico con explicaciones breves de cada concepto y enlaces a las fuentes oficiales (AEAT, Hacienda).
- Guía paso a paso mostrando qué valor concreto de tu sesión va en cada casilla de Renta Web.

---

## Privacidad

- **Los archivos no salen de tu dispositivo**. El parseo corre 100 % client-side.
- **Sin backend con datos de usuario**: el servidor (Express) sirve el HTML estático y un endpoint trivial `/api/health`. La app funciona igual con Vite static + cualquier hosting de ficheros.
- **Persistencia local** en IndexedDB. Puedes exportar la sesión como JSON plano, **backup cifrado con passphrase** (para guardar en Drive/USB sin exponer el contenido), o borrarla con un click.

---

## Stack

- **Frontend**: Vite 7 + Vue 3 + TypeScript + Tailwind CSS 4 + Pinia + vue-router + lucide-vue-next.
- **Backend mínimo**: Express (Node) en el mismo proceso que Vite vía `server.ts` (corre con `tsx`). En producción aplica `helmet` con CSP estricta (`default-src 'self'`, sin `unsafe-eval`). Sin lock-in a ningún PaaS; deployable en un VPS genérico con `node server.ts`.
- **Tests**: Vitest (94 tests unitarios).
- **Cifrado**: Web Crypto API nativa (sin dependencias externas) para el backup portable.
- **FX**: Tipos de cambio del BCE bundleados como JSON; `npm run fx:update` descarga la última versión.

---

## Primeros pasos

```bash
npm install
npm run dev        # http://localhost:5173 (Vite + Express en un solo proceso)
npm run build      # compila el SPA a dist/
npm start          # producción: sirve dist/ + /api/health
npm run typecheck  # vue-tsc --noEmit
npm test           # suite Vitest
npm run fx:update  # refresca src/lib/fx/bce-rates.json desde el BCE
```

---

## Estructura

```
taxES/
├── src/
│   ├── App.vue main.ts style.css
│   ├── pages/              # Home · Concepts · PreparacionIbkr · RentaWeb · Print · About
│   ├── composables/        # useAnnualChecklist (checklist persistida por sesión)
│   ├── components/         # AppHeader · SideDrawer · ResultsView · ...
│   ├── router/
│   ├── stores/             # Pinia: session store con multi-sesión
│   ├── utils/
│   └── lib/
│       ├── parser/         # Tokenizer CSV + parsers IBKR + merger
│       │   └── ibkr/
│       ├── rules/          # Motor IRPF por ejercicio + FIFO + convenios + countries
│       ├── fx/             # BCE rates (bundled + lookup)
│       ├── storage/        # IndexedDB wrapper + sesiones
│       ├── crypto/         # Envelope AES-GCM + PBKDF2 (backup portable cifrado)
│       ├── export/         # Generadores CSV (resumen por país · dividendos · plusvalías)
│       └── __fixtures__.ts # Fixtures sintéticos para tests (cuenta ficticia)
├── api/                    # Express router mínimo (/api/health)
├── scripts/                # tsx scripts: parse, render, update-bce-rates
├── samples/                # Fixtures locales reales (gitignored por defecto, ver abajo)
├── server.ts               # Vite middleware + Express, único proceso
├── .github/workflows/ci.yml  # Typecheck + test + build en cada push/PR
├── ROADMAP.md CHANGELOG.md CLAUDE.md
```

### Fixtures y datos reales

Dos rutas distintas según su propósito:

- **`src/lib/__fixtures__.ts`** — fixtures **sintéticos** (cuenta ficticia `U00001234`, valores redondos). Usados por los 92 tests unitarios. Se comitean al repo.
- **`samples/`** — fixtures **reales/privados** para desarrollo local. La carpeta tiene su propio `.gitignore` que excluye todo su contenido (excepto el `README.md` y el propio `.gitignore`). Deja aquí tus CSV reales sin miedo: `git` los ignora automáticamente. Los scripts `npm run parse:sample`, `parse:activity`, `render:irpf` los buscan aquí por defecto.

---

## Tests + CI

Cada push a `main` corre en GitHub Actions (`.github/workflows/ci.yml`): `typecheck + test + build`. Si algo rompe, verás una ✗ roja en el PR.

---

## Aviso fiscal

Esta aplicación **no es asesoramiento fiscal**. Es una herramienta de ayuda para preparar los datos siguiendo las reglas generales del Manual de Renta (AEAT). Revisa siempre los valores antes de presentar la declaración y consulta a un asesor para casos particulares (participaciones ≥ 10 %, fondos de pensiones, regímenes especiales…).

---

## Apoya el proyecto

Si la app te ha ahorrado tiempo o dinero, considera invitarme a un café:
[☕ ko-fi.com/kumoricuba](https://ko-fi.com/kumoricuba)

---

## Licencia

[AGPL-3.0-or-later](LICENSE). Si despliegas una versión modificada como servicio en red, estás obligado a ofrecer el código fuente modificado a tus usuarios.
