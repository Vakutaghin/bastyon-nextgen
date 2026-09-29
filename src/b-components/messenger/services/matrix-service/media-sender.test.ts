// Медиа в чате: загрузка в media-store (строка или {content_uri} от SDK,
// прогресс), события m.audio/m.image/m.video/m.file с http-адресом и
// секретами шифрования, длительность в мс, миниатюра видео. m.file кладёт
// в body JSON {name, type, size, url}: так его читают bastyon-chat и
// forta.chat (иначе у них «NaN undefined»). Донат — m.text с
// pocketnet_transaction и читаемым body для сторонних клиентов.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./mxc-resolver', () => ({
  resolveMxcHttpUrl: (_client: unknown, mxc: string) =>
    mxc.startsWith('mxc://') ? `https://media.example/${mxc.slice(6)}` : '',
}))

import { sendAudio, sendFile, sendImage, sendVideo, uploadContent } from './media-sender'
import type { MatrixClient } from './types'

function fakeClient(upload: unknown = 'mxc://srv/media1') {
  return {
    uploadContent: vi.fn(async (_file: Blob, opts: { progressCallback?: (i: object) => void }) => {
      opts.progressCallback?.({ loaded: 50, total: 100 })
      return upload
    }),
    sendEvent: vi.fn(async (_roomId: string, _type: string, _content: unknown) => ({
      event_id: '$sent',
    })),
  }
}

const asClient = (c: ReturnType<typeof fakeClient>) => c as unknown as MatrixClient
const sentContent = (c: ReturnType<typeof fakeClient>) =>
  c.sendEvent.mock.lastCall![2] as Record<string, unknown> & { info: Record<string, unknown> }
const SECRETS = { keys: 'enc-keys', block: 3_000_000, v: 2 }

describe('media-sender', () => {
  let client: ReturnType<typeof fakeClient>
  beforeEach(() => {
    client = fakeClient()
  })

  describe('uploadContent', () => {
    it('возвращает mxc из строки и из {content_uri}; прогресс доходит, ошибка колбэка не роняет загрузку', async () => {
      const onProgress = vi.fn(() => {
        throw new Error('UI crashed')
      })
      const blob = new Blob(['x'], { type: 'image/png' })
      await expect(uploadContent(asClient(client), blob, { onProgress })).resolves.toBe(
        'mxc://srv/media1'
      )
      expect(onProgress).toHaveBeenCalledWith(50, 100)
      expect(client.uploadContent.mock.lastCall![1]).toMatchObject({ type: 'image/png' })

      const objectClient = fakeClient({ content_uri: 'mxc://srv/media2' })
      await expect(uploadContent(asClient(objectClient), blob)).resolves.toBe('mxc://srv/media2')
    })

    it('ответ без адреса — ошибка', async () => {
      await expect(uploadContent(asClient(fakeClient({})), new Blob(['x']))).rejects.toThrow(
        'Upload content failed'
      )
    })
  })

  it('голосовое: загрузка, длительность в мс, секреты, блок и версия шифрования', async () => {
    const blob = new Blob(['voice'], { type: 'audio/ogg' })
    await sendAudio(asClient(client), '!room', {
      blob,
      duration: 2.345,
      secrets: SECRETS,
      block: 3_000_000,
    })

    expect(client.uploadContent.mock.lastCall![1]).toMatchObject({
      name: 'voice-message',
      type: 'audio/ogg',
    })
    expect(client.sendEvent).toHaveBeenCalledWith('!room', 'm.room.message', expect.any(Object))
    expect(sentContent(client)).toEqual({
      msgtype: 'm.audio',
      body: 'https://media.example/srv/media1',
      url: 'https://media.example/srv/media1',
      info: {
        mimetype: 'audio/ogg',
        size: 5,
        duration: 2345,
        url: 'mxc://srv/media1',
        httpUrl: 'https://media.example/srv/media1',
        secrets: SECRETS,
      },
      block: 3_000_000,
      version: 2,
    })
  })

  it('уже загруженное (mxcUrl) не грузится повторно', async () => {
    await sendImage(asClient(client), '!room', {
      mxcUrl: 'mxc://srv/ready',
      width: 640,
      height: 480,
    })
    expect(client.uploadContent).not.toHaveBeenCalled()
    expect(sentContent(client)).toMatchObject({
      msgtype: 'm.image',
      url: 'https://media.example/srv/ready',
      info: { mimetype: 'image/jpeg', w: 640, h: 480, url: 'mxc://srv/ready' },
    })
  })

  it('видео с миниатюрой и размерами', async () => {
    await sendVideo(asClient(client), '!room', {
      mxcUrl: 'mxc://srv/v',
      name: 'море.mp4',
      duration: 12,
      width: 1920,
      height: 1080,
      thumbnailUrl: 'mxc://srv/thumb',
      thumbnailWidth: 320,
      thumbnailHeight: 180,
    })
    expect(sentContent(client)).toMatchObject({
      msgtype: 'm.video',
      body: 'море.mp4',
      info: {
        mimetype: 'video/mp4',
        duration: 12_000,
        w: 1920,
        h: 1080,
        thumbnail_url: 'mxc://srv/thumb',
        thumbnail_info: { mimetype: 'image/jpeg', w: 320, h: 180 },
      },
    })
  })

  it('файл: body — JSON для bastyon-chat, filename и url — для Element', async () => {
    const blob = new Blob(['12345678'], { type: 'application/pdf' })
    await sendFile(asClient(client), '!room', { blob, name: 'отчёт.pdf', secrets: SECRETS })
    const content = sentContent(client)
    expect(JSON.parse(content.body as string)).toEqual({
      name: 'отчёт.pdf',
      type: 'application/pdf',
      size: 8,
      url: 'https://media.example/srv/media1',
      secrets: SECRETS,
    })
    expect(content).toMatchObject({
      msgtype: 'm.file',
      filename: 'отчёт.pdf',
      info: { mimetype: 'application/pdf', size: 8, secrets: SECRETS },
      version: 2,
    })
  })

  it.each([
    ['sendAudio', sendAudio],
    ['sendImage', sendImage],
    ['sendVideo', sendVideo],
    ['sendFile', sendFile],
  ])('%s без файла и без mxcUrl — ошибка, событие не уходит', async (_name, send) => {
    await expect(send(asClient(client), '!room', {})).rejects.toThrow('missing mxcUrl')
    expect(client.sendEvent).not.toHaveBeenCalled()
  })
})
