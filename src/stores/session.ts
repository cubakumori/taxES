/**
 * Estado de la sesión y persistencia multi-sesión vía IndexedDB.
 *
 * Cada sesión se identifica por `(taxYear, accountId)`. Cargar un nuevo
 * archivo que cambie esa clave crea automáticamente una nueva sesión; cargar
 * uno que la mantenga actualiza la existente. El usuario puede conmutar entre
 * sesiones guardadas desde la UI sin reuploadear los CSV.
 *
 * Export/import de sesiones completas como JSON (incluye ambos docs).
 */

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { z } from 'zod'
import {
  detectIbkrFileType,
  type IbkrFileType,
  type MergedStatementDocument,
  mergeIbkrStatements,
  parseIbkrActivityStatement,
  parseIbkrDividendReport,
  type StatementDocument,
} from '@lib/parser'
import {
  decryptEnvelope,
  encryptJsonToEnvelope,
  isEncryptedEnvelope,
  WeakEnvelopeError,
  WrongPassphraseError,
} from '@lib/crypto/envelope'
import {
  buildDividendsDetailCsv,
  buildPlusvaliasCsv,
  buildSummaryByCountryCsv,
} from '@lib/export/session-csv'
import { applyRulesIrpf2025, type IrpfSummary } from '@lib/rules'
import {
  deleteSession as dbDeleteSession,
  getActiveSessionId,
  listSessions as dbListSessions,
  loadSession as dbLoadSession,
  makeSessionId,
  makeSessionLabel,
  migrateFromLocalStorage,
  saveSession as dbSaveSession,
  setActiveSessionId,
  type StoredSession,
} from '@lib/storage/sessions'

const MAX_BYTES = 20 * 1024 * 1024

