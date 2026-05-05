# Changelog

Todos los cambios relevantes del proyecto taxES se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [Unreleased]

## [1.1.1] — 2026-05-05

Pulido de seguridad, código y UX a partir de una revisión completa. Sin cambios en el motor fiscal: las cifras IRPF que produce la app son idénticas a las de 1.1.0 con los mismos extractos de entrada. Compatible con backups cifrados creados por versiones previas.

### Seguridad — Cabeceras HTTP estrictas en producción (helmet + CSP)

`server.ts` ahora aplica `helmet` con una **Content-Security-Policy estricta** cuando `NODE_ENV=production`:

- `default-src 'self'` y `script-src 'self'` (sin `unsafe-eval` / `unsafe-inline`): si una dependencia npm fuera comprometida, el navegador bloquearía cualquier intento de exfiltrar IndexedDB hacia un dominio externo o cargar JS de terceros
- `connect-src 'self'`: solo `/api/health` (mismo origen). Si en el futuro se añade un proxy `/api/ai/*`, ajustar aquí
- `frame-ancestors 'none'` + `X-Frame-Options: SAMEORIGIN` (anti-clickjacking)
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, HSTS, `object-src 'none'`, `form-action 'self'`, `upgrade-insecure-requests`
- En **dev** la CSP se desactiva por compatibilidad con Vite middleware (HMR usa `eval`); el modo dev no se sirve a usuarios finales

### Seguridad — Backup cifrado: passphrase mínima + AAD + validación de iteraciones

Endurecimiento del envelope `AES-GCM-256` + PBKDF2 (`src/lib/crypto/envelope.ts`):

- **Passphrase mínima de 12 caracteres** (antes: 1). Validación tanto en la librería (`encryptJsonToEnvelope`) como en la UI (`PassphraseDialog.vue`). Constante exportada `MIN_PASSPHRASE_LENGTH` para que ambos puntos compartan el mismo umbral
- **AAD (Additional Authenticated Data)**: el cifrado GCM ahora autentica también `iterations`, `salt` e `iv` además del ciphertext. Manipular cualquiera de esos campos en el envelope (p. ej. rebajar las iteraciones a 1000 manteniéndolas dentro del rango aceptable) provoca un fallo de descifrado limpio (`WrongPassphraseError`) en lugar de derivar una clave equivocada y fingir éxito
- **Rechazo en import de iteraciones < 100 000** (`PBKDF2_MIN_ITERATIONS_ON_IMPORT`): nueva excepción `WeakEnvelopeError` para distinguir un envelope con KDF debilitada de una passphrase incorrecta. La UI lo propaga con su propio mensaje
- Tests nuevos: tampering de `kdf.iterations` y rechazo de envelopes con KDF demasiado baja. Tests existentes adaptados al mínimo de iteraciones (TEST_ITERATIONS = 100 000)

### Seguridad — Superficie del backend reducida

`server.ts`: eliminado `express.json()`. La única ruta del backend (`/api/health`) es GET y no consume cuerpo. Sin parser de JSON registrado, no hay deserialización de payloads cliente. También se valida `process.env.PORT` como entero 1–65535 al arranque (antes: `Number("abc")` → `NaN` → Express colgado en silencio).

### Refactor — Helpers de parser deduplicados + split de `ResultsView`

Limpieza de código sin cambio funcional:

- `src/lib/parser/ibkr/utils.ts` (nuevo): `uuid()`, `num()`, `redactAccountId()` y `normalizeIbkrDate()` — antes duplicados en `dividend-report.ts` y `activity-statement.ts`. La función de fecha unifica los dos formatos de IBKR (compacto `20250430` y datetime `2025-04-30, HH:MM:SS`)
- `src/components/CrossValidationCard.vue` (nuevo) y `src/components/IbkrEquivalenceCard.vue` (nuevo): extraídos de `ResultsView.vue`, que pasa de **895 a 635 líneas**. Los dos componentes son puros (props in, render out) — más fáciles de testear y mantener
- `src/stores/session.ts`: el watcher de auto-persistencia pierde `{ deep: true }`. Los documentos se re-asignan enteros tras cada parseo y al cambiar de sesión, nunca se mutan in-place; el watch por identidad basta y evita rastrear miles de eventos como dependencias reactivas

### Fix — Avisos FIFO emitidos solo del año declarable

`src/lib/rules/fifo.ts`: si una venta de un `priorDoc` (extracto de año anterior cargado solo para alimentar la base de coste) disparaba una notice (`fifo-incomplete-basis` o `fifo-anti-elusion`), antes esa notice se generaba pero luego se descartaba silenciosamente porque el motor solo propaga notices cuando hay `plusvalias` definidas en el ejercicio actual. Pasaba de "ruido invisible" a desaparecer del todo según los datos. Ahora la comprobación `if (saleYear !== taxYear) continue` se hace **antes** de emitir notices: solo se generan para ventas del ejercicio que se está declarando, evitando avisos que pertenecen a una declaración pasada o futura.

### UX — Drag & drop en la zona de carga

`src/components/UploadZone.vue`: el contenedor de archivos acepta soltar un CSV directamente, con highlight azul al pasar por encima y mensaje «Suelta el archivo para cargarlo». Implementado con `dragenter/dragover/dragleave/drop` + un contador `dragDepth` para evitar el flicker que causan los hijos al cruzar (cada hijo dispara enter+leave). Click en «Cargar» y arrastrar funcionan en paralelo; el parser detecta el tipo automáticamente y coloca el archivo en el slot correcto sin importar cómo llegó.

### Decisiones — Cambios descartados al revisar a fondo

- **Web Worker para el parseo**: deferido conscientemente (ver `CLAUDE.md`). En CSV reales del autor (~MB) el bloqueo del main thread no es perceptible. Cuando llegue un caso con miles de eventos se aborda
- **Excluir filas con base incompleta del total de plusvalías**: la UI ya las marca con banner rojo grande («Base de coste incompleta — infla la ganancia»), badge por fila y clase de fondo. Excluirlas haría que el usuario olvidase declararlas; mantener visibles + warning es la opción conservadora correcta
- **Disclaimer en `Print.vue`**: ya existía en el `<footer>` de la hoja imprimible. La sospecha de duplicación venía del `print:hidden` de Home, que es correcto

### Feature — Página «Preparación fiscal (IBKR)» con checklist anual persistida

Nueva ruta dedicada a la parte operativa del broker, separada de los conceptos fiscales generales. Cubre cuatro bloques:

- **Documentos que descargar cada año**: tabla comparativa con `DividendReport.csv`, `Informe de Actividad.csv`, `FX Income Worksheet`, `1042-S` (USA), `NR4` (Canadá) y `Dividend Tax Vouchers`. Cada fila explica qué es, dónde obtenerlo en IBKR Client Portal, para qué sirve y si es obligatorio, condicional (USA/Canadá), recomendado u opcional. Aclara qué dos archivos se suben a la app (los CSV principales) y cuáles se conservan como prueba (cuatro años, prescripción AEAT)
- **Cómo minimizar pérdidas por retención en origen**: acciones permanentes en IBKR (W-8BEN vigente, certificado de residencia fiscal española para relief-at-source, acción ordinaria vs ADR, ETFs UCITS irlandeses) + tabla por país con retención por defecto, tope del convenio y vía de reclamación post-facto (BE Mod. 276 Div · DE EU-012 · FR 5000 · IT Istanza di rimborso · CH form 85 · AT ZS-RD1 · JP form 8 · US prevención W-8BEN). Incluye nota práctica sobre cuándo reclamar y cuándo dejarlo correr
- **Advertencia clara sobre Tax Planner y Tax Optimizer de IBKR**: son herramientas US-centric (IRS / 1099 / 1042-S). El «Account Match Method» de IBKR (FIFO / LIFO / MinGain / MaxGain…) solo afecta cómo IBKR **reporta** las ventas; **no cambia la obligación española de FIFO por ISIN** (art. 37.2 LIRPF). Recomendación práctica: configurar FIFO en Tax Optimizer para minimizar divergencia visual
- **Checklist anual antes de presentar**: nueve ítems marcables con persistencia en IndexedDB por `(taxYear, accountId)`. Distingue ítems obligatorios de opcionales, muestra progreso `n/total obligatorios` y permite reiniciar. En sesión nueva sin guardar, opera en memoria sin persistir

