/**
 * Вложения для LXMF: картинка уменьшается до 1024 px по длинной стороне и
 * пересжимается в JPEG — по радио каждый килобайт идёт секунды, а JPEG
 * понимают Sideband и MeshChat. Файлы уходят как есть.
 */

import type { MeshAttachment } from '@/db/types'

const MAX_SIDE = 1024
const QUALITY = 0.75

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Картинка поменьше; не удалось декодировать — отправляется исходник. */
export async function shrinkImage(file: File): Promise<MeshAttachment> {
  const base = file.name.replace(/\.[^.]*$/, '') || 'image'
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    )
    if (!blob) throw new Error('no jpeg')
    // Уменьшенная вышла больше исходника (маленький PNG) — исходник.
    if (blob.size < file.size || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return { kind: 'image', name: `${base}.jpg`, mime: 'image/jpeg', data: await bytesOf(blob) }
    }
  } catch {
    /* не картинка для браузера — уйдёт исходником */
  }
  return {
    kind: /^image\/(jpeg|png|webp|gif)$/.test(file.type) ? 'image' : 'file',
    name: file.name || base,
    mime: file.type || 'application/octet-stream',
    data: await bytesOf(file),
  }
}

/** Выбранные пользователем файлы → вложения LXMF. */
export async function meshAttachments(files: File[]): Promise<MeshAttachment[]> {
  return Promise.all(
    files.map(async (f) =>
      f.type.startsWith('image/')
        ? shrinkImage(f)
        : {
            kind: 'file' as const,
            name: f.name || 'file',
            mime: f.type || 'application/octet-stream',
            data: await bytesOf(f),
          }
    )
  )
}
