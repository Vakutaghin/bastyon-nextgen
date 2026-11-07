// Форматы транзакций мини-приложений сверены с mainnet: hash256(serialized) —
// второй пуш OP_RETURN настоящих транзакций Barteron (getrawtransaction).

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  brtAccountObject,
  brtOfferObject,
  commentObject,
  removeObject,
  upvoteShareObject,
} from './legacy-objects'

const hash256 = (s: string) =>
  createHash('sha256')
    .update(createHash('sha256').update(Buffer.from(s, 'utf8')).digest())
    .digest('hex')

// brtoffer 430ecc22…b541 (новое объявление), блок 4097xxx.
const OFFER_AUTHOR = 'PAk3r2YK9ZbrTgxpkwV4tS599xD8pohPMo'
const OFFER = {
  language: 'ru-RU',
  caption: 'Сеансы биоэнерготерапевта',
  description: 'Сеансы биоэнерготерапевта.',
  tag: 277,
  tags: ['my_list'],
  condition: 'new',
  published: 'published',
  currencyPrice: { currency: 'RUB', price: '45068.00' },
  delivery: {},
  videoSettings: { order: 'first' },
  safeDeal: {},
  metaData: {},
  images: ['https://bastyon.com:8092/i/OUnkKeuoOVnlxRaJCoDudc.jfif'],
  geohash: 'ucfsmxzf7gs3',
  price: 380000,
}
const OFFER_OPRETURN = '77f3917f486e8fd6fc9a4813eae60f32b106295028f8e2882336bda159252501'

describe('brtOfferObject', () => {
  it('новое объявление — тот же хэш, что в OP_RETURN на mainnet, и те же поля', () => {
    const obj = brtOfferObject(OFFER, OFFER_AUTHOR)
    expect(obj.type).toBe('brtoffer')
    expect(hash256(obj.serialized)).toBe(OFFER_OPRETURN)
    expect(obj.message).toEqual({
      s1: OFFER_AUTHOR,
      p: {
        s1: 'ru-RU',
        s2: 'Сеансы биоэнерготерапевта',
        s3: 'Сеансы биоэнерготерапевта.',
        s4: '{"t":277,"a":["my_list"],"c":"new","p":"published","f":{"currency":"RUB","price":"45068.00"},"d":{},"v":{"order":"first"},"s":{},"m":{}}',
        s5: '["https://bastyon.com:8092/i/OUnkKeuoOVnlxRaJCoDudc.jfif"]',
        s6: 'ucfsmxzf7gs3',
        s7: '',
        i1: 380000,
      },
    })
  })

  it('правка — hash первой версии в s2 и в хэше; Barteron узнаёт её по полям alias', () => {
    const root = 'b'.repeat(64)
    const obj = brtOfferObject({ ...OFFER, hash: root }, OFFER_AUTHOR)
    expect(obj.message.s2).toBe(root)
    expect(obj.serialized.startsWith(OFFER_AUTHOR + root + 'ru-RU')).toBe(true)
    // isOfferAction у Barteron: эти ключи должны быть в expObject.
    for (const key of [
      'address',
      'hash',
      'language',
      'caption',
      'description',
      'tag',
      'condition',
      'geohash',
    ]) {
      expect(obj.alias).toHaveProperty(key)
    }
  })

  it('не 64 символа в hash — новое объявление (Barteron шлёт свой временный id)', () => {
    const obj = brtOfferObject({ ...OFFER, hash: 'draft-1' }, OFFER_AUTHOR)
    expect(obj.message).not.toHaveProperty('s2')
    expect(obj.alias.hash).toBeNull()
  })

  it('без обязательных полей — отказ с именем поля', () => {
    expect(() => brtOfferObject({ ...OFFER, caption: '' }, OFFER_AUTHOR)).toThrow(
      'brtoffer:invalid:caption'
    )
    expect(() => brtOfferObject({ ...OFFER, price: -5 }, OFFER_AUTHOR)).toThrow(
      'brtoffer:invalid:price'
    )
    expect(() => brtOfferObject({ ...OFFER, images: undefined }, OFFER_AUTHOR)).toThrow(
      'brtoffer:invalid:images'
    )
  })

  it('чужой адрес — отказ: подписать от чужого имени нельзя', () => {
    expect(() => brtOfferObject({ ...OFFER, address: 'PSomeone' }, OFFER_AUTHOR)).toThrow(
      'brtoffer:invalid:address'
    )
  })
})