Cambios asociados:

- `src/pages/PreparacionIbkr.vue`: página nueva. Lazy-loaded (20 KB / 8 KB gzip)
- `src/composables/useAnnualChecklist.ts`: composable reactivo que hidrata desde IDB, persiste optimistamente al cambiar, y expone `state / reset / completedCount / totalRequired`. IDs estables (`dividend-report`, `activity-statement`, `fx-worksheet`, `form-1042s`, `form-nr4`, `tax-vouchers`, `w8ben`, `backup-encrypted`, `cross-validated`) para poder añadir o renombrar labels sin perder el estado guardado
- `src/components/UploadZone.vue`: rediseño con dropzone compacta + recuadro informativo debajo. El recuadro explica qué dos CSV subir y por qué (DividendReport = fuente canónica fiscal; Activity Statement = necesario para FIFO plusvalías), con check verde por archivo según lo cargado, y la ruta exacta de descarga en IBKR Client Portal dentro del contexto de cada archivo (en lugar de como línea suelta). Enlace a la nueva página para el detalle completo (1042-S, NR4, vouchers, FX Worksheet…)
- `src/router/index.ts`: ruta nueva `/preparacion-ibkr`
- `src/components/SideDrawer.vue`: entrada «Preparación (IBKR)» con icono `Briefcase`, posicionada entre «Conceptos» y «Guía Renta Web» para reflejar el orden lógico (teoría → preparación operativa → volcado en Renta Web)

### Fix — `<button>` anidado en SessionSelector + selector de archivos robusto

Dos bugs relacionados con la fiabilidad del click:

- `SessionSelector.vue`: la fila de sesión guardada tenía un `<button>` (botón de papelera) dentro de otro `<button>` (selector de la sesión). Vite emitía warning y los navegadores desplegaban el HTML de forma impredecible: el botón interno podía ser re-parentado fuera del externo, rompiendo layout y, en algunos casos, bloqueando eventos click de hermanos. Refactorizado: el `<li>` ahora contiene dos botones hermanos (seleccionar + eliminar) lado a lado
- `UploadZone.vue`: sustituido el patrón `<input type="file" hidden>` + `inputRef.value?.click()` por `<label>` que envuelve el `<input>`. El selector de archivos se abre de forma **nativa** al pulsar cualquier parte del label — sin JavaScript, sin `HTMLElement.click()` programático que es frágil cuando el input está `display: none`. Cada slot tiene su propio `<input>` con `class="sr-only"` (visualmente oculto pero accesible e interactivo)

### Fix — `loadFile` saltaba al resumen sin feedback visible en el upload

Relacionado con la petición original del usuario de *"sea el usuario quien pase al 'Resumen IRPF'"*:

- `stores/session.ts`: tras un parseo correcto, `loadFile` deja `status = 'idle'` (antes pasaba a `'ready'`). Así la UploadZone sigue visible tras la carga y el usuario ve el slot marcado con ✓ y el nombre del archivo — antes el cambio a ResultsView era instantáneo y la confirmación del upload quedaba oculta
- La navegación al resumen pasa a ser **explícita** a través del botón «Ver resumen IRPF» del UploadZone. Dos clicks mínimo para llegar al resumen desde un estado nuevo, a cambio de control total y feedback claro de cada paso
- Flujo típico ahora: Click «Cargar» → selecciona archivo → spinner breve («Parseando …») → UploadZone re-renderiza con ✓ verde en el slot y nombre del archivo → Click «Ver resumen IRPF» → resumen

### Fix — «Otro extracto» destruía la sesión · summary falso todo-ceros

Dos bugs relacionados que se disparaban juntos cuando el usuario subía primero el Dividend Report, quería añadir después el Informe de Actividad, y usaba el botón del resumen para volver a la carga:

- **`ResultsView.vue`**: el botón «Otro extracto» llamaba a `store.reset()` que **borra la sesión completa**. Cambiado a `store.backToUpload()` que solo cambia `status` a `idle` preservando los docs ya cargados. Renombrado a «Añadir / cambiar archivo» con tooltip explícito para que no quede ambigüedad
- **`stores/session.ts`**: el gate del `summary` aceptaba cualquier `TradeEvent` como contenido útil, incluidos los buys. Resultado: subir solo un Informe de Actividad con solo compras (sin ventas ni dividendos) producía un `IrpfSummary` con **todos los importes a cero** en vez de caer al fallback. Gate corregido a `hasDividends || hasSells` (al menos un dividendo o una venta). Ahora solo se construye el resumen cuando hay contenido tributable real

### Feature — Slots de archivo explícitos en la carga

Sustituye el dropzone genérico por slots nombrados por tipo de archivo, cada uno con su estado (cargado / pendiente), descripción, ruta de descarga en IBKR y botón «Cargar» o «Cambiar». Más claro para no-técnicos («¿qué es lo que arrastro aquí?») y deja sitio visible para futuras incorporaciones:

- **Slot 1 · `DividendReport.csv`** — badge rojo «obligatorio para dividendos» cuando no está; verde «cargado» cuando sí
- **Slot 2 · `Informe de Actividad.csv`** — badge ámbar «necesario si hubo ventas»; verde cuando sí
- **Slot 3 · `FX Income Worksheet.csv`** — visible pero deshabilitado con candado y etiqueta «próximamente» (el parser llegará cuando decidamos atacarlo)
- **Detección automática**: todos los botones delegan en `store.loadFile()`; el parser inspecciona la cabecera (`Account,…` vs `Statement,…`) y coloca el archivo en el slot correcto. Si el usuario pulsa el botón equivocado, la UI refleja la realidad (el archivo acaba donde corresponde)
- **Banner «Ver resumen IRPF»** en la cabecera del UploadZone cuando ya hay datos cargados — vuelve al resumen sin necesidad de tocar los archivos. Resuelve el flujo «pulsé Añadir archivo desde el resumen y me arrepiento»
- **Aviso ámbar inline** cuando hay archivos cargados pero el summary no tiene contenido tributable (p. ej. Activity con solo compras): explica qué falta sin dejar al usuario en el vacío

Cambios asociados:

- `src/stores/session.ts`: nueva acción `showSummary()` (vuelve a `status: 'ready'` si hay datos) exportada desde el store para su uso desde UploadZone

### UX — Home más legible: disclaimer destacado y orden del upload

- `src/pages/Home.vue`: el disclaimer «Esta aplicación no es asesoramiento fiscal» pasa de ser una nota gris casi invisible al pie a un **banner ámbar con icono `ShieldAlert`** (mismo patrón que `About.vue` para consistencia visual). Texto con la parte clave en negrita y ejemplos concretos de casos particulares (participaciones ≥ 10 %, fondos de pensiones, regímenes especiales, divisas no publicadas por el BCE…). Sigue con `print:hidden` para no duplicarse en hoja impresa. Elección cromática: ámbar en lugar de rojo para no competir con los errores reales (base incompleta, retención sin recuperar) que sí usan rojo en la app
- `src/pages/Home.vue`: eliminada la línea redundante «Dónde descargarlo: IBKR → Informes → Impuestos → Dividend Report» que quedaba suelta bajo el dropzone. La info ahora vive **en el contexto de cada archivo** dentro del recuadro del UploadZone
- `src/components/UploadZone.vue`: dropzone primero, recuadro explicativo debajo (antes al revés — la explicación quedaba fuera de pantalla en viewports cortos). Dropzone compactada (`p-6` vs `p-12`, icono `w-6` vs `w-10`) con texto simplificado a «Arrastra o haz clic aquí»: así el recuadro "¿Qué archivos subir?" queda visible de entrada sin scroll

