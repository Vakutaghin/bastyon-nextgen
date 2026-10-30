<template>
  <!-- Чем идут запросы к блокчейну: прокси или ноды напрямую (helpers/api/direct-nodes).
       Только в приложениях: в браузере к нодам напрямую не подключиться. -->
  <SC_ConnectionRow data-testid="connection-mode">
    <SC_SystemLabel>
      <SC_ConnectionHead>
        <SC_SystemTitle>{{ t('settings.network.title') }}</SC_SystemTitle>
        <Tooltip
          :title="t('settings.network.info')"
          :trigger="['hover', 'focus', 'click']"
          placement="top"
        >
          <SC_InfoButton type="button" :aria-label="t('settings.network.infoLabel')">
            <InfoCircleOutlined />
          </SC_InfoButton>
        </Tooltip>
      </SC_ConnectionHead>
      <SC_SystemHint>{{ t('settings.network.hint') }}</SC_SystemHint>
      <SC_ConnectionStatus role="status" data-testid="connection-status">
        {{ status }}
      </SC_ConnectionStatus>
    </SC_SystemLabel>
    <SC_ScaleRow role="radiogroup" :aria-label="t('settings.network.title')">
      <SC_ScaleButton
        v-for="mode in MODES"
        :key="mode"
        role="radio"
        :aria-checked="state.mode === mode"
        :active="state.mode === mode"
        :disabled="torOn"
        type="button"
        @click="setConnectionMode(mode)"
      >
        {{ t(`settings.network.mode.${mode}`) }}
      </SC_ScaleButton>
    </SC_ScaleRow>
  </SC_ConnectionRow>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { InfoCircleOutlined } from '@/components/icons'
import {
  connectionRoute,
  setConnectionMode,
  type ConnectionMode,
} from '@/helpers/api/direct-nodes/connection-route'
import { connectionState as state } from '@/helpers/api/direct-nodes/connection-state'
import { useTorStore } from '@/stores/tor-store'
import {
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemTitle,
} from './system-tab.styled'
import {
  SC_ConnectionHead,
  SC_ConnectionRow,
  SC_ConnectionStatus,
  SC_InfoButton,
} from './connection-mode-section.styled'

const MODES: readonly ConnectionMode[] = ['auto', 'proxy', 'direct']

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

onMounted(() => {
  void connectionRoute().catch(() => {})
})
</script>
