// Куда сохранить скачанный и проверенный IPFS-файл в браузере и на телефоне:
//  - телефон (Capacitor): по кускам во временную папку приложения, потом
//    системное «Поделиться» — оттуда «Сохранить в Файлы» или любое приложение;
//  - браузер с File System Access (Chrome, Edge): диалог сохранения и запись
//    на диск по мере скачивания, без потолка памяти;
//  - остальные браузеры: файл собирается в Blob и уходит обычной загрузкой,
//    поэтому у этого способа потолок размера.
import { isMobile } from '@mobile/utils/platform'
import { triggerAnchorDownload } from '@/helpers/common/download-media'
import { isAbortError } from './ipfs-errors'

export type SinkKind = 'share' | 'disk' | 'blob'

export interface SaveSink {
  readonly kind: SinkKind
  /** Сколько байт этот способ выдержит. */
  readonly maxBytes: number
  write(chunk: Uint8Array): Promise<void>
  /** Файл готов: сохранить (или отдать в «Поделиться»). */
  close(): Promise<void>
  /** Отмена или ошибка: недокачанный файл не остаётся. */
  abort(): Promise<void>
}

/** Как MAX_VERIFIED_DOWNLOAD_BYTES в Rust. */
export const MAX_FILE_BYTES = 4 * 1024 ** 3
/** Blob держит файл в памяти вкладки. */
export const MAX_BLOB_BYTES = 1024 ** 3
/** Раз в столько байт куски сливаются в Blob — браузер может убрать их из памяти JS. */
const BLOB_BATCH_BYTES = 16 * 1024 * 1024
/** Кусок записи на телефоне: каждый идёт через мост Capacitor в base64. */
const SHARE_FLUSH_BYTES = 2 * 1024 * 1024
/** Папка загрузок в кэше приложения; чистится перед каждой новой. */
const SHARE_DIR = 'ipfs-downloads'

type SaveFilePicker = (options: { suggestedName?: string }) => Promise<FileSystemFileHandle>

/**
 * Способ сохранения для этого устройства. На десктопном браузере сначала
 * открывается диалог сохранения, поэтому вызывать — прямо по клику
 * пользователя. null — диалог закрыли.
 */
export async function openSaveSink(name: string): Promise<SaveSink | null> {
  if (isMobile()) return openShareSink(name)
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: name })
      return new DiskSink(await handle.createWritable())
    } catch (e) {
      if (isAbortError(e)) return null
      // Нет жеста пользователя или запрет политики — обычная загрузка.
    }
  }
  return new BlobSink(name)
}

class DiskSink implements SaveSink {
  readonly kind = 'disk'
  readonly maxBytes = MAX_FILE_BYTES

  constructor(private readonly writable: FileSystemWritableFileStream) {}

  write(chunk: Uint8Array): Promise<void> {
    return this.writable.write(chunk as Uint8Array<ArrayBuffer>)
  }

  close(): Promise<void> {
    return this.writable.close()
  }

  async abort(): Promise<void> {
    // Браузер пишет во временный файл и заменяет им выбранный только в close().
    await this.writable.abort().catch(() => {})
  }
}

export class BlobSink implements SaveSink {
  readonly kind = 'blob'
  readonly maxBytes = MAX_BLOB_BYTES
  private parts: Blob[] = []
  private batch: Uint8Array<ArrayBuffer>[] = []
  private batchBytes = 0

  constructor(private readonly name: string) {}

  async write(chunk: Uint8Array): Promise<void> {
    this.batch.push(chunk as Uint8Array<ArrayBuffer>)
    this.batchBytes += chunk.length
    if (this.batchBytes >= BLOB_BATCH_BYTES) this.seal()
  }

  private seal(): void {
    if (this.batch.length) this.parts.push(new Blob(this.batch))
    this.batch = []
    this.batchBytes = 0
  }

  async close(): Promise<void> {
    this.seal()
    const url = URL.createObjectURL(new Blob(this.parts, { type: 'application/octet-stream' }))
    this.parts = []
    triggerAnchorDownload(url, this.name)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async abort(): Promise<void> {
    this.parts = []
    this.batch = []
    this.batchBytes = 0
  }
}

type FilesystemApi = typeof import('@capacitor/filesystem').Filesystem
type ShareApi = typeof import('@capacitor/share').Share
type Directory = import('@capacitor/filesystem').Directory

async function openShareSink(name: string): Promise<SaveSink> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  // Прошлые загрузки уже отданы в «Поделиться» — не даём кэшу расти.
  await Filesystem.rmdir({ path: SHARE_DIR, directory: Directory.Cache, recursive: true }).catch(
    () => {}
  )
  return new ShareSink(
    Filesystem,
    Share,
    Directory.Cache,
    `${SHARE_DIR}/${Date.now()}/${name}`,
    name
  )
}

/** base64 без префикса data-URL: так файл пишет Filesystem. */
function toBase64(parts: Uint8Array<ArrayBuffer>[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob(parts))
  })
}

export class ShareSink implements SaveSink {
  readonly kind = 'share'
  readonly maxBytes = MAX_FILE_BYTES
  private batch: Uint8Array<ArrayBuffer>[] = []
  private batchBytes = 0
  private created = false

  constructor(
    private readonly fs: FilesystemApi,
    private readonly share: ShareApi,
    private readonly directory: Directory,
    private readonly path: string,
    private readonly name: string
  ) {}

  async write(chunk: Uint8Array): Promise<void> {
    this.batch.push(chunk as Uint8Array<ArrayBuffer>)
    this.batchBytes += chunk.length
    if (this.batchBytes >= SHARE_FLUSH_BYTES) await this.flush()
  }

  private async flush(): Promise<void> {
    const data = await toBase64(this.batch)
    this.batch = []
    this.batchBytes = 0
    const target = { path: this.path, directory: this.directory, data }
    if (this.created) {
      await this.fs.appendFile(target)
    } else {
      await this.fs.writeFile({ ...target, recursive: true })
      this.created = true
    }
  }

  async close(): Promise<void> {
    await this.flush()
    const { uri } = await this.fs.getUri({ path: this.path, directory: this.directory })
    try {
      await this.share.share({ title: this.name, files: [uri] })
    } catch {
      // «Поделиться» закрыли — файл скачан, повторить можно новым кликом.
    }
  }

  async abort(): Promise<void> {
    this.batch = []
    this.batchBytes = 0
    await this.fs.deleteFile({ path: this.path, directory: this.directory }).catch(() => {})
  }
}
