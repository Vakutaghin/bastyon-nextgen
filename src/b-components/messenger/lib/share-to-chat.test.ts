import { describe, expect, it } from 'vitest'

import type { Dialog } from '../types'
import { isOpenChat, isShareTarget, shareMessageText, shareTargets } from './share-to-chat'

function dialog(id: string, name: string, time: number, over: Partial<Dialog> = {}): Dialog {
  return {
    id,
    partner: { id: `@${id}:host`, name } as Dialog['partner'],
    unreadCount: 0,
    lastMessage: time ? ({ timestamp: time } as Dialog['lastMessage']) : undefined,
    createdAt: time,
    ...over,
  }
}

describe('отправить в чат: куда', () => {
  it('переписки Matrix, в которые вступили; не приглашения, не mesh, не каналы', () => {
    expect(isShareTarget(dialog('!a:host', 'Алиса', 1))).toBe(true)
    expect(isShareTarget(dialog('!g:host', 'Группа', 1, { group: {} as Dialog['group'] }))).toBe(
      true
    )
    expect(isShareTarget(dialog('!i:host', 'Приглашение', 1, { invite: { by: '@x:host' } }))).toBe(
      false
    )
    expect(isShareTarget(dialog('mesh:mt:1', 'Радио', 1, { transport: 'meshtastic' }))).toBe(false)
    expect(isShareTarget(dialog('channel:PADDR', 'Канал', 1))).toBe(false)
  })

  it('свежие сверху; поиск по названию без учёта регистра и ё; спрятанные фильтром — нет', () => {
    const list = [
      dialog('!old:host', 'Старый чат', 10),
      dialog('!new:host', 'Фёдор', 30),
      dialog('!mid:host', 'Работа', 20),
      dialog('!hidden:host', 'Спам', 40),
    ]
    const hidden = new Set(['!hidden:host'])
    expect(shareTargets(list, '', hidden).map((d) => d.id)).toEqual([
      '!new:host',
      '!mid:host',
      '!old:host',
    ])
    expect(shareTargets(list, 'федор', hidden).map((d) => d.id)).toEqual(['!new:host'])
    expect(shareTargets(list, '  РАБ ', hidden).map((d) => d.id)).toEqual(['!mid:host'])
  })

  it('без шифрования — открытая или большая группа; личный чат шифруется всегда', () => {
    expect(isOpenChat({ group: { unencrypted: 'public' } as Dialog['group'] })).toBe(true)
    expect(isOpenChat({ group: { unencrypted: 'large' } as Dialog['group'] })).toBe(true)
    expect(isOpenChat({ group: {} as Dialog['group'] })).toBe(false)
    expect(isOpenChat({})).toBe(false)
  })
})

describe('отправить в чат: текст', () => {
  it('ссылка; с подписью — подпись и ссылка отдельной строкой', () => {
    expect(shareMessageText('https://bastyon.com/post?s=1')).toBe('https://bastyon.com/post?s=1')
    expect(shareMessageText('https://bastyon.com/post?s=1', '  Глянь  ')).toBe(
      'Глянь\nhttps://bastyon.com/post?s=1'
    )
  })
})
