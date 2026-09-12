<template>
  <!-- Управление скачанным модулем Kubo. Показываем только когда он установлен
       (на вебе/без установки — удалять нечего, секция скрыта). -->
  <SC_IpfsCard v-if="ipfs.installed">
    <SC_IpfsHead>
      <SC_IpfsTitle>{{ t('settings.ipfs.title') }}</SC_IpfsTitle>
      <SC_IpfsStatus>{{ statusLabel }}</SC_IpfsStatus>
    </SC_IpfsHead>
    <SC_IpfsDesc>{{ t('settings.ipfs.description') }}</SC_IpfsDesc>
    <SC_IpfsActions>
      <Button danger :loading="ipfs.busy" @click="onUninstall">
        {{ t('settings.ipfs.uninstall') }}
      </Button>
    </SC_IpfsActions>
  </SC_IpfsCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { useIpfsStore } from '@/stores/ipfs-store'
import {
  SC_IpfsCard,
  SC_IpfsHead,
  SC_IpfsTitle,
  SC_IpfsStatus,
  SC_IpfsDesc,
  SC_IpfsActions,
} from './ipfs-section.styled'

const { t } = useI18n()
const ipfs = useIpfsStore()

// На случай открытия настроек без смонтированной шапки — подтянем статус модуля.
onMounted(() => {
  ipfs.hydrate().catch(() => {})
})

const statusLabel = computed<string>(() =>
  ipfs.status === 'running' ? t('settings.ipfs.statusRunning') : t('settings.ipfs.statusStopped')
)

function onUninstall(): void {
  Modal.confirm({
    title: t('header.ipfsUninstallConfirmTitle'),
    content: t('header.ipfsUninstallConfirmContent'),
    okText: t('header.ipfsUninstallBtn'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => ipfs.uninstall(),
  })
}
</script>
