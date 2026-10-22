import { describe, it, expect } from 'vitest'
import {
  isTrustedMediaUrl,
  mediaUrlToMxc,
  resolveMediaUrl,
  resolveMxcHttpUrl,
  trustedMediaOrigins,
} from './mxc-resolver'

const HS = 'https://matrix.pocketnet.app'

const clientWith = (fn: (mxc: string) => string | null, baseUrl: string = HS) =>
  ({ mxcUrlToHttp: fn, baseUrl }) as unknown as Parameters<typeof resolveMxcHttpUrl>[0]

const MXC = 'mxc://matrix.org/abc123'
const VIA_HS = `${HS}/_matrix/media/v3/download/matrix.org/abc123`

describe('resolveMxcHttpUrl', () => {
  it("использует client.mxcUrlToHttp, если URL на homeserver'е", () => {
    const client = clientWith(() => `${HS}/_matrix/media/v3/download/matrix.org/abc123?x=1`)
    expect(resolveMxcHttpUrl(client, MXC)).toBe(
      `${HS}/_matrix/media/v3/download/matrix.org/abc123?x=1`
    )
  })

  it('чужой хост от клиента — не доверяем, собираем через homeserver (S34)', () => {
    const client = clientWith(() => 'https://cdn.example/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe(VIA_HS)
  })

  it('игнорирует loopback (127.0.0.1) и собирает URL через homeserver', () => {
    const client = clientWith(() => 'http://127.0.0.1:8008/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe(VIA_HS)
  })

  it('игнорирует loopback (localhost)', () => {
    const client = clientWith(() => 'https://localhost/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe(VIA_HS)
  })

  it('fallback без клиента — через дефолтный homeserver, а не https://{server}', () => {
    const url = resolveMxcHttpUrl(null, MXC)!
    expect(url.endsWith('/_matrix/media/v3/download/matrix.org/abc123')).toBe(true)
    expect(url.startsWith('https://matrix.org/')).toBe(false)
  })

  it('fallback, если mxcUrlToHttp бросает', () => {
    const client = clientWith(() => {
      throw new Error('not supported')
    })
    expect(resolveMxcHttpUrl(client, MXC)).toBe(VIA_HS)
  })

  it('возвращает null для не-mxc URL', () => {
    expect(resolveMxcHttpUrl(null, 'https://not-mxc/url')).toBeNull()
    expect(
      resolveMxcHttpUrl(
        clientWith(() => 'https://x/y'),
        'https://not-mxc/url'
      )
    ).toBeNull()
  })

  it('возвращает null, если в mxc нет mediaId', () => {
    expect(resolveMxcHttpUrl(null, 'mxc://serveronly')).toBeNull()
  })

  it('null-кандидат от клиента → сборка через homeserver', () => {
    const client = clientWith(() => null)
    expect(resolveMxcHttpUrl(client, MXC)).toBe(VIA_HS)
  })
})

describe('isTrustedMediaUrl', () => {
  it("доверяет homeserver'у клиента и прод-homeserver'у", () => {
    const client = clientWith(() => null, 'https://test.matrix.pocketnet.app')
    expect(trustedMediaOrigins(client)).toEqual([
      'https://test.matrix.pocketnet.app',
      'https://matrix.pocketnet.app',
    ])
    expect(isTrustedMediaUrl(client, 'https://test.matrix.pocketnet.app/_matrix/media/x')).toBe(
      true
    )
    expect(isTrustedMediaUrl(client, 'https://matrix.pocketnet.app/_matrix/media/x')).toBe(true)
  })

  it('чужие хосты, loopback, другой порт/схема и мусор — нет', () => {
    const client = clientWith(() => null)
    for (const u of [
      'https://evil.example/track.png',
      'http://127.0.0.1:8008/x',
      'https://localhost/x',
      'http://matrix.pocketnet.app/x',
      'https://matrix.pocketnet.app:8448/x',
      'mxc://matrix.pocketnet.app/abc',
      'javascript:alert(1)',
      '',
    ]) {
      expect(isTrustedMediaUrl(client, u), u).toBe(false)
    }
  })
})

describe('mediaUrlToMxc', () => {
  it('разбирает ссылки на медиа Matrix любого хоста', () => {
    expect(
      mediaUrlToMxc(
        'https://matrix.2.pocketnet.app/_matrix/media/r0/download/matrix.pocketnet.app/AbC_1-z'
      )
    ).toBe('mxc://matrix.pocketnet.app/AbC_1-z')
    expect(
      mediaUrlToMxc('http://127.0.0.1:8008/_matrix/media/v3/download/hs.example:8448/id1')
    ).toBe('mxc://hs.example:8448/id1')
    expect(
      mediaUrlToMxc('https://x.example/_matrix/client/v1/media/download/hs.example/id2/voice.ogg')
    ).toBe('mxc://hs.example/id2')
    expect(
      mediaUrlToMxc('https://x.example/_matrix/media/r0/thumbnail/hs.example/id3?width=320')
    ).toBe('mxc://hs.example/id3')
  })

  it('не медиа Matrix — null', () => {
    for (const u of [
      'https://evil.example/track.png',
      'https://evil.example/x/_matrix/media/r0/download/hs.example/id',
      'https://evil.example/_matrix/media/r0/download/hs.example/',
      'https://evil.example/_matrix/media/r0/download/hs.example/id%2F..',
      'ftp://x.example/_matrix/media/r0/download/hs.example/id',
      'mxc://hs.example/id',
      'not a url',
    ]) {
      expect(mediaUrlToMxc(u), u).toBeNull()
    }
  })
})

describe('resolveMediaUrl', () => {
  const client = clientWith(() => null)

  it("медиа через зеркало homeserver'а — качаем через свой homeserver", () => {
    expect(
      resolveMediaUrl(
        client,
        'https://matrix.2.pocketnet.app/_matrix/media/r0/download/matrix.pocketnet.app/AbC'
      )
    ).toBe(`${HS}/_matrix/media/v3/download/matrix.pocketnet.app/AbC`)
  })

  it("mxc и ссылки homeserver'а — как раньше, чужое — ''", () => {
    expect(resolveMediaUrl(client, MXC)).toBe(VIA_HS)
    expect(resolveMediaUrl(client, `${HS}/_matrix/media/r0/download/matrix.org/abc123`)).toBe(
      `${HS}/_matrix/media/r0/download/matrix.org/abc123`
    )
    expect(resolveMediaUrl(client, 'https://evil.example/track.png')).toBe('')
  })
})
