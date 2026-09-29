/**
 * Mesh-маршруты к собеседникам Bastyon: проверенные записи связки (binding.ts)
 * «адрес Bastyon → адрес в mesh-сети» — Reticulum (LXMF), MeshCore или
 * Meshtastic, у человека может быть по одному в каждой. По маршруту обычный
 * диалог с ним продолжается через mesh-сеть, когда сервер чатов недоступен.
 *
 * Маршрут узнаётся двумя путями:
 * - из чата Bastyon: собеседник поделился адресами (записи в зашифрованном
 *   теле сообщения);
 * - из самого сообщения LXMF: к первому сообщению в запуске приложение
 *   прикладывает свою запись Reticulum (поля FIELD_CUSTOM_* — другие клиенты
 *   их не видят). Так маршрут появляется, даже если чат Bastyon уже недоступен.
 *
 * Узнанный маршрут сразу учит сеть: Reticulum — ключу собеседника, радио —
 * его контакту (MeshCore) или ключу для ЛС (Meshtastic): без этого радио
 * собеседнику не напишет и его ЛС не расшифрует.
 *
 * Маршруты — на аккаунт, в localStorage; чистятся при выходе и удалении
 * аккаунта (storage-manager).
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useAuthStore } from '@/blockchain'
import { MESH_ROUTES_PREFIX } from '@/blockchain/constants/storage'
import {
  signBinding,
  signMeshCoreBinding,
  signMeshtasticBinding,
  verifyBinding,
  type AccountKeys,
  type MeshBinding,
  type MeshNet,
} from '../binding'
import { ADV_TYPE, OUT_PATH_UNKNOWN } from '../meshcore/constants'
import { deriveRnsIdentity } from '../reticulum/identity'
import { rnsLearn, type RnsCustom } from '../reticulum/rns-api'
import { useMeshConnectionStore } from './mesh-connection-store'
import { useMeshtasticConnectionStore } from './meshtastic-connection-store'
import { useReticulumStore } from './reticulum-store'

/** Тип данных приложения в сообщении LXMF, которым едет запись связки. */
export const BINDING_KIND = 'bastyon.binding/1'

/** В каком порядке пробовать маршруты: Reticulum шифрует сквозным образом. */
export const ROUTE_ORDER: MeshNet[] = ['lxmf', 'meshcore', 'meshtastic']

export interface MeshRoute {
  /** Адрес Bastyon собеседника. */
  contact: string
  binding: MeshBinding
  /** Откуда узнали: из чата Bastyon или из сообщения LXMF. */
  via: 'matrix' | 'lxmf'
  /** Имя собеседника — для контакта на радио (не подписано, только для вида). */
  name?: string
  /** Когда запомнили, мс. */
  learnedAt: number
}

type Routes = Record<string, Partial<Record<MeshNet, MeshRoute>>>

interface Stored {
  v: 2
  routes: Routes
  /** Кому свои адреса уже отправлены в чат Bastyon. */
  sharedWith: string[]
}

function storageKey(account: string): string {
  return `${MESH_ROUTES_PREFIX}${account}`
}

function toBytes(key: unknown): Uint8Array | null {
  if (key instanceof Uint8Array) return new Uint8Array(key)
  return null
}

/** Имя для контакта на радио: MeshCore — до 31 байта, Meshtastic — длинное имя. */
function radioName(route: MeshRoute): string {
  const base = route.name?.trim() || `Bastyon ${route.contact.slice(0, 8)}`
  let out = ''
  for (const ch of base) {
    if (new TextEncoder().encode(out + ch).length > 31) break
    out += ch
  }
  return out
}

