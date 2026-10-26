// Сохранить файл на устройство тем же путём, что и файлы IPFS
// (helpers/ipfs/ipfs-save-sinks): на компьютере — системный диалог
// «Сохранить», на телефоне — «Поделиться», в браузере — диалог сохранения
// или обычная загрузка. `<a download>` в приложении для компьютера не годится:
// WKWebView и WebKitGTK без обработчика загрузок молча её отменяют.

import { openSaveSink } from '@/helpers/ipfs/ipfs-save-sinks'

export type SaveResult = 'saved' | 'cancelled' | 'failed'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
}

/** Сколько байт за раз уходит в запись. */
const CHUNK_BYTES = 1024 * 1024

/**
 * Имя из недоверенной строки (имя вложения от собеседника, адрес): без пути,
 * управляющих и запрещённых в именах файлов символов. Нет расширения — по типу.
 */
export function safeFileName(name: string, mime = '', fallback = 'download'): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f:*?"<>|]/g, '')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 150)
  const clean = base || fallback
  const ext = EXTENSIONS[(mime.split(';')[0] ?? '').trim().toLowerCase()]
  return ext && !/\.[a-z0-9]{1,5}$/i.test(clean) ? `${clean}.${ext}` : clean
}

export async function saveBlobToDevice(blob: Blob, name: string): Promise<SaveResult> {
  let sink: Awaited<ReturnType<typeof openSaveSink>>
  try {
    sink = await openSaveSink(safeFileName(name, blob.type))
  } catch {
    return 'failed'
  }
  if (!sink) return 'cancelled'
  try {
    if (blob.size > sink.maxBytes) throw new Error('too big')
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const part = blob.slice(offset, offset + CHUNK_BYTES)
      await sink.write(new Uint8Array(await part.arrayBuffer()))
    }
    await sink.close()
    return 'saved'
  } catch {
    await sink.abort()
    return 'failed'
  }
}
