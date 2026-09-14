/**
 * Типы для `miscreant` (AES-SIV в DM мессенджера).
 *
 * Пакет объявляет `types: src/index.ts` — TypeScript компилировал бы его
 * исходники под нашим strict-профилем и давал 69 ошибок в node_modules
 * (`skipLibCheck` на `.ts` не действует). `paths` в tsconfig направляет
 * `miscreant` сюда; описано только то, что использует pcrypto.ts.
 * Рантайм-импорт не меняется: Vite резолвит пакет из node_modules.
 */
declare module 'miscreant' {
  export interface ICryptoProvider {
    importBlockCipherKey(keyData: Uint8Array): Promise<unknown>
    importCTRKey(keyData: Uint8Array): Promise<unknown>
  }

  export class WebCryptoProvider implements ICryptoProvider {
    constructor(crypto?: Crypto)
    importBlockCipherKey(keyData: Uint8Array): Promise<unknown>
    importCTRKey(keyData: Uint8Array): Promise<unknown>
  }

  export class PolyfillCryptoProvider implements ICryptoProvider {
    constructor()
    importBlockCipherKey(keyData: Uint8Array): Promise<unknown>
    importCTRKey(keyData: Uint8Array): Promise<unknown>
  }

  export class IntegrityError extends Error {}
  export class NotImplementedError extends Error {}

  /** AES-SIV (RFC 5297): ключ 32 или 64 байта, associatedData — список векторов. */
  export class SIV {
    static importKey(keyData: Uint8Array, alg: string, provider?: ICryptoProvider): Promise<SIV>
    seal(plaintext: Uint8Array, associatedData: Uint8Array[]): Promise<Uint8Array>
    open(sealed: Uint8Array, associatedData: Uint8Array[]): Promise<Uint8Array>
    clear(): this
  }
}