describe('brtAccountObject', () => {
  it('профиль — тот же хэш, что в OP_RETURN на mainnet (brtaccount 39b4f348…)', () => {
    const address = 'PMQdinb6TKLYvj779MtPVTzwHUB3KbJSy7'
    const obj = brtAccountObject(
      { address, tags: [11116, 23], geohash: '', static: false, radius: 0, safeDeal: {} },
      address
    )
    expect(obj.type).toBe('brtaccount')
    expect(obj.message).toEqual({
      s1: address,
      p: { s4: '{"a":[11116,23],"g":"","s":false,"r":0,"d":{}}' },
    })
    expect(hash256(obj.serialized)).toBe(
      '0eb20a663fdce4cf2a93766d46b7b95acdc4ec35793b168b8ff4be9429831cf6'
    )
  })

  it('alias держит ключи и без значений: Barteron узнаёт профиль по их наличию', () => {
    const obj = brtAccountObject({}, 'PUser')
    expect(JSON.parse(JSON.stringify(obj.alias))).toEqual({
      address: 'PUser',
      tags: null,
      geohash: null,
      static: null,
      radius: null,
      safeDeal: null,
      metaData: null,
    })
  })
})

describe('commentObject, upvoteShareObject, removeObject', () => {
  const post = 'c'.repeat(64)

  it('отзыв — как Comment прежнего клиента: msg с message, url, images, info', () => {
    const obj = commentObject({ postid: post, msgparsed: { message: 'Отлично', info: '5' } })
    const msg = '{"message":"Отлично","url":"","images":[],"info":"5"}'
    expect(obj.message).toEqual({ postid: post, answerid: '', parentid: '', msg })
    expect(obj.serialized).toBe(post + msg)
    expect(obj.alias).toMatchObject({ postid: post, msgparsed: { message: 'Отлично', info: '5' } })
    expect(obj.alias.type).toBe('comment')
  })

  it('пустой отзыв и слишком длинный — отказ', () => {
    expect(() => commentObject({ postid: post, msgparsed: { message: '' } })).toThrow(
      'comment:invalid:content'
    )
    expect(() => commentObject({ postid: post, msgparsed: { message: 'x'.repeat(916) } })).toThrow(
      'comment:invalid:messagelength'
    )
  })

  it('оценка — share+value в хэше, «автор значение» третьим пушем', () => {
    const obj = upvoteShareObject({ share: post, vsaddress: 'PAuthor', value: 4 })
    expect(obj.serialized).toBe(post + '4')
    expect(obj.message).toEqual({ share: post, value: '4' })
    expect(obj.opReturnExtra).toBe('PAuthor 4')
    expect(obj.alias).toEqual({
      type: 'upvoteShare',
      share: post,
      value: '4',
      vsaddress: 'PAuthor',
    })
    expect(() => upvoteShareObject({ share: post, vsaddress: 'P', value: 6 })).toThrow(
      'upvoteShare:invalid:value'
    )
  })

  it('удаление объявления — contentDelete с txidEdit', () => {
    const obj = removeObject(post)
    expect(obj).toEqual({
      type: 'contentDelete',
      serialized: post,
      message: { txidEdit: post },
      alias: { txidEdit: post, type: 'contentDelete' },
    })
    expect(() => removeObject('nope')).toThrow('contentDelete:invalid:hash')
  })
})
