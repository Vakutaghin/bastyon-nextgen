<template>
  <SC_SupportBar
    type="button"
    :aria-haspopup="'dialog'"
    :aria-label="t('messenger.supportReport.barLabel')"
    :title="t('messenger.supportReport.barLabel')"
    @click="openConsent"
  >
    <SC_ReportIcon aria-hidden="true"><FileTextOutlined /></SC_ReportIcon>
    <SC_SupportBarText>
      <SC_SupportBarTitle>{{ t('messenger.supportReport.title') }}</SC_SupportBarTitle>
      <SC_SupportBarHint>{{ t('messenger.supportReport.barHint') }}</SC_SupportBarHint>
    </SC_SupportBarText>
    <SC_SupportBarAction aria-hidden="true">
      {{ t('messenger.supportReport.barAction') }}
    </SC_SupportBarAction>
  </SC_SupportBar>

  <!-- Над виджетом чата (2500), как окна чаевых и жалобы. -->
  <Modal
    :open="open"
    :width="520"
    :centered="true"
    :closable="!sending"
    :mask-closable="!sending"
    :z-index="2700"
    :title="t('messenger.supportReport.consentTitle')"
    @cancel="close"
  >
    <SC_ModalBody>
      <SC_ConsentText>
        <p>{{ t('messenger.supportReport.consentLead') }}</p>
        <ul>
          <li v-for="key in CONSENT_ITEMS" :key="key">
            {{ t(`messenger.supportReport.consentItems.${key}`) }}
          </li>
        </ul>
        <SC_ConsentNote>{{ t('messenger.supportReport.consentNever') }}</SC_ConsentNote>
        <SC_ConsentPreviewLabel>
          {{
            messages.length > 1
              ? t('messenger.supportReport.consentPreviewParts', { count: messages.length })
              : t('messenger.supportReport.consentPreview')
          }}
        </SC_ConsentPreviewLabel>
        <SupportReportBox v-if="json" :body="json" tall />
        <Spin v-else />
      </SC_ConsentText>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button :disabled="sending" @click="close">{{ t('messenger.cancel') }}</Button>
        <Button type="primary" :loading="sending" :disabled="!messages.length" @click="send">
          {{ t('messenger.supportReport.send') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal, Spin } from 'ant-design-vue'
import { FileTextOutlined } from '@/components/icons'
import { SC_ModalActions, SC_ModalBody } from '@/components/modal'
import { appToast } from '@/b-components/app-toast'
import { buildReportMessages } from '../../lib/support-report'
import { collectSupportReport, reportJson } from '../../lib/support-report-data'
import { useMessengerStore } from '../../store'
import SupportReportBox from './support-report-box.vue'
import {
  SC_SupportBar,
  SC_ReportIcon,
  SC_SupportBarText,
  SC_SupportBarTitle,
  SC_SupportBarHint,
  SC_SupportBarAction,
  SC_ConsentText,
  SC_ConsentNote,
  SC_ConsentPreviewLabel,
} from './styled'

const CONSENT_ITEMS = ['app', 'system', 'settings', 'network', 'errors'] as const

const props = defineProps<{ chatId: string }>()

const { t } = useI18n()
const store = useMessengerStore()

const open = ref(false)
const sending = ref(false)
/** Ровно то, что уйдёт: собрано при открытии окна и показано в нём. */
const json = ref<string | null>(null)

function caption(part: number, total: number): string {
  return total > 1
    ? t('messenger.supportReport.captionPart', { part, total })
    : t('messenger.supportReport.caption')
}

const messages = computed<string[]>(() => {
  if (!json.value) return []
  try {
    return buildReportMessages(json.value, caption)
  } catch (error) {
    console.error('[support-report] сведения не делятся на сообщения:', error)
    return []
  }
})

async function openConsent(): Promise<void> {
  json.value = null
  open.value = true
  try {
    json.value = reportJson(await collectSupportReport())
  } catch (error) {
    console.error('[support-report] не удалось собрать сведения:', error)
    open.value = false
    appToast.error({ message: t('messenger.supportReport.collectFailed') })
  }
}

function close(): void {
  if (sending.value) return
  open.value = false
}

async function send(): Promise<void> {
  if (!json.value || sending.value) return
  sending.value = true
  try {
    // По очереди: части должны прийти в своём порядке. Не ушедшая часть
    // остаётся в чате с кнопкой «Повторить», как любое сообщение.
    for (const text of messages.value) await store.sendMessage(props.chatId, text)
    open.value = false
  } finally {
    sending.value = false
  }
}
</script>
