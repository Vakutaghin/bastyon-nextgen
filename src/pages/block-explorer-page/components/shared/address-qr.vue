<template>
  <SC_QrFrame
    type='button'
    :title="t('explorerShared.qrCodeOfAddress', { address })"
    @click='expanded = true'
  >
    <SC_QrPlaceholder v-if='!dataUrl' />
    <img v-else :src='dataUrl' :alt="t('explorerShared.qrCodeOfAddress', { address })" />
  </SC_QrFrame>

  <Teleport to='body'>
    <SC_QrModalBackdrop v-if='expanded' @click.self='expanded = false'>
      <SC_QrModalCard>
        <SC_QrModalImage v-if='dataUrl' :src='dataUrl' :alt="t('explorerShared.qrCodeOfAddress', { address })" />
        <SC_QrModalAddr>{{ address }}</SC_QrModalAddr>
      </SC_QrModalCard>
    </SC_QrModalBackdrop>
  </Teleport>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateQRCode } from '@/blockchain/utils/qr-code'
import {
  SC_QrFrame,
  SC_QrPlaceholder,
  SC_QrModalBackdrop,
  SC_QrModalCard,
  SC_QrModalImage,
  SC_QrModalAddr,
} from './address-qr.styled'

const { t } = useI18n()

const p = defineProps<{
  address: string
}>()

const dataUrl = ref<string>('')
const expanded = ref(false)

async function render() {
  if (!p.address) {
    dataUrl.value = ''
    return
  }
  try {
    dataUrl.value = await generateQRCode(p.address, {
      width: 320,
      errorCorrectionLevel: 'M',
    })
  } catch {
    dataUrl.value = ''
  }
}

onMounted(render)
watch(() => p.address, render)

// Escape — закрыть модал.
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') expanded.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
