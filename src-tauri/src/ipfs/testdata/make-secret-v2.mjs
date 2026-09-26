// Фикстура приватного файла формата v2 (crypto.rs, ipfs-secret.ts), собранная
// независимо — node:crypto, а не нашим кодом: оба читателя сверяются с ней.
//   node src-tauri/src/ipfs/testdata/make-secret-v2.mjs
// Ключ — байты 0..31, префикс nonce — 1..7, кусок 1000 байт (формат берёт его
// из заголовка), открытый текст — pattern(2500), как в make-fixtures.sh.
import { createCipheriv } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const key = Buffer.from([...Array(32).keys()])
const prefix = Buffer.from([1, 2, 3, 4, 5, 6, 7])
const chunk = 1000
const plain = Buffer.from(Array.from({ length: 2500 }, (_, i) => (i * 37 + 11) % 256))

const header = Buffer.concat([
  Buffer.from('BSTN'),
  Buffer.from([2]),
  Buffer.from([0, 0, chunk >> 8, chunk & 0xff]),
  prefix,
])
const parts = [header]
const count = Math.max(1, Math.ceil(plain.length / chunk))
for (let i = 0; i < count; i++) {
  const nonce = Buffer.concat([prefix, Buffer.from([0, 0, 0, i]), Buffer.from([i === count - 1 ? 1 : 0])])
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(header)
  parts.push(cipher.update(plain.subarray(i * chunk, (i + 1) * chunk)), cipher.final(), cipher.getAuthTag())
}
writeFileSync(new URL('./secret-v2.bin', import.meta.url), Buffer.concat(parts))
console.log('key', key.toString('base64'))
