// Нода отдаёт пустой список комментариев, если в getcomments передан адрес,
// которого ещё нет в блокчейне: вошедший, но не зарегистрированный пользователь
// видел «Комментарии (13)» и ни одного комментария.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ call: vi.fn() }))
const auth = vi.hoisted(() => ({
  getUserAddress: null as string | null,
  isUserAuthenticated: false,
  getUserProfile: null as { address?: string; id?: number } | null,
}))
vi.mock('@/helpers/api/request', () => ({ getByPRC: (args: unknown) => rpc.call(args) }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => auth }))

import { fetchComments } from './fetch-comments'

type Call = { parameters: string[]; cachehash: string }
const callArgs = (i: number) => rpc.call.mock.calls[i]?.[0] as Call
const viewers = () => rpc.call.mock.calls.map(([args]) => (args as Call).parameters[2])

/** Нода: на незарегистрированный адрес — пусто, иначе — два комментария. */
function node(unregistered: string) {
  return async (args: Call) => {
    const viewer = args.parameters[2]
    return { result: 'success', data: viewer === unregistered ? [] : [{ id: 'c1' }, { id: 'c2' }] }
  }
}

beforeEach(() => {
  rpc.call.mockReset()
  auth.getUserAddress = null
  auth.isUserAuthenticated = false
  auth.getUserProfile = null
})

describe('fetchComments', () => {
  it('гость: один запрос без адреса', async () => {
    rpc.call.mockImplementation(node('PNEW'))
    const list = await fetchComments('post', '', 'h')
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(viewers()).toEqual([''])
  })

  it('зарегистрированный: адрес уходит ноде ради myScore', async () => {
    auth.getUserAddress = 'PREG'
    auth.isUserAuthenticated = true
    auth.getUserProfile = { address: 'PREG', id: 42 }
    rpc.call.mockImplementation(node('PNEW'))
    const list = await fetchComments('post', 'parent', 'h')
    expect(list).toHaveLength(2)
    expect(viewers()).toEqual(['PREG'])
    expect(callArgs(0).parameters).toEqual(['post', 'parent', 'PREG'])
  })

  it('вошёл без регистрации: пустой ответ — повтор без адреса', async () => {
    auth.getUserAddress = 'PNEW'
    auth.isUserAuthenticated = true
    rpc.call.mockImplementation(node('PNEW'))
    const list = await fetchComments('post', '', 'h')
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(viewers()).toEqual(['PNEW', ''])
    expect(callArgs(1).cachehash).toBe('h-anon')
  })

  it('зарегистрированному пустой ответ верим — комментариев нет', async () => {
    auth.getUserAddress = 'PREG'
    auth.getUserProfile = { address: 'PREG', id: 42 }
    rpc.call.mockResolvedValue({ result: 'success', data: [] })
    expect(await fetchComments('post', '', 'h')).toEqual([])
    expect(viewers()).toEqual(['PREG'])
  })

  it('профиль-заглушка после регистрации (id 0) ещё не в блокчейне — повтор без адреса', async () => {
    auth.getUserAddress = 'PNEW'
    auth.getUserProfile = { address: 'PNEW', id: 0 }
    rpc.call.mockImplementation(node('PNEW'))
    expect(await fetchComments('post', '', 'h')).toHaveLength(2)
    expect(viewers()).toEqual(['PNEW', ''])
  })

  it('ответ без конверта — массив как есть', async () => {
    rpc.call.mockResolvedValue([{ id: 'c1' }])
    expect(await fetchComments('post', '', 'h')).toEqual([{ id: 'c1' }])
  })
})
