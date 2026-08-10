// Чистое решение: каким шлюзом резолвить IPFS-ссылку по состоянию модуля.
// Tier 0 = публичный шлюз (fallback/дефолт), Tier 1 = локальная нода Kubo.
// Вынесено из стора, чтобы покрыть матрицей юнит-тестов.

export type IpfsConsent = 'unknown' | 'accepted' | 'declined'

export type GatewaySource =
  | 'local' // нода поднята → сразу локальный URL
  | 'ensure' // согласие есть, ноду надо поднять
  | 'ask' // согласие не спрашивали — предложить установку
  | 'public' // публичный шлюз (веб/отказ)

export type TierInput = {
  /** Tauri-десктоп (в вебе локальной ноды быть не может). */
  available: boolean
  /** Демон уже поднят. */
  running: boolean
  /** Известен порт локального gateway. */
  hasPort: boolean
  consent: IpfsConsent
}

export function pickGatewaySource(s: TierInput): GatewaySource {
  if (!s.available) return 'public'
  if (s.running && s.hasPort) return 'local'
  if (s.consent === 'declined') return 'public'
  if (s.consent === 'accepted') return 'ensure'
  return 'ask'
}
