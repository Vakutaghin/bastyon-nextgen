import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { confirm, deletePost, toast } = vi.hoisted(() => ({
  confirm: vi.fn(),
  deletePost: vi.fn(async () => {}),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('ant-design-vue', () => ({ Modal: { confirm } }))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('./post-deleter', () => ({ deletePost }))

import { usePostDelete } from './use-post-delete'
import { usePostsStore } from '@/stores/posts-store'

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('usePostDelete', () => {
  it('confirmDelete открывает подтверждение, удаление идёт только по onOk', async () => {
    const onDeleted = vi.fn()
    const { confirmDelete, deleted } = usePostDelete(() => 'tx1', onDeleted)
    confirmDelete()
    expect(deletePost).not.toHaveBeenCalled()
    const opts = confirm.mock.calls[0]![0] as { onOk: () => Promise<void>; okType: string }
    expect(opts.okType).toBe('danger')
    await opts.onOk()
    expect(deletePost).toHaveBeenCalledWith('tx1')
    expect(deleted.value).toBe(true)
    expect(toast.success).toHaveBeenCalledWith({ message: 'postCard.deleted' })
    expect(onDeleted).toHaveBeenCalledWith('tx1')
    // Пост прячется везде, а не только в этой карточке (N12).
    expect(usePostsStore().isPostDeleted('tx1')).toBe(true)
  })

  it('ошибка транзакции: тост с текстом ошибки, deleted не выставляется, колбэк не зовётся', async () => {
    deletePost.mockRejectedValueOnce(new Error('no unspents'))
    const onDeleted = vi.fn()
    const { doDelete, deleted, deleting } = usePostDelete(() => 'tx1', onDeleted)
    await doDelete()
    expect(toast.error).toHaveBeenCalledWith({ message: 'no unspents' })
    expect(deleted.value).toBe(false)
    expect(deleting.value).toBe(false)
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('повторный вызов во время удаления игнорируется', async () => {
    let release: () => void = () => {}
    deletePost.mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
    const { doDelete, deleting } = usePostDelete(() => 'tx1', vi.fn())
    const first = doDelete()
    expect(deleting.value).toBe(true)
    await doDelete()
    expect(deletePost).toHaveBeenCalledTimes(1)
    release()
    await first
    expect(deleting.value).toBe(false)
  })
})
