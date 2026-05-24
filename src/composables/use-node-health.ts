/**
 * Проверка живости каждой ноды из servers.json: getnodeinfo с таймаутом + измерение latency.
 *
 * Под капотом ходит к каждой ноде по очереди (Promise.all) с принудительным таймаутом
 * через AbortController. Возвращает массив `NodeHealth` в том же порядке, что и в
 * servers.json, чтобы UI мог просто пройтись по списку.
 *
 * staleTime: 1 минута — баланс между актуальностью и нагрузкой; refetchInterval 60 с.
 */

import { useQuery } from '@tanstack/vue-query'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import servers from '@/servers.json'
import type { GetNodeInfoResponse } from '@/types/rpc-responses/get-node-info'

export interface NodeHealth {
  host: string
  port: number
  /** true — нода ответила за отведённое время. */
  ok: boolean
  /** Длительность запроса, мс. null если запрос упал/тайм-аутнулся. */
  latencyMs: number | null
  /** Версия ноды если получили. */
  version?: string
  /** Высота tip-а если получили. */
  height?: number
  /** Сообщение об ошибке для troubleshoot-а. */
  error?: string
}

const PING_TIMEOUT_MS = 4_000

interface ServerEntry {
  host: string
  port: number
}

function getProductionServers(): ServerEntry[] {
  const raw = (servers as { servers?: { production?: { proxy?: ServerEntry[] } } })
  return raw.servers?.production?.proxy ?? []
}

async function pingNode(host: string, port: number): Promise<NodeHealth> {
  const startedAt = performance.now()
  // Используем Promise.race вместо AbortController — getByPRC не пробрасывает signal.
  // Это значит, что underlying-запрос всё равно дойдёт, но мы перестанем его ждать.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS),
  )
  try {
    const resp = (await Promise.race([
      getByPRC(
        {
          method: rpcEndpoints.getNodeInfo,
          parameters: [],
          options: { auth: false },
        },
        { host, port },
      ),
      timeoutPromise,
    ])) as GetNodeInfoResponse
    const latencyMs = Math.round(performance.now() - startedAt)
    return {
      host,
      port,
      ok: resp?.result === 'success',
      latencyMs,
      version: resp?.data?.version,
      height: resp?.data?.lastblock?.height,
    }
  } catch (e) {
    return {
      host,
      port,
      ok: false,
      latencyMs: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function useNodeHealth() {
  const ports = getProductionServers()
  return useQuery<NodeHealth[]>({
    queryKey: ['explorer', 'node-health'] as const,
    queryFn: async () => {
      return Promise.all(ports.map((s) => pingNode(s.host, s.port)))
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function getProductionServersList(): ServerEntry[] {
  return getProductionServers()
}
