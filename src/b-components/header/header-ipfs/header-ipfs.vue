<template>
  <Dropdown
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :overlay-style="{ zIndex: 3000 }"
  >
    <SC_IpfsWrapper :variant="variant" @click="onTriggerClick">
      <CheckCircleFilled v-if="variant === 'ready'" :style="ICON_SIZE_XL" />
      <LoadingOutlined v-else-if="variant === 'busy'" :style="ICON_SIZE_XL" spin />
      <WarningFilled v-else-if="variant === 'failed'" :style="ICON_SIZE_XL" />
      <GlobalOutlined v-else :style="ICON_SIZE_XL" />
      <SC_IpfsDot v-if="updateAvailable" />
    </SC_IpfsWrapper>

    <template #overlay>
      <SC_IpfsMenu @click.stop @mousedown.stop>
        <SC_IpfsRow>
          <SC_IpfsTitle>IPFS</SC_IpfsTitle>
        </SC_IpfsRow>

        <SC_IpfsStatusLine>{{ statusLine }}</SC_IpfsStatusLine>

        <SC_IpfsProgressOuter v-if="showProgress">
          <SC_IpfsProgressInner :pct="progressPct" />
        </SC_IpfsProgressOuter>

        <SC_IpfsHint v-if="updateAvailable">{{ t('header.ipfsUpdateHint') }}</SC_IpfsHint>

        <SC_IpfsActions>
          <Button
            v-if="status === 'running'"
            size="small"
            @click="ipfs.stop()"
          >
            {{ t('header.ipfsStopBtn') }}
          </Button>
          <Button
            v-else
            size="small"
            type="primary"
            :loading="busy"
            @click="ipfs.enable()"
          >
            {{ installed ? t('header.ipfsStartBtn') : t('header.ipfsInstallBtn') }}
          </Button>

          <Button
            v-if="updateAvailable"
            size="small"
            :loading="busy"
            @click="ipfs.update()"
          >
            {{ t('header.ipfsUpdateBtn') }}
          </Button>

          <Button v-if="installed && !busy" size="small" danger @click="onUninstall">
            {{ t('header.ipfsUninstallBtn') }}
          </Button>
        </SC_IpfsActions>

        <SC_IpfsHint>{{ t('header.ipfsMenuHint') }}</SC_IpfsHint>
      </SC_IpfsMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Dropdown, Button, Modal } from 'ant-design-vue'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import {
  GlobalOutlined,
  LoadingOutlined,
  WarningFilled,
  CheckCircleFilled,
} from '@ant-design/icons-vue'
import { useIpfsStore } from '@/stores/ipfs-store'
import {
  SC_IpfsWrapper,
  SC_IpfsDot,
  SC_IpfsMenu,
  SC_IpfsRow,
  SC_IpfsTitle,
  SC_IpfsStatusLine,
  SC_IpfsProgressOuter,
  SC_IpfsProgressInner,
  SC_IpfsActions,
  SC_IpfsHint,
} from './styled'

const { t } = useI18n()

const ipfs = useIpfsStore()
const { available, status, message, install, installed, updateAvailable, busy } = storeToRefs(ipfs)

const visible = ref(false)

onMounted(() => {
  ipfs.hydrate().catch(() => {})
})

const variant = computed<'off' | 'busy' | 'ready' | 'failed'>(() => {
  if (status.value === 'running') return 'ready'
  if (status.value === 'failed') return 'failed'
  if (status.value === 'installing' || status.value === 'starting') return 'busy'
  return 'off'
})

const statusLine = computed<string>(() => {
  switch (status.value) {
    case 'installing':
      return install.value
        ? t('header.ipfsInstallingProgress', {
            pct: Math.round(install.value.fraction * 100),
            message: install.value.message,
          })
        : t('header.ipfsPreparing')
    case 'starting':
      return t('header.ipfsStarting')
    case 'running':
      return t('header.ipfsStatusRunning')
    case 'failed':
      return message.value
        ? t('header.ipfsStatusError', { message: message.value })
        : t('header.ipfsError')
    default:
      return installed.value
        ? t('header.ipfsStatusStopped')
        : t('header.ipfsStatusNotInstalled')
  }
})

const showProgress = computed<boolean>(
  () => status.value === 'installing' || status.value === 'starting'
)

const progressPct = computed<number>(() => {
  if (status.value === 'installing' && install.value) return install.value.fraction * 100
  if (status.value === 'starting') return 97
  return 0
})

function onTriggerClick(): void {
  if (!available.value) {
    Modal.info({
      title: t('header.ipfsDesktopOnlyTitle'),
      content: t('header.ipfsDesktopOnlyContent'),
    })
    return
  }
  visible.value = !visible.value
}

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
