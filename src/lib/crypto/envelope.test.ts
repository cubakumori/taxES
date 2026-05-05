import { describe, expect, it } from 'vitest'
import {
  decryptEnvelope,
  encryptJsonToEnvelope,
  isEncryptedEnvelope,
  MIN_PASSPHRASE_LENGTH,
  PBKDF2_MIN_ITERATIONS_ON_IMPORT,
  WeakEnvelopeError,
  WrongPassphraseError,
} from './envelope'

// Iteraciones de test = mínimo aceptado en import. Corrección criptográfica no
// depende del número, pero por debajo de este umbral el descifrado falla con
// WeakEnvelopeError (defensa contra backups con KDF rebajada).
const TEST_ITERATIONS = PBKDF2_MIN_ITERATIONS_ON_IMPORT
const PASS = 'correcto caballo batería grapa'
const PASS_ALT = 'otra passphrase larga 1234'

describe('encryptJsonToEnvelope / decryptEnvelope', () => {
  it('round-trip preserva el plaintext exacto', async () => {
    const plaintext = JSON.stringify({ hello: 'world', n: 42, emoji: '🔐' })
    const envelope = await encryptJsonToEnvelope(plaintext, PASS, TEST_ITERATIONS)
    const decrypted = await decryptEnvelope(envelope, PASS)
    expect(decrypted).toBe(plaintext)
  })

  it('genera salt e IV distintos en cada cifrado', async () => {
    const a = await encryptJsonToEnvelope('mismo texto', PASS, TEST_ITERATIONS)
    const b = await encryptJsonToEnvelope('mismo texto', PASS, TEST_ITERATIONS)
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('lanza WrongPassphraseError con passphrase incorrecta', async () => {
    const envelope = await encryptJsonToEnvelope('secreto', PASS, TEST_ITERATIONS)
    await expect(decryptEnvelope(envelope, PASS_ALT)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    )
  })

  it('lanza WrongPassphraseError si el ciphertext está tampered', async () => {
    const envelope = await encryptJsonToEnvelope('secreto', PASS, TEST_ITERATIONS)
    // Flip el último byte del ciphertext (base64 → bytes → flip → base64).
    const bytes = Uint8Array.from(atob(envelope.ciphertext), (c) => c.charCodeAt(0))
    bytes[bytes.length - 1] ^= 0x01
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    const tampered = { ...envelope, ciphertext: btoa(bin) }
    await expect(decryptEnvelope(tampered, PASS)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    )
  })

  it('lanza WrongPassphraseError si las iteraciones del envelope se manipulan', async () => {
    // AAD incluye iterations: cambiarlas (manteniéndolas ≥ mínimo) debe romper GCM.
    const envelope = await encryptJsonToEnvelope('secreto', PASS, TEST_ITERATIONS + 50_000)
    const tampered = {
      ...envelope,
      kdf: { ...envelope.kdf, iterations: TEST_ITERATIONS },
    }
    await expect(decryptEnvelope(tampered, PASS)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    )
  })

  it('lanza WeakEnvelopeError si el envelope viene con iteraciones por debajo del mínimo', async () => {
    const envelope = await encryptJsonToEnvelope('secreto', PASS, TEST_ITERATIONS)
    const weak = {
      ...envelope,
      kdf: { ...envelope.kdf, iterations: 1000 },
    }
    await expect(decryptEnvelope(weak, PASS)).rejects.toBeInstanceOf(
      WeakEnvelopeError,
    )
  })

  it(`rechaza passphrase con menos de ${MIN_PASSPHRASE_LENGTH} caracteres`, async () => {
    await expect(
      encryptJsonToEnvelope('x', 'corta', TEST_ITERATIONS),
    ).rejects.toThrow(/al menos/)
  })
})

describe('isEncryptedEnvelope', () => {
  it('reconoce un envelope válido', async () => {
    const envelope = await encryptJsonToEnvelope('x', PASS, TEST_ITERATIONS)
    expect(isEncryptedEnvelope(envelope)).toBe(true)
  })

  it('rechaza un JSON de sesión en claro', () => {
    expect(
      isEncryptedEnvelope({ app: 'taxES', v: 1, dividendDoc: null }),
    ).toBe(false)
  })

  it('rechaza basura', () => {
    expect(isEncryptedEnvelope(null)).toBe(false)
    expect(isEncryptedEnvelope('string')).toBe(false)
    expect(isEncryptedEnvelope({})).toBe(false)
  })
})
