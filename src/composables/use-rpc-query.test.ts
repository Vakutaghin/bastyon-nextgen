// S5: ключ/параметры/enabled у useRpcQuery реактивные — смена адреса после
// монтирования перевыполняет запрос, а запрос, смонтированный до адреса,
// включается, когда адрес появляется.

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({ getByPRC: vi.fn(), getByPRCWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({
  getByPRC: mocks.getByPRC,
  getByPRCWithAuth: mocks.getByPRCWithAuth,
}))

import { useRpcQueryWithAuth } from './use-rpc-query'

const mounted: Array<{ unmount: () => void }> = []
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  mocks.getByPRCWithAuth.mockReset()
})

function withComposable<T>(fn: () => T): T {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let api!: T
  const harness = defineComponent({
    setup() {
      api = fn()
      return () => h('div')
    },
  })
  mounted.push(mount(harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return api
}

const settle = () => new Promise((r) => setTimeout(r, 10))

describe('useRpcQueryWithAuth (S5)', () => {
  it('смена адреса в ключе перевыполняет запрос для нового адреса', async () => {
    mocks.getByPRCWithAuth.mockImplementation(async (p: { parameters: unknown[] }) => ({
      for: p.parameters[0],
    }))
    const address = ref<string | null>('PA')
    const q = withComposable(() =>
      useRpcQueryWithAuth<{ for: unknown }>(
        () => ['user', 'state', address.value],
        () => ({ method: 'getuserstate', parameters: [address.value], options: { auth: true } }),
        { enabled: () => !!address.value }
      )
    )
    await settle()
    expect(q.data.value).toEqual({ for: 'PA' })

    address.value = 'PB'
    await nextTick()
    await settle()
    expect(q.data.value).toEqual({ for: 'PB' })
    expect(mocks.getByPRCWithAuth.mock.calls.map((c) => c[0].parameters[0])).toEqual(['PA', 'PB'])
  })

  it('смонтирован до адреса — включается, когда адрес появляется', async () => {
    mocks.getByPRCWithAuth.mockResolvedValue({ ok: true })
    const address = ref<string | null>(null)
    const q = withComposable(() =>
      useRpcQueryWithAuth(
        () => ['user', 'state', address.value],
        () => ({ method: 'getuserstate', parameters: [address.value], options: { auth: true } }),
        { enabled: () => !!address.value }
      )
    )
    await settle()
    expect(mocks.getByPRCWithAuth).not.toHaveBeenCalled()

    address.value = 'PA'
    await nextTick()
    await settle()
    expect(mocks.getByPRCWithAuth).toHaveBeenCalledTimes(1)
    expect(q.data.value).toEqual({ ok: true })
  })

  it('статические ключ/параметры (как раньше) продолжают работать', async () => {
    mocks.getByPRCWithAuth.mockResolvedValue({ ok: 1 })
    const q = withComposable(() =>
      useRpcQueryWithAuth(['x'], { method: 'm', parameters: [], options: { auth: true } })
    )
    await settle()
    expect(q.data.value).toEqual({ ok: 1 })
  })
})