---

## [1.1.0] — 2026-04-21

Tres añadidos funcionales sobre la v1.0.0, todos aditivos y retro-compatibles: cálculo FIFO de plusvalías multi-año, backup portable cifrado con passphrase y tres generadores de CSV para abrir en Excel. Incluye también pulido menor de código (componente `SortableTh` reutilizable, `eventsExcluded` en una sola pasada con semántica correcta, validación `zod` al importar sesiones) y formalización de la licencia `AGPL-3.0-or-later`.

### Feature — FIFO de plusvalías y minusvalías patrimoniales

Cierra la última pieza funcional del IRPF español para IBKR: transmisiones de valores negociados.

- `src/lib/rules/fifo.ts`: motor FIFO puro por ISIN. Agrega trades y eventos ROC de todos los docs recibidos, mantiene cola de lotes abiertos por ISIN y consume los más antiguos primero en cada venta. Valor de transmisión = gross − comisión; valor de adquisición = suma FIFO consumida (coste + comisión prorrateada). ROC reduce cost basis proporcionalmente a las acciones remanentes del ISIN
- `computeFifoGains(docs, taxYear)` devuelve `IrpfGainLossSummary` + avisos de parser
- **Multi-año por `accountId`**: el store agrega `priorDocs` desde `savedSessions` (mismo `accountId`, `taxYear` anterior). Una venta en 2025 puede consumir lotes cargados en la sesión de 2024 sin re-subir los CSV. El aggregation vive en memoria (los `StoredSession` ya llevan los docs)
- **Incomplete basis**: si al consumir lotes no hay buys previos suficientes, el coste faltante se trata como 0 y se marca la fila (`hasIncompleteBasis: true`) + warning `fifo-incomplete-basis`. Instruimos al usuario a cargar extractos anteriores o completar cost basis manualmente
- **Regla anti-elusión 2 meses / 1 año** (art. 33.5.f LIRPF): se detecta el patrón (pérdida + recompra en ventana corta, ventana española para ISIN `ES*`, extranjera para el resto) y se flaguea la fila con `antiElusionFlag: true` + warning `fifo-anti-elusion`. El motor **NO** difiere la pérdida automáticamente: se deja al criterio del usuario + asesor
- **Acciones corporativas fuera de alcance v1**: se emite un info `fifo-corporate-actions-oos` recordando al usuario que splits/spinoffs/fusiones requieren ajuste manual
- `applyRulesIrpf2025(doc, { priorDocs })`: motor extendido con opción opcional `priorDocs`. `RULES_VERSION` sube a `IRPF_2025_v0.2.0`. La `IrpfSummary` expone `plusvalias` opcional
- `src/components/PlusvaliasView.vue`: sección nueva en el resumen con 3 tarjetas (valor transmisión, valor adquisición, neto con desglose ganancia/pérdida), banners rojo para `incomplete basis` y ámbar para `anti-elusión` cuando aplican, y detalle plegable con fila por venta (fecha, valor, cantidad, transm., adquis., resultado, rango de lotes FIFO, etiquetas de flags). Colores semánticos: verde ganancia · rojo pérdida
- **Integración en el resumen**: la `ResultsView` muestra la nueva sección. La gate de `summary` se relaja: antes requería dividendos; ahora acepta dividendos **o** trades (un usuario con solo ventas también obtiene resumen completo)
- **Print**: `Print.vue` incluye el bloque de plusvalías (tarjeta con totales + tabla resumida) con salto de página controlado
- **Export CSV**: nueva entrada "CSV · plusvalías FIFO" en el menú de export, con fecha, valor, ISIN, país emisor, cantidad, rango de lotes consumidos, valor de transmisión/adquisición, resultado y flags
- **Tests**: 8 nuevos en `src/lib/rules/fifo.test.ts` cubriendo los casos clave (base incompleta, anti-elusión, matching multi-año, independencia del orden de docs, totales agregados, aviso de CA)
- **Fixtures sintéticos**: nuevos `ACTIVITY_STATEMENT_WITH_BUYS_2024` y `ACTIVITY_STATEMENT_WITH_SELLS_2025` con escenarios variados (match multi-año ENG, venta total MO, sin base UCB, pérdida + recompra APLE)

### Feature — Backup portable cifrado con passphrase (AES-GCM + PBKDF2)

Permite guardar la sesión en Drive / iCloud / USB con confidencialidad real: aunque la ubicación se comprometa, sin la passphrase nadie puede leer el contenido. Cero servidor, cero dependencias externas (100 % Web Crypto).

- `src/lib/crypto/envelope.ts`: módulo pequeño con `encryptJsonToEnvelope`, `decryptEnvelope` e `isEncryptedEnvelope`. Usa AES-GCM-256 (authenticated encryption) con claves derivadas por PBKDF2-SHA256 a 600 000 iteraciones (OWASP 2023). Salt 16 bytes e IV 12 bytes aleatorios por archivo. Error tipado `WrongPassphraseError` para que la UI distinga passphrase mala de archivo corrupto
- 8 tests nuevos en `src/lib/crypto/envelope.test.ts`: round-trip, salt/IV únicos por cifrado, passphrase incorrecta, ciphertext tampered, passphrase vacía, discriminador `isEncryptedEnvelope`
- Store Pinia: `exportSessionEncrypted(passphrase)` y `importSessionEncrypted(text, passphrase)`. Nuevo helper `detectImportKind(text)` distingue `plain | encrypted | invalid` para que la UI decida si pedir passphrase
- `src/components/PassphraseDialog.vue`: modal reutilizable en modos `export` / `import`. Con toggle show/hide, confirmación para export (evita typos), mensaje de error inline para reintentar tras passphrase mala, recordatorio de que la passphrase no es recuperable. Portal a `<body>`, cerrable con Escape / click fuera
- `ResultsView.vue`: nueva entrada «Backup cifrado · portable» en el menú Exportar. Descarga un `taxes-{año}-{cuenta}.taxes-enc.json`
- `SessionSelector.vue`: el botón «Importar JSON» ahora detecta automáticamente si el archivo es cifrado y abre el diálogo de passphrase. Si es plano, se importa directamente. Si no es reconocible, avisa al usuario
- **Alcance decidido**: *defensa en profundidad para el archivo en reposo fuera del navegador*. Fuera de alcance: keylogger local, extensión maliciosa, sync entre dispositivos (ese es trabajo de una futura tier Pro con backend E2E)

### Feature — Export CSV del resumen por país y de los dividendos detalle

- `src/lib/export/csv.ts`: helper genérico de serialización CSV con convenciones es-ES (separador `;`, coma decimal, BOM UTF-8 para que Excel abra sin pasos manuales) y `downloadTextFile` para disparar la descarga en el navegador
- `src/lib/export/session-csv.ts`: dos constructores de CSV a partir de `IrpfSummary` + `StatementDocument`:
  - `buildSummaryByCountryCsv` — una fila por país con bruto, retenido, tipo de convenio, cap, deducible y excedente. Ordenado por bruto desc.
  - `buildDividendsDetailCsv` — una fila por `DividendEvent` (incluye splits ROC) con fecha, símbolo, ISIN, nombre, país, subtipo, divisa, importe original, tipo de cambio y bruto EUR. Ordenado por fecha asc.
