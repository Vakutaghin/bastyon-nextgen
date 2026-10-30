// Вызов метода у ноды: тело и путь как у прокси, сертификат запоминается при
// первой встрече и сверяется потом, ошибка ноды — её объектом с httpStatus,
// сбой связи — NodeTransportError (спросить другую ноду).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('./native-link', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./native-link')>()),
  nodeLinkRequest: h.request,
}))

import { NodePinMismatchError } from './native-link'
import { isNodeTransportError, nodeCall, NodeTransportError } from './node-call'
import { pinOf, resetPinsForTests } from './node-pins'

const reply = (body: unknown, status = 200, fingerprint = 'AB'.repeat(32)) => ({
  status,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  fingerprint,
})

describe('nodeCall', () => {
  beforeEach(() => {
    h.request.mockReset()
    resetPinsForTests()
  })

  it('шлёт метод с приведёнными параметрами и запоминает сертификат', async () => {
    h.request.mockResolvedValue(reply({ result: { ok: 1 }, error: null, id: null }))
    await expect(nodeCall('1.2.3.4', 'getrawtransaction', ['tx', '1'])).resolves.toEqual({ ok: 1 })
    const req = h.request.mock.calls[0]![0]
    expect(req).toMatchObject({ host: '1.2.3.4', port: 38881, path: '/public/', pin: null })
    expect(JSON.parse(req.body)).toEqual({ method: 'getrawtransaction', params: ['tx', 1] })
    expect(pinOf('1.2.3.4:38881')).toBe('ab'.repeat(32))

    await nodeCall('1.2.3.4', 'sendrawtransactionwithmessage', ['hex', {}, 'share'])
    expect(h.request.mock.calls[1]![0]).toMatchObject({ path: '/post/', pin: 'ab'.repeat(32) })
  })

  it('ошибка ноды — её объект с httpStatus, как от прокси', async () => {
    h.request.mockResolvedValue(
      reply({ result: null, error: { code: -26, message: 'min relay fee not met' } }, 500)
    )
    const error = await nodeCall('1.2.3.4', 'sendrawtransactionwithmessage', []).catch((e) => e)
    expect(error).toEqual({ code: -26, message: 'min relay fee not met', httpStatus: 500 })
    expect(isNodeTransportError(error)).toBe(false)
  })

  it('сбой связи, не JSON и перегрузка — спросить другую ноду', async () => {
    h.request.mockRejectedValueOnce(new Error('connection refused'))
    await expect(nodeCall('1.2.3.4', 'getnodeinfo', [])).rejects.toBeInstanceOf(NodeTransportError)
    h.request.mockResolvedValueOnce(reply('<html>', 502))
    await expect(nodeCall('1.2.3.4', 'getnodeinfo', [])).rejects.toBeInstanceOf(NodeTransportError)
    h.request.mockResolvedValueOnce(reply({ error: 'Work queue depth exceeded' }, 500))
    await expect(nodeCall('1.2.3.4', 'getnodeinfo', [])).rejects.toBeInstanceOf(NodeTransportError)
  })

  it('чужой сертификат — отдельная ошибка, сертификат не перезаписывается', async () => {
    h.request.mockRejectedValue(new NodePinMismatchError('1.2.3.4'))
    const error = await nodeCall('1.2.3.4', 'getnodeinfo', []).catch((e) => e)
    expect(error).toBeInstanceOf(NodePinMismatchError)
    expect(isNodeTransportError(error)).toBe(true)
    expect(pinOf('1.2.3.4:38881')).toBeNull()
  })
})
