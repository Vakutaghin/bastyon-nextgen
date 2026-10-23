// Каналы в мессенджере (lib/channels.ts): какие авторы читаются здесь, до
// какого поста прочитано и последние посты для строки в списке.
//
// Список — в данных аккаунта Matrix, общий для устройств; локальная копия
// (`BST_MSG_CHANNELS_<адрес>`) показывает его сразу после запуска и держит
// изменения, пока сервер чатов недоступен.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MESSENGER_CHANNELS_PREFIX } from '@/blockchain/constants/storage'
import { logger } from '@/services/logger'
import type { AdaptedPost } from '@/types/adapted-post'

import { matrixService } from '../services/matrix-service'
import { fetchChannelPage } from '../lib/channel-feed'
import {
  CHANNELS_ACCOUNT_DATA,
  channelAddresses,
  channelPostPreview,
  countNewPosts,
  emptyChannelsDoc,
  mergeChannelsDoc,
  parseChannelsDoc,
  postTime,
  sameChannelsDoc,
  type ChannelPostPreview,
  type ChannelsDoc,
} from '../lib/channels'

const log = logger.scope('[MessengerChannels]')

/** Сколько последних постов смотреть: столько же — потолок счётчика новых. */
export const CHANNEL_RECENT = 10
/** Чаще списка не опрашиваем ноду: строки обновляются при каждом открытии мессенджера. */
const REFRESH_AFTER = 60_000
const PARALLEL = 3
/** Отметки «прочитано» копятся и уходят на сервер одной записью. */
const PUSH_DELAY = 1500

/** Строка канала в списке: последний пост и время недавних — для счётчика новых. */
export interface ChannelSummary {
  last?: ChannelPostPreview
  recent: number[]
  /** Имя и аватар автора из ленты — пока профиль не пришёл в кэш мессенджера. */
  name?: string
  avatar?: string | null
  checkedAt: number
}

