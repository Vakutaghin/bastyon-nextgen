import { computed } from 'vue'
import { VideoCameraAddOutlined } from '@ant-design/icons-vue'
import { SC_FabButton } from './styled'
import { isTauri } from '../../utils/environment'

export function useFabButton() {
  const isTauriEnv = computed(() => isTauri())

  return {
    VideoCameraAddOutlined,
    SC_FabButton,
    isTauriEnv
  }
}
