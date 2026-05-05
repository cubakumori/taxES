/**
 * Operaciones de sesión persistida. Cada sesión se identifica por
 * `${taxYear}-${accountId}` y contiene los dos documentos parseados.
 */

import { dbDelete, dbGet, dbGetAll, dbPut, STORES } from './db'
import type { IbkrFileType, StatementDocument } from '@lib/parser'

export interface StoredSession {
  /** `${taxYear}-${accountId}` */
  id: string
  /** Etiqueta humana, ej. "Renta 2025 · U…420". */
  label: string
  taxYear: number
  accountId: string
  dividendDoc: StatementDocument | null
  activityDoc: StatementDocument | null
  fileName: string | null
  lastFileType: IbkrFileType | null
  createdAt: string
  updatedAt: string
}

const ACTIVE_SESSION_KEY = 'activeSessionId'

export function makeSessionId(taxYear: number, accountId: string): string {
  return `${taxYear}-${accountId}`
}

export function makeSessionLabel(
  taxYear: number,
  accountId: string,
): string {
  return `Renta ${taxYear} · ${accountId}`
}

export async function saveSession(s: StoredSession): Promise<void> {
  await dbPut(STORES.sessions, s)
}

export function loadSession(id: string): Promise<StoredSession | null> {
  return dbGet<StoredSession>(STORES.sessions, id)
}

export async function listSessions(): Promise<StoredSession[]> {
  const all = await dbGetAll<StoredSession>(STORES.sessions)
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function deleteSession(id: string): Promise<void> {
  return dbDelete(STORES.sessions, id)
}

export function getActiveSessionId(): Promise<string | null> {
  return dbGet<string>(STORES.meta, ACTIVE_SESSION_KEY)
}

export async function setActiveSessionId(
  id: string | null,
): Promise<void> {
  if (id === null) {
    await dbDelete(STORES.meta, ACTIVE_SESSION_KEY)
  } else {
    await dbPut(STORES.meta, id, ACTIVE_SESSION_KEY)
  }
}

/**
 * Migra la sesión guardada en localStorage (esquema v2) a IndexedDB.
 * Devuelve el número de sesiones migradas (0 ó 1). Borra la entrada de
 * localStorage tras la migración.
 */
export async function migrateFromLocalStorage(): Promise<number> {
  if (typeof window === 'undefined') return 0
  const KEY = 'taxes-session-v2'
  const raw = localStorage.getItem(KEY)
  if (!raw) return 0

  try {
    const data = JSON.parse(raw) as {
      v: number
      dividendDoc: StatementDocument | null
      activityDoc: StatementDocument | null
      fileName: string | null
      lastFileType: IbkrFileType | null
    }
    if (data.v !== 2) return 0
    const doc = data.dividendDoc ?? data.activityDoc
    if (!doc) return 0

    const taxYear = doc.taxYear ?? new Date().getFullYear()
    const accountId = doc.accountInfo?.accountId ?? 'unknown'
    const id = makeSessionId(taxYear, accountId)
    const now = new Date().toISOString()

    await saveSession({
      id,
      label: makeSessionLabel(taxYear, accountId),
      taxYear,
      accountId,
      dividendDoc: data.dividendDoc,
      activityDoc: data.activityDoc,
      fileName: data.fileName,
      lastFileType: data.lastFileType,
      createdAt: now,
      updatedAt: now,
    })
    await setActiveSessionId(id)
    localStorage.removeItem(KEY)
    return 1
  } catch {
    return 0
  }
}
