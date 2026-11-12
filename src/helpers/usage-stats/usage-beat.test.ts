import { describe, expect, it } from 'vitest'
import {
  SLOT_MS,
  beatUrl,
  detectPlatform,
  nextBeat,
  parseBeatState,
  periodKeys,
  slotOf,
} from './usage-beat'

/** Момент по московскому времени (UTC+3). */
const msk = (iso: string): number => Date.parse(`${iso}+03:00`)

describe('periodKeys', () => {
  it('сутки, неделя и месяц — по Москве', () => {
    // 23:30 UTC 31 декабря — в Москве уже 1 января.
    expect(periodKeys(Date.parse('2026-12-31T23:30:00Z'))).toEqual({
      day: '2027-01-01',
      week: '2026-W53',
      month: '2027-01',
    })
    expect(periodKeys(msk('2026-11-12T21:05:00'))).toEqual({
      day: '2026-11-12',
      week: '2026-W46',
      month: '2026-11',
    })
  })

  it('ISO-неделя на стыке лет', () => {
    expect(periodKeys(msk('2027-01-04T10:00:00')).week).toBe('2027-W01')
    expect(periodKeys(msk('2025-12-29T10:00:00')).week).toBe('2026-W01')
  })
})

describe('nextBeat', () => {
  it('первая отметка — все флаги', () => {
    const beat = nextBeat(null, msk('2026-11-12T21:05:00'))
    expect(beat?.flags).toEqual({ d: true, w: true, m: true, n: true })
    expect(beat?.state.slot).toBe(slotOf(msk('2026-11-12T21:05:00')))
  })

  it('в той же 15-минутке — ничего', () => {
    const now = msk('2026-11-12T21:05:00')
    const sent = nextBeat(null, now)!.state
    expect(nextBeat(sent, now + 9 * 60 * 1000)).toBeNull()
    expect(nextBeat(sent, now + 10 * 60 * 1000)).not.toBeNull()
  })

  it('флаги считаются от прошлой отметки', () => {
    const sent = nextBeat(null, msk('2026-11-12T21:05:00'))!.state
    expect(nextBeat(sent, msk('2026-11-12T22:00:00'))?.flags).toEqual({
      d: false,
      w: false,
      m: false,
      n: false,
    })
    // Пятница той же недели.
    expect(nextBeat(sent, msk('2026-11-13T09:00:00'))?.flags).toEqual({
      d: true,
      w: false,
      m: false,
      n: false,
    })
    // Понедельник следующей недели.
    expect(nextBeat(sent, msk('2026-11-16T09:00:00'))?.flags).toEqual({
      d: true,
      w: true,
      m: false,
      n: false,
    })
    expect(nextBeat(sent, msk('2026-12-01T09:00:00'))?.flags).toEqual({
      d: true,
      w: true,
      m: true,
      n: false,
    })
  })

  it('часы устройства ушли назад — новой отметки нет', () => {
    const sent = nextBeat(null, msk('2026-11-12T21:05:00'))!.state
    expect(nextBeat(sent, msk('2026-11-12T21:05:00') - 2 * SLOT_MS)).toBeNull()
  })
})

describe('beatUrl', () => {
  it('только версия, платформа и флаги', () => {
    const beat = nextBeat(null, msk('2026-11-12T21:05:00'))!
    const url = new URL(beatUrl('https://stats.example:8460/beat', beat, '0.35.0', 'android'))
    expect(url.origin + url.pathname).toBe('https://stats.example:8460/beat')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      v: '0.35.0',
      p: 'android',
      d: '1',
      w: '1',
      m: '1',
      n: '1',
    })
  })
})

describe('detectPlatform', () => {
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/131.0'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile'
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'

  it('программа для компьютера — по системе', () => {
    expect(detectPlatform(WIN, 'desktop')).toBe('windows')
    expect(detectPlatform(MAC, 'desktop')).toBe('macos')
    expect(detectPlatform(LINUX, 'desktop')).toBe('linux')
  })

  it('телефон — Android или iPhone', () => {
    expect(detectPlatform(ANDROID, 'mobile')).toBe('android')
    expect(detectPlatform(IPHONE, 'mobile')).toBe('ios')
  })

  it('сайт — всегда web, даже в браузере телефона', () => {
    expect(detectPlatform(ANDROID, 'web')).toBe('web')
    expect(detectPlatform(WIN, 'web')).toBe('web')
  })
})

describe('parseBeatState', () => {
  it('принимает своё и отбрасывает чужое', () => {
    const state = { slot: 1, day: '2026-11-12', week: '2026-W46', month: '2026-11' }
    expect(parseBeatState(state)).toEqual(state)
    expect(parseBeatState(null)).toBeNull()
    expect(parseBeatState('x')).toBeNull()
    expect(parseBeatState({ ...state, slot: 'a' })).toBeNull()
    expect(parseBeatState({ ...state, slot: Number.NaN })).toBeNull()
    expect(parseBeatState({ slot: 1 })).toBeNull()
  })
})
