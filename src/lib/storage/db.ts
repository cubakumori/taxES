/**
 * Wrapper minimalista sobre IndexedDB con promises.
 * Solo se crean dos object stores: `sessions` y `meta`.
 */

const DB_NAME = 'taxes-db'
const DB_VERSION = 1

export const STORES = {
  sessions: 'sessions',
  meta: 'meta',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este entorno'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function dbPut<T>(
  storeName: string,
  value: T,
  key?: IDBValidKey,
): Promise<IDBValidKey> {
  return runTransaction(storeName, 'readwrite', (s) =>
    key !== undefined ? s.put(value, key) : s.put(value),
  )
}

export async function dbGet<T>(
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  const res = await runTransaction<T | undefined>(storeName, 'readonly', (s) =>
    s.get(key),
  )
  return res ?? null
}

export function dbGetAll<T>(storeName: string): Promise<T[]> {
  return runTransaction<T[]>(storeName, 'readonly', (s) => s.getAll())
}

export async function dbDelete(
  storeName: string,
  key: IDBValidKey,
): Promise<void> {
  await runTransaction(storeName, 'readwrite', (s) => s.delete(key))
}
