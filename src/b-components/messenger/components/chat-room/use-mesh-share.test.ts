// Свой адрес Reticulum в обычный чат: без узла — на вкладку Reticulum, с
// узлом — подписанная запись связки через стор; отказ — тостом.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rns: { available: true, status: 'idle' as string, address: null as string | null },
  push: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/mesh/store/reticulum-store', () => ({ useReticulumStore: () => h.rns }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { info: h.info, error: h.error } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { useMeshShare } from './use-mesh-share'

beforeEach(() => {
  vi.clearAllMocks()
  h.rns.status = 'idle'
  h.rns.address = null
})

describe('useMeshShare', () => {
  it('asks to start the node when it is not running', async () => {
    const share = vi.fn(async () => 'sent' as const)
    await useMeshShare(share).shareAddress()
    expect(share).not.toHaveBeenCalled()
    expect(h.info).toHaveBeenCalledWith({ message: 'mesh.share.startNode' })
    expect(h.push).toHaveBeenCalledWith({ path: '/mesh', query: { net: 'reticulum' } })
  })

  it('shares the signed binding when the node runs', async () => {
    h.rns.status = 'running'
    h.rns.address = 'ab'.repeat(16)
    const share = vi.fn(async () => 'sent' as const)
    const mesh = useMeshShare(share)
    expect(mesh.available).toBe(true)
    await mesh.shareAddress()
    expect(share).toHaveBeenCalledOnce()
    expect(h.info).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
  })

  it('says so when the binding could not be sent', async () => {
    h.rns.status = 'running'
    h.rns.address = 'ab'.repeat(16)
    await useMeshShare(async () => 'failed').shareAddress()
    expect(h.error).toHaveBeenCalledWith({ message: 'mesh.share.failed' })
  })
})
