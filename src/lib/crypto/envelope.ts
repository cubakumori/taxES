/**
 * Envoltorio cifrado para exportar sesiones de forma portable.
 *
 * Objetivo: el usuario puede guardar el archivo donde quiera (Drive, iCloud,
 * Proton Drive, USB). Aunque la ubicación se comprometa, sin la passphrase
 * nadie puede leer el contenido.
 *
 * Criptografía:
 * - **AES-GCM-256** (authenticated encryption: integridad + confidencialidad)
 * - **PBKDF2** con SHA-256 y 600 000 iteraciones (recomendación OWASP 2023)
 * - Salt aleatorio 16 bytes, IV aleatorio 12 bytes (tamaño óptimo para GCM)
 * - Implementación 100 % con Web Crypto API: sin dependencias, disponible en
 *   todos los navegadores modernos y en Node 20+
 *
 * Amenaza contemplada: atacante con acceso al ciphertext (Drive comprometido,
 * USB perdido). Fuera de alcance: keylogger local, extensión maliciosa en el
 * navegador. Es una herramienta de defensa en profundidad, no una bóveda.
 */

export const PBKDF2_ITERATIONS = 600_000
/**
 * Mínimo aceptado al descifrar un envelope. Bloquea backups generados con
 * iteraciones de test (`encryptJsonToEnvelope(..., 1000)` por ejemplo) que
 * abrirían la puerta a fuerza bruta offline si el archivo cae en malas manos.
 */
export const PBKDF2_MIN_ITERATIONS_ON_IMPORT = 100_000
/** Longitud mínima recomendada para la passphrase. */
export const MIN_PASSPHRASE_LENGTH = 12
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_LENGTH_BITS = 256

export interface EncryptedEnvelope {
  app: 'taxES'
  v: 1
  kind: 'encrypted-session'
  algo: 'AES-GCM-256'
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    /** Base64 de los bytes de salt (16 bytes). */
    salt: string
  }
  /** Base64 del IV (12 bytes). */
  iv: string
  /** Base64 del ciphertext (incluye el tag GCM al final). */
  ciphertext: string
  createdAt: string
}

/** Se lanza cuando el ciphertext no descifra — passphrase incorrecta o datos corruptos. */
export class WrongPassphraseError extends Error {
  constructor() {
    super(
      'No se pudo descifrar el backup. Revisa la passphrase o comprueba que el archivo no esté corrupto.',
    )
    this.name = 'WrongPassphraseError'
  }
}

/** Se lanza al importar un envelope con parámetros KDF demasiado débiles. */
export class WeakEnvelopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WeakEnvelopeError'
  }
}

// ---------------------------------------------------------------------------
// Helpers base64 <-> ArrayBuffer (sin deps; funciona en navegador y Node 20+)
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/**
 * Decodifica base64 a un `Uint8Array` con buffer garantizado `ArrayBuffer`
 * (no `SharedArrayBuffer`). TypeScript 5 distingue ambos y Web Crypto solo
 * acepta el primero; construimos el buffer explícitamente para evitar el
 * incidente `Uint8Array<ArrayBufferLike>` / `BufferSource`.
 */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ---------------------------------------------------------------------------
// Derivación de clave
// ---------------------------------------------------------------------------

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const passBytes = new TextEncoder().encode(passphrase)
  const passBuf = new ArrayBuffer(passBytes.byteLength)
  new Uint8Array(passBuf).set(passBytes)
  const material = await crypto.subtle.importKey(
    'raw',
    passBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const saltBuf = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuf).set(salt)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Construye el AAD (Additional Authenticated Data) que GCM autentica junto al
 * ciphertext. Cubrimos los parámetros KDF y el IV en una representación
 * canónica para que cualquier manipulación del envelope (rebajar iteraciones,
 * cambiar salt) cause un fallo de descifrado.
 */
function buildAad(
  iterations: number,
  saltBase64: string,
  ivBase64: string,
): Uint8Array<ArrayBuffer> {
  const aad = `taxES/v1|kdf=PBKDF2|hash=SHA-256|iter=${iterations}|salt=${saltBase64}|iv=${ivBase64}`
  const bytes = new TextEncoder().encode(aad)
  const buf = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buf).set(bytes)
  return new Uint8Array(buf)
}

/**
 * Cifra un string de plaintext y devuelve un envelope JSON-serializable.
 * `iterations` se expone solo para tests; en producción usa el default.
 */
export async function encryptJsonToEnvelope(
  plaintext: string,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedEnvelope> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `La passphrase debe tener al menos ${MIN_PASSPHRASE_LENGTH} caracteres.`,
    )
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt, iterations)

  const saltB64 = bytesToBase64(salt)
  const ivB64 = bytesToBase64(iv)
  const aad = buildAad(iterations, saltB64, ivB64)

  const plaintextBytes = new TextEncoder().encode(plaintext)
  const plaintextBuf = new ArrayBuffer(plaintextBytes.byteLength)
  new Uint8Array(plaintextBuf).set(plaintextBytes)
  const ivBuf = new ArrayBuffer(iv.byteLength)
  new Uint8Array(ivBuf).set(iv)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuf, additionalData: aad.buffer },
      key,
      plaintextBuf,
    ),
  )

  return {
    app: 'taxES',
    v: 1,
    kind: 'encrypted-session',
    algo: 'AES-GCM-256',
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: saltB64,
    },
    iv: ivB64,
    ciphertext: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString(),
  }
}

/**
 * Descifra un envelope. Lanza `WeakEnvelopeError` si los parámetros KDF están
 * por debajo del mínimo aceptable, o `WrongPassphraseError` si el descifrado
 * falla (passphrase incorrecta, ciphertext o AAD manipulado).
 */
export async function decryptEnvelope(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<string> {
  if (envelope.kdf.iterations < PBKDF2_MIN_ITERATIONS_ON_IMPORT) {
    throw new WeakEnvelopeError(
      `Backup con iteraciones PBKDF2 demasiado bajas (${envelope.kdf.iterations}). Mínimo aceptado: ${PBKDF2_MIN_ITERATIONS_ON_IMPORT}.`,
    )
  }
  const salt = base64ToBytes(envelope.kdf.salt)
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations)
  const aad = buildAad(envelope.kdf.iterations, envelope.kdf.salt, envelope.iv)

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer, additionalData: aad.buffer },
      key,
      ciphertext.buffer,
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new WrongPassphraseError()
  }
}

/** Discriminador: detecta si un JSON parseado es un envelope cifrado v1. */
export function isEncryptedEnvelope(data: unknown): data is EncryptedEnvelope {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.app === 'taxES' &&
    d.v === 1 &&
    d.kind === 'encrypted-session' &&
    d.algo === 'AES-GCM-256' &&
    typeof d.iv === 'string' &&
    typeof d.ciphertext === 'string' &&
    typeof d.kdf === 'object' &&
    d.kdf !== null
  )
}
