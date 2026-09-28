// Окно входа: пустое поле не уходит в сеть, повторный клик во время входа
// игнорируется, ошибка ноды видна в форме, а «Отмена» во время входа
// прерывает его и откатывает именно новый аккаунт (V11), без сообщения об
// ошибке. QR-код подставляет расшифрованный текст и сразу входит.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  revertSignIn: vi.fn(),
}))
vi.mock('@/blockchain', () => ({
  useAuthStore: () => ({ signIn: mocks.signIn, revertSignIn: mocks.revertSignIn }),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('ant-design-vue', () => ({ Alert: {} }))
vi.mock('@/components/modal/modal.vue', () => ({ default: {} }))
vi.mock('@/components/button/button.vue', () => ({ default: {} }))
vi.mock('./styled', () =>
  Object.fromEntries(
    [
      'SC_SignInForm',
      'SC_FormItem',
      'SC_FormLabel',
      'SC_InputWrapper',
      'SC_InputWithToggle',
      'SC_PasswordToggle',
      'SC_ErrorMessage',
      'SC_LinkToRegister',
      'SC_LinkButton',
    ].map((name) => [name, {}])
  )
)

import { useSignInModal } from './sign-in-modal'

type Emit = Parameters<typeof useSignInModal>[1]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const props = reactive({ open: true })
  const emit = vi.fn()
  const modal = useSignInModal(props, emit as unknown as Emit)
  const emitted = () => emit.mock.calls.map((c) => c.join(':'))
  return { props, emit, emitted, modal }
}

describe('useSignInModal', () => {
  beforeEach(() => {
    mocks.signIn.mockReset().mockResolvedValue({ success: true, address: 'PN' })
    mocks.revertSignIn.mockReset().mockResolvedValue(undefined)
  })

  it('пустое поле: подсказка и никакого входа', async () => {
    const { modal } = setup()
    modal.privateKey.value = '   '
    await modal.handleSignIn()
    expect(modal.error.value).toBe('accountMsg.enterMnemonicOrKey')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('успех: секрет уходит обрезанным, форма очищается, окно закрывается', async () => {
    const { modal, emitted } = setup()
    modal.privateKey.value = '  word1 word2  '
    await modal.handleSignIn()

    expect(mocks.signIn).toHaveBeenCalledWith(
      { privateKey: 'word1 word2' },
      { signal: expect.any(AbortSignal) }
    )
    expect(emitted()).toEqual(['success', 'update:open:false'])
    expect(modal.privateKey.value).toBe('')
    expect(modal.loading.value).toBe(false)
  })

  it('повторный вход, пока идёт первый, игнорируется', async () => {
    const first = deferred<{ success: boolean }>()
    mocks.signIn.mockReturnValueOnce(first.promise)
    const { modal } = setup()
    modal.privateKey.value = 'seed'

    const running = modal.handleSignIn()
    expect(modal.loading.value).toBe(true)
    await modal.handleSignIn()
    expect(mocks.signIn).toHaveBeenCalledTimes(1)

    first.resolve({ success: true })
    await running
  })

  it('отказ: текст ошибки из ответа, иначе общий; окно остаётся открытым', async () => {
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'

    mocks.signIn.mockResolvedValueOnce({ success: false, error: 'Неверная фраза' })
    await modal.handleSignIn()
    expect(modal.error.value).toBe('Неверная фраза')

    mocks.signIn.mockResolvedValueOnce({ success: false })
    await modal.handleSignIn()
    expect(modal.error.value).toBe('accountMsg.signInError')

    mocks.signIn.mockRejectedValueOnce(new Error('network down'))
    await modal.handleSignIn()
    expect(modal.error.value).toBe('network down')

    mocks.signIn.mockRejectedValueOnce('boom')
    await modal.handleSignIn()
    expect(modal.error.value).toBe('accountMsg.signInUnexpectedError')

    expect(emitted()).toEqual([])
    expect(modal.privateKey.value).toBe('seed')
  })

  it('«Отмена» во время входа прерывает его и откатывает новый аккаунт к прежнему', async () => {
    const pending = deferred<object>()
    mocks.signIn.mockReturnValueOnce(pending.promise)
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'

    const running = modal.handleSignIn()
    modal.handleCancel()
    const { signal } = mocks.signIn.mock.calls[0]![1] as { signal: AbortSignal }
    expect(signal.aborted).toBe(true)
    // Окно не закрывается, пока вход не доведён до отката.
    expect(emitted()).toEqual([])

    pending.resolve({ success: true, address: 'PN', previousAddress: 'PO' })
    await running

    expect(mocks.revertSignIn).toHaveBeenCalledWith('PN', 'PO')
    expect(emitted()).toEqual(['cancel', 'update:open:false'])
    expect(modal.error.value).toBeNull()
  })

  it('вход, который сам сообщил об отмене, не откатывается повторно', async () => {
    mocks.signIn.mockResolvedValueOnce({ success: false, cancelled: true })
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'
    await modal.handleSignIn()
    expect(mocks.revertSignIn).not.toHaveBeenCalled()
    expect(emitted()).toEqual(['cancel', 'update:open:false'])
  })

  it('исключение после «Отмены» не показывается как ошибка', async () => {
    const pending = deferred<object>()
    mocks.signIn.mockReturnValueOnce(pending.promise)
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'

    const running = modal.handleSignIn()
    modal.handleCancel()
    pending.reject(new DOMException('aborted', 'AbortError'))
    await running

    expect(modal.error.value).toBeNull()
    expect(emitted()).toEqual(['cancel', 'update:open:false'])
  })

  it('«Отмена» без входа просто закрывает окно', () => {
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'
    modal.handleCancel()
    expect(emitted()).toEqual(['cancel', 'update:open:false'])
    expect(modal.privateKey.value).toBe('')
  })

  it('переход к регистрации заблокирован во время входа', async () => {
    const pending = deferred<object>()
    mocks.signIn.mockReturnValueOnce(pending.promise)
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'

    const running = modal.handleSignIn()
    modal.handleOpenRegister()
    expect(emitted()).toEqual([])

    pending.resolve({ success: false, error: 'x' })
    await running
    modal.handleOpenRegister()
    expect(emitted()).toEqual(['openRegister', 'update:open:false'])
  })

  it('QR: пустой результат игнорируется, иначе текст подставляется и вход начинается', async () => {
    const { modal } = setup()
    modal.toggleQrScanner()
    expect(modal.showQrScanner.value).toBe(true)

    modal.handleQrDecoded('   ')
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(modal.showQrScanner.value).toBe(true)

    modal.handleQrDecoded('  seed from qr ')
    expect(modal.showQrScanner.value).toBe(false)
    expect(mocks.signIn).toHaveBeenCalledWith({ privateKey: 'seed from qr' }, expect.anything())
  })

  it('сканер нельзя открыть во время входа; открытие сканера прячет ошибку', async () => {
    const { modal } = setup()
    modal.error.value = 'old error'
    modal.toggleQrScanner()
    expect(modal.error.value).toBeNull()
    modal.toggleQrScanner()

    const pending = deferred<object>()
    mocks.signIn.mockReturnValueOnce(pending.promise)
    modal.privateKey.value = 'seed'
    const running = modal.handleSignIn()
    modal.toggleQrScanner()
    expect(modal.showQrScanner.value).toBe(false)
    pending.resolve({ success: true })
    await running
  })

  it('закрытие окна снаружи очищает форму и пересоздаёт её', async () => {
    const { props, modal } = setup()
    modal.privateKey.value = 'seed'
    modal.showPassword.value = true
    const key = modal.modalKey.value

    props.open = false
    await nextTick()

    expect(modal.privateKey.value).toBe('')
    expect(modal.showPassword.value).toBe(false)
    expect(modal.modalKey.value).toBe(key + 1)
  })

  it('isOpen = false из v-model очищает форму и сообщает родителю', () => {
    const { modal, emitted } = setup()
    modal.privateKey.value = 'seed'
    modal.isOpen.value = false
    expect(modal.privateKey.value).toBe('')
    expect(emitted()).toEqual(['update:open:false'])
  })
})