- `src/stores/session.ts`: nuevos métodos `exportSummaryCsv()` / `exportDividendsCsv()` que devuelven el string CSV listo para descargar
- `ResultsView.vue`: botón «Exportar» con menú desplegable que ofrece las tres opciones (CSV resumen · CSV dividendos · JSON sesión completa). Cierre con click fuera / Escape
- 11 tests nuevos en `src/lib/export/csv.test.ts` (total 76)

### Refactor — Mejoras menores de código

- `src/components/SortableTh.vue`: componente genérico para cabeceras ordenables con chevron. Sustituye ~80 LOC repetidas en `ResultsView.vue` (7 columnas con lógica idéntica)
- `src/lib/rules/rules_IRPF_2025.ts`: cálculo de `eventsExcluded` en una sola pasada sobre `doc.events` y con semántica correcta (cuenta eventos de renta —dividendo, retención, refund, interés— que caen fuera del ejercicio; antes podía incluir trades/fees del merged doc como "excluidos")
- `src/stores/session.ts`: validación con `zod` del JSON al importar una sesión. Un envelope bien formado pero con `dividendDoc` corrupto ya no hace crashear la UI al renderizar

### Docs — Versionado y licencia

- Primer release etiquetado **1.0.0** cerrando el MVP (parser IBKR + motor IRPF 2025 + UI + tests + CI). Todo lo publicado hasta ahora bajo esta versión
- `LICENSE`: añadido el texto canónico de **AGPL-3.0-or-later**
- `package.json`: campo `license` y `version` a `1.0.0`
- `README.md`: sección de licencia actualizada con la obligación de ofrecer fuente modificada al desplegar como servicio en red

---

## [1.0.0] — 2026-04-21

Cierre del MVP. Primer release estable: parser IBKR (DividendReport + Informe de Actividad), motor de reglas IRPF 2025, UI completa con navegación multi-página, persistencia multi-sesión en IndexedDB, integración BCE para FX, 65 tests con CI, vista imprimible, guía Renta Web paso a paso y página "Acerca de" con Ko-fi. Licencia AGPL-3.0.

### Feature — Página Acerca de con botón de donación + CI en GitHub Actions

- Nueva ruta `/acerca-de` (`src/pages/About.vue`) con cuatro bloques:
  - **¿Qué hace?** — resumen del flujo de la app
  - **Privacidad** — argumento client-side, sin backend con datos de usuario
  - **Disclaimer fiscal** — destacado en ámbar, con los casos que exigen asesor
  - **Autor** — presentación + enlace a GitHub (placeholder, a rellenar tras publicar el repo)
  - **Ko-fi** — bloque en rojo/rosa de Ko-fi con botón que enlaza a `https://ko-fi.com/kumoricuba`. Copy claro sin presión ("opcional, sin ataduras")
- Se elimina el placeholder "próximamente" del enlace en `SideDrawer.vue`; la entrada "Acerca de" ya navega a la nueva página
- **CI GitHub Actions** (`.github/workflows/ci.yml`): en cada push y PR contra `main` corre `npm ci → typecheck → test → build` en una máquina Ubuntu limpia. Si algo rompe, el PR muestra una ✗ roja y GitHub envía email. Timeout de 10 min. Gratis en repos públicos
- **README.md** reescrito: enfocado a público externo ahora que el repo va a ser público, con lista de features, privacidad, stack, estructura real, instrucciones completas y enlace a Ko-fi
- **CLAUDE.md** actualizado: refleja que el parser corre en main thread (el Web Worker se dejó para cuando sea necesario), incluye comandos y stack reales (FX BCE, IndexedDB, tests)

### UX — Auto-guardado optimista + disclaimer en Home

- **Store de sesión**: `persistCurrent()` ahora actualiza `savedSessions` y `activeSessionId` en memoria ANTES de escribir a IndexedDB. La escritura a IDB sucede en segundo plano. Con esto la UI se entera inmediatamente de la nueva sesión — sin depender de que termine el round-trip async con IDB. Si la escritura a IDB falla, se loguea claramente en consola (los datos en memoria persisten durante la sesión del navegador)
- **Disclaimer en Home**: añadido pie de página con "Esta aplicación no es asesoramiento fiscal…" visible en todos los estados de la home (idle, processing, ready, error). Eliminado el duplicado de `ResultsView.vue`. Lleva `print:hidden` para no duplicarse con el disclaimer de la vista imprimible

### UX — Imprimir como acción aparte, TOC oculto al imprimir Conceptos, save-flow sin flash

- **SideDrawer**: el botón "Imprimir / Guardar PDF" (copy más corto) ahora vive en una sección propia, separada del `<nav>` por una línea, justo encima del footer. Deja de mezclarse con las rutas y se lee claramente como acción, no como un enlace que abriría otra página
- **Concepts.vue**: el TOC (`<aside>`) se oculta al imprimir (`print:hidden`) porque los anclas no navegan en papel. El contenedor grid pasa a `print:block` para que el contenido ocupe el ancho entero sin dejar el hueco de la columna del TOC
- **Store de sesión**: reorganizado `persistCurrent()` — ahora hace `dbSaveSession → setActiveSessionId → refreshSessions → activeSessionId.value = id`. Setear `activeSessionId` DESPUÉS de que `savedSessions` refresque evita el flash momentáneo de "sesión activa con id que no aparece en la lista" (que es lo que hacía que el punto verde nunca apareciera tras guardar y que el dropdown pareciera vacío)
- Eliminado el flag `skipNextPersist`: el coste de re-guardar la sesión justo al cargarla de IDB es un único `dbPut` redundante (idempotente) y a cambio se simplifica el flujo

### UX — Arreglo del label "(sin guardar)" y del botón Imprimir del sidebar

- **SessionSelector**: elimina el sufijo engañoso "(sin guardar)" del label de sesión. El auto-guardado en IndexedDB ya sucede en cuanto cambia `dividendDoc`/`activityDoc`; el sufijo solo aparecía durante el refresh de `savedSessions` y daba a entender que faltaba una acción manual. Ahora muestra el mismo label que usará la sesión tras guardarse
- **SessionSelector**: nueva nota fija en el encabezado del dropdown: "Las sesiones se guardan automáticamente en este navegador" — hace visible el auto-save sin alarmar
- **SideDrawer**: el enlace "Imprimir / PDF" deja de ir a `/imprimir` (que es la vista especializada del resumen IRPF). Ahora es un botón genérico que dispara `window.print()` sobre la página actual — vale para Conceptos, Guía Renta Web o cualquier otra ruta. La vista optimizada `/imprimir` sigue accesible desde el botón específico de ResultsView
- El drawer lleva `print:hidden` para garantizar que nunca aparezca en la hoja impresa aunque quedara visible durante la transición

### Feature — Guía Renta Web paso a paso con valores concretos de la sesión

- Nueva ruta `/renta-web` (`src/pages/RentaWeb.vue`) accesible desde el drawer con el icono `ListChecks`
- **Enlaces oficiales AEAT/Hacienda** (Sede Renta, Manual práctico, Convenios CDI, Cita previa) con el icono externo visible
- **Paso 1 · Casilla 0029**: breadcrumb de la ruta en Renta Web, valores concretos a meter en «Ingresos íntegros» y «Retenciones» tomados de la sesión actual
- **Paso 2 · Doble imposición internacional**: solo si hay rendimientos extranjeros; breadcrumb + valores para «Rendimientos netos del capital mobiliario extranjero» e «Impuesto satisfecho en el extranjero»
- **Aviso · Excedente no recuperable**: si aplica, lista los países con exceso y el importe concreto por país para que el usuario sepa dónde reclamar
- **Sección «Recuerda»**: criterio de caja, dividendos de enero próximo, W-8BEN, ROC no tributa
- Fallback amable si no hay sesión cargada

