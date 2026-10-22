// «Постоянные ссылки» аккаунта — свои имена IPNS (helpers/ipfs/ipns-names.ts).
//
// Список имён аккаунта лежит на устройстве, в localStorage
// `BST_IPNS_NAMES_<адрес>`: номер имени, куда оно ведёт и номер записи.
// Ключи имён не хранятся нигде — их выводят из ключа аккаунта для каждой
// подписи. Имена, созданные на другом устройстве, находятся перебором номеров,
// когда открыты «Мои файлы».
//
// В сеть стор ходит, только когда у аккаунта есть свои имена или открыты
// «Мои файлы»: иначе каждый запуск показывал бы delegated-ipfs.dev IP-адрес
// любого пользователя. Под Tor не ходит вовсе: запросы шли бы мимо Tor.
import { defineStore } from 'pinia'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { IPNS_NAMES_PREFIX } from '@/blockchain/constants/storage'
import type { KnownName, NameRecord } from '@/helpers/ipfs/ipns-names'
import { useIpfsStore } from '@/stores/ipfs-store'
import { useTorStore } from '@/stores/tor-store'

/** Переиздавать свои имена не чаще: DHT держит запись около 48 часов. */
export const RENEW_EVERY_MS = 12 * 3600_000
/** Больше стольких имён подряд перебор не ищет. */
const PROBE_LIMIT = 50

export interface OwnName {
  index: number
  /** `k51…` */
  name: string
  /** Куда ведёт: `/ipfs/<cid>/<имя файла>`. */
  value: string
  /** Номер последней записи — строкой: в JSON нет bigint. */
  sequence: string
  /** Когда запись подписана или найдена в сети, мс. */
  updatedAt: number
}

interface Saved {
  names: OwnName[]
  /** Когда имена переиздавались в последний раз, мс. */
  renewedAt: number
}

const loadNames = () => import('@/helpers/ipfs/ipns-names')

function storageKey(account: string): string {
  return `${IPNS_NAMES_PREFIX}${account}`
}

function readSaved(account: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(account))
    const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : {}
    return {
      names: Array.isArray(parsed.names) ? parsed.names : [],
      renewedAt: typeof parsed.renewedAt === 'number' ? parsed.renewedAt : 0,
    }
  } catch {
    return { names: [], renewedAt: 0 }
  }
}

function writeSaved(account: string, saved: Saved): void {
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(saved))
  } catch {
    // Не сохранили — имена найдутся перебором при следующем открытии «Моих файлов».
  }
}

function known(entry: OwnName): KnownName {
  return { index: entry.index, value: entry.value, sequence: BigInt(entry.sequence) }
}

function toEntry(index: number, record: NameRecord): OwnName {
  return {
    index,
    name: record.name,
    value: record.value,
    sequence: record.sequence.toString(),
    updatedAt: Date.now(),
  }
}

/** Под Tor имена не публикуются: окно про Tor уже показано, тост не нужен. */
export class BlockedByTorError extends Error {
  constructor() {
    super('IPNS publishing is off while Tor is on')
    this.name = 'BlockedByTorError'
  }
}

/** Под Tor запрос ушёл бы мимо Tor: показываем окно про Tor и не публикуем. */
function refuseUnderTor(): void {
  if (!torEnabled()) return
  useIpfsStore().showTorBlocked()
  throw new BlockedByTorError()
}

function torEnabled(): boolean {
  try {
    return useTorStore().enabled
  } catch {
    return false
  }
}

