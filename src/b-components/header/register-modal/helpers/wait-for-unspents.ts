// Фоновое ожидание появления UTXO у адреса: polling + WS-подписка.
// Используется после оптимистичного запроса free-balance — пока сеть подтверждает,
// мы уже показали пользователю «часики». Таймаут — 5 минут.

interface ProxyServer {
  host: string
  port: number
}

type GetUnspentsFn = (
  addr: string,
  minConf: number,
  maxConf: number,
  server?: ProxyServer
) => Promise<any[]>

type FilterAvailableFn = (u: any[], onlyConfirmed: boolean) => any[]

interface WaitOptions {
  address: string
  getUnspents: GetUnspentsFn
  filterAvailableUnspents: FilterAvailableFn
  proxyServer?: ProxyServer
  /** Период polling между проверками (мс). По умолчанию 3000. */
  pollIntervalMs?: number
  /** Общий таймаут (мс). По умолчанию 5 минут. */
  timeoutMs?: number
}

const LOG_PREFIX = '[wait-for-unspents]'

/**
 * Ждёт, пока у адреса появится хотя бы один доступный UTXO. Резолвится первым ненулевым
 * списком unspents. Реджектит по таймауту. Колбэки чистые — никакого component this.
 */
export async function waitForUnspents(opts: WaitOptions): Promise<any[]> {
  const {
    address,
    getUnspents,
    filterAvailableUnspents,
    proxyServer,
    pollIntervalMs = 3000,
    timeoutMs = 5 * 60 * 1000,
  } = opts

  const { wsService } = await import('@/blockchain/ws')

  return new Promise<any[]>((resolve, reject) => {
    let resolved = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let unsubscribeWs: (() => void) | null = null

    const cleanup = () => {
      resolved = true
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (unsubscribeWs) unsubscribeWs()
    }

    const checkUnspents = async () => {
      if (resolved) return
      try {
        let unspents = await getUnspents(address, 0, 9999999, proxyServer)
        unspents = filterAvailableUnspents(unspents, false)
        if (unspents.length > 0 && !resolved) {
          console.log(LOG_PREFIX, 'unspents appeared:', unspents.length)
          cleanup()
          resolve(unspents)
        }
      } catch {
        /* retry на следующем тике */
      }
    }

    wsService.subscribeAddress(address).catch(() => {})
    unsubscribeWs = wsService.on('transaction', () => {
      console.log(LOG_PREFIX, 'WS transaction, rechecking unspents')
      checkUnspents()
    })

    pollTimer = setInterval(checkUnspents, pollIntervalMs)
    // Первая проверка через 1 сек — даём времени WS подняться.
    setTimeout(checkUnspents, 1000)

    timeoutTimer = setTimeout(() => {
      if (!resolved) {
        cleanup()
        reject(new Error('Background: unspents timeout'))
      }
    }, timeoutMs)
  })
}
