import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import {
  checkPeerKeys,
  acceptPeerKeys,
  getPinnedKeys,
  clearAllKeyPins,
  normalizeKeys,
  KEY_PINS_PREFIX,
} from './key-pinning'

const OWNER = 'PMe'
const PEER = 'PPeer'
const K1 = '02aa,02bb,02cc'
const K2 = '02aa,02bb,02dd'

// happy-dom в vitest отдаёт урезанный localStorage — подменяем Map-заглушкой.
beforeEach(() => vi.stubGlobal('localStorage', memStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('key-pinning (TOFU, P3-3)', () => {
  it('первое появление ключей → pinned, повтор → match', () => {
    expect(checkPeerKeys(OWNER, PEER, K1)).toBe('pinned')
    expect(checkPeerKeys(OWNER, PEER, K1)).toBe('match')
    expect(getPinnedKeys(OWNER, PEER)).toBe(K1)
  })

  it('другие ключи → changed, старый пин сохраняется до явного принятия', () => {
    checkPeerKeys(OWNER, PEER, K1)
    expect(checkPeerKeys(OWNER, PEER, K2)).toBe('changed')
    expect(getPinnedKeys(OWNER, PEER)).toBe(K1)
    expect(checkPeerKeys(OWNER, PEER, K2)).toBe('changed') // и при следующем запросе тоже

    acceptPeerKeys(OWNER, PEER, K2)
    expect(checkPeerKeys(OWNER, PEER, K2)).toBe('match')
    expect(checkPeerKeys(OWNER, PEER, K1)).toBe('changed')
  })

  it('нормализация: пробелы/пустые элементы не считаются сменой ключа', () => {
    checkPeerKeys(OWNER, PEER, K1)
    expect(checkPeerKeys(OWNER, PEER, ' 02aa , 02bb,,02cc ')).toBe('match')
    expect(normalizeKeys(' a, ,b ')).toBe('a,b')
  })

  it('пины namespace-нуты по владельцу; пустые аргументы — match без записи', () => {
    checkPeerKeys(OWNER, PEER, K1)
    expect(checkPeerKeys('POther', PEER, K2)).toBe('pinned')
    expect(getPinnedKeys(OWNER, PEER)).toBe(K1)
    expect(checkPeerKeys('', PEER, K1)).toBe('match')
    expect(checkPeerKeys(OWNER, PEER, '')).toBe('match')
  })

  it('повреждённое хранилище не ломает проверку; clearAllKeyPins снимает всё', () => {
    localStorage.setItem(KEY_PINS_PREFIX + OWNER, '{not json')
    expect(checkPeerKeys(OWNER, PEER, K1)).toBe('pinned')
    checkPeerKeys('POther', PEER, K1)
    localStorage.setItem('BST_OTHER', 'keep')
    clearAllKeyPins()
    expect(localStorage.getItem(KEY_PINS_PREFIX + OWNER)).toBeNull()
    expect(localStorage.getItem(KEY_PINS_PREFIX + 'POther')).toBeNull()
    expect(localStorage.getItem('BST_OTHER')).toBe('keep')
  })
})
