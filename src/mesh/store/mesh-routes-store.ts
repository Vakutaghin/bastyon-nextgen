/**
 * Mesh-маршруты к собеседникам Bastyon: проверенные записи связки (binding.ts)
 * «адрес Bastyon → адрес LXMF». По маршруту обычный диалог с человеком
 * продолжается через Reticulum, когда сервер чатов недоступен.
 *
 * Маршрут узнаётся двумя путями:
 * - из чата Bastyon: собеседник поделился адресом Reticulum (запись в
 *   зашифрованном теле сообщения);
 * - из самого сообщения LXMF: к первому сообщению в запуске приложение
 *   прикладывает свою запись (поля FIELD_CUSTOM_* — другие клиенты их не
 *   видят). Так маршрут появляется, даже если чат Bastyon уже недоступен.
 *
 * Маршруты — на аккаунт, в localStorage; чистятся при выходе и удалении
 * аккаунта (storage-manager).
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useAuthStore } from '@/blockchain'
import { MESH_ROUTES_PREFIX } from '@/blockchain/constants/storage'
import { signBinding, verifyBinding, type MeshBinding } from '../binding'
import { deriveRnsIdentity } from '../reticulum/identity'
import { rnsLearn, type RnsCustom } from '../reticulum/rns-api'
import { useReticulumStore } from './reticulum-store'

/** Тип данных приложения в сообщении LXMF, которым едет запись связки. */
export const BINDING_KIND = 'bastyon.binding/1'

export interface MeshRoute {
  /** Адрес Bastyon собеседника. */
  contact: string
  binding: MeshBinding
  /** Откуда узнали: из чата Bastyon или из сообщения LXMF. */
  via: 'matrix' | 'lxmf'
  /** Когда запомнили, мс. */
  learnedAt: number
}

interface Stored {
  v: 1
  routes: Record<string, MeshRoute>
  /** Кому своя запись уже отправлена в чат Bastyon. */
  sharedWith: string[]
}

function storageKey(account: string): string {
  return `${MESH_ROUTES_PREFIX}${account}`
}

function toBytes(key: unknown): Uint8Array | null {
  if (key instanceof Uint8Array) return new Uint8Array(key)
  return null
}

export const useMeshRoutesStore = defineStore('mesh-routes', () => {
  const routes = ref<Record<string, MeshRoute>>({})
  const sharedWith = ref<string[]>([])
  let account: string | null = null
  /** Своя запись связки — подписывается один раз за запуск. */
  let own: Promise<MeshBinding | null> | null = null
  /** Кому в этом запуске своя запись уже ушла в сообщении LXMF. */
  const sentOverLxmf = new Set<string>()

  function ensureLoaded(): void {
    const current = useAuthStore().address ?? null
    if (current === account) return
    account = current
    own = null
    sentOverLxmf.clear()
    routes.value = {}
    sharedWith.value = []
    if (!current) return
    try {
      const raw = localStorage.getItem(storageKey(current))
      if (!raw) return
      const stored = JSON.parse(raw) as Partial<Stored>
      // Каждая запись перепроверяется: localStorage мог поправить кто угодно.
      for (const r of Object.values(stored.routes ?? {})) {
        const binding = verifyBinding(r?.binding)
        if (binding && binding.bastyon === r.contact) {
          routes.value[r.contact] = { ...r, binding }
        }
      }
      sharedWith.value = Array.isArray(stored.sharedWith) ? stored.sharedWith : []
    } catch {
      /* испорченная запись — маршрутов нет */
    }
  }

  function save(): void {
    if (!account) return
    try {
      const stored: Stored = { v: 1, routes: routes.value, sharedWith: sharedWith.value }
      localStorage.setItem(storageKey(account), JSON.stringify(stored))
    } catch {
      /* нет localStorage — маршруты на этот запуск */
    }
  }

  function routeFor(contact: string | null | undefined): MeshRoute | null {
    ensureLoaded()
    return contact ? (routes.value[contact] ?? null) : null
  }

  function contactForDest(dest: string): string | null {
    ensureLoaded()
    const d = dest.toLowerCase()
    return Object.values(routes.value).find((r) => r.binding.dest === d)?.contact ?? null
  }

  /** Научить узел Reticulum ключу адресата: писать можно до его announce. */
  function teach(route: MeshRoute): void {
    if (useReticulumStore().status !== 'running') return
    void rnsLearn(route.binding.dest, route.binding.key).catch(() => {})
  }

  /**
   * Запомнить маршрут из записи связки, если она подлинная. `expect` — чья она
   * должна быть: собеседник чата Bastyon или отправитель сообщения LXMF.
   * Из двух записей одного человека верна более новая.
   */
  function learn(
    raw: unknown,
    via: MeshRoute['via'],
    expect: { contact?: string; dest?: string } = {}
  ): MeshRoute | null {
    ensureLoaded()
    const binding = verifyBinding(raw)
    if (!binding || !account || binding.bastyon === account) return null
    if (expect.contact && binding.bastyon !== expect.contact) return null
    if (expect.dest && binding.dest !== expect.dest.toLowerCase()) return null
    const known = routes.value[binding.bastyon]
    if (known && known.binding.ts >= binding.ts) return known
    const route: MeshRoute = { contact: binding.bastyon, binding, via, learnedAt: Date.now() }
    routes.value = { ...routes.value, [binding.bastyon]: route }
    save()
    teach(route)
    return route
  }

  /** После запуска узла — все известные ключи собеседников. */
  function teachNode(): void {
    ensureLoaded()
    for (const route of Object.values(routes.value)) teach(route)
  }

  /** Своя запись связки (ключ аккаунта и выведенный из него Reticulum). */
  function ownBinding(): Promise<MeshBinding | null> {
    ensureLoaded()
    own ??= (async () => {
      const auth = useAuthStore()
      const privateKey = toBytes(auth.keyPair?.privateKey)
      const publicKey = toBytes(auth.keyPair?.publicKey)
      if (!auth.address || !privateKey || privateKey.length !== 32 || !publicKey) return null
      return signBinding({
        address: auth.address,
        privateKey,
        publicKey,
        identity: await deriveRnsIdentity(privateKey),
      })
    })().catch(() => null)
    return own
  }

  /**
   * Своя запись для сообщения LXMF собеседнику по маршруту: к первому в этом
   * запуске — так он узнает маршрут, даже если чат Bastyon недоступен.
   */
  async function customFor(dest: string): Promise<RnsCustom | undefined> {
    if (!contactForDest(dest) || sentOverLxmf.has(dest)) return undefined
    const binding = await ownBinding()
    if (!binding) return undefined
    sentOverLxmf.add(dest)
    return { kind: BINDING_KIND, data: JSON.stringify(binding) }
  }

  /** Своя запись связки ушла собеседнику в чат Bastyon. */
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
    own = null
    sentOverLxmf.clear()
    routes.value = {}
    sharedWith.value = []
  }

  return {
    routes,
    ensureLoaded,
    routeFor,
    contactForDest,
    learn,
    teachNode,
    ownBinding,
    customFor,
    markShared,
    hasShared,
    reset,
  }
})
