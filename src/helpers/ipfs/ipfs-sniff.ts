// Тип IPFS-файла без отдельного запроса к шлюзу: по расширению имени, а без
// него — по первым байтам, как делает сам шлюз (Go http.DetectContentType).
// Нужен только для решения «показать или скачать» (classify в ipfs-content.ts),
// поэтому различаем семейства, а не точные подтипы.

const BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  txt: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  pdf: 'application/pdf',
  // Частые «скачиваемые»: по ним решение принимается без запроса к шлюзу.
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  tar: 'application/x-tar',
  exe: 'application/vnd.microsoft.portable-executable',
  msi: 'application/x-msi',
  dmg: 'application/x-apple-diskimage',
  apk: 'application/vnd.android.package-archive',
  deb: 'application/vnd.debian.binary-package',
  iso: 'application/x-iso9660-image',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  epub: 'application/epub+zip',
}

/** Расширение для файла без имени (ссылка на голый CID) — по угаданному типу. */
const EXTENSION_FOR: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'text/plain': 'txt',
  'text/html': 'html',
}

/** MIME по расширению имени; null — расширения нет или оно незнакомо. */
export function typeFromName(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null
}

function startsWith(head: Uint8Array, signature: string | number[], offset = 0): boolean {
  const bytes =
    typeof signature === 'string' ? Array.from(signature, (c) => c.charCodeAt(0)) : signature
  return bytes.every((b, i) => head[offset + i] === b)
}

/**
 * «Двоичный» байт по WHATWG MIME Sniffing: управляющие символы, кроме
 * табуляции, переводов строки, form feed и ESC.
 */
function isBinaryByte(b: number): boolean {
  return b <= 0x08 || b === 0x0b || (b >= 0x0e && b <= 0x1a) || (b >= 0x1c && b <= 0x1f)
}

/** Бренд контейнера ISO BMFF (`ftyp`): картинка, звук или видео. */
function isoBrandType(head: Uint8Array): string {
  const brand = String.fromCharCode(...head.subarray(8, 12))
  if (brand === 'avif' || brand === 'avis') return 'image/avif'
  if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
  if (brand === 'M4A ') return 'audio/mp4'
  if (brand === 'qt  ') return 'video/quicktime'
  return 'video/mp4'
}

/** Ogg — контейнер: тип зависит от кодека в первой странице. */
function oggType(head: Uint8Array): string {
  const page = String.fromCharCode(...head.subarray(0, 64))
  if (page.includes('vorbis') || page.includes('OpusHead')) return 'audio/ogg'
  if (page.includes('theora')) return 'video/ogg'
  return 'application/ogg'
}

/**
 * MIME по первым байтам файла: только надёжные сигнатуры. Слабые (кадр
 * MPEG-аудио без ID3) не угадываем — такой файл скачается с проверкой.
 */
export function typeFromBytes(head: Uint8Array): string {
  if (startsWith(head, '%PDF-')) return 'application/pdf'
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(head, 'GIF87a') || startsWith(head, 'GIF89a')) return 'image/gif'
  if (startsWith(head, 'RIFF') && startsWith(head, 'WEBP', 8)) return 'image/webp'
  if (startsWith(head, 'RIFF') && startsWith(head, 'WAVE', 8)) return 'audio/wav'
  if (startsWith(head, 'BM')) return 'image/bmp'
  if (startsWith(head, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon'
  if (startsWith(head, 'ftyp', 4)) return isoBrandType(head)
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  if (startsWith(head, 'OggS')) return oggType(head)
  if (startsWith(head, 'fLaC')) return 'audio/flac'
  if (startsWith(head, 'ID3')) return 'audio/mpeg'
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip'
  if (startsWith(head, [0x1f, 0x8b])) return 'application/gzip'
  if (head.some(isBinaryByte)) return 'application/octet-stream'
  const text = new TextDecoder().decode(head.subarray(0, 512)).trimStart().toLowerCase()
  return /^<(!doctype html|html|head|body)[\s>]/.test(text) ? 'text/html' : 'text/plain'
}

/** Тип файла: имя важнее содержимого — так же решает шлюз. */
export function guessContentType(name: string, head: Uint8Array): string {
  return typeFromName(name) ?? typeFromBytes(head)
}

export function extensionFor(type: string): string | null {
  return EXTENSION_FOR[type] ?? null
}
