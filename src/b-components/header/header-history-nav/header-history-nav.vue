<template>
  <!-- На телефоне — только «Назад», и только когда есть куда: как в мобильных приложениях. -->
  <SC_HistoryNav v-if="!compact || canBack">
    <Tooltip :title="compact ? undefined : backHint" placement="bottom">
      <SC_HistoryButton
        type="button"
        :aria-label="t('header.back')"
        :aria-disabled="!canBack"
        data-testid="history-back"
        @click="go('back')"
      >
        <ArrowLeftIcon />
      </SC_HistoryButton>
    </Tooltip>
    <Tooltip v-if="!compact" :title="forwardHint" placement="bottom">
      <SC_HistoryButton
        type="button"
        :aria-label="t('header.forward')"
        :aria-disabled="!canForward"
        data-testid="history-forward"
        @click="go('forward')"
      >
        <ArrowRightIcon />
      </SC_HistoryButton>
    </Tooltip>
  </SC_HistoryNav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/icons'
import { historyShortcutHint, isApplePlatform } from '@/composables/use-history-hotkeys'
import { useHistoryNav } from '@/composables/use-history-nav'
import { SC_HistoryNav, SC_HistoryButton } from './styled'

defineProps<{ compact?: boolean }>()

const { t } = useI18n()
const { canBack, canForward, go } = useHistoryNav()

const apple = isApplePlatform()
const backHint = computed(() => `${t('header.back')} (${historyShortcutHint('back', apple)})`)
const forwardHint = computed(
  () => `${t('header.forward')} (${historyShortcutHint('forward', apple)})`
)
</script>
