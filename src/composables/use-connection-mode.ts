// «Подключение к сети»: режим, чем запросы идут сейчас, и что с Tor выбор не
// действует. Одна логика для «Настройки → Система» и меню щита в шапке.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setConnectionMode, type ConnectionMode } from '@/helpers/api/direct-nodes/connection-route'
import { connectionState as state } from '@/helpers/api/direct-nodes/connection-state'
import { useTorStore } from '@/stores/tor-store'

export const CONNECTION_MODES: readonly ConnectionMode[] = ['auto', 'proxy', 'direct']

export function useConnectionMode() {
  const { t } = useI18n()
  const tor = useTorStore()
  const torOn = computed(() => tor.wantsTor)

  const status = computed(() => {
    if (torOn.value) return t('settings.network.statusTor')
    if (state.route === null) return t('settings.network.statusChecking')
    if (state.route === 'proxy') return t('settings.network.statusProxy')
    if (state.selecting && !state.nodes) return t('settings.network.statusSearching')
    if (!state.nodes && state.selectFailed) return t('settings.network.statusNoNodes')
    if (!state.nodes) return t('settings.network.statusSearching')
    return state.mode === 'auto'
      ? t('settings.network.statusAutoDirect', { n: state.nodes })
      : t('settings.network.statusDirect', { n: state.nodes })
  })

  return { state, torOn, status, setConnectionMode }
}
