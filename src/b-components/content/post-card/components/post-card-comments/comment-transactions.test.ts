// Транзакции комментариев: новый комментарий, правка, голос в опросе,
// удаление и оценка. Форматы payload и serializedData — как у старого
// клиента (kit.js): нода сверяет хеш по этой строке, ошибка в ней = отказ.
// Правка меняет только текст: картинки, ссылка и info исходного комментария
// сохраняются.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {
    getKeyPair: { privateKey: 'priv' } as unknown,
    getUserAddress: 'PMe' as string | null,
  },
  getUnspents: vi.fn(),
  filterAvailableUnspents: vi.fn(),
  selectBestUnspents: vi.fn(),
  lockUTXOs: vi.fn(),
  buildTransaction: vi.fn(),
  broadcastTransaction: vi.fn(),
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain/core/transactions/transaction-builder', () => ({
  buildTransaction: mocks.buildTransaction,
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: mocks.getUnspents,
  filterAvailableUnspents: mocks.filterAvailableUnspents,
  selectBestUnspents: mocks.selectBestUnspents,
  lockUTXOs: mocks.lockUTXOs,
}))
vi.mock('@/blockchain/core/transactions/transaction-sender', () => ({
  broadcastTransaction: mocks.broadcastTransaction,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { deleteComment } from './comment-deleter'
import { sendCommentScore } from './comment-scoring'
import { editedBody, sendComment, sendPollVote } from './comment-sender'

const UTXO = [{ txid: 'u1', vout: 0, amount: 1 }]

function lastBuild() {
  return mocks.buildTransaction.mock.lastCall![0] as {
    serializedData: string
    operationType: string
    fee: number
    unspents: unknown
    opReturnData?: Buffer[]
  }
}
function lastBroadcast() {
  return mocks.broadcastTransaction.mock.lastCall![0] as {
    hex: string
    messageData: Record<string, string>
    operationType: string
    pending?: unknown
  }
}

describe('транзакции комментариев', () => {
  beforeEach(() => {
    mocks.auth.getKeyPair = { privateKey: 'priv' }
    mocks.auth.getUserAddress = 'PMe'
    mocks.getUnspents.mockReset().mockResolvedValue(UTXO)
    mocks.filterAvailableUnspents.mockReset().mockImplementation((u: unknown) => u)
    mocks.selectBestUnspents.mockReset().mockImplementation((u: unknown) => u)
    mocks.lockUTXOs.mockReset()
    mocks.buildTransaction.mockReset().mockResolvedValue({ hex: 'deadbeef' })
    mocks.broadcastTransaction.mockReset().mockResolvedValue('tx-out')
  })

  describe('editedBody', () => {
    it('меняет текст, сохраняя картинки, ссылку и info', () => {
      const original = JSON.stringify({
        message: 'было',
        url: 'https://example.com',
        images: ['https://img/1.jpg', 7, 'https://img/2.jpg'],
        info: '{"x":1}',
      })
      expect(editedBody(original, '  стало  ')).toEqual({
        message: 'стало',
        url: 'https://example.com',
        images: ['https://img/1.jpg', 'https://img/2.jpg'],
        info: '{"x":1}',
      })
    })

    it('старый формат msg (просто текст) или его отсутствие — только новый текст', () => {
      const empty = { url: '', images: [], info: '' }
      expect(editedBody('просто текст', 'новый')).toEqual({ message: 'новый', ...empty })
      expect(editedBody(undefined, 'новый')).toEqual({ message: 'новый', ...empty })
      expect(editedBody('null', 'новый')).toEqual({ message: 'новый', ...empty })
    })
  })

  describe('sendComment', () => {
    it('новый ответ: comment, payload без id, serializedData = postid + msg + parentid + answerid', async () => {
      await expect(sendComment('post1', 'parent1', 'answer1', '  Привет  ')).resolves.toBe('tx-out')

      const msg = JSON.stringify({ message: 'Привет', url: '', images: [], info: '' })
      expect(lastBuild()).toMatchObject({
        serializedData: `post1${msg}parent1answer1`,
        operationType: 'comment',
        fee: DEFAULT_TX_FEE,
        unspents: UTXO,
      })
      expect(lastBroadcast()).toEqual({
        hex: 'deadbeef',
        messageData: { postid: 'post1', answerid: 'answer1', parentid: 'parent1', msg },
        operationType: 'comment',
        pending: false,
      })
      expect(mocks.lockUTXOs).toHaveBeenCalledWith(UTXO)
      expect(mocks.getUnspents).toHaveBeenCalledWith('PMe', 1, 9999999)
    })

    it('правка: commentEdit с id, картинки исходного комментария остаются', async () => {
      const original = JSON.stringify({
        message: 'было',
        url: '',
        images: ['https://img/1.jpg'],
        info: '',
      })
      await sendComment('post1', '', '', 'стало', 'comment1', original)

      const msg = JSON.stringify({
        message: 'стало',
        url: '',
        images: ['https://img/1.jpg'],
        info: '',
      })
      expect(lastBuild()).toMatchObject({
        serializedData: `post1${msg}`,
        operationType: 'commentEdit',
      })
      expect(lastBroadcast().messageData).toEqual({
        postid: 'post1',
        answerid: '',
        parentid: '',
        msg,
        id: 'comment1',
      })
      // Правка ждёт блока в «песочных часах»: пост и новый текст.
      expect(lastBroadcast().pending).toEqual({ postId: 'post1', title: 'стало' })
    })

    it.each([
      ['пустой текст', () => sendComment('post1', '', '', '   '), 'errPostAndTextRequired'],
      ['нет поста', () => sendComment('', '', '', 'текст'), 'errPostAndTextRequired'],
      [
        'нет ключа',
        () => {
          mocks.auth.getKeyPair = null
          return sendComment('post1', '', '', 'текст')
        },
        'errAuthRequiredSend',
      ],
      [
        'нет монет',
        () => {
          mocks.getUnspents.mockResolvedValue([])
          return sendComment('post1', '', '', 'текст')
        },
        'errNoUnspents',
      ],
      [
        'монеты не подобрались',
        () => {
          mocks.selectBestUnspents.mockReturnValue([])
          return sendComment('post1', '', '', 'текст')
        },
        'errSelectUnspents',
      ],
    ])('%s — понятная ошибка, транзакции нет', async (_name, run, key) => {
      await expect(run()).rejects.toThrow(`commentsMsg.${key}`)
      expect(mocks.broadcastTransaction).not.toHaveBeenCalled()
    })
  })

  it('голос в опросе — корневой комментарий с номером варианта в info', async () => {
    await sendPollVote('post1', 2, 'Горы')
    const msg = JSON.stringify({ message: '🗳 Горы', url: '', images: [], info: '{"poll":2}' })
    expect(lastBroadcast().messageData).toEqual({
      postid: 'post1',
      answerid: '',
      parentid: '',
      msg,
    })
    expect(lastBuild().operationType).toBe('comment')
    expect(lastBroadcast().pending).toEqual({ kind: 'pollVote', postId: 'post1', title: 'Горы' })
  })

  describe('deleteComment', () => {
    it('commentDelete без msg, serializedData = postid + parentid + answerid', async () => {
      await expect(
        deleteComment({ postId: 'post1', commentId: 'c1', parentId: 'p1', answerId: 'a1' })
      ).resolves.toBe('tx-out')
      expect(lastBuild()).toMatchObject({
        serializedData: 'post1p1a1',
        operationType: 'commentDelete',
      })
      expect(lastBroadcast().messageData).toEqual({
        postid: 'post1',
        answerid: 'a1',
        parentid: 'p1',
        id: 'c1',
      })
    })

    it('без ключа или без id — ошибка до построения транзакции', async () => {
      await expect(deleteComment({ postId: 'post1', commentId: '' })).rejects.toThrow(
        'commentsMsg.errPostAndCommentRequired'
      )
      mocks.auth.getUserAddress = null
      await expect(deleteComment({ postId: 'post1', commentId: 'c1' })).rejects.toThrow(
        'commentsMsg.errAuthRequiredDelete'
      )
      expect(mocks.buildTransaction).not.toHaveBeenCalled()
    })
  })

  describe('sendCommentScore', () => {
    it('cScore: serializedData = id + значение, OP_RETURN = «адрес автора значение»', async () => {
      await sendCommentScore('c1', -1, 'PAuthor')
      const build = lastBuild()
      expect(build.serializedData).toBe('c1-1')
      expect(build.operationType).toBe('cScore')
      expect(build.opReturnData?.[0]?.toString('utf8')).toBe('PAuthor -1')
      expect(lastBroadcast()).toEqual({
        hex: 'deadbeef',
        messageData: { commentid: 'c1', value: '-1' },
        operationType: 'cScore',
        pending: { address: 'PAuthor' },
      })
    })

    it('без автора или без входа — ошибка', async () => {
      await expect(sendCommentScore('c1', 1, '')).rejects.toThrow(
        'commentsMsg.errAuthorAddressRequired'
      )
      mocks.auth.getKeyPair = null
      await expect(sendCommentScore('c1', 1, 'PAuthor')).rejects.toThrow(
        'commentsMsg.errAuthRequiredScore'
      )
    })
  })
})
