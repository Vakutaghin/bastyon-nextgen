/**
 * Окно жалобы на содержимое мини-приложения (`complain`): singleton, как окно
 * оплаты. Окно (mini-app-complain-dialog.vue, смонтировано в src.vue) само
 * отправляет жалобу и отвечает, ушла ли она.
 */

import { computed, ref, shallowRef } from 'vue'
import type { ComplaintEntity } from '../core/miniapp-complaint'

export interface ComplainRequest {
  appName: string
  entity: ComplaintEntity
}

const requestRef = shallowRef<ComplainRequest | null>(null)
const isOpenRef = ref(false)
let currentResolve: ((sent: boolean) => void) | null = null

export const isComplainDialogOpen = computed(() => isOpenRef.value)
export const complainRequest = computed(() => requestRef.value)

export class ComplainDialogBusyError extends Error {
  constructor() {
    super('complain:busy')
    this.name = 'ComplainDialogBusyError'
  }
}

/** true — жалоба ушла, false — окно закрыли. */
export function openComplainDialog(req: ComplainRequest, signal?: AbortSignal): Promise<boolean> {
  if (isOpenRef.value) return Promise.reject(new ComplainDialogBusyError())
  if (signal?.aborted) return Promise.resolve(false)
  requestRef.value = req
  isOpenRef.value = true
  return new Promise((resolve) => {
    currentResolve = resolve
    signal?.addEventListener(
      'abort',
      () => {
        if (currentResolve === resolve) resolveComplainDialog(false)
      },
      { once: true }
    )
  })
}

export function resolveComplainDialog(sent: boolean): void {
  isOpenRef.value = false
  requestRef.value = null
  const resolve = currentResolve
  currentResolve = null
  resolve?.(sent)
}

export function _resetComplainDialogForTests(): void {
  resolveComplainDialog(false)
}