### Feature — Modal de confirmación reutilizable (sustituye `window.confirm`)

- `src/components/ConfirmDialog.vue`: modal genérico con props `title`, `message`, `confirmLabel`, `cancelLabel`, `danger`. Eventos `confirm`/`cancel`/`update:open`. Cierra con Escape o click fuera
- `SessionSelector.vue` ya no usa `window.confirm` para eliminar sesiones; abre el modal con copy más claro y botón rojo de «Eliminar». El dropdown se cierra al abrir el modal para evitar overlays superpuestos

### Feature — Página imprimible / export PDF del resumen IRPF

- Nueva ruta `/imprimir` (`src/pages/Print.vue`): vista limpia pensada para papel/PDF que incluye casilla 0029, bloque de doble imposición, desglose por país (ordenado por bruto desc) y avisos relevantes (error/warn; los info se omiten para ahorrar espacio)
- Botón **"Imprimir / PDF"** en la cabecera del resumen y en el sidebar, que navega a `/imprimir`
- La página de impresión tiene un botón que dispara `window.print()`; el navegador abre el diálogo nativo con opción "Guardar como PDF". Cero dependencias, sin backend; mantiene la filosofía offline-first
- CSS de impresión: oculta la cabecera/drawer de la app (`print:hidden`), tipografía reducida, control de saltos de página (`break-inside: avoid`) en las tablas, fuerza impresión de color para las celdas destacadas (excedente no recuperable)
- Disclaimer fiscal siempre visible en el pie de la hoja imprimible

### Feature — Integración de tipos de cambio del Banco Central Europeo (BCE)

Desbloquea la valoración EUR de trades, fees y movimientos de caja en divisa extranjera dentro del Informe de Actividad. El DividendReport ya venía con EUR precomputado; ahora el Activity Statement también.

- `scripts/update-bce-rates.ts`: descarga `eurofxref-hist.zip` del BCE, filtra a 30 divisas relevantes y al período 2020→actualidad, genera un bundle compacto en `src/lib/fx/bce-rates.json` (~640 KB · ~1 600 fechas)
- Nuevo script npm: `npm run fx:update`
- `src/lib/fx/bce.ts`: módulo de lookup `getBceRateToEur(currency, date)` con:
  - Convención BCE: `1 EUR = X currency`; devuelve el multiplicador inverso `eur = amount * rate`
  - Fallback automático al día hábil anterior si la fecha cae en fin de semana o festivo (hasta 7 días atrás, criterio conservador aceptado por AEAT)
  - `isBceSupported(currency)` para detectar divisas fuera del publicado (p. ej. TWD)
- Parser del Activity Statement:
  - Helper `makeMoney(amount, currency, date)` que resuelve FX vía BCE al construir cada `Money`
  - Los importes EUR se rellenan automáticamente para trades, comisiones, fees y movimientos de caja en divisa soportada
  - Avisos agregados por divisa al final del parseo (no uno por evento): `fx-rate-missing` para fechas sin rate y `fx-currency-unsupported` para divisas fuera del BCE
- Observación sobre datos reales: el usuario tiene 364 custody fees en TWD (que el BCE no publica). Esto genera un único warning agregado recomendando verificación manual con el tipo del broker
- Tests nuevos (13) en `src/lib/fx/bce.test.ts` + actualización del test de Activity Statement para validar que USD se resuelve a EUR correctamente

### Feature — Ampliación del acápite Conceptos

Pasa de 7 artículos (uno en stub) a **10 artículos cerrados**, con el TOC reagrupado por temas para navegarse fácil.

- **TOC por grupos**: Conceptos básicos · Doble imposición · Casos especiales · Práctica
- **FIFO y plusvalías** — stub reemplazado por contenido completo: cómo aplica por ISIN/todas las cuentas, ejemplo trabajado de compras parciales + venta, divergencia con el criterio LIFO/coste medio de IBKR, regla anti-elusión de 2 meses / 1 año, aviso de que la app recalculará con FIFO español cuando haya ventas
- **Divisas y tipo de cambio** (nuevo): criterio AEAT del día de cobro, fuentes aceptadas (broker vs BCE), nota sobre cuentas con base ≠ EUR
- **Convenios de doble imposición** (nuevo): tabla renderizada dinámicamente desde `TREATY_RATES_IRPF_2025` con código + país + tope + notas, y listado de jurisdicciones sin convenio. La data queda en un único sitio (el motor de reglas) usada tanto para calcular como para documentar
- **Errores comunes** (nuevo): ocho bloques clasificados (declarar el neto, mezclar retenciones extranjeras con ES, olvidar la deducción, tratar ROC como ordinario, no renovar W-8BEN, año equivocado por criterio de caja, confundir depósito con rendimiento, ignorar el excedente sobre convenio). Con enlaces internos entre artículos

### Tests — Suite unitaria con Vitest (52 tests)

Blindaje automatizado de todas las piezas críticas. Ningún cambio futuro romperá silenciosamente los totales que cuadramos con IBKR.

- Dependencia nueva: `vitest` (dev). `vite.config.ts` extendido con `defineConfig` de `vitest/config`
- Scripts nuevos: `npm test` (single run), `npm run test:watch`
- `src/lib/__fixtures__.ts`: fixtures sintéticos (cuenta ficticia `U00001234`, sin datos reales) que cubren:
  - Dividendos ES con retención 19 %
  - Dividendos US con retención 15 % (tope del convenio)
  - Dividendos BE con retención 30 % (excede convenio)
  - REIT con ROC parcial (APLE-like)
  - Dividendo 100 % ROC (N2IU-like)
  - Dividendo con pay date en enero del año siguiente (out-of-year)
  - Activity Statement con trades, fees EUR/USD, depósito y catálogo de instrumentos
- Suites:
  - `parser/ibkr/csv.test.ts`: tokenizer (BOM, CRLF, quoting, escapes, campos vacíos) y `groupBySection`
  - `parser/ibkr/dividend-report.test.ts`: redacción de cuenta, ejercicio por moda, split de ROC parcial, 100 % ROC, scope ES vs foreign, pairing dividendo↔retención, `sourceTotals`, out-of-year warning
  - `parser/ibkr/activity-statement.test.ts`: account info con período, trades con side, enriquecido con ISIN, clasificación de fees, movimientos de caja, totales de Dividendos/Retención, warnings FX
  - `parser/merge.test.ts`: wrap de una fuente, combinación sin duplicados, enriquecimiento, cross-validation match/mismatch
  - `rules/rules_IRPF_2025.test.ts`: casilla 0029, retenciones ES aisladas, rendimientos extranjeros, cap + excedente por país, warnings anclados a país, exclusión de ROC
  - `rules/ibkr-equivalence.test.ts`: US vs Non-US, ROC total
  - `utils/format.test.ts`: formato EUR (tolerante a data ICU de Node) y porcentaje

### Feature — Navegación multi-página, sidebar y primer acápite didáctico

- **Routing**: nueva ruta `/conceptos` y `scrollBehavior` en el router que hace smooth scroll a anclas (`#base-ahorro`, `#dividendos`, …)
- **Layout común en `App.vue`**: la cabecera y el drawer se mueven de `Home.vue` a nivel de app para aparecer en todas las rutas
- **`AppHeader.vue`**: logo clicable a home + selector de sesión + botón hamburguesa
- **`SideDrawer.vue`**: drawer desde la derecha con enlaces a «Resumen IRPF» y «Conceptos» (más «Acerca de» como placeholder). Bloquea el scroll del body mientras está abierto, cierra con Escape/backdrop
- **`Concepts.vue`**: página didáctica con:
  - Tabla de contenidos sticky en desktop, stacked en móvil
  - 7 artículos iniciales: base del ahorro, dividendos, doble imposición internacional, ROC, W-8BEN, FIFO y el extracto de IBKR (FIFO queda con stub "próximamente")
  - Enlaces a fuentes oficiales (AEAT, Hacienda CDI)
