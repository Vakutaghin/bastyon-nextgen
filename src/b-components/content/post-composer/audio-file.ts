// Звуковой файл: узнать его среди выбранных и прочитать длительность.

/** Типы по расширению: у FLAC и M4A на Android типа у файла часто нет. */
const TYPES: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  wma: 'audio/x-ms-wma',
}

/** Что предлагать в окне выбора записи. */
export const AUDIO_ACCEPT = `audio/*,${Object.keys(TYPES)
  .map((ext) => `.${ext}`)
  .join(',')}`

/** Сколько ждать сведений о файле. */
const DURATION_WAIT_MS = 10_000

/** Звук? Файл без типа узнаётся по расширению и получает тип; null — не звук. */
export function asAudioFile(file: File): File | null {
  if (file.type.startsWith('audio/')) return file
  if (file.type) return null
  const ext = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? ''
  const type = TYPES[ext]
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : null
}

/** Секунды записи; null — браузер такой звук не читает. */
export function audioDuration(file: File): Promise<number | null> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function')
    return Promise.resolve(null)
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    let timer: ReturnType<typeof setTimeout> | undefined = undefined
    const finish = (seconds: number | null): void => {
      clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null)
    audio.onerror = () => finish(null)
    timer = setTimeout(() => finish(null), DURATION_WAIT_MS)
    audio.src = url
  })
}
