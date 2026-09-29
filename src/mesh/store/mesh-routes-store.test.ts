// Mesh-маршруты к собеседникам: только подлинные записи связки, того, чья она
// должна быть, новее — вместо старой; хранятся на аккаунт и перепроверяются
// при чтении; своя запись уходит в первом сообщении LXMF собеседнику.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { Buffer } from 'buffer'

const h = vi.hoisted(() => ({
  auth: {
    address: null as string | null,
    keyPair: null as null | { privateKey: Uint8Array; publicKey: Uint8Array },
  },
  rns: { status: 'running' as string },
  learn: vi.fn(async (_dest: string, _key: string) => {}),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('./reticulum-store', () => ({ useReticulumStore: () => h.rns }))
vi.mock('../reticulum/rns-api', () => ({ rnsLearn: h.learn }))

import { generatePocketnetAddress } from '@/blockchain/core/addresses/address-generator'
import { signBinding } from '../binding'
import { deriveRnsIdentity } from '../reticulum/identity'
import { BINDING_KIND, useMeshRoutesStore } from './mesh-routes-store'

const ECPair = ECPairFactory(ecc)

async function person(seed: number) {
  const privateKey = Uint8Array.from({ length: 32 }, (_, i) => i + seed)
  const publicKey = new Uint8Array(ECPair.fromPrivateKey(privateKey).publicKey)
  return {
    address: generatePocketnetAddress(Buffer.from(publicKey)).address,
    privateKey,
    publicKey,
    identity: await deriveRnsIdentity(privateKey),
  }
}

let alice: Awaited<ReturnType<typeof person>>
let bob: Awaited<ReturnType<typeof person>>
let carol: Awaited<ReturnType<typeof person>>

beforeEach(async () => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  alice ??= await person(1)
  bob ??= await person(40)
  carol ??= await person(80)
  h.auth.address = alice.address
  h.auth.keyPair = { privateKey: alice.privateKey, publicKey: alice.publicKey }
  h.rns.status = 'running'
})

describe('mesh routes', () => {
  it('keeps a genuine binding of the expected person and teaches the node', () => {
    const routes = useMeshRoutesStore()
    const b = signBinding(bob, 100)
    // Запись Боба, пришедшая «от Кэрол», — не маршрут к Кэрол.
    expect(routes.learn(b, 'matrix', { contact: carol.address })).toBeNull()
    expect(routes.learn({ ...b, dest: signBinding(carol).dest }, 'matrix')).toBeNull()
    const route = routes.learn(b, 'matrix', { contact: bob.address })!
    expect(route).toMatchObject({ contact: bob.address, via: 'matrix' })
    expect(routes.routeFor(bob.address)?.binding.dest).toBe(b.dest)
    expect(routes.contactForDest(b.dest)).toBe(bob.address)
    expect(h.learn).toHaveBeenCalledWith(b.dest, b.key)
    // Своя запись — не маршрут.
    expect(routes.learn(signBinding(alice), 'matrix')).toBeNull()
  })

  it('takes the newer binding of the same person and keeps the older out', () => {
    const routes = useMeshRoutesStore()
    routes.learn(signBinding(bob, 200), 'lxmf')
    routes.learn(signBinding(bob, 100), 'matrix')
    expect(routes.routeFor(bob.address)?.binding.ts).toBe(200)
    routes.learn(signBinding(bob, 300), 'matrix')
    expect(routes.routeFor(bob.address)).toMatchObject({ via: 'matrix', binding: { ts: 300 } })
  })

  it('stores routes per account and checks them again when reading', () => {
    useMeshRoutesStore().learn(signBinding(bob, 100), 'matrix')
    useMeshRoutesStore().markShared(bob.address)
    const key = `BST_MESH_ROUTES_${alice.address}`
    const stored = JSON.parse(localStorage.getItem(key)!)
    // Подделка в localStorage не проходит перепроверку.
    stored.routes[bob.address].binding.dest = signBinding(carol).dest
    localStorage.setItem(key, JSON.stringify(stored))

    setActivePinia(createPinia())
    const again = useMeshRoutesStore()
    expect(again.routeFor(bob.address)).toBeNull()
    expect(again.hasShared(bob.address)).toBe(true)

    // Другой аккаунт маршрутов Алисы не видит.
    h.auth.address = carol.address
    expect(again.hasShared(bob.address)).toBe(false)
  })

  it('attaches the own binding to the first LXMF message to a routed contact', async () => {
    const routes = useMeshRoutesStore()
    const b = signBinding(bob, 100)
    expect(await routes.customFor(b.dest)).toBeUndefined()
    routes.learn(b, 'matrix')
    const custom = (await routes.customFor(b.dest))!
    expect(custom.kind).toBe(BINDING_KIND)
    expect(JSON.parse(custom.data)).toMatchObject({ bastyon: alice.address })
    expect(await routes.customFor(b.dest)).toBeUndefined()
  })
})