interface Stored {
  doc: ChannelsDoc
  summaries: Record<string, ChannelSummary>
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function readStored(owner: string): Stored {
  const empty: Stored = { doc: emptyChannelsDoc(), summaries: {} }
  try {
    const raw = storage()?.getItem(`${MESSENGER_CHANNELS_PREFIX}${owner}`)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Stored>
    const summaries =
      parsed.summaries && typeof parsed.summaries === 'object' ? parsed.summaries : {}
    return { doc: parseChannelsDoc(parsed.doc), summaries }
  } catch {
    return empty
  }
}

export const useMessengerChannelsStore = defineStore('messenger-channels', () => {
  /** Чей список: адрес вошедшего аккаунта. */
  const owner = ref<string | null>(null)
  const doc = ref<ChannelsDoc>(emptyChannelsDoc())
  const summaries = ref<Record<string, ChannelSummary>>({})
  /** Каналы, чьи последние посты сейчас запрашиваются. */
  const refreshing = new Set<string>()

  /** Включённые каналы, недавно добавленные первыми. */
  const addresses = computed<string[]>(() => channelAddresses(doc.value))

  const isOn = (address: string): boolean => !!doc.value.items[address]?.on

  const seenOf = (address: string): number | undefined => doc.value.items[address]?.seen

  const newCount = (address: string): number =>
    countNewPosts(summaries.value[address]?.recent ?? [], seenOf(address))

  /** Сколько каналов с непрочитанными постами — для чипа «Каналы». */
  const withNew = computed<number>(() => addresses.value.filter((a) => newCount(a) > 0).length)

  function persist(): void {
    if (!owner.value) return
    try {
      const data: Stored = { doc: doc.value, summaries: summaries.value }
      storage()?.setItem(`${MESSENGER_CHANNELS_PREFIX}${owner.value}`, JSON.stringify(data))
    } catch {
      /* переполнение — останется в памяти до следующего раза */
    }
  }

  // --- Сервер чатов ---

  /** Локальные изменения, которых ещё нет на сервере. */
  let dirty = false
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  async function pushNow(): Promise<void> {
    pushTimer = null
    if (!dirty || !matrixService.getClient()) return
    dirty = false
    try {
      await matrixService.setAccountData(CHANNELS_ACCOUNT_DATA, { ...doc.value })
    } catch (e) {
      log.warn('channels not saved to server', e)
      dirty = true
    }
  }

  function schedulePush(): void {
    dirty = true
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => void pushNow(), PUSH_DELAY)
  }

  /** Копия с сервера (первый синк или изменение с другого устройства). */
  function applyRemote(content: unknown): void {
    if (!owner.value) return
    const remote = parseChannelsDoc(content)
    const merged = mergeChannelsDoc(doc.value, remote)
    if (!sameChannelsDoc(merged, doc.value)) {
      const before = new Set(addresses.value)
      doc.value = merged
      persist()
      const added = addresses.value.filter((a) => !before.has(a))
      if (added.length) void refresh(added)
    }
    if (!sameChannelsDoc(merged, remote)) schedulePush()
  }

  /** Первый синк прошёл: забрать серверную копию и отдать свою, если в ней новее. */
  function syncWithServer(): void {
    applyRemote(matrixService.getAccountData(CHANNELS_ACCOUNT_DATA))
    if (dirty) void pushNow()
  }

  // --- Аккаунт ---

  /** Вошли в аккаунт: его список с прошлого запуска. */
  function attach(address: string): void {
    if (owner.value === address) return
    reset()
    owner.value = address
    const stored = readStored(address)
    doc.value = stored.doc
    summaries.value = stored.summaries
  }

  function reset(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    dirty = false
    owner.value = null
    doc.value = emptyChannelsDoc()
    summaries.value = {}
    refreshing.clear()
  }

  // --- Изменения пользователем ---

  /** «Читать в мессенджере» / «Не читать». Новое после включения — то, что выйдет дальше. */
  function setChannel(address: string, on: boolean): void {
    if (!owner.value || isOn(address) === on) return
    const prev = doc.value.items[address]
    const now = Date.now()
    const seen = on ? Math.max(prev?.seen ?? 0, now) : prev?.seen
    doc.value = {
      v: 1,
      items: { ...doc.value.items, [address]: seen ? { on, t: now, seen } : { on, t: now } },
    }
    persist()
    schedulePush()
    if (on) void refresh([address], { force: true })
  }

  /** Прочитано до поста с этим временем (мс). Назад не двигается. */
  function markSeen(address: string, time: number): void {
    const entry = doc.value.items[address]
    if (!entry || !time || (entry.seen ?? 0) >= time) return
    doc.value = { v: 1, items: { ...doc.value.items, [address]: { ...entry, seen: time } } }
    persist()
    schedulePush()
  }

  /** Канал открыт и прочитан до самого свежего из известных постов. */
  function markAllSeen(address: string): void {
    const recent = summaries.value[address]?.recent ?? []
    markSeen(address, Math.max(0, ...recent))
  }

  // --- Последние посты ---

  /** Свежие посты канала (из ленты канала или запроса списка) — в строку списка. */
  function noteLatest(address: string, posts: AdaptedPost[]): void {
    const sorted = [...posts].sort((a, b) => postTime(b) - postTime(a))
    const head = sorted[0]
    const author = head?.author
    summaries.value = {
      ...summaries.value,
      [address]: {
        ...(head ? { last: channelPostPreview(head) } : {}),
        recent: sorted.slice(0, CHANNEL_RECENT).map(postTime),
        ...(author?.name && author.name !== address ? { name: author.name } : {}),
        ...(author?.avatar ? { avatar: author.avatar } : {}),
        checkedAt: Date.now(),
      },
    }
    persist()
  }

  /** Обновить строки каналов: по умолчанию всех, не чаще раза в минуту на канал. */
  async function refresh(list?: string[], opts: { force?: boolean } = {}): Promise<void> {
    const now = Date.now()
    const queue = (list ?? addresses.value).filter(
      (a) =>
        isOn(a) &&
        !refreshing.has(a) &&
        (opts.force || now - (summaries.value[a]?.checkedAt ?? 0) > REFRESH_AFTER)
    )
    for (const a of queue) refreshing.add(a)
    const worker = async (): Promise<void> => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        const forOwner = owner.value
        try {
          const page = await fetchChannelPage(a, CHANNEL_RECENT)
          if (owner.value === forOwner && isOn(a)) noteLatest(a, page.posts)
        } catch (e) {
          log.debug('channel not refreshed', a, e)
        } finally {
          refreshing.delete(a)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker))
  }

  return {
    owner,
    doc,
    summaries,
    addresses,
    withNew,
    isOn,
    seenOf,
    newCount,
    attach,
    reset,
    applyRemote,
    syncWithServer,
    setChannel,
    markSeen,
    markAllSeen,
    noteLatest,
    refresh,
  }
})
