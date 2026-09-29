<template>
  <Teleport to="body">
    <SC_PaperOverlay
      role="dialog"
      :aria-label="t('mesh.chat.paperTitle')"
      @click.self="emit('close')"
    >
      <SC_PaperCard>
        <SC_PaperTitle>{{ t('mesh.chat.paperTitle') }}</SC_PaperTitle>
        <SC_PaperHint>{{ t('mesh.chat.paperHint') }}</SC_PaperHint>
        <SC_PaperQr v-if="qr" :src="qr" :alt="t('mesh.chat.paperTitle')" />
        <SC_PaperLink>{{ uri }}</SC_PaperLink>
        <SC_PaperActions>
          <Button @click="copy">{{ t('mesh.chat.paperCopy') }}</Button>
          <Button type="primary" @click="emit('close')">{{ t('mesh.chat.paperDone') }}</Button>
        </SC_PaperActions>
      </SC_PaperCard>
    </SC_PaperOverlay>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Бумажное сообщение LXMF: QR-код и ссылка `lxm://`. Их передают как угодно —
 * распечаткой, фото, текстом; прочитать может только адресат (его приложение
 * или Sideband / NomadNet).
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { generateQRCode } from '@/blockchain/utils/qr-code'
import {
  SC_PaperActions,
  SC_PaperCard,
  SC_PaperHint,
  SC_PaperLink,
  SC_PaperOverlay,
  SC_PaperQr,
  SC_PaperTitle,
} from './styled'

const props = defineProps<{ uri: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const qr = ref<string | null>(null)

onMounted(async () => {
  try {
    // Ссылка длинная (до ~2,9 КБ) — наименьшая коррекция, как у Sideband.
    qr.value = await generateQRCode(props.uri, { width: 640, errorCorrectionLevel: 'L' })
  } catch {
    qr.value = null
  }
})

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.uri)
    appToast.success({ message: t('mesh.chat.paperCopied') })
  } catch {
    appToast.error({ message: t('mesh.errors.generic', { code: 'clipboard' }) })
  }
}
</script>
