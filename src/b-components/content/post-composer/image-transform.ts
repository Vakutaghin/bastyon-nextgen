/**
 * Трансформации картинок композера на стороне клиента (canvas). Работаем с
 * base64 data-URL (формат, в котором use-post-images хранит превью) → на выходе
 * снова base64. Без сети — чистая локальная операция перед загрузкой.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

/** Тип вывода по исходному data-URL (png/jpeg/webp), c фолбэком на png. */
function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:(image\/[a-z+.-]+);/i.exec(dataUrl)
  return m ? m[1] : 'image/png'
}

/**
 * Поворачивает изображение на кратный 90° угол по часовой стрелке.
 * `degrees` нормализуется в {0, 90, 180, 270}.
 */
export async function rotateBase64(base64: string, degrees: number): Promise<string> {
  const deg = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360
  if (deg === 0) return base64

  const img = await loadImage(base64)
  const swap = deg === 90 || deg === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.height : img.width
  canvas.height = swap ? img.width : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return base64

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  const mime = mimeFromDataUrl(base64)
  // Для jpeg задаём качество, чтобы не раздувать; png/webp игнорируют второй арг.
  return canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.9 : undefined)
}
