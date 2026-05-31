import { describe, it, expect } from 'vitest'
import { resolveMxcHttpUrl } from './mxc-resolver'

const clientWith = (fn: (mxc: string) => string | null) =>
  ({ mxcUrlToHttp: fn }) as unknown as Parameters<typeof resolveMxcHttpUrl>[0]

const MXC = 'mxc://matrix.org/abc123'

describe('resolveMxcHttpUrl', () => {
  it('использует client.mxcUrlToHttp, если URL не loopback', () => {
    const client = clientWith(() => 'https://cdn.example/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe('https://cdn.example/media/abc')
  })

  it('игнорирует loopback (127.0.0.1) и собирает URL вручную', () => {
    const client = clientWith(() => 'http://127.0.0.1:8008/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe(
      'https://matrix.org/_matrix/media/v3/download/matrix.org/abc123'
    )
  })

  it('игнорирует loopback (localhost)', () => {
    const client = clientWith(() => 'https://localhost/media/abc')
    expect(resolveMxcHttpUrl(client, MXC)).toBe(
      'https://matrix.org/_matrix/media/v3/download/matrix.org/abc123'
    )
  })

  it('fallback на ручную сборку, если клиента нет', () => {
    expect(resolveMxcHttpUrl(null, MXC)).toBe(
      'https://matrix.org/_matrix/media/v3/download/matrix.org/abc123'
    )
  })

  it('fallback, если mxcUrlToHttp бросает', () => {
    const client = clientWith(() => {
      throw new Error('not supported')
    })
    expect(resolveMxcHttpUrl(client, MXC)).toBe(
      'https://matrix.org/_matrix/media/v3/download/matrix.org/abc123'
    )
  })

  it('возвращает null для не-mxc URL без клиента', () => {
    expect(resolveMxcHttpUrl(null, 'https://not-mxc/url')).toBeNull()
  })

  it('возвращает null, если в mxc нет mediaId', () => {
    expect(resolveMxcHttpUrl(null, 'mxc://serveronly')).toBeNull()
  })

  it('null-кандидат от клиента → ручная сборка', () => {
    const client = clientWith(() => null)
    expect(resolveMxcHttpUrl(client, MXC)).toBe(
      'https://matrix.org/_matrix/media/v3/download/matrix.org/abc123'
    )
  })
})
