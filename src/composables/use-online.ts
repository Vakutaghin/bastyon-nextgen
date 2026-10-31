// Есть ли сеть — по событиям `online`/`offline` окна. Одна подписка на всё
// приложение. «Есть» не значит, что ноды отвечают: только что устройство
// куда-то подключено.

import { readonly, ref, type Ref } from 'vue'

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
let watching = false

export function useOnline(): Readonly<Ref<boolean>> {
  if (!watching && typeof window !== 'undefined') {
    watching = true
    // До первой подписки сеть могла пропасть — берём то, что есть сейчас.
    online.value = navigator.onLine !== false
    window.addEventListener('online', () => (online.value = true))
    window.addEventListener('offline', () => (online.value = false))
  }
  return readonly(online)
}
