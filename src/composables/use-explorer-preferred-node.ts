/**
 * Preferred node for the block explorer.
 *
 * Хранит выбранную пользователем ноду из servers.json в localStorage и предоставляет
 * её как RpcRequestConfig для use-block-explorer-queries. Если ничего не выбрано —
 * запросы идут через обычный round-robin из request.ts.
 *
 * Состояние модуль-левел ref-а синхронизировано между всеми инстансами composable-а.
 * При смене ноды все explorer-запросы инвалидуются, чтобы получить свежие данные с
 * новой ноды.
 */

import { ref, computed } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import serversConfig from '@/servers.json'
import type { RpcRequestConfig } from '@/helpers/api/request'

const STORAGE_KEY = 'explorer-preferred-node'

export type PreferredNode = { host: string; port: number }
export type AvailableNode = { host: string; port: number; wss?: number }

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function readFromStorage(): PreferredNode | null {
  if (!hasLocalStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.host === 'string' && typeof parsed.port === 'number') {
      return { host: parsed.host, port: parsed.port }
    }
  } catch {
    // ignore corrupted localStorage entry
  }
  return null
}

const preferredNodeRef = ref<PreferredNode | null>(readFromStorage())

/** Текущая закреплённая нода (или null, если выбран автоматический режим). */
export function getExplorerPreferredNode(): PreferredNode | null {
  return preferredNodeRef.value
}

/**
 * Конфиг для getByPRC. Возвращает undefined для «авто» — тогда getByPRC использует
 * стандартный round-robin по servers.json.
 */
export function getExplorerRpcConfig(): RpcRequestConfig | undefined {
  const n = preferredNodeRef.value
  return n ? { host: n.host, port: n.port } : undefined
}

/** Список нод из servers.json — стабилен, читается один раз. */
export function getAvailableExplorerNodes(): AvailableNode[] {
  const proxies = serversConfig?.servers?.production?.proxy ?? []
  return proxies as AvailableNode[]
}

export function useExplorerPreferredNode() {
  const queryClient = useQueryClient()
  const preferredNode = computed(() => preferredNodeRef.value)
  const availableNodes = getAvailableExplorerNodes()

  function setPreferredNode(node: PreferredNode | null) {
    if (hasLocalStorage()) {
      try {
        if (node) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(node))
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        // ignore write errors (quota / disabled storage)
      }
    }
    preferredNodeRef.value = node
    queryClient.invalidateQueries({ queryKey: ['explorer'] })
  }

  function clearPreferredNode() {
    setPreferredNode(null)
  }

  return {
    preferredNode,
    availableNodes,
    setPreferredNode,
    clearPreferredNode,
  }
}
