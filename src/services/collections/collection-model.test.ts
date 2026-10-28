// Модель коллекции: payload, строка под хеш и размер — как у ноды и старого
// клиента. Хеш сверен с настоящей коллекцией mainnet «Анархия»
// (2f28aaa1…, блок 4 054 912): OP_RETURN её транзакции — 7380be2a….

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  COLLECTION_MAX_ITEMS,
  cleanContentIds,
  collectionPayload,
  collectionPayloadBytes,
  contentTypesOf,
  kindOfContentTypes,
  parseCollectionSettings,
  serializeCollection,
  stringifyCollectionSettings,
  validateCollectionDraft,
  type CollectionDraft,
} from './collection-model'

const hash256 = (s: string): string =>
  createHash('sha256').update(createHash('sha256').update(s, 'utf8').digest()).digest('hex')

const ID_A = '1cabe401c0bf8f98137109d9a49fd33a074f3b9eb31d5f1bfdb752417f67b2a5'
const ID_B = 'bb02dccf52b04cc95af1836e12a0246b99309bd348c8b76ec74bb20b70b47f38'

const draft = (patch: Partial<CollectionDraft> = {}): CollectionDraft => ({
  kind: 'posts',
  caption: 'Анархия',
  description: 'Мать порядка.',
  image: 'https://bastyon.com:8092/i/IvqotOaEwOSSpdbpLzmFcv.jfif',
  lang: 'ru',
  contentIds: [ID_A],
  ...patch,
})

describe('collection-model', () => {
  it('хеш совпадает с OP_RETURN коллекции mainnet', () => {
    const payload = collectionPayload(draft())
    expect(payload).toEqual({
      c: 'Анархия',
      i: 'https://bastyon.com:8092/i/IvqotOaEwOSSpdbpLzmFcv.jfif',
      l: 'ru',
      s: '{"m":"Мать порядка."}',
      contentIds: [ID_A],
      txidEdit: '',
    })
    expect(hash256(serializeCollection(payload))).toBe(
      '7380be2a45c845c38225eb3be29280124b3c651b4c34f976b2fcecaf109eaed7'
    )
  })

  it('у плейлиста тип элементов идёт в payload и в хеш после root txid', () => {
    const payload = collectionPayload(draft({ kind: 'video', rootTxid: ID_B }))
    expect(payload.contentTypes).toBe(201)
    expect(payload.txidEdit).toBe(ID_B)
    expect(serializeCollection(payload).startsWith(`${ID_B}201${ID_A}ru`)).toBe(true)
    expect(collectionPayload(draft({ kind: 'audio' })).contentTypes).toBe(210)
    expect('contentTypes' in collectionPayload(draft())).toBe(false)
  })

  it('тип по полю ноды — и числом, и строкой', () => {
    expect(kindOfContentTypes('201')).toBe('video')
    expect(kindOfContentTypes(210)).toBe('audio')
    expect(kindOfContentTypes(200)).toBeNull()
    expect(kindOfContentTypes(undefined)).toBeNull()
    expect(contentTypesOf('posts')).toBeUndefined()
  })

  it('настройки: описание в m, чужие ключи сохраняются, пустое не шлётся', () => {
    expect(stringifyCollectionSettings({ x: 1, m: 'старое' }, ' новое ')).toBe(
      '{"x":1,"m":"новое"}'
    )
    expect(stringifyCollectionSettings({}, '  ')).toBe('')
    expect(parseCollectionSettings('{"m":"a","k":2}')).toEqual({ m: 'a', k: 2 })
    expect(parseCollectionSettings('[1]')).toEqual({})
    expect(parseCollectionSettings('не json')).toEqual({})
    expect(parseCollectionSettings({ m: 'b' })).toEqual({ m: 'b' })
  })

  it('элементы: только txid, нижний регистр, без повторов, порядок сохраняется', () => {
    expect(cleanContentIds([ID_B, ID_A.toUpperCase(), ID_B, 'abc', 5])).toEqual([ID_B, ID_A])
  })

  it('размер — в байтах: кириллица по два, у правки ещё root txid', () => {
    const payload = collectionPayload(draft({ description: '', image: '', caption: 'Яя' }))
    expect(collectionPayloadBytes(payload)).toBe(4 + 2)
    const edit = collectionPayload(
      draft({ description: '', image: '', caption: 'a', rootTxid: ID_B })
    )
    expect(collectionPayloadBytes(edit)).toBe(1 + 2 + 64)
  })

  it('проверка черновика', () => {
    expect(validateCollectionDraft(draft())).toBeNull()
    expect(validateCollectionDraft(draft({ caption: '  ' }))).toBe('caption')
    expect(validateCollectionDraft(draft({ caption: 'я'.repeat(101) }))).toBe('caption')
    expect(validateCollectionDraft(draft({ contentIds: [] }))).toBe('empty')
    const many = Array.from({ length: COLLECTION_MAX_ITEMS + 1 }, (_, i) =>
      i.toString(16).padStart(64, '0')
    )
    expect(validateCollectionDraft(draft({ contentIds: many }))).toBe('tooMany')
    // 1000 символов кириллицей — 2000 байт описания: старый клиент такое пропускает, нода нет.
    expect(validateCollectionDraft(draft({ description: 'ж'.repeat(1000) }))).toBe('tooBig')
  })
})