- **`TermInfo.vue`**: popover reutilizable con icono `Info` que muestra explicación breve + enlace "Leer más en Conceptos →" a la sección correspondiente. Cierre con click fuera o Escape
- Tooltips aplicados sobre términos clave del resumen: «Rendimientos del capital mobiliario», «Ingresos íntegros», «Retenciones (España)», «Doble imposición internacional», «Excedente no recuperable vía IRPF»

### Feature — Multi-sesión en IndexedDB + import/export JSON

Migra la persistencia de localStorage a IndexedDB y permite mantener varias sesiones (p. ej. IRPF 2024 + IRPF 2025 + distintas cuentas) a la vez, intercambiables sin re-subir los CSV.

- `src/lib/storage/db.ts`: wrapper minimalista sobre IndexedDB con promises. Dos object stores: `sessions` (keyed por id) y `meta` (para el `activeSessionId`)
- `src/lib/storage/sessions.ts`: CRUD de `StoredSession`, con `id = ${taxYear}-${accountId}` derivado automáticamente del documento parseado. Migración automática desde el esquema anterior de `localStorage` (`taxes-session-v2`) hacia IDB — datos previos se preservan sin intervención
- **Store Pinia** refactorizado: `init()` asíncrono hidratado desde IDB al montar la app; `watch` profundo sobre los docs que guarda automáticamente tras cada cambio. Nuevo estado `loading` mientras hidrata. Nueva bandera `skipNextPersist` para evitar re-guardar al aplicar una sesión leída. Nuevos métodos: `switchSession(id)`, `newSession()`, `deleteSession(id)`, `refreshSessions()`, `exportSessionJson()`, `importSessionJson(text)`
- `src/components/SessionSelector.vue`: dropdown en la cabecera con:
  - Label actual (p. ej. "Renta 2025 · U…420 · (sin guardar)")
  - Lista de sesiones guardadas con punto verde en la activa y fecha de última actualización
  - Papelera por sesión con confirmación
  - «+ Nueva sesión», «⬆ Importar JSON» (acepta un export previo), «⬇ Exportar sesión actual» (incluye ambos docs)
  - Cierre con click fuera o Escape
- `App.vue` llama a `store.init()` en `onMounted`; `Home.vue` muestra spinner durante `status === 'loading'`
- Export JSON incluye ambos docs + metadata (`app: 'taxES'`, `v: 1`). Import valida ese envelope y restaura la sesión, que queda auto-guardada en IDB con el siguiente auto-save

### UX — Resumen por empresa en modal de país, contador de empresas y fallback de etiqueta en chart

- **Chart**: si el excedente `−X,XX €` no cabe dentro del ámbar (<5 pp de ancho), se renderiza a la izquierda del `XX.X%` en lugar de ocultarse. Siempre visible
- **Modal de país**:
  - Cabecera muestra ahora «N dividendos · M empresas» usando conteo de pagos únicos por `(símbolo, fecha)` (alineado con la tabla principal) y recuento de símbolos distintos
  - Nueva sección «Por empresa»: tabla con símbolo, nombre, ISIN (tooltip), tag ROC si aplica, número de pagos, rango de fechas, bruto EUR y retenido EUR. Ordenada por bruto descendente
  - El detalle línea a línea pasa a ser un `<details>` colapsable (por defecto cerrado), indicando el número de líneas (incluye los split ROC, como indica el copy "línea a línea")
  - Columna «Fechas» y línea de ISIN ocultas en móvil (`hidden sm:table-cell`/`sm:block`) para mantener la tabla respirable en pantallas pequeñas

### UX — Retention chart colapsable, etiquetas dentro de la barra y responsive

- `RetentionChart.vue` envuelto en `<details>` con toggle «mostrar/ocultar», **cerrado por defecto** (como Verificación)
- Se eliminan las dos columnas externas (`% retenido` y `€ no recuperable`). Las etiquetas ahora van **dentro** de la barra:
  - `X.X%` justo al final del fill total
  - `−X,XX €` centrado dentro del segmento ámbar (solo si el ancho ámbar ≥ 5 puntos porcentuales, para que el texto quepa)
- Columna de país más estrecha en móvil (`w-24 sm:w-44`) y código ISO con `text-[10px] sm:text-xs` para ganar espacio horizontal
- Pareja de segmentos verde/ámbar inside de un wrapper con `overflow-hidden` para rounded limpio; capa de labels aparte sin clipping

### Feature — Drill-down por país, gráfico comparativo y pulido de modal

- `src/components/CountryDetailsModal.vue`: al hacer click en una fila de la tabla por país se abre un modal con el detalle de cada dividendo — fecha, símbolo, **nombre de empresa**, **ISIN** (cuando el catálogo del Activity Statement los aporta), bruto EUR, retención EUR y tag ordinario/ROC. Totales en la cabecera. Cierre con Esc, click fuera o botón X
- `src/components/RetentionChart.vue`: barras horizontales por país con segmento verde (retención dentro del convenio, recuperable) + segmento ámbar (excedente no recuperable), marca vertical del tope del convenio. Ordenado por excedente descendente para que lo accionable esté arriba
- Fila de la tabla con cursor pointer + nombre subrayado con puntos para indicar drill-down. Badges de avisos con `@click.stop` para no interferir con el click del modal
- Avisos plegado por defecto (como Verificación)
- Columna "Cuadra" del cross-validation: la fila de conteo sustituye el texto "info" (que inducía a pensar que era clicable) por un icono `Info` con tooltip que explica el motivo
- Modal con muchos datos: cap de altura al viewport (`max-h-full` + `overflow-y-auto` en el body) para que siempre respete márgenes arriba/abajo y la cabecera quede fija mientras el usuario hace scroll internamente

### Feature — Merger y validación cruzada entre los dos informes

Cierra el objetivo inicial del plan: "dos archivos que se complementen o confirmen entre sí".

- `src/lib/parser/merge.ts`: `mergeIbkrStatements(dividendDoc, activityDoc)` produce un `MergedStatementDocument` que combina:
  - **Dividendos y retenciones** del `DividendReport.csv` (fuente fiscal canónica)
  - **Trades, fees y cash** del `Informe de Actividad.csv`
  - **Catálogo de instrumentos enriquecido**: cada evento que tenga `instrument` recibe ISIN, nombre y país desde el catálogo del Activity Statement cuando el DividendReport no los aporta
  - AccountInfo fusionado (prefiere período del Statement; preserva accountId redactado)
  - Warnings combinados y deduplicados por `code+message`
- `CrossValidationReport` compara totales de ambas fuentes con umbral de 5 céntimos:
  - Dividendos brutos EUR
  - Retenciones EUR
  - Conteo de dividendos (informativo, puede diferir por ROC split)
- `src/lib/parser/types.ts`: nuevo campo `sourceTotals` en `StatementDocument` para soportar la validación
- Parsers actualizados para emitir `sourceTotals`:
  - DividendReport: suma desde sus propios eventos (175 divs / 103 ws · 755,12 € / 90,11 €)
  - Activity Statement: extrae directamente las filas «Total Dividendos en EUR» y «Total Retención de impuestos en EUR»
- **Store Pinia**: `summary` y `mergedDoc` pasan a ser `computed` derivados de `dividendDoc`/`activityDoc`; la persistencia sube a `v2` y ya no guarda el `summary` (se recalcula)
- UI `ResultsView.vue`: nueva sección «Validación cruzada» con banner verde/ámbar y tabla comparativa con iconos de check/cross por métrica

