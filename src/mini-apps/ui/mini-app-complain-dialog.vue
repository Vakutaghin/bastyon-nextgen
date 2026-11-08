<template>
  <!-- Жалоба на содержимое мини-приложения (complain): причины — как у прежнего
       клиента, запись уходит команде Pocketnet без адреса пользователя.
       Монтируется только на время запроса (src.vue, v-if). -->
  <Modal
    :open="true"
    :width="440"
    centered
    :closable="!sending"
    :mask-closable="!sending"
    @cancel="close"
  >
    <template #title>
      {{ t('miniapps.complainTitle', { name: request?.appName ?? '' }) }}
      <HelpLink topic="reports#mini-apps" />
    </template>
    <SC_ModalBody>
      <SC_ReportBody>
        <SC_ReportIntro>{{ t('miniapps.complainIntro') }}</SC_ReportIntro>
        <SC_ReasonList role="radiogroup">
          <SC_ReasonItem
            v-for="id in REASONS"
            :key="id"
            type="button"
            role="radio"
            :aria-checked="selected === id"
            :active="selected === id"
            :danger="id === CSAM"
            :disabled="sending"
            @click="selected = id"
          >
            <SC_ReasonRadio :class="{ checked: selected === id }" />
            <span>{{ t(`report.reason${id}`) }}</span>
          </SC_ReasonItem>
        </SC_ReasonList>
        <SC_FieldError v-if="error" role="alert">{{ error }}</SC_FieldError>
      </SC_ReportBody>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button :disabled="sending" @click="close">{{ t('report.cancel') }}</Button>
        <Button
          type="primary"
          danger
          :loading="sending"
          :disabled="selected === null"
          @click="send"
        >
          {{ t('report.submit') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'

import { appToast } from '@/b-components/app-toast'
import { SC_ModalActions, SC_ModalBody } from '@/components/modal'
import { appFetch } from '@/helpers/api/fetch-strategies'
import {
  SC_FieldError,
  SC_ReasonItem,
  SC_ReasonList,
  SC_ReasonRadio,
  SC_ReportBody,
  SC_ReportIntro,
} from '@/b-components/report/report-modal.styled'
import { sendMiniAppComplaint, type ComplaintReasonId } from '../core/miniapp-complaint'
import { complainRequest, resolveComplainDialog } from './complain-dialog-controller'
import HelpLink from '@/b-components/help/help-link.vue'

/** Все шесть причин прежнего клиента, включая «Нарушение авторских прав». */
const REASONS: ComplaintReasonId[] = [1, 2, 3, 4, 5, 6]
const CSAM: ComplaintReasonId = 2

const { t, locale } = useI18n()
const request = complainRequest.value
const selected = ref<ComplaintReasonId | null>(null)
const sending = ref(false)
const error = ref('')

async function send(): Promise<void> {
  if (!request || selected.value === null || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await sendMiniAppComplaint(
      {
        entity: request.entity,
        reason: selected.value,
        language: locale.value,
        appVersion: __APP_VERSION__,
      },
      { fetch: (url, init) => appFetch(url, init) }
    )
    appToast.success({ message: t('report.sentToast') })
    resolveComplainDialog(true)
  } catch (e) {
    console.warn('[mini-apps] complaint not sent', e)
    error.value = t('miniapps.complainFailed')
  } finally {
    sending.value = false
  }
}

function close(): void {
  if (!sending.value) resolveComplainDialog(false)
}

declare const __APP_VERSION__: string
</script>