export const useIpnsNamesStore = defineStore('ipns-names', {
  state: () => ({
    account: '',
    names: [] as OwnName[],
    renewedAt: 0,
    /** Идёт перебор номеров или переиздание. */
    syncing: false,
  }),

  actions: {
    /** Список имён аккаунта с устройства — без сети. */
    use(account: string): void {
      if (this.account === account) return
      const saved = account ? readSaved(account) : { names: [], renewedAt: 0 }
      this.account = account
      this.names = saved.names
      this.renewedAt = saved.renewedAt
    },

    _save(): void {
      if (!this.account) return
      const names = [...this.names].sort((a, b) => a.index - b.index)
      this.names = names
      writeSaved(this.account, { names, renewedAt: this.renewedAt })
    },

    _remember(entry: OwnName): void {
      this.names = [...this.names.filter((n) => n.index !== entry.index), entry]
      this._save()
    },

    /** Ключ аккаунта, чьи имена открыты; аккаунт сменился или ключ закрыт — null. */
    _accountKey(): Uint8Array | null {
      const auth = useAuthStore()
      const pair = auth.getKeyPair
      if (!pair || auth.getUserAddress !== this.account) return null
      return new Uint8Array(pair.privateKey)
    },

    /** Запись — в delegated routing; с запущенной нодой — ещё и в DHT своим Kubo, фоном. */
    async _publish(record: NameRecord): Promise<void> {
      const { putRecord } = await loadNames()
      await putRecord(record)
      const ipfs = useIpfsStore()
      if (ipfs.available && ipfs.status === 'running') {
        const { invoke } = await import('@tauri-apps/api/core')
        let binary = ''
        for (const byte of record.bytes) binary += String.fromCharCode(byte)
        invoke('ipfs_name_put', { name: record.name, record: btoa(binary) }).catch((e: unknown) =>
          console.warn('[ipns] kubo routing put failed:', e)
        )
      }
    },

    /**
     * Сверка с сетью для «Моих файлов»: у своих имён — свежие значения (имя
     * могли перевести с другого устройства), за последним номером — имена,
     * созданные на других устройствах. Перебор останавливается на первом
     * номере, которого в сети нет.
     */
    async sync(): Promise<void> {
      const accountKey = this._accountKey()
      if (!accountKey || torEnabled() || this.syncing) return
      this.syncing = true
      try {
        const { nameKey, fetchRecord } = await loadNames()
        for (const entry of [...this.names]) {
          const record = await fetchRecord(entry.name).catch(() => null)
          if (record && record.sequence > BigInt(entry.sequence)) {
            this._remember(toEntry(entry.index, record))
          }
        }
        let index = this.names.reduce((max, n) => Math.max(max, n.index + 1), 0)
        for (const limit = index + PROBE_LIMIT; index < limit; index++) {
          const name = nameKey(accountKey, index).publicKey.toName()
          const record = await fetchRecord(name)
          if (!record) break
          this._remember(toEntry(index, record))
        }
      } finally {
        this.syncing = false
      }
    },

    /**
     * Новая постоянная ссылка на `value`. Номер — первый свободный: занятые
     * (имя создано на другом устройстве) попадают в список по пути.
     */
    async create(value: string): Promise<OwnName> {
      const accountKey = this._accountKey()
      if (!accountKey) throw new Error('account key is locked')
      refuseUnderTor()
      const { nameKey, fetchRecord, signRecord } = await loadNames()
      let index = this.names.reduce((max, n) => Math.max(max, n.index + 1), 0)
      for (;;) {
        const key = nameKey(accountKey, index)
        const taken = await fetchRecord(key.publicKey.toName())
        if (taken) {
          this._remember(toEntry(index, taken))
          index++
          continue
        }
        const record = await signRecord(key, value, 1n)
        await this._publish(record)
        const entry = toEntry(index, record)
        this._remember(entry)
        return entry
      }
    },

    /** «Обновить на новую версию»: имя ведёт на `value`, ссылка та же. */
    async point(index: number, value: string): Promise<OwnName> {
      const accountKey = this._accountKey()
      const entry = this.names.find((n) => n.index === index)
      if (!accountKey || !entry) throw new Error('unknown name')
      refuseUnderTor()
      const { nameKey, fetchRecord, signRecord } = await loadNames()
      const key = nameKey(accountKey, index)
      // Номер — больше, чем у записи в сети: её могли обновить с другого устройства.
      const network = await fetchRecord(entry.name)
      const last =
        network && network.sequence > BigInt(entry.sequence)
          ? network.sequence
          : BigInt(entry.sequence)
      const record = await signRecord(key, value, last + 1n)
      await this._publish(record)
      const updated = toEntry(index, record)
      this._remember(updated)
      return updated
    },

    /**
     * Держать свои имена живыми: при запуске и раз в RENEW_EVERY_MS. Свежая
     * запись из сети переиздаётся как есть, старая — с новой подписью. Имя,
     * которое не удалось проверить в сети, ждёт следующего раза: подписать
     * своё значение вслепую значило бы откатить перевод с другого устройства.
     */
    async renew(now = Date.now()): Promise<void> {
      const accountKey = this._accountKey()
      if (!accountKey || !this.names.length || torEnabled() || this.syncing) return
      if (now - this.renewedAt < RENEW_EVERY_MS) return
      this.syncing = true
      try {
        const { nameKey, getRecordBytes, parseRecord, renewal } = await loadNames()
        let failed = false
        for (const entry of [...this.names]) {
          try {
            const bytes = await getRecordBytes(entry.name)
            const network = bytes ? await parseRecord(entry.name, bytes).catch(() => null) : null
            const record = await renewal(
              nameKey(accountKey, entry.index),
              known(entry),
              network,
              now
            )
            if (!record) continue
            await this._publish(record)
            this._remember(toEntry(entry.index, record))
          } catch (e) {
            failed = true
            console.warn('[ipns] renew failed:', entry.name, e)
          }
        }
        // Не вышло — повторим при следующей проверке, а не через 12 часов.
        if (!failed) this.renewedAt = now
        this._save()
      } finally {
        this.syncing = false
      }
    },
  },
})
