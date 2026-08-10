import { describe, it, expect } from 'vitest'
import { pickGatewaySource, type TierInput } from './ipfs-tier'

const base: TierInput = {
  available: true,
  running: false,
  hasPort: false,
  consent: 'unknown',
}

describe('pickGatewaySource', () => {
  it('веб (не Tauri) → всегда public', () => {
    expect(pickGatewaySource({ ...base, available: false })).toBe('public')
    // даже при мнимо «поднятой» ноде и согласии в вебе — public
    expect(
      pickGatewaySource({ available: false, running: true, hasPort: true, consent: 'accepted' })
    ).toBe('public')
  })

  it('нода поднята с портом → local (приоритетнее consent)', () => {
    expect(
      pickGatewaySource({ ...base, running: true, hasPort: true, consent: 'unknown' })
    ).toBe('local')
  })

  it('running без порта → не local', () => {
    expect(pickGatewaySource({ ...base, running: true, hasPort: false })).toBe('ask')
  })

  it('отказ пользователя → public', () => {
    expect(pickGatewaySource({ ...base, consent: 'declined' })).toBe('public')
  })

  it('согласие есть, но не запущено → ensure', () => {
    expect(pickGatewaySource({ ...base, consent: 'accepted' })).toBe('ensure')
  })

  it('согласие не спрашивали → ask', () => {
    expect(pickGatewaySource({ ...base, consent: 'unknown' })).toBe('ask')
  })
})
