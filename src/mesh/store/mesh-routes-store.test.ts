// Mesh-маршруты к собеседникам: только подлинные записи связки, того, чья она
// должна быть, по одной на сеть (новее — вместо старой); узнанный маршрут
// учит сеть (узел Reticulum, контакт MeshCore, ключ Meshtastic); хранятся на
// аккаунт и перепроверяются при чтении; свои записи — по подключённым сетям.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { Buffer } from 'buffer'
import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex } from '@noble/hashes/utils'

const h = vi.hoisted(() => ({
  auth: {
    address: null as string | null,
    keyPair: null as null | { privateKey: Uint8Array; publicKey: Uint8Array },
  },
  rns: { status: 'running' as string },
  learn: vi.fn(async (_dest: string, _key: string) => {}),
  mc: {
    status: 'idle' as string,
    session: null as null | {
      self: { publicKey: string }
      contacts: Map<string, unknown>
      addContact: ReturnType<typeof vi.fn>
      sign: (data: Uint8Array) => Promise<Uint8Array | null>
    },
  },
  mt: {
    status: 'idle' as string,
    self: null as null | { nodeNum: number; publicKey: string | null },
    session: null as null | {
      node: (num: number) => { user?: { publicKey?: unknown } } | undefined
      addContact: ReturnType<typeof vi.fn>
    },
  },
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('./reticulum-store', () => ({ useReticulumStore: () => h.rns }))
vi.mock('./mesh-connection-store', () => ({ useMeshConnectionStore: () => h.mc }))
vi.mock('./meshtastic-connection-store', () => ({ useMeshtasticConnectionStore: () => h.mt }))
vi.mock('../reticulum/rns-api', () => ({ rnsLearn: h.learn }))

import { generatePocketnetAddress } from '@/blockchain/core/addresses/address-generator'
import { signBinding, signMeshCoreBinding, signMeshtasticBinding, verifyBinding } from '../binding'
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
  h.mc.status = 'idle'
  h.mc.session = null
  h.mt.status = 'idle'
  h.mt.self = null
  h.mt.session = null
})

describe('mesh routes', () => {
  it('keeps a genuine binding of the expected person and teaches the node', () => {
    const routes = useMeshRoutesStore()
    const b = signBinding(bob, 100)
    // Запись Боба, пришедшая «от Кэрол», — не маршрут к Кэрол.
    expect(routes.learn(b, 'matrix', { contact: carol.address })).toEqual([])
    expect(routes.learn({ ...b, dest: signBinding(carol).dest }, 'matrix')).toEqual([])
    const [route] = routes.learn(b, 'matrix', { contact: bob.address, name: 'Боб' })
    expect(route).toMatchObject({ contact: bob.address, via: 'matrix', name: 'Боб' })
    expect(routes.routeFor(bob.address)?.binding.dest).toBe(b.dest)
    expect(routes.contactForDest(b.dest)).toBe(bob.address)
    expect(h.learn).toHaveBeenCalledWith(b.dest, b.key)
    // Своя запись — не маршрут.
    expect(routes.learn(signBinding(alice), 'matrix')).toEqual([])
  })

  it('keeps one route per network, the newer one, in the order to try them', async () => {
    const routes = useMeshRoutesStore()
    const radio = bytesToHex(ed25519.getPublicKey(new Uint8Array(32).fill(5)))
    routes.learn(
      [
        signMeshtasticBinding(bob, 0x11223344, 'ab'.repeat(32), 100),
        await signMeshCoreBinding(bob, radio, null, 100),
        signBinding(bob, 200),
      ],
      'matrix',
      { contact: bob.address }
    )
    expect(routes.routesFor(bob.address).map((r) => r.binding.net)).toEqual([
      'lxmf',
      'meshcore',
      'meshtastic',
    ])
    routes.learn(signBinding(bob, 150), 'lxmf')
    expect(routes.routeFor(bob.address)?.binding.ts).toBe(200)
    routes.learn(signMeshtasticBinding(bob, 0x55667788, 'cd'.repeat(32), 300), 'matrix')
    expect(routes.routeFor(bob.address, 'meshtastic')?.binding.dest).toBe('55667788')
  })

  it('puts a radio route on the connected radio: a MeshCore contact, a Meshtastic key', async () => {
    const routes = useMeshRoutesStore()
    const radio = bytesToHex(ed25519.getPublicKey(new Uint8Array(32).fill(7)))
    h.mc.session = {
      self: { publicKey: 'ee'.repeat(32) },
      contacts: new Map(),
      addContact: vi.fn(async () => {}),
      sign: async () => null,
    }
    h.mt.session = { node: () => undefined, addContact: vi.fn(async () => {}) }
    routes.learn(
      [
        await signMeshCoreBinding(bob, radio, null),
        signMeshtasticBinding(bob, 0x0a0b0c0d, 'ab'.repeat(32)),
      ],
      'matrix',
      { contact: bob.address, name: 'Боб Бобович Бобов из Бобруйска' }
    )
    expect(h.mc.session.addContact).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: radio, type: 1, name: 'Боб Бобович Бобо' })
    )
    expect(h.mt.session.addContact).toHaveBeenCalledWith(0x0a0b0c0d, {
      publicKey: 'ab'.repeat(32),
      longName: 'Боб Бобович Бобо',
    })
    // Контакт уже на радио — второй раз не добавляется.
    h.mc.session.contacts.set(radio, {})
    routes.teachRadios()
    expect(h.mc.session.addContact).toHaveBeenCalledTimes(1)
  })

  it('stores routes per account and checks them again when reading', () => {
    useMeshRoutesStore().learn(signBinding(bob, 100), 'matrix')
    useMeshRoutesStore().markShared(bob.address)
    const key = `BST_MESH_ROUTES_${alice.address}`
    const stored = JSON.parse(localStorage.getItem(key)!)
    expect(stored.v).toBe(2)
    // Подделка в localStorage не проходит перепроверку.
    stored.routes[bob.address].lxmf.binding.dest = signBinding(carol).dest
    localStorage.setItem(key, JSON.stringify(stored))

    setActivePinia(createPinia())
    const again = useMeshRoutesStore()
    expect(again.routeFor(bob.address)).toBeNull()
    expect(again.hasShared(bob.address)).toBe(true)

    // Другой аккаунт маршрутов Алисы не видит.
    h.auth.address = carol.address
    expect(again.hasShared(bob.address)).toBe(false)
  })

  it('shares own bindings for the networks that are up, the radio signing its own', async () => {
    const routes = useMeshRoutesStore()
    h.rns.status = 'idle'
    expect(await routes.ownBindings()).toEqual([])

    const seed = new Uint8Array(32).fill(9)
    h.rns.status = 'running'
    h.mc.status = 'connected'
    h.mc.session = {
      self: { publicKey: bytesToHex(ed25519.getPublicKey(seed)) },
      contacts: new Map(),
      addContact: vi.fn(),
      sign: async (data) => ed25519.sign(data, seed),
    }
    h.mt.status = 'connected'
    h.mt.self = { nodeNum: 0xdeadbeef, publicKey: 'ab'.repeat(32) }
    const own = await routes.ownBindings()
    expect(own.map((b) => b.net)).toEqual(['lxmf', 'meshcore', 'meshtastic'])
    expect(own.every((b) => verifyBinding(b) !== null)).toBe(true)
    expect(own[1]!.rsig).toBeDefined()
    expect(own[2]).toMatchObject({ dest: 'deadbeef', bastyon: alice.address })
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