### Observaciones del extracto real 2025

- Dividendos brutos: DividendReport 755,12 € vs Activity 755,65 € → diff **0,53 €** (supera el umbral)
- Retenciones: DividendReport 90,11 € vs Activity 91,16 € → diff **1,05 €** (supera el umbral)
- Pequeñas discrepancias entre los dos informes oficiales del propio broker: es un caso real donde el cross-validation añade información que no habríamos detectado de otro modo

### Feature — Sección Avisos colapsable

- La sección de "Avisos" de `ResultsView.vue` se convierte en `<details>` con toggle «mostrar/ocultar» en el encabezado (mismo patrón que «Verificación»), abierta por defecto
- `scrollTo()` abre automáticamente cualquier `<details>` cerrado antes de hacer scroll al destino, para que al pulsar un badge numerado desde la tabla por país siempre se vea el aviso

### Feature — Persistencia de sesión en localStorage

- Al recargar la página ya no se pierden los archivos subidos
- El store Pinia serializa `dividendDoc`, `activityDoc`, `summary`, `fileName` y `lastFileType` a `localStorage` con clave versionada (`taxes-session-v1`)
- `watch` con `deep: true` guarda tras cada cambio; `reset()` limpia también lo almacenado; `backToUpload()` conserva los datos para permitir añadir el segundo archivo sin perder el primero
- Guardado client-only (guardia `typeof window !== 'undefined'`), tolerante a datos corruptos y a excepciones de cuota

### Feature — Nombres de país y tabla ordenable

