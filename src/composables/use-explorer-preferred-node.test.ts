import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  getExplorerPreferredNode,
  getExplorerRpcConfig,
  getAvailableExplorerNodes,
  useExplorerPreferredNode,
} from './use-explorer-preferred-node'

function withComposable<T>(fn: () => T): { api: T; queryClient: QueryClient } {
  const queryClient = new QueryClient()
  let captured: T | null = null
  const harness = defineComponent({
    setup() {
      captured = fn()
      return {}
    },
    render: () => h('div'),
  })
  mount(harness, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { api: captured as T, queryClient }
}

beforeEach(() => {
  setActivePinia(createPinia())
  // Reset module-level state via setter through composable.
  // The test environment's localStorage is a no-op stub; we exercise the in-memory
  // ref behaviour, persistence is guarded by try/catch in the source.
  const { api } = withComposable(() => useExplorerPreferredNode())
  api.setPreferredNode(null)
})

describe('use-explorer-preferred-node', () => {
  it('defaults to auto (no preferred node)', () => {
    expect(getExplorerPreferredNode()).toBeNull()
    expect(getExplorerRpcConfig()).toBeUndefined()
  })

  it('updates module-level state when a node is pinned', async () => {
    const { api } = withComposable(() => useExplorerPreferredNode())
    api.setPreferredNode({ host: '3.pocketnet.app', port: 8899 })
    await nextTick()

    expect(getExplorerPreferredNode()).toEqual({ host: '3.pocketnet.app', port: 8899 })
    expect(getExplorerRpcConfig()).toEqual({ host: '3.pocketnet.app', port: 8899 })
    expect(api.preferredNode.value).toEqual({ host: '3.pocketnet.app', port: 8899 })
  })

  it('clearPreferredNode resets to auto', async () => {
    const { api } = withComposable(() => useExplorerPreferredNode())
    api.setPreferredNode({ host: '1.pocketnet.app', port: 8899 })
    api.clearPreferredNode()
    await nextTick()

    expect(getExplorerPreferredNode()).toBeNull()
    expect(getExplorerRpcConfig()).toBeUndefined()
  })

  it('invalidates explorer queries on change', async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const harness = defineComponent({
      setup() {
        const api = useExplorerPreferredNode()
        return { api }
      },
      render: () => h('div'),
    })
    const wrapper = mount(harness, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    ;(wrapper.vm as any).api.setPreferredNode({ host: '5.pocketnet.app', port: 8899 })
    await nextTick()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['explorer'] })
  })

  it('exposes the list of available nodes from servers.json', () => {
    const nodes = getAvailableExplorerNodes()
    expect(Array.isArray(nodes)).toBe(true)
    expect(nodes.length).toBeGreaterThan(0)
    for (const n of nodes) {
      expect(typeof n.host).toBe('string')
      expect(typeof n.port).toBe('number')
    }
  })

  it('does not throw when localStorage is unavailable / stubbed', () => {
    // The test environment provides a partial localStorage object — set/remove
    // are guarded by try/catch in the source, so the composable should still
    // update its in-memory state.
    const { api } = withComposable(() => useExplorerPreferredNode())
    expect(() => api.setPreferredNode({ host: '2.pocketnet.app', port: 8899 })).not.toThrow()
    expect(getExplorerPreferredNode()).toEqual({ host: '2.pocketnet.app', port: 8899 })
    expect(() => api.clearPreferredNode()).not.toThrow()
    expect(getExplorerPreferredNode()).toBeNull()
  })
})
