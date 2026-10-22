<template>
  <!-- Постоянная ссылка: сама ссылка, QR и перевод на новую версию файла. -->
  <Modal
    :open="!!entry"
    :title="t('myFiles.permanent.title')"
    :footer="null"
    :width="520"
    @cancel="emit('close')"
  >
    <SC_LinkBody v-if="entry">
      <SC_LinkNote>{{ t('myFiles.permanent.lead') }}</SC_LinkNote>
      <SC_LinkTarget>{{ t('myFiles.permanent.pointsTo', { name: target }) }}</SC_LinkTarget>

      <SC_LinkBar>
        <Input :value="link" readonly :aria-label="t('myFiles.permanent.title')" />
        <Button @click="emit('copy')">{{ t('myFiles.permanent.copy') }}</Button>
      </SC_LinkBar>

      <SC_LinkQr>
        <img v-if="qr" :src="qr" :alt="t('myFiles.permanent.qr')" />
      </SC_LinkQr>

      <SC_LinkSection>
        <SC_LinkHeading>{{ t('myFiles.permanent.update') }}</SC_LinkHeading>
        <SC_LinkNote>{{ t('myFiles.permanent.updateLead') }}</SC_LinkNote>
        <SC_LinkBar>
          <Select
            v-model:value="next"
            :options="options"
            :placeholder="t('myFiles.permanent.choose')"
            :not-found-content="t('myFiles.permanent.noOther')"
          />
          <Button type="primary" :disabled="!next" :loading="busy" @click="apply">
            {{ t('myFiles.permanent.apply') }}
          </Button>
        </SC_LinkBar>
      </SC_LinkSection>
    </SC_LinkBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal, Select } from 'ant-design-vue'
import { buildNameLink, buildNameValue } from '@/helpers/ipfs/ipfs-viewer'
import type { IpfsShare } from '@/stores/ipfs-store'
import type { OwnName } from '@/stores/ipns-names-store'
import {
  SC_LinkBar,
  SC_LinkBody,
  SC_LinkHeading,
  SC_LinkNote,
  SC_LinkQr,
  SC_LinkSection,
  SC_LinkTarget,
} from './permanent-link-dialog.styled'

const props = defineProps<{
  entry: OwnName | null
  /** Куда ссылка ведёт сейчас — имя файла. */
  target: string
  /** Публичные файлы из «Моих файлов» — новые версии на выбор. */
  files: IpfsShare[]
  busy: boolean
}>()

const emit = defineEmits<{
  close: []
  copy: []
  point: [file: IpfsShare]
}>()

const { t } = useI18n()
const qr = ref('')
/** CID выбранной новой версии. */
const next = ref<string | undefined>()

const link = computed(() => (props.entry ? buildNameLink(props.entry.name) : ''))
const options = computed(() =>
  props.files
    .filter((f) => buildNameValue(f) !== props.entry?.value)
    .map((f) => ({ value: f.cid, label: f.name }))
)

watch(
  link,
  async (value) => {
    qr.value = ''
    next.value = undefined
    if (!value) return
    try {
      const { generateQRCode } = await import('@/blockchain/utils/qr-code')
      const url = await generateQRCode(value, { width: 240, errorCorrectionLevel: 'M' })
      if (link.value === value) qr.value = url
    } catch {
      // Без QR ссылку всё равно можно скопировать.
    }
  },
  { immediate: true }
)

function apply(): void {
  const file = props.files.find((f) => f.cid === next.value)
  if (file) emit('point', file)
}
</script>
