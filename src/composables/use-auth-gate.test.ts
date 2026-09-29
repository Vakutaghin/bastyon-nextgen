import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useModalStore } from '@/stores/modal-store'

const auth = vi.hoisted(() => ({ current: null as null | { isUserAuthenticated: boolean } }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => auth.current }))

// Отложенное действие живёт в модуле — каждому тесту свой экземпляр.
async function loadGate() {
  vi.resetModules()
  return import('./use-auth-gate')
}

describe('requireAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    auth.current = reactive({ isUserAuthenticated: false })
  })

  it('runs the action at once for a signed-in user', async () => {
    auth.current!.isUserAuthenticated = true
    const { requireAuth } = await loadGate()
    const action = vi.fn()
    expect(requireAuth(action)).toBe(true)
    expect(action).toHaveBeenCalledOnce()
    expect(useModalStore().authModal.isOpen).toBe(false)
  })

  it('asks a guest to sign in and runs the action after sign-in', async () => {
    const { requireAuth } = await loadGate()
    const action = vi.fn()
    expect(requireAuth(action)).toBe(false)
    expect(action).not.toHaveBeenCalled()
    expect(useModalStore().authModal).toMatchObject({ isOpen: true, mode: 'login' })

    auth.current!.isUserAuthenticated = true
    await nextTick()
    expect(action).toHaveBeenCalledOnce()
  })

  it('forgets the action when the guest closes the window without signing in', async () => {
    const { requireAuth } = await loadGate()
    const action = vi.fn()
    requireAuth(action)
    await nextTick()
    useModalStore().closeAuthModal()
    await nextTick()

    auth.current!.isUserAuthenticated = true
    await nextTick()
    expect(action).not.toHaveBeenCalled()
  })

  it('keeps only the latest action', async () => {
    const { requireAuth } = await loadGate()
    const first = vi.fn()
    const second = vi.fn()
    requireAuth(first)
    requireAuth(second)

    auth.current!.isUserAuthenticated = true
    await nextTick()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
