import { describe, expect, it } from 'vitest'
import { pingLabel, shortenVersion } from './peers-format'

const EM = '—'

// S68: pingtime у Core — секунды, а не микросекунды; деление на 1000 давало
// «0.0 ms» вообще у всех пиров.
describe('pingLabel', () => {
  it('быстрый пир — десятые доли миллисекунды', () => {
    expect(pingLabel(0.0055, EM)).toBe('5.5 ms')
  })

  it('обычный пир — целые миллисекунды', () => {
    expect(pingLabel(0.055, EM)).toBe('55 ms')
    expect(pingLabel(0.25, EM)).toBe('250 ms')
  })

  it('медленный пир — секунды', () => {
    expect(pingLabel(1.4, EM)).toBe('1.4 s')
  })

  it('нет данных — прочерк', () => {
    expect(pingLabel(0, EM)).toBe(EM)
    expect(pingLabel(-1, EM)).toBe(EM)
    expect(pingLabel(Number.NaN, EM)).toBe(EM)
  })
})

describe('shortenVersion', () => {
  it('режет слэши и двоеточие', () => {
    expect(shortenVersion('/Satoshi:0.22.21/')).toBe('Satoshi 0.22.21')
  })

  it('незнакомый формат остаётся как есть', () => {
    expect(shortenVersion('custom-build')).toBe('custom-build')
    expect(shortenVersion('')).toBe('')
  })
})
