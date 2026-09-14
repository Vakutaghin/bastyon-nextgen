import { describe, it, expect } from 'vitest'
import { isTrustedMediaUrl, resolveMxcHttpUrl, trustedMediaOrigins } from './mxc-resolver'

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
