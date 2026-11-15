import { createVNode, defineComponent, h, reactive, render, type AppContext } from 'vue'
import ConfirmDialog from './confirm-dialog.vue'
import type { DialogHandle, DialogKind, DialogOptions } from './dialog-types'

/**
 * Окна вопроса и сообщения из кода — замена antd Modal.confirm / info /
 * success / error / warning с тем же хэндлом `{ update, destroy }`.
 *
 * Окно монтируется с контекстом приложения (`setDialogAppContext` в main.ts):
 * в `content`-функциях работают i18n, роутер и сторы. Само окно — обычная
 * Modal: слой из стека (над окном, из которого спросили), Esc — «Отмена».
 * После анимации закрытия окно снимается и зовётся `afterClose`.
 */

let appContext: AppContext | null = null

/** Контекст приложения для окон из кода; один раз в main.ts. */
export function setDialogAppContext(context: AppContext): void {
  appContext = context
}

function open(kind: DialogKind, initial: DialogOptions): DialogHandle {
  const options = reactive<DialogOptions>({ ...initial })
  const state = reactive({ open: true })
  const container = document.createElement('div')
  let disposed = false

  const close = (): void => {
    state.open = false
  }
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    render(null, container)
    options.afterClose?.()
  }

  const Host = defineComponent({
    setup: () => () =>
      h(ConfirmDialog, { kind, options, open: state.open, onClose: close, onClosed: dispose }),
  })
  const vnode = createVNode(Host)
  vnode.appContext = appContext
  render(vnode, container)

  return {
    update(next) {
      Object.assign(options, next)
    },
    destroy: close,
  }
}

export const confirm = (options: DialogOptions): DialogHandle => open('confirm', options)
export const info = (options: DialogOptions): DialogHandle => open('info', options)
export const success = (options: DialogOptions): DialogHandle => open('success', options)
export const error = (options: DialogOptions): DialogHandle => open('error', options)
export const warning = (options: DialogOptions): DialogHandle => open('warning', options)
