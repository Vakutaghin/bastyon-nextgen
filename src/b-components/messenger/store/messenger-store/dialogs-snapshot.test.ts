import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dialog, Message } from '../../types'
import { loadDialogsSnapshot, saveDialogsSnapshot } from './dialogs-snapshot'

// Тестовое окружение даёт no-op localStorage — ставим рабочий in-memory.
function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, String(v))),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

let storage: ReturnType<typeof memStorage>

beforeEach(() => {
  storage = memStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function message(over: Partial<Message> = {}): Message {
  return {
    id: '$ev1',
    chatId: '!room:host',
    senderId: '@me:host',
    text: 'привет',
    type: 'text',
    timestamp: 1_700_000_000_000,
    read: true,
    status: 'sent',
    ...over,
  }
}

function dialog(id: string, over: Partial<Dialog> = {}): Dialog {
  return {
    id,
    partner: {
      id: `@${id}:host`,
      name: `Name ${id}`,
      avatar: `https://a/${id}.png`,
      verified: true,
    },
    unreadCount: 2,
    lastMessage: message({ chatId: id }),
    createdAt: 1_600_000_000_000,
    ...over,
  }
}

describe('dialogs-snapshot', () => {
  it('сохраняет и поднимает список того же аккаунта', () => {
    const list = [dialog('!a:host'), dialog('!b:host', { unreadCount: 0, lastMessage: undefined })]
    saveDialogsSnapshot('PAlice', list)
    expect(loadDialogsSnapshot('PAlice')).toEqual(list)
  })

  it('у каждого аккаунта свой список', () => {
    saveDialogsSnapshot('PAlice', [dialog('!a:host')])
    expect(loadDialogsSnapshot('PBob')).toEqual([])
  })

  it('хранит только то, что рисует строка списка', () => {
    const heavy = message({
      text: 'x'.repeat(5000),
      info: { mimetype: 'image/png', size: 10 },
      rawContent: { body: 'secret envelope' },
      reactions: [{ key: '👍', count: 1 }],
      url: 'mxc://file',
    })
    saveDialogsSnapshot('PAlice', [dialog('!a:host', { lastMessage: heavy })])
    const [restored] = loadDialogsSnapshot('PAlice')
    expect(restored?.lastMessage).toEqual({
      id: '$ev1',
      chatId: '!room:host',
      senderId: '@me:host',
      text: 'x'.repeat(200),
      type: 'text',
      timestamp: 1_700_000_000_000,
      read: true,
      status: 'sent',
    })
  })

  it('не больше 100 диалогов — остальные подтянет синк', () => {
    const many = Array.from({ length: 150 }, (_, i) => dialog(`!r${i}:host`))
    saveDialogsSnapshot('PAlice', many)
    expect(loadDialogsSnapshot('PAlice')).toHaveLength(100)
  })

  it('пустой список стирает снимок', () => {
    saveDialogsSnapshot('PAlice', [dialog('!a:host')])
    saveDialogsSnapshot('PAlice', [])
    expect(storage.getItem('BST_MSG_DIALOGS_PAlice')).toBeNull()
  })

  it('не переписывает хранилище, если список не изменился', () => {
    saveDialogsSnapshot('PAlice', [dialog('!a:host')])
    saveDialogsSnapshot('PAlice', [dialog('!a:host')])
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('битый JSON, чужая версия и мусорные записи — пустой список', () => {
    storage.setItem('BST_MSG_DIALOGS_P1', '{broken')
    storage.setItem('BST_MSG_DIALOGS_P2', JSON.stringify({ v: 999, dialogs: [dialog('!a:host')] }))
    storage.setItem(
      'BST_MSG_DIALOGS_P3',
      JSON.stringify({ v: 1, dialogs: [null, { id: 1 }, dialog('!ok:host')] })
    )
    expect(loadDialogsSnapshot('P1')).toEqual([])
    expect(loadDialogsSnapshot('P2')).toEqual([])
    expect(loadDialogsSnapshot('P3').map((d) => d.id)).toEqual(['!ok:host'])
  })

  it('хранилище бросает — без снимка, но и без исключения', () => {
    storage.setItem = vi.fn(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveDialogsSnapshot('PAlice', [dialog('!a:host')])).not.toThrow()
    expect(loadDialogsSnapshot('PAlice')).toEqual([])
  })
})
