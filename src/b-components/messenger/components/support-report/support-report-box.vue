<template>
  <SC_ReportBox :class="{ tall }">
    <SC_ReportHead>
      <SC_ReportIcon aria-hidden="true"><FileTextOutlined /></SC_ReportIcon>
      <SC_ReportTitle :title="title">{{ title }}</SC_ReportTitle>
      <SC_ReportPart v-if="total > 1">
        {{ t('messenger.supportReport.part', { part, total }) }}
      </SC_ReportPart>
      <SC_CopyButton
        type="button"
        :class="{ done: copied }"
        :aria-label="copyLabel"
        :title="copyLabel"
        @click.stop="copy"
      >
        <CheckOutlined v-if="copied" />
        <CopyOutlined v-else />
      </SC_CopyButton>
    </SC_ReportHead>
    <!-- Прокручиваемая область — с клавиатуры тоже: tabindex. -->
    <SC_ReportCode :class="{ tall }" tabindex="0" :aria-label="title">{{ body }}</SC_ReportCode>
  </SC_ReportBox>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckOutlined, CopyOutlined, FileTextOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { copyText } from '@/helpers/common/clipboard'
import {
  SC_ReportBox,
  SC_ReportHead,
  SC_ReportIcon,
  SC_ReportTitle,
  SC_ReportPart,
  SC_CopyButton,
  SC_ReportCode,
} from './styled'

const props = withDefaults(
  defineProps<{
    /** Текст в окошке — он же копируется. */
    body: string
    part?: number
    total?: number
    /** Повыше: в окне подтверждения, где окошко — главное. */
    tall?: boolean
  }>(),
  { part: 1, total: 1, tall: false }
)

const { t } = useI18n()

const title = computed(() => t('messenger.supportReport.title'))

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
const copyLabel = computed(() =>
  copied.value ? t('messenger.supportReport.copied') : t('messenger.supportReport.copy')
)

async function copy(): Promise<void> {
  if (!(await copyText(props.body))) {
    appToast.error({ message: t('messenger.supportReport.copyFailed') })
    return
  }
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 1500)
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>