export const useMeshRoutesStore = defineStore('mesh-routes', () => {
  const routes = ref<Routes>({})
  const sharedWith = ref<string[]>([])
  let account: string | null = null
  /** Своя запись Reticulum — подписывается один раз за запуск. */
  let ownLxmf: Promise<MeshBinding | null> | null = null
  /** Своя запись MeshCore — на радио (его ключ), подписывает само радио. */
  let ownMeshCore: { key: string; binding: Promise<MeshBinding | null> } | null = null
  /** Кому в этом запуске своя запись уже ушла в сообщении LXMF. */
  const sentOverLxmf = new Set<string>()

  function ensureLoaded(): void {
    const current = useAuthStore().address ?? null
    if (current === account) return
    account = current
    ownLxmf = null
    ownMeshCore = null
    sentOverLxmf.clear()
    routes.value = {}
    sharedWith.value = []
    if (!current) return
    try {
      const raw = localStorage.getItem(storageKey(current))
      if (!raw) return
      const stored = JSON.parse(raw) as { v?: number; routes?: unknown; sharedWith?: unknown }
      // v1 — одна запись LXMF на человека; v2 — по записи на сеть.
      const lists: unknown[] =
        stored.v === 2
          ? Object.values((stored.routes ?? {}) as Routes).flatMap((r) => Object.values(r ?? {}))
          : Object.values((stored.routes ?? {}) as Record<string, MeshRoute>)
      // Каждая запись перепроверяется: localStorage мог поправить кто угодно.
      for (const item of lists) {
        const r = item as Partial<MeshRoute> | null
        const binding = verifyBinding(r?.binding)
        if (!r || !binding || binding.bastyon !== r.contact) continue
        routes.value[r.contact] = {
          ...routes.value[r.contact],
          [binding.net]: { ...(r as MeshRoute), binding },
        }
      }
      sharedWith.value = Array.isArray(stored.sharedWith) ? (stored.sharedWith as string[]) : []
    } catch {
      /* испорченная запись — маршрутов нет */
    }
  }

  function save(): void {
    if (!account) return
    try {
      const stored: Stored = { v: 2, routes: routes.value, sharedWith: sharedWith.value }
      localStorage.setItem(storageKey(account), JSON.stringify(stored))
    } catch {
      /* нет localStorage — маршруты на этот запуск */
    }
  }

  /** Маршруты к человеку — в порядке, в котором их пробовать. */
  function routesFor(contact: string | null | undefined): MeshRoute[] {
    ensureLoaded()
    const own = contact ? routes.value[contact] : undefined
    return own ? ROUTE_ORDER.flatMap((net) => (own[net] ? [own[net]!] : [])) : []
  }

  function routeFor(contact: string | null | undefined, net: MeshNet = 'lxmf'): MeshRoute | null {
    ensureLoaded()
    return (contact && routes.value[contact]?.[net]) || null
  }

  function contactForDest(dest: string, net: MeshNet = 'lxmf'): string | null {
    ensureLoaded()
    const d = dest.toLowerCase()
    for (const [contact, byNet] of Object.entries(routes.value)) {
      if (byNet[net]?.binding.dest === d) return contact
    }
    return null
  }

  /**
   * Научить сеть маршруту: узел Reticulum — ключу собеседника; MeshCore —
   * контакту на радио; Meshtastic — ключу узла для ЛС. Без сети — позже
   * (teachRadios при подключении).
   */
  function teach(route: MeshRoute): void {
    const b = route.binding
    if (b.net === 'lxmf') {
      if (useReticulumStore().status !== 'running') return
      void rnsLearn(b.dest, b.key).catch(() => {})
      return
    }
    if (b.net === 'meshcore') {
      const session = useMeshConnectionStore().session
      if (!session || session.contacts.has(b.dest)) return
      void session
        .addContact({
          publicKey: b.dest,
          type: ADV_TYPE.CHAT,
          flags: 0,
          outPathLen: OUT_PATH_UNKNOWN,
          name: radioName(route),
          lastAdvert: 0,
          lat: null,
          lon: null,
          lastMod: 0,
        })
        .catch(() => {})
      return
    }
    const mt = useMeshtasticConnectionStore().session
    const num = parseInt(b.dest, 16) >>> 0
    if (!mt || mt.node(num)?.user?.publicKey) return
    void mt.addContact(num, { publicKey: b.key, longName: radioName(route) }).catch(() => {})
  }

  /**
   * Запомнить маршруты из записей связки (одна или список), если они
   * подлинные. `expect` — чьи они должны быть: собеседник чата Bastyon или
   * отправитель сообщения LXMF. Из двух записей одной сети верна новее.
   */
  function learn(
    raw: unknown,
    via: MeshRoute['via'],
    expect: { contact?: string; net?: MeshNet; dest?: string; name?: string } = {}
  ): MeshRoute[] {
    ensureLoaded()
    const learnt: MeshRoute[] = []
    for (const item of Array.isArray(raw) ? raw.slice(0, ROUTE_ORDER.length) : [raw]) {
      const binding = verifyBinding(item)
      if (!binding || !account || binding.bastyon === account) continue
      if (expect.contact && binding.bastyon !== expect.contact) continue
      if (expect.net && binding.net !== expect.net) continue
      if (expect.dest && binding.dest !== expect.dest.toLowerCase()) continue
      const known = routes.value[binding.bastyon]?.[binding.net]
      if (known && known.binding.ts >= binding.ts) {
        learnt.push(known)
        continue
      }
      const route: MeshRoute = {
        contact: binding.bastyon,
        binding,
        via,
        name: expect.name ?? known?.name,
        learnedAt: Date.now(),
      }
      routes.value = {
        ...routes.value,
        [binding.bastyon]: { ...routes.value[binding.bastyon], [binding.net]: route },
      }
      learnt.push(route)
      teach(route)
    }
    if (learnt.length > 0) save()
    return learnt
  }

  /** После запуска узла Reticulum — все известные ключи собеседников. */
  function teachNode(): void {
    ensureLoaded()
    for (const byNet of Object.values(routes.value)) if (byNet.lxmf) teach(byNet.lxmf)
  }

  /** Радио подключилось — контакты и ключи собеседников по маршрутам. */
  function teachRadios(): void {
    ensureLoaded()
    for (const byNet of Object.values(routes.value)) {
      if (byNet.meshcore) teach(byNet.meshcore)
      if (byNet.meshtastic) teach(byNet.meshtastic)
    }
  }

  function accountKeys(): AccountKeys | null {
    const auth = useAuthStore()
    const privateKey = toBytes(auth.keyPair?.privateKey)
    const publicKey = toBytes(auth.keyPair?.publicKey)
    if (!auth.address || !privateKey || privateKey.length !== 32 || !publicKey) return null
    return { address: auth.address, privateKey, publicKey }
  }

  /** Своя запись Reticulum (identity выведена из ключа аккаунта). */
  function ownBinding(): Promise<MeshBinding | null> {
    ensureLoaded()
    ownLxmf ??= (async () => {
      const keys = accountKeys()
      if (!keys) return null
      return signBinding({ ...keys, identity: await deriveRnsIdentity(keys.privateKey) })
    })().catch(() => null)
    return ownLxmf
  }

  /**
   * Свои записи для чата Bastyon: Reticulum — если узел запущен; MeshCore и
   * Meshtastic — если радио подключено (MeshCore ещё и подписывает её сам).
   */
  async function ownBindings(): Promise<MeshBinding[]> {
    ensureLoaded()
    const keys = accountKeys()
    if (!keys) return []
    const out: MeshBinding[] = []
    if (useReticulumStore().status === 'running') {
      const lxmf = await ownBinding()
      if (lxmf) out.push(lxmf)
    }
    const mc = useMeshConnectionStore()
    const session = mc.session
    if (mc.status === 'connected' && session) {
      const key = session.self.publicKey
      if (ownMeshCore?.key !== key) {
        ownMeshCore = {
          key,
          binding: signMeshCoreBinding(keys, key, (text) => session.sign(text)).catch(() => null),
        }
      }
      const b = await ownMeshCore.binding
      if (b) out.push(b)
    }
    const mt = useMeshtasticConnectionStore()
    if (mt.status === 'connected' && mt.self?.publicKey) {
      out.push(signMeshtasticBinding(keys, mt.self.nodeNum, mt.self.publicKey))
    }
    return out
  }

  /**
   * Своя запись Reticulum для сообщения LXMF собеседнику по маршруту: к
   * первому в этом запуске — так он узнает маршрут, даже если чат Bastyon
   * недоступен.
   */
  async function customFor(dest: string): Promise<RnsCustom | undefined> {
    if (!contactForDest(dest, 'lxmf') || sentOverLxmf.has(dest)) return undefined
    const binding = await ownBinding()
    if (!binding) return undefined
    sentOverLxmf.add(dest)
    return { kind: BINDING_KIND, data: JSON.stringify(binding) }
  }

  /** Свои адреса ушли собеседнику в чат Bastyon. */
  function markShared(contact: string): void {
    ensureLoaded()
    if (sharedWith.value.includes(contact)) return
    sharedWith.value = [...sharedWith.value, contact]
    save()
  }

  function hasShared(contact: string): boolean {
    ensureLoaded()
    return sharedWith.value.includes(contact)
  }

  /** Смена аккаунта или выход. */
  function reset(): void {
    account = null
    ownLxmf = null
    ownMeshCore = null
    sentOverLxmf.clear()
    routes.value = {}
    sharedWith.value = []
  }

  return {
    routes,
    ensureLoaded,
    routesFor,
    routeFor,
    contactForDest,
    learn,
    teachNode,
    teachRadios,
    ownBinding,
    ownBindings,
    customFor,
    markShared,
    hasShared,
    reset,
  }
})
