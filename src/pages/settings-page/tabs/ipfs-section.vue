<template>
  <!-- Модуль Kubo (десктоп): скачать и включить — то же, что кнопка в шапке,
       удалить — с диска целиком. -->
  <SC_IpfsCard v-if="ipfs.available" data-testid="ipfs-module">
    <SC_IpfsHead>
      <SC_IpfsTitle>{{ t('settings.ipfs.title') }}</SC_IpfsTitle>
      <SC_IpfsStatus>{{ statusLabel }}</SC_IpfsStatus>
    </SC_IpfsHead>
    <SC_IpfsDesc>{{ t('settings.ipfs.description') }}</SC_IpfsDesc>
    <ModuleInfo module="ipfs" />
    <SC_IpfsActions>
      <Button v-if="ipfs.installed" danger :loading="ipfs.busy" @click="onUninstall">
        {{ t('settings.ipfs.uninstall') }}
      </Button>
      <Button
        v-else
        :loading="ipfs.status === 'installing'"
        data-testid="ipfs-install"
        @click="onInstall"
      >
        {{ t('settings.ipfs.install') }}
      </Button>
    </SC_IpfsActions>
  </SC_IpfsCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { useIpfsStore } from '@/stores/ipfs-store'
import { useStorageStore } from '@/stores/storage-store'
import ModuleInfo from './module-info.vue'
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

const storage = useStorageStore()

const statusLabel = computed<string>(() => {
  if (ipfs.status === 'installing') return t('settings.ipfs.statusInstalling')
  if (!ipfs.installed) return t('settings.ipfs.notInstalled')
  return ipfs.status === 'running'
    ? t('settings.ipfs.statusRunning')
    : t('settings.ipfs.statusStopped')
})

/** Как кнопка в шапке: под Tor модуль недоступен (Kubo светил бы адрес). */
async function onInstall(): Promise<void> {
  if (ipfs.torActive) {
    ipfs.showTorBlocked()
    return
  }
  await ipfs.enable()
  await storage.refresh()
}

function onUninstall(): void {
  Modal.confirm({
    title: t('header.ipfsUninstallConfirmTitle'),
    content: t('header.ipfsUninstallConfirmContent'),
    okText: t('header.ipfsUninstallBtn'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await ipfs.uninstall()
      await storage.refresh()
    },
  })
}
</script>
