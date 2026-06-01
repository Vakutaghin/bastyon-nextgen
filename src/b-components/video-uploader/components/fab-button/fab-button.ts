import { ref, onMounted, onBeforeUnmount } from 'vue'
import { VideoCameraAddOutlined } from '@ant-design/icons-vue'
import { SC_FabButton } from './styled'
import { isTauri, isTauriAsync } from '../../utils/environment'

const isTauriBuild =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_TAURI === 'true'

export function useFabButton() {
  const isTauriEnv = ref(isTauri())
  let pollIntervalId: ReturnType<typeof setInterval> | null = null
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null

  onMounted(async () => {
    // Async и опрос — только для сборки Tauri; в браузере без VITE_TAURI не вызываем
    if (!isTauriBuild) return

    if (!isTauriEnv.value) {
      isTauriEnv.value = await isTauriAsync()
    }
    pollIntervalId = setInterval(() => {
      if (isTauriEnv.value) return
      isTauriEnv.value = isTauri()
    }, 500)
    pollTimeoutId = setTimeout(() => {
      if (pollIntervalId) clearInterval(pollIntervalId)
      pollIntervalId = null
    }, 5000)
  })

  onBeforeUnmount(() => {
    if (pollIntervalId) clearInterval(pollIntervalId)
    if (pollTimeoutId) clearTimeout(pollTimeoutId)
  })

  return {
    VideoCameraAddOutlined,
    SC_FabButton,
    isTauriEnv
  }
}
