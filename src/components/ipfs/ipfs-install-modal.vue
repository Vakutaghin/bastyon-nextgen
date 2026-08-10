<template>
  <Modal
    :open="ipfs.modalOpen"
    :width="440"
    :centered="true"
    :closable="ipfs.modalPhase !== 'progress'"
    :mask-closable="ipfs.modalPhase !== 'progress'"
    :keyboard="ipfs.modalPhase !== 'progress'"
    :z-index="3000"
    :footer="null"
    @cancel="ipfs.closeModal()"
  >
    <template #title>{{ title }}</template>

    <SC_IpfsBody>
      <!-- Веб/мобилка: фича только для десктопа -->
      <template v-if="ipfs.modalPhase === 'desktop-only'">
        <SC_IpfsText>{{ t('header.ipfsDesktopOnlyContent') }}</SC_IpfsText>
        <SC_ModalActions>
          <Button type="primary" block @click="ipfs.closeModal()">
            {{ t('header.ipfsOk') }}
          </Button>
        </SC_ModalActions>
      </template>

      <!-- Tor включён: публичный шлюз деанонимизировал бы — просим локальную ноду -->
      <template v-else-if="ipfs.modalPhase === 'tor-blocked'">
        <SC_IpfsText>{{ t('header.ipfsTorBlockedContent') }}</SC_IpfsText>
        <SC_ModalActions>
          <Button type="primary" block @click="ipfs.closeModal()">
            {{ t('header.ipfsOk') }}
          </Button>
        </SC_ModalActions>
      </template>

      <!-- Настройка удалённого pin (durability) -->
      <template v-else-if="ipfs.modalPhase === 'pin-config'">
        <SC_IpfsText>{{ t('header.ipfsPinConfigContent') }}</SC_IpfsText>
        <SC_IpfsText v-if="ipfs.pinServiceConfigured">
          {{ t('header.ipfsPinConfigured') }}
        </SC_IpfsText>
        <Input v-model:value="pinEndpoint" :placeholder="t('header.ipfsPinEndpointPlaceholder')" />
        <Input
          v-model:value="pinKey"
          type="password"
          :placeholder="t('header.ipfsPinKeyPlaceholder')"
        />
        <SC_ModalActions>
          <Button
            type="primary"
            block
            :loading="pinSaving"
            :disabled="!pinEndpoint || !pinKey"
            @click="onSavePin"
          >
            {{ t('header.ipfsPinSaveBtn') }}
          </Button>
          <Button v-if="ipfs.pinServiceConfigured" block danger @click="onClearPin">
            {{ t('header.ipfsPinClearBtn') }}
          </Button>
        </SC_ModalActions>
      </template>

      <!-- Первый клик: предложение установить модуль -->
      <template v-else-if="ipfs.modalPhase === 'consent'">
        <SC_IpfsText>{{ t('header.ipfsConsentContent') }}</SC_IpfsText>
        <SC_ModalActions>
          <Button type="primary" block @click="ipfs.chooseInstall()">
            {{ t('header.ipfsConsentInstall') }}
          </Button>
          <Button block @click="ipfs.choosePublic()">
            {{ t('header.ipfsConsentPublic') }}
          </Button>
        </SC_ModalActions>
      </template>

      <!-- Скачивание/запуск -->
      <template v-else>
        <SC_IpfsText>{{ progressLine }}</SC_IpfsText>
        <SC_IpfsProgressOuter>
          <SC_IpfsProgressInner :pct="progressPct" />
        </SC_IpfsProgressOuter>
        <SC_ModalActions>
          <!-- Прекратить ОЖИДАНИЕ (докачка продолжится в фоне) — чтобы масочная
               модалка не блокировала UI, если демон завис. -->
          <Button block @click="ipfs.cancelInstall()">
            {{ t('header.ipfsCancel') }}
          </Button>
        </SC_ModalActions>
      </template>
    </SC_IpfsBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button, Input } from 'ant-design-vue'
import { useIpfsStore } from '@/stores/ipfs-store'
import { SC_ModalActions } from '@/components/modal'
import {
  SC_IpfsBody,
  SC_IpfsText,
  SC_IpfsProgressOuter,
  SC_IpfsProgressInner,
} from './styled'

const { t } = useI18n()
const ipfs = useIpfsStore()

const pinEndpoint = ref('')
const pinKey = ref('')
const pinSaving = ref(false)

onMounted(() => {
  ipfs.hydrate().catch(() => {})
})

const title = computed<string>(() => {
  switch (ipfs.modalPhase) {
    case 'desktop-only':
      return t('header.ipfsDesktopOnlyTitle')
    case 'tor-blocked':
      return t('header.ipfsTorBlockedTitle')
    case 'pin-config':
      return t('header.ipfsPinConfigTitle')
    case 'consent':
      return t('header.ipfsConsentTitle')
    default:
      return t('header.ipfsInstallTitle')
  }
})

async function onSavePin(): Promise<void> {
  pinSaving.value = true
  try {
    const ok = await ipfs.setPinService(pinEndpoint.value.trim(), pinKey.value.trim())
    if (ok) {
      pinKey.value = ''
      ipfs.closeModal()
    }
  } finally {
    pinSaving.value = false
  }
}

function onClearPin(): void {
  ipfs.clearPinService()
  pinEndpoint.value = ''
  pinKey.value = ''
}

const progressLine = computed<string>(() => {
  if (ipfs.status === 'installing' && ipfs.install) {
    return t('header.ipfsInstallingProgress', {
      pct: Math.round(ipfs.install.fraction * 100),
      message: ipfs.install.message,
    })
  }
  if (ipfs.status === 'starting') return t('header.ipfsStarting')
  return t('header.ipfsPreparing')
})

const progressPct = computed<number>(() => {
  if (ipfs.status === 'installing' && ipfs.install) return ipfs.install.fraction * 100
  if (ipfs.status === 'starting') return 97
  return 0
})
</script>
