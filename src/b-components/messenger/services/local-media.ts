/**
 * Медиа, которое уже лежит в памяти (вложения mesh-сетей): ссылка `blob:` для
 * `<img>`/`<audio>` и сам Blob. Голосовому плееру Blob нужен целиком (волна),
 * а fetch ссылки `blob:` CSP не пускает (connect-src), — он берёт его отсюда.
 */

const blobs = new Map<string, Blob>()

/** Ссылка `blob:` на данные; помнится, пока её не отпустят. */
export function registerLocalMedia(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  blobs.set(url, blob)
  return url
}

export function localMediaBlob(url: string): Blob | undefined {
  return blobs.get(url)
}

export function releaseLocalMedia(url: string): void {
  if (!blobs.delete(url)) return
  URL.revokeObjectURL(url)
}
