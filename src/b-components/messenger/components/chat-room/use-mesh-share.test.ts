// Свой адрес Reticulum в обычный чат: без узла — на вкладку Reticulum, с
// узлом — текст с адресом `lxmf@…`, который узнаёт приложение собеседника.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rns: { available: true, status: 'idle' as string, address: null as string | null },
  push: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@/mesh/store/reticulum-store', () => ({ useReticulumStore: () => h.rns }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { info: h.info } }))
vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, string>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}))

import { useMeshShare } from './use-mesh-share'

beforeEach(() => {
  vi.clearAllMocks()
  h.rns.status = 'idle'
  h.rns.address = null
})

describe('useMeshShare', () => {
  it('asks to start the node when it is not running', () => {
    const send = vi.fn()
    useMeshShare(send).shareAddress()
    expect(send).not.toHaveBeenCalled()
    expect(h.info).toHaveBeenCalledWith({ message: 'mesh.share.startNode' })
    expect(h.push).toHaveBeenCalledWith({ path: '/mesh', query: { net: 'reticulum' } })
  })

  it('sends the lxmf@ address when the node runs', () => {
    h.rns.status = 'running'
    h.rns.address = 'ab'.repeat(16)
    const send = vi.fn()
    const share = useMeshShare(send)
    expect(share.available).toBe(true)
    share.shareAddress()
    expect(send).toHaveBeenCalledWith(
      `mesh.share.text ${JSON.stringify({ address: `lxmf@${'ab'.repeat(16)}` })}`
    )
  })
})
