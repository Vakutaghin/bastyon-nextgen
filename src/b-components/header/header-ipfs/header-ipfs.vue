<template>
  <Dropdown
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :overlay-style="{ zIndex: 3000 }"
  >
    <SC_IpfsWrapper :variant="variant" @click="onTriggerClick">
      <LoadingOutlined v-if="variant === 'busy'" spin />
      <WarningFilled v-else-if="variant === 'failed'" />
      <!-- Выключен — серый глобус, запущен — тот же глобус зелёным (цвет у SC_IpfsWrapper). -->
      <GlobalOutlined v-else />
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

        <SC_IpfsActions>
          <Button v-if="status === 'running'" size="small" @click="ipfs.stop()">
            {{ t('header.ipfsStopBtn') }}
          </Button>
          <Button v-else size="small" type="primary" :loading="busy" @click="onEnable">
            {{ installed ? t('header.ipfsStartBtn') : t('header.ipfsInstallBtn') }}
          </Button>
          <Button v-if="status === 'installing'" size="small" @click="ipfs.abortInstall()">
            {{ t('header.ipfsAbortInstall') }}
          </Button>

          <!-- Публикация, список опубликованного и удалённый pin — на странице «Мои файлы». -->
          <Button size="small" @click="openMyFiles">
            {{ t('header.ipfsMyFilesBtn') }}
          </Button>

          <Button size="small" @click="openBrowser">
            {{ t('header.ipfsBrowserBtn') }}
          </Button>
        </SC_IpfsActions>

        <SC_IpfsHint>{{ t('header.ipfsMenuHint') }}</SC_IpfsHint>
      </SC_IpfsMenu>
    </template>
  </Dropdown>

  <IpfsBrowserDialog :open="browserOpen" @close="browserOpen = false" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Dropdown, Button, Modal } from 'ant-design-vue'
import { GlobalOutlined, LoadingOutlined, WarningFilled } from '@/components/icons'
import { useIpfsStore } from '@/stores/ipfs-store'
import IpfsBrowserDialog from './ipfs-browser-dialog.vue'
import {
  SC_IpfsWrapper,
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
const { available, status, message, install, installed, busy } = storeToRefs(ipfs)

const router = useRouter()
const visible = ref(false)
/** IPFS-браузер: адресная строка для ссылки IPFS. */
const browserOpen = ref(false)

function openBrowser(): void {
  visible.value = false
  browserOpen.value = true
}

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
      return installed.value ? t('header.ipfsStatusStopped') : t('header.ipfsStatusNotInstalled')
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

/**
 * Под Tor модуль IPFS недоступен целиком: Kubo не торифицирован (светит IP, а при
 * раздаче — ещё и становится провайдером файла под реальным IP). Показываем ту же
 * модалку, что и при открытии ссылок.
 */
function torBlocked(): boolean {
  if (!ipfs.torActive) return false
  ipfs.showTorBlocked()
  return true
}

function onEnable(): void {
  if (torBlocked()) return
  void ipfs.enable()
}

function openMyFiles(): void {
  visible.value = false
  void router.push('/my-files')
}
</script>
