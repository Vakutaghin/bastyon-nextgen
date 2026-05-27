/**
 * Извлечение метаданных из медиа-файлов перед загрузкой в комнату:
 * - {@link extractImageDimensions} — натуральные размеры (или null если не картинка)
 * - {@link extractVideoMetadata} — duration + размеры + first-frame poster (JPEG blob).
 *   Poster НЕ шифруется — клиенты видят превью до расшифровки самого видео.
 */

/** Натуральные размеры картинки. null если файл не декодируется. */
export function extractImageDimensions(blob: Blob): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      URL.revokeObjectURL(url)
      resolve(w && h ? { w, h } : null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Метаданные видео + первый кадр (poster).
 * `maxThumbDim` — максимальная сторона poster (по умолчанию 768).
 * При ошибках возвращает корректную структуру с нулями / null — не throws.
 */
export function extractVideoMetadata(
  blob: Blob,
  maxThumbDim = 768
): Promise<{ duration: number; w: number; h: number; posterBlob: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    let done = false
    const finalize = (result: {
      duration: number
      w: number
      h: number
      posterBlob: Blob | null
    }) => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      resolve(result)
    }
    video.onerror = () => finalize({ duration: 0, w: 0, h: 0, posterBlob: null })
    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 0
      const w = video.videoWidth || 0
      const h = video.videoHeight || 0
      if (!w || !h) return finalize({ duration, w: 0, h: 0, posterBlob: null })
      // Seek в небольшую позицию, чтобы получить кадр (а не чёрный начальный кадр)
      const seekTo = Math.min(Math.max(0.1, duration * 0.05), 1.5)
      const onSeeked = () => {
        try {
          const scale = Math.min(1, maxThumbDim / Math.max(w, h))
          const tw = Math.max(1, Math.round(w * scale))
          const th = Math.max(1, Math.round(h * scale))
          const canvas = document.createElement('canvas')
          canvas.width = tw
          canvas.height = th
          const ctx = canvas.getContext('2d')
          if (!ctx) return finalize({ duration, w, h, posterBlob: null })
          ctx.drawImage(video, 0, 0, tw, th)
          canvas.toBlob((b) => finalize({ duration, w, h, posterBlob: b }), 'image/jpeg', 0.7)
        } catch {
          finalize({ duration, w, h, posterBlob: null })
        }
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      try {
        video.currentTime = seekTo
      } catch {
        finalize({ duration, w, h, posterBlob: null })
      }
    }
    video.src = url
    try {
      video.load()
    } catch {
      /* ignore */
    }
  })
}