export type SessionStatus =
  | 'loading'
  | 'idle'
  | 'processing'
  | 'ready'
  | 'error'

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('loading')
  const dividendDoc = ref<StatementDocument | null>(null)
  const activityDoc = ref<StatementDocument | null>(null)
  const fileName = ref<string | null>(null)
  const lastFileType = ref<IbkrFileType | null>(null)
  const errorMessage = ref<string | null>(null)

  const savedSessions = ref<StoredSession[]>([])
  const activeSessionId = ref<string | null>(null)

  const mergedDoc = computed<MergedStatementDocument | null>(() =>
    mergeIbkrStatements(dividendDoc.value, activityDoc.value),
  )

  const hasAnyData = computed(
    () => dividendDoc.value !== null || activityDoc.value !== null,
  )

  const currentTaxYear = computed<number | null>(
    () => dividendDoc.value?.taxYear ?? activityDoc.value?.taxYear ?? null,
  )

  const currentAccountId = computed<string | null>(
    () =>
      dividendDoc.value?.accountInfo.accountId ??
      activityDoc.value?.accountInfo.accountId ??
      null,
  )

  /**
   * Documentos de años ANTERIORES para la misma cuenta IBKR. Solo aportan
   * base de coste al motor FIFO; no generan eventos tributables en el
   * ejercicio declarable. Se extraen de `savedSessions` — ya en memoria —
   * sin round-trip adicional a IndexedDB.
   */
  const priorDocsForFifo = computed<StatementDocument[]>(() => {
    const currentYear = currentTaxYear.value
    const currentAcc = currentAccountId.value
    if (currentYear === null || currentAcc === null) return []
    const priors: StatementDocument[] = []
    for (const s of savedSessions.value) {
      if (s.accountId !== currentAcc) continue
      if (s.taxYear >= currentYear) continue
      const merged = mergeIbkrStatements(s.dividendDoc, s.activityDoc)
      if (merged) priors.push(merged)
    }
    return priors
  })

  const summary = computed<IrpfSummary | null>(() => {
    const d = mergedDoc.value
    if (!d) return null
    // Solo producir un resumen IRPF si hay contenido tributable. Las compras
    // sueltas sin ventas ni dividendos no generan casilla alguna — caeríamos
    // en un resumen todo-ceros que confunde al usuario. En ese caso devolvemos
    // null y Home.vue muestra el estado parcial (upload + slots con check).
    const hasDividends = d.events.some((e) => e.kind === 'dividend')
    const hasSells = d.events.some(
      (e) => e.kind === 'trade' && e.side === 'sell',
    )
    if (!hasDividends && !hasSells) return null
    return applyRulesIrpf2025(d, { priorDocs: priorDocsForFifo.value })
  })

  // -----------------------------------------------------------------------
  // Inicialización: migración de localStorage → IDB y carga de sesión activa
  // -----------------------------------------------------------------------

  async function init(): Promise<void> {
    status.value = 'loading'
    try {
      await migrateFromLocalStorage()
      await refreshSessions()
      const activeId = await getActiveSessionId()
      if (activeId) {
        const s = await dbLoadSession(activeId)
        if (s) applyStoredSession(s)
      }
      status.value = hasAnyData.value ? 'ready' : 'idle'
    } catch (err) {
      console.error('Error al inicializar la sesión:', err)
      status.value = 'idle'
    }
  }

  async function refreshSessions(): Promise<void> {
    try {
      savedSessions.value = await dbListSessions()
    } catch {
      savedSessions.value = []
    }
  }

  function applyStoredSession(s: StoredSession): void {
    dividendDoc.value = s.dividendDoc
    activityDoc.value = s.activityDoc
    fileName.value = s.fileName
    lastFileType.value = s.lastFileType
    activeSessionId.value = s.id
  }

  // -----------------------------------------------------------------------
  // Auto-save
  // -----------------------------------------------------------------------

  async function persistCurrent(): Promise<void> {
    if (!hasAnyData.value) return
    const year = currentTaxYear.value
    const accountId = currentAccountId.value
    if (year === null || accountId === null) return

    const id = makeSessionId(year, accountId)
    const now = new Date().toISOString()
    const existing = savedSessions.value.find((s) => s.id === id)

    const session: StoredSession = {
      id,
      label: makeSessionLabel(year, accountId),
      taxYear: year,
      accountId,
      dividendDoc: dividendDoc.value,
      activityDoc: activityDoc.value,
      fileName: fileName.value,
      lastFileType: lastFileType.value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    // Actualización optimista: refresca el estado en memoria antes de la
    // escritura asíncrona a IndexedDB. Así el dropdown muestra la sesión y
    // el punto verde de inmediato, sin esperar al round-trip con IDB.
    const next = [...savedSessions.value]
    const idx = next.findIndex((s) => s.id === id)
    if (idx >= 0) next[idx] = session
    else next.push(session)
    savedSessions.value = next.sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
    activeSessionId.value = id

    // Persistencia en IDB en segundo plano.
    try {
      await dbSaveSession(session)
      await setActiveSessionId(id)
    } catch (err) {
      console.error('No se pudo guardar la sesión en IndexedDB:', err)
    }
  }

  // No usamos `{ deep: true }`: los documentos se re-asignan enteros tras
  // cada parseo y al cambiar de sesión; nunca se mutan in-place. El watch por
  // identidad basta y evita rastrear miles de eventos como dependencias
  // reactivas.
  watch([dividendDoc, activityDoc], () => {
    void persistCurrent()
  })

  // -----------------------------------------------------------------------
  // Carga de archivo
  // -----------------------------------------------------------------------

  async function loadFile(file: File): Promise<void> {
    status.value = 'processing'
    fileName.value = file.name
    errorMessage.value = null

    try {
      if (file.size > MAX_BYTES) {
        throw new Error(
          `El archivo supera el tamaño máximo (${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB).`,
        )
      }
      await new Promise((r) => setTimeout(r, 0))
      const text = await file.text()
      const type = detectIbkrFileType(text)
      lastFileType.value = type

      if (type === 'unknown') {
        throw new Error(
          'No se reconoce el archivo como un informe de Interactive Brokers. Se esperaba un "DividendReport.csv" (empieza por "Account,…") o un "Informe de Actividad.csv" (empieza por "Statement,…").',
        )
      }

      if (type === 'dividend-report') {
        dividendDoc.value = parseIbkrDividendReport(text)
      } else {
        activityDoc.value = parseIbkrActivityStatement(text)
      }

      // Nos quedamos en la vista de upload tras un parseo correcto para que el
      // usuario vea el slot marcado con ✓ y pueda añadir más archivos antes de
      // pasar al resumen. La navegación al resumen la controla `showSummary()`
      // (botón «Ver resumen IRPF» de UploadZone).
      status.value = 'idle'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      status.value = 'error'
    }
  }

  // -----------------------------------------------------------------------
  // Operaciones sobre sesiones guardadas
  // -----------------------------------------------------------------------

  async function switchSession(id: string): Promise<void> {
    const s = await dbLoadSession(id)
    if (!s) return
    applyStoredSession(s)
    await setActiveSessionId(id)
    status.value = hasAnyData.value ? 'ready' : 'idle'
  }

  /** Limpia la sesión en memoria (sin borrar de IDB). */
  async function newSession(): Promise<void> {
    dividendDoc.value = null
    activityDoc.value = null
    fileName.value = null
    lastFileType.value = null
    errorMessage.value = null
    activeSessionId.value = null
    await setActiveSessionId(null)
    status.value = 'idle'
  }

  async function deleteSession(id: string): Promise<void> {
    await dbDeleteSession(id)
    if (activeSessionId.value === id) {
      await newSession()
    }
    await refreshSessions()
  }

  function reset(): void {
    void newSession()
  }

  function backToUpload(): void {
    status.value = 'idle'
    errorMessage.value = null
  }

  /** Vuelve a la vista de resumen si hay datos cargados y tiene contenido útil. */
  function showSummary(): void {
    if (!hasAnyData.value) return
    status.value = 'ready'
    errorMessage.value = null
  }

  // -----------------------------------------------------------------------
  // Import / Export JSON de sesión completa
  // -----------------------------------------------------------------------

  interface SessionExportPayload {
    app: 'taxES'
    v: 1
    exportedAt: string
    dividendDoc: StatementDocument | null
    activityDoc: StatementDocument | null
    fileName: string | null
    lastFileType: IbkrFileType | null
  }

  // Schema laxo: validamos la forma mínima necesaria para evitar que un JSON
  // bien formado pero con estructura distinta haga crashear la UI. Los
  // sub-docs se tratan como `unknown` a nivel zod y se confían al resto del
  // flujo (merger + motor de reglas), que ya los consume defensivamente.
  const statementDocSchema = z
    .object({
      accountInfo: z.object({
        accountId: z.string().optional(),
        baseCurrency: z.string(),
        periodFrom: z.string(),
        periodTo: z.string(),
        broker: z.literal('IBKR'),
      }),
      taxYear: z.number().int(),
      events: z.array(z.unknown()),
      warnings: z.array(z.unknown()),
      parsedAt: z.string(),
      parserVersion: z.string(),
    })
    .passthrough()

  const sessionExportSchema = z.object({
    app: z.literal('taxES'),
    v: z.literal(1),
    exportedAt: z.string(),
    dividendDoc: statementDocSchema.nullable(),
    activityDoc: statementDocSchema.nullable(),
    fileName: z.string().nullable(),
    lastFileType: z.enum(['dividend-report', 'activity-statement', 'unknown'])
      .nullable(),
  })

  function exportSummaryCsv(): string | null {
    if (!summary.value) return null
    return buildSummaryByCountryCsv(summary.value)
  }

  function exportDividendsCsv(): string | null {
    const d = mergedDoc.value
    if (!d) return null
    return buildDividendsDetailCsv(d)
  }

  function exportPlusvaliasCsv(): string | null {
    const p = summary.value?.plusvalias
    if (!p) return null
    return buildPlusvaliasCsv(p)
  }

  function exportSessionJson(): string {
    const payload: SessionExportPayload = {
      app: 'taxES',
      v: 1,
      exportedAt: new Date().toISOString(),
      dividendDoc: dividendDoc.value,
      activityDoc: activityDoc.value,
      fileName: fileName.value,
      lastFileType: lastFileType.value,
    }
    return JSON.stringify(payload, null, 2)
  }

  async function importSessionJson(text: string): Promise<void> {
    status.value = 'processing'
    errorMessage.value = null
    try {
      const raw: unknown = JSON.parse(text)
      const result = sessionExportSchema.safeParse(raw)
      if (!result.success) {
        throw new Error(
          'Formato de sesión no reconocido. Se esperaba un export JSON generado por taxES v1 con los campos app/v/dividendDoc/activityDoc.',
        )
      }
      const data = result.data
      dividendDoc.value = (data.dividendDoc as StatementDocument | null) ?? null
      activityDoc.value = (data.activityDoc as StatementDocument | null) ?? null
      fileName.value = data.fileName
      lastFileType.value = data.lastFileType
      status.value = hasAnyData.value ? 'ready' : 'idle'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      status.value = 'error'
    }
  }

  /**
   * Detecta si un texto JSON representa un export plano (`plain`), un envelope
   * cifrado (`encrypted`) o no es un export reconocible (`invalid`). Permite a
   * la UI decidir si pedir passphrase antes de importar.
   */
  function detectImportKind(text: string): 'plain' | 'encrypted' | 'invalid' {
    try {
      const raw: unknown = JSON.parse(text)
      if (isEncryptedEnvelope(raw)) return 'encrypted'
      if (sessionExportSchema.safeParse(raw).success) return 'plain'
      return 'invalid'
    } catch {
      return 'invalid'
    }
  }

  /** Cifra la sesión actual con una passphrase y devuelve el envelope JSON. */
  async function exportSessionEncrypted(passphrase: string): Promise<string> {
    const plaintext = exportSessionJson()
    const envelope = await encryptJsonToEnvelope(plaintext, passphrase)
    return JSON.stringify(envelope, null, 2)
  }

  /** Descifra un envelope y aplica la sesión. Lanza en caso de passphrase mala. */
  async function importSessionEncrypted(
    text: string,
    passphrase: string,
  ): Promise<void> {
    status.value = 'processing'
    errorMessage.value = null
    try {
      const raw: unknown = JSON.parse(text)
      if (!isEncryptedEnvelope(raw)) {
        throw new Error('El archivo no es un backup cifrado de taxES v1.')
      }
      const plaintext = await decryptEnvelope(raw, passphrase)
      await importSessionJson(plaintext)
      // importSessionJson deja errorMessage poblado si el plaintext no es una
      // sesión válida; en ese caso re-lanzamos para que la UI pueda reintentar.
      if (errorMessage.value) {
        throw new Error(errorMessage.value)
      }
    } catch (err) {
      const msg =
        err instanceof WrongPassphraseError || err instanceof WeakEnvelopeError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      errorMessage.value = msg
      status.value = 'error'
      // Re-lanzamos para que la UI pueda distinguir passphrase mala y reintentar.
      throw err
    }
  }

  return {
    status,
    dividendDoc,
    activityDoc,
    mergedDoc,
    summary,
    fileName,
    lastFileType,
    errorMessage,
    hasAnyData,
    savedSessions,
    activeSessionId,
    currentTaxYear,
    currentAccountId,
    init,
    loadFile,
    reset,
    backToUpload,
    showSummary,
    switchSession,
    newSession,
    deleteSession,
    refreshSessions,
    exportSessionJson,
    exportSessionEncrypted,
    exportSummaryCsv,
    exportDividendsCsv,
    exportPlusvaliasCsv,
    importSessionJson,
    importSessionEncrypted,
    detectImportKind,
  }
})
