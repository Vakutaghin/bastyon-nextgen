/**
 * HostContext methods: произвольные RPC к pocketnet-ноде + специализированные
 * helpers (balance, blockheight).
 */

import type { HostContext } from '../host-context'

export interface RpcDeps {
  useAuthStore: typeof import('@/blockchain/store/auth-store').useAuthStore
  getByPRC: typeof import('@/helpers/api/request').getByPRC
  rpcEndpoints: typeof import('@/helpers/api/rpc-endpoints').rpcEndpoints
  unwrapRpcResponse: typeof import('@/helpers/common/response-parser').unwrapRpcResponse
}

export type RpcMethods = Pick<HostContext, 'callRpc' | 'getUserBalance' | 'getCurrentBlockHeight'>

export function createRpcMethods(deps: RpcDeps): RpcMethods {
  const { useAuthStore, getByPRC, rpcEndpoints, unwrapRpcResponse } = deps

  // TODO: end-to-end AbortSignal в RPC-слой. Сейчас `getByPRC` его не
  // принимает — bridge всё равно установит таймаут на свою сторону через
  // `DEFAULT_RPC_TIMEOUT_MS`, но прервать уже отправленный fetch к ноде
  // мы не можем.

  return {
    callRpc: async (method, parameters = [], options = {}) => {
      // Pocketnet RPC всегда отдаёт обёртку `{result, data, node, time}` —
      // снимаем её и пробрасываем только `data` миниаппе. Legacy ровно так
      // и делает (миниаппы пишут `.map` сразу на результате).
      const raw = await getByPRC({
        method,
        parameters,
        options: { auth: false, ...options },
      } as Parameters<typeof getByPRC>[0])
      if (
        raw &&
        typeof raw === 'object' &&
        'result' in raw &&
        (raw as { result: string }).result === 'error'
      ) {
        const err = (raw as { error?: string }).error ?? 'rpc_error'
        throw new Error(err)
      }
      return unwrapRpcResponse(raw) ?? raw
    },

    getUserBalance: async () => {
      const auth = useAuthStore()
      if (!auth.address) return {}
      const raw = await getByPRC({
        method: rpcEndpoints.getAddressInfo,
        parameters: [auth.address],
        options: { auth: false },
      })
      const data = unwrapRpcResponse<Record<string, unknown>>(raw)
      return data ?? {}
    },

    getCurrentBlockHeight: async () => {
      const raw = await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      })
      const data = unwrapRpcResponse<{ lastblock?: { height?: number } }>(raw)
      const height = data?.lastblock?.height
      if (typeof height !== 'number') {
        throw new Error('actions_currentBlock_not_defined')
      }
      return height
    },
  }
}