- `src/lib/rules/country-names.ts`: mapa ISO alpha-2 → nombre en español (44 países). `getCountryName(code)` con fallback al código si es desconocido
- La columna "País" de la tabla por país ahora muestra el código en mono + el nombre completo (`US · Estados Unidos`)
- Todos los encabezados de la tabla (País, #Div, Bruto, Retenido, Convenio, Deducible, Excedente) son clicables y ordenan asc/desc. Icono `ChevronUp`/`ChevronDown` en la columna activa, `ChevronsUpDown` gris en las inactivas
- Orden por defecto: Bruto descendente. Al pulsar el mismo encabezado se invierte; al pulsar otro, default desc para columnas numéricas y asc para País

### Feature — Parser del Informe de Actividad de IBKR

Segundo parser (complementa al `DividendReport.csv`) para trades, fees y movimientos de caja.

- `src/lib/parser/ibkr/activity-statement.ts`: extrae 4 tipos de evento desde el `Informe de Actividad.csv`:
  - **Trades** (Operaciones / Acciones, ETF, Fondos) → `TradeEvent` con detección de side por `Código` (BUY/SELL) o signo de `Productos`
  - **Fees** (Tarifas) → `FeeEvent` con clasificación heurística: `custody` / `adr-fee` / `financing` / `other`
  - **Cash movements** (Depósitos y retiradas) → `CashTransactionEvent`
  - **Catálogo de instrumentos** (Información de instrumento financiero) → mapa `Símbolo → Instrument` con ISIN, nombre, país del emisor (derivado del ISIN) y asset class
- Extrae período del informe desde la sección `Statement` ("Enero 1, 2025 - Diciembre 31, 2025")
- Redacta `accountId` por defecto (`U…420`)
- **Fuera de alcance por ahora** con warnings agregados:
  - **Fórex trades** (739 conversiones automáticas de IBKR) → `forex-skipped`
  - **FX a EUR para divisas ≠ EUR** → `fx-rate-missing` por evento; se rellenará con tabla BCE en Phase 2
  - Dividendos y retenciones del Activity Statement (redundante con el DividendReport, mejor granularidad fiscal ahí)
  - Acciones corporativas, Modificación de devengados, Posiciones, NAV
- `scripts/parse-activity.ts`: verificación offline con `npm run parse:activity`

### Verificado contra extracto real 2025

- 440 eventos (54 trades · 375 fees · 11 cash · 0 dividends en este parser)
- Todas las operaciones del año son compras (no vendió nada en 2025)
- Trades en EUR: 3.772,72 € · resto en USD/GBP/NOK/CAD/SGD pendiente de FX
- Depósitos del año: 6.700,00 €

### Feature — Avisos con badges numerados y navegación bidireccional

Cerrar la duda "¿este aviso a qué dato se refiere?" con vínculo clicable.

- `IrpfNotice.anchorCountry` (nuevo campo opcional): los avisos asociados a un país se marcan con el código ISO. Se propaga en `no-treaty-withholding`, `withholding-exceeds-treaty` y `treaty-note`
- UI de `ResultsView.vue`:
  - Los avisos se numeran 1..N por severidad (errores → warn → info)
  - En la tabla por país aparece una columna "Avisos" con pastillas coloreadas (rojo/ámbar/azul según severidad) con el número; click hace scroll y resalta el aviso correspondiente
  - Cada aviso muestra su número al inicio y, si tiene ancla de país, un botón "↩ XX" que vuelve a la fila
  - Highlight temporal con ring azul al aterrizar en el target

### Feature — Equivalencia con "Dividend Revenue Summary" de IBKR

Panel colapsable para contrastar al céntimo los totales con el HTML oficial de IBKR.

- `src/lib/rules/ibkr-equivalence.ts`: función pura `computeIbkrEquivalence(doc, taxYear)` que reproduce los ejes de IBKR (US / Non-US, sin filtro de año) y calcula también los importes excluidos del ejercicio fiscal para justificar la diferencia con el resumen IRPF
- UI: `<details>` expandible al final del resumen con los 5 totales (Total Ordinary, Non-US Ordinary, US Tax Paid, Non-US Tax Paid, Return of Capital) y la reconciliación `IBKR − exclusiones = IRPF` línea a línea

### Feature — UI mínima de upload + resumen

Cierra el flujo vertical end-to-end en el navegador sin dependencia de servidor.

- `src/stores/session.ts`: store Pinia con máquina de estados `idle → processing → ready | error`. Carga el archivo en memoria, invoca el parser + motor de reglas, captura errores con mensaje legible. Límite de 20 MB para prevenir uploads accidentales grandes
- `src/components/UploadZone.vue`: zona drag-and-drop y selector clásico. Mensaje explícito de que "el archivo no sale del navegador"
- `src/components/ResultsView.vue`: vista de resultados con tarjetas para Casilla 0029, bloque de Doble Imposición Internacional con desglose tabular por país, lista de avisos agrupados por severidad (error/warn/info con iconos de lucide), y botón de export JSON de la sesión completa
- `src/pages/Home.vue`: orquesta los cuatro estados — landing con explicación, upload, spinner de procesamiento, vista de resultados o error
- `src/utils/format.ts`: formateadores `formatEur` y `formatPct` en locale es-ES con tabular-nums
- UX: disclaimer "no es asesoramiento fiscal" siempre visible · reset para cargar otro extracto sin recargar · fileName mostrado en cabecera

### Feature — Motor de reglas IRPF 2025

Primer flujo vertical completo del MVP: `DividendReport.csv` → parseo → motor de reglas → resumen Renta Web ready.

- `src/lib/rules/types.ts`: tipos de salida (`IrpfSummary`, `IrpfCasillaDividendos`, `IrpfCountrySummary`, `IrpfDoubleTaxationDeduction`, `IrpfNotice`)
- `src/lib/rules/treaty-rates.ts`: tabla de convenios de doble imposición entre España y 40+ países. Dividendos de cartera (participación < 10 %). Marcado el origen del convenio y notas operativas (W-8BEN para USA, 5 % para Singapur, jurisdicciones sin convenio como Caimán/Marshall)
- `src/lib/rules/rules_IRPF_2025.ts`: función `applyRulesIrpf2025(doc)` que produce:
  - **Casilla 0029** — Ingresos íntegros (bruto tributable, excluye ROC y eventos fuera del ejercicio) + Retenciones practicadas en España
  - **Deducción por doble imposición internacional** — rendimientos extranjeros + impuesto deducible aplicando el límite del convenio por país
  - **Por país**: bruto, retenido, tipo convenio, cap, deducible, excedente no recuperable
- `scripts/render-irpf.ts`: salida tabular por consola con el resumen Renta Web, ejecutable con `npm run render:irpf`
- Warnings: `withholding-exceeds-treaty`, `no-treaty-withholding`, `treaty-note`
- Propagación de avisos del parser (`event-outside-tax-year`)

### Verificado contra extracto real 2025

- **Casilla 0029**: 697,24 € ingresos íntegros + 11,08 € retenciones España (filtrados los 2,20 € de APLE 2026-01-15 que van al IRPF 2026 por criterio de caja)
- **Doble imposición**: 636,64 € rendimientos · 62,12 € deducible · 16,58 € excedente no recuperable
- 8 países con retención por encima del convenio detectados automáticamente (BE 30 % → tope 15 %, AT 27,5 %, IT 26 %, KR 22 %, NO 25 %, PH 25 %, TW 21 %, JP marginal)

### Feature — Parser del DividendReport de IBKR

- `src/lib/parser/ibkr/csv.ts`: tokenizer CSV tolerante al formato de IBKR (BOM, CRLF, quoting selectivo), con agrupación por sección y helper `rowToRecord` para acceso a celdas por nombre de columna
- `src/lib/parser/ibkr/dividend-report.ts`: convierte `DividendReport.csv` en un `StatementDocument` con `DividendEvent` + `WithholdingEvent` emparejados
- Detección de `subtype: 'return-of-capital'` vs `'cash'` cruzando filas `Summary` con sus `RevenueComponent`
- Warning `mixed-dividend-components` cuando un dividendo tiene componente Return of Capital parcial (posible ajuste al coste de adquisición)
- Ejercicio fiscal calculado como moda de años de eventos (no `max`), evitando confundir el año por dividendos con pay date en enero del siguiente. Warning `event-outside-tax-year` por cada evento que caiga fuera
- `accountId` redactado por defecto (`U…420`)
- `scripts/parse-sample.ts`: verificación offline end-to-end contra un extracto real; ejecutable con `npm run parse:sample`
- `samples/`: convención para guardar extractos reales como fixtures; gitignorada

### Fix — Dividendos perdidos por dedup y ROC parcial mal clasificado

Descubierto comparando los totales de mi parser con el bloque "Dividend Revenue Summary" del `DividendReport.html` oficial de IBKR:

- **Walker secuencial** (antes indexaba por `símbolo|divisa|fecha`): IBKR emite a veces varias filas `Summary` con la misma clave cuando hay componentes de naturaleza fiscal distinta (p. ej. N2IU 2025-03-07 con 3 `Summary`). El map colapsaba en 1 perdiendo el resto. Recuperados 10 dividendos (+35,89 € bruto, +6,71 € retenciones).
- **Split de ROC parcial**: dividendos mixtos (APLE, O: 20-30 % ROC + 70-80 % Ordinary) ahora se emiten como DOS `DividendEvent` separados (`cash` + `return-of-capital`). Antes se contaban 100 % como tributables. Corrige 15,48 € reclasificados de tributable a ROC.
- Componentes aceptados como tributables: `Ordinary Dividend`, `Franking Dividend`, `Exempt From Withholding`. `Return of Capital` → no tributa. `Other` → ignorado (son ajustes pequeños reflejados ya en `Summary.Withhold`).
- Warning `unknown-revenue-component` para cualquier tipo no conocido (se trata como tributable por defecto).
- Sustituye el warning `mixed-dividend-components` por `split-roc-component` (info, no warn): el split es automático y correcto.

### Verificado sobre extracto real 2025 (175 DividendEvent + 103 WithholdingEvent, 21 países, 8 divisas)

Cuadre **exacto** contra "Dividend Revenue Summary" oficial de IBKR:

| Concepto | IBKR HTML | Parser |
|---|---|---|
| Total Ordinary Dividends | 699,44 € | 699,44 € ✓ |
| Total non-US Ordinary | 574,30 € | 574,30 € ✓ |
| US Tax Paid | 18,76 € | 18,76 € ✓ |
| Non-US Tax Paid | 71,35 € | 71,35 € ✓ |
| Return of Capital | 55,68 € | 55,68 € ✓ |
| Suma total bruto | 755,12 € | 755,12 € ✓ |

### Feature — Modelo de datos normalizado del parser

- `src/lib/parser/types.ts` define el contrato estable entre parser, motor de reglas IRPF y UI
- Eventos soportados: `DividendEvent`, `WithholdingEvent`, `WithholdingRefundEvent`, `InterestEvent`, `TradeEvent`, `FeeEvent`, `FxConversionEvent`, `CashTransactionEvent`
- `Money` lleva siempre divisa original + equivalente EUR + tipo de cambio + fecha (FX del día del evento, no cierre de año)
- `Provenance` en cada evento conserva fila cruda del extracto para trazabilidad completa
- `ParserWarning` con códigos canónicos estables (`fx-rate-missing`, `unpaired-withholding`, `withholding-exceeds-treaty`…)
- Subtipos de dividendo separados: `cash`, `stock`, `payment-in-lieu`, `drip`, `return-of-capital`
- Retenciones separadas por `scope`: `foreign-source` (doble imposición internacional) vs `spanish` (casilla de retenciones)

### Decisiones

- **Neutralidad del parser**: no conoce casillas de Renta Web, convenios ni FIFO. Todo eso vive en el motor de reglas por ejercicio.
- **Pairing dividendo↔retención** lo hace el parser (heurística símbolo + fecha ±1 día + magnitud). Si falla, eventos quedan sueltos con warning `unpaired-withholding`.
- **Redacción de `accountId` por defecto**: privacy-by-default; el usuario decide si mostrarlo completo desde la UI.

---

## [0.1.0] — 2026-04-20

### Feature — Scaffold inicial

- **Stack base**: Vite 7 + Vue 3 + TypeScript + Tailwind CSS 4 + Pinia + vue-router + vee-validate/zod + axios + lucide-vue-next
- **Backend Express (Node)** arrancado junto al frontend desde un único proceso (`server.ts` con Vite en modo middleware). `npm run dev` levanta los dos sin `concurrently`
- **Estructura de carpetas** alineada con la convención interna del autor (referencia: cooperafy): `src/{components,composables,layouts,lib,pages,router,schemas,services,stores,types,utils,workers}`, `api/{routes,ai}`
- **Alias de Vite**: `@`, `@components`, `@composables`, `@layouts`, `@lib`, `@pages`, `@schemas`, `@services`, `@stores`, `@types`, `@utils`, `@workers`
- **Scripts**: `dev`, `build`, `start`, `preview`, `typecheck`
- **Endpoint `/api/health`** de verificación inicial
- **Documentación**: `README.md`, `ROADMAP.md`, `CHANGELOG.md`, `CLAUDE.md`

### Decisiones de arquitectura

- Parseo de extractos IBKR en **Web Worker del lado cliente** — los statements no salen del navegador (privacidad como feature).
- **Reglas fiscales por ejercicio** en archivos separados (`rules_IRPF_YYYY.ts`) para aislar cambios normativos anuales.
- **Indexa Capital fuera de scope**: foco exclusivo en Interactive Brokers.
- Deploy agnóstico (`node-server`): `npm run build` + `npm start` en cualquier VPS.
