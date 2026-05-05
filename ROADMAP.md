# taxES — Tareas Pendientes

> La v1.0.0 (MVP cerrado: parser IBKR + motor IRPF 2025 + UI + tests + CI) se etiquetó en abril de 2026.
> Sobre ella se han añadido: **FIFO multi-año de plusvalías**, **backup portable cifrado (AES-GCM)**, **exports CSV** y pulido de código. Ver `CHANGELOG.md` para el detalle.
>
> Este documento lista **solo lo pendiente**. Se mueve a CHANGELOG al completarse.

---

## Parser — casuística IBKR

Gaps reales del parser que afectan la fidelidad del resumen.

- [ ] Etiquetar **payment-in-lieu** y **DRIP** en el parser del DividendReport (emitir `subtype` correcto + warning informativo). Tipos ya existen en `StatementEvent`
- [ ] Parser de **WithholdingRefundEvent** + netting en el motor de reglas. Tipo ya existe; falta el parsing y la integración
- [ ] Parser explícito de **operaciones Fórex** del Informe de Actividad → `FxConversionEvent` (hoy se cuentan y se emite warning)
- [ ] Parser **HTML** del extracto como fallback si el usuario solo dispone del HTML

## FX

- [ ] Fuente alternativa para divisas no publicadas por el BCE (TWD en el caso real del autor, tasas del broker derivadas del DividendReport, etc.)
- [ ] Soporte para cuentas IBKR con divisa base distinta a EUR

## Próximos ejercicios

- [ ] `rules_IRPF_2024.ts` / `rules_IRPF_2026.ts` cuando haya necesidad real (el motor ya está versionado, la estructura permite duplicar)
- [ ] Selección automática del motor por `doc.taxYear` (hoy está hardcoded a 2025)
- [ ] Validar casillas vigentes contra Manual AEAT cada ejercicio

## UX / polish

- [ ] **Dark mode** (Tailwind 4 lo soporta; tocar variantes `dark:` componente a componente)
- [ ] **PWA / offline-first**: service worker que cachea assets tras la primera visita; instalable desde Chrome/Edge
- [ ] **i18n EN/ES** (expande audiencia)
- [ ] **Tauri bundles**: binarios nativos (.dmg / .exe / .AppImage) si aparece demanda real
- [ ] Tema y diseño refinados antes de un lanzamiento amplio

## Lanzamiento público (cuando decidas publicar el repo)

- [ ] Hacer público el repo en GitHub
- [ ] Deploy a un dominio (Cloudflare Pages, Netlify, VPS propio…). El backend Express es opcional: con el SPA estático + cualquier hosting de ficheros vale
- [ ] Actualizar enlace al repo en `About.vue` y añadir badge de CI al README
- [ ] Captar 5-10 beta testers con carteras IBKR para cazar edge cases en extractos distintos

## Futuro

### Sincronización cifrada E2E en la nube
> Extensión natural del backup portable cifrado actual: subir el ciphertext a un endpoint propio (el servidor solo guarda bytes opacos). Requiere auth mínima e infra dedicada — se aborda cuando haya demanda real o encaje en una tier Pro. Notas de monetización en `MONETIZATION.md` (gitignored).

### Asistencia con IA (backend `/api/ai/*`)
> Proxy a un proveedor con clave en servidor para: (a) resumir cambios del Manual AEAT año a año, (b) explicar al usuario casillas concretas, (c) detectar casos raros en su extracto. Empezar en modo asistido (propuestas para el desarrollador), nunca autónomo en producción.

### Otros brokers
> Degiro, Trade Republic, Freedom24, etc. Mantener el modelo interno neutro y añadir parsers específicos por broker. Ver `CONTRIBUTING.md` → "Añadir un broker nuevo".

### Modelo 720 / 721
> Para residentes con >50k € fuera de España. Nicho adyacente pero legalmente más delicado. Evaluar cuando haya tracción.

### Modo asesor / batch
> Procesar varios clientes a la vez, histórico por cliente. Justificaría un backend más serio y posiblemente una app desktop (Tauri reutilizando este frontend).

> **Monetización** — las notas estratégicas (freemium, pricing, backup E2E…) se mantienen aparte en `MONETIZATION.md` (gitignored, no público).
