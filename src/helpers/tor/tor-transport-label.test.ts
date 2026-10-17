import { describe, expect, it } from 'vitest'

import { countryDisplayName, torTransportLabel } from './tor-transport-label'

describe('torTransportLabel', () => {
  it('без мостов подписи нет', () => {
    expect(torTransportLabel(null)).toBeNull()
    expect(torTransportLabel(undefined)).toBeNull()
    expect(torTransportLabel('direct')).toBeNull()
  })

  it('транспорты — названиями Tor Browser', () => {
    expect(torTransportLabel('webtunnel')).toEqual({ kind: 'brand', name: 'WebTunnel' })
    expect(torTransportLabel('snowflake')).toEqual({ kind: 'brand', name: 'Snowflake' })
    expect(torTransportLabel('meek_lite')).toEqual({ kind: 'brand', name: 'meek' })
    expect(torTransportLabel('scramblesuit')).toEqual({ kind: 'brand', name: 'scramblesuit' })
  })

  it('свои разнотипные и обычные мосты — подписью из словаря', () => {
    expect(torTransportLabel('custom')).toEqual({ kind: 'custom' })
    expect(torTransportLabel('vanilla')).toEqual({ kind: 'vanilla' })
  })
})

describe('countryDisplayName', () => {
  it('код страны — названием на языке интерфейса', () => {
    expect(countryDisplayName('ru', 'ru')).toBe('Россия')
    expect(countryDisplayName('ru', 'en')).toBe('Russia')
  })

  it('битая локаль не роняет подпись', () => {
    expect(countryDisplayName('ru', '!!')).toBe('RU')
  })
})
