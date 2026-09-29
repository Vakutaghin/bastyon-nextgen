// Связка аккаунта Bastyon с адресом LXMF: адрес LXMF по ключу — как у Python
// RNS (эталон из Rust-тестов и Python), подписи аккаунта и Reticulum, отказ на
// любую подмену.

import { describe, expect, it } from 'vitest'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { Buffer } from 'buffer'

import { generatePocketnetAddress } from '@/blockchain/core/addresses/address-generator'
import { toHex } from './bytes'
import {
  lxmfAddressOf,
  rnsIdentityHash,
  rnsPublicKey,
  signBinding,
  verifyBinding,
  type MeshBinding,
} from './binding'
import { deriveRnsIdentity } from './reticulum/identity'

const ECPair = ECPairFactory(ecc)

async function account(seed: number) {
  const privateKey = Uint8Array.from({ length: 32 }, (_, i) => i + seed)
  const publicKey = new Uint8Array(ECPair.fromPrivateKey(privateKey).publicKey)
  return {
    address: generatePocketnetAddress(Buffer.from(publicKey)).address,
    privateKey,
    publicKey,
    identity: await deriveRnsIdentity(privateKey),
  }
}

describe('mesh binding', () => {
  it('derives the LXMF address from the Reticulum key as Python RNS does', async () => {
    // Ключ аккаунта 1..32 → identity 9a2c… (identity.test.ts) → эталон Python.
    const key = rnsPublicKey(
      await deriveRnsIdentity(Uint8Array.from({ length: 32 }, (_, i) => i + 1))
    )
    expect(toHex(rnsIdentityHash(key))).toBe('0151a8e9c78317b27ff0a40306b9ef31')
    expect(lxmfAddressOf(key)).toBe('41bb60343d8fc4a961a89b7c666dce77')
  })

  it('signs with both keys and verifies without the network', async () => {
    const alice = await account(1)
    const b = signBinding(alice, 1_790_000_000)
    expect(b).toMatchObject({
      v: 1,
      net: 'lxmf',
      bastyon: alice.address,
      dest: '41bb60343d8fc4a961a89b7c666dce77',
      ts: 1_790_000_000,
    })
    expect(verifyBinding(JSON.parse(JSON.stringify(b)))).toEqual(b)
  })

  it('refuses any substitution', async () => {
    const alice = await account(1)
    const bob = await account(7)
    const good = signBinding(alice, 1_790_000_000)
    const bobs = signBinding(bob, 1_790_000_000)
    const bad: Array<Partial<MeshBinding>> = [
      // Чужой адрес LXMF под своей подписью аккаунта.
      { dest: bobs.dest, key: bobs.key },
      // Свой адрес LXMF, выданный за чужой аккаунт.
      { bastyon: bob.address },
      { bastyon: bob.address, pub: bobs.pub },
      // Подписи от другой записи.
      { sig: bobs.sig },
      { rsig: bobs.rsig },
      { ts: good.ts + 1 },
    ]
    for (const patch of bad) expect(verifyBinding({ ...good, ...patch })).toBeNull()
    for (const junk of [null, 'x', {}, { ...good, v: 2 }, { ...good, sig: 'zz' }]) {
      expect(verifyBinding(junk)).toBeNull()
    }
  })
})
