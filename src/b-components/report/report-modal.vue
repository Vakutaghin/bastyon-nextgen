<template>
  <Modal
    :open="reportStore.isOpen"
    :width="440"
    :centered="true"
    :closable="!sending"
    :mask-closable="!sending"
    :z-index="2700"
    :title="title"
    @cancel="handleCancel"
  >
    <SC_ModalBody>
      <SC_ReportBody>
        <!-- Жалобу сеть примет только от «акулы»: остальным — сразу, почему,
             и что можно сделать самому. -->
        <template v-if="canFlag === false">
          <SC_ReportIntro data-testid="report-shark-only">{{
            t('report.sharkOnly')
          }}</SC_ReportIntro>
          <SC_ReportIntro>{{ t('report.sharkOnlyHint') }}</SC_ReportIntro>
        </template>

        <SC_ReportIntro v-else>{{ t('report.intro') }}</SC_ReportIntro>

        <SC_ReasonList v-if="canFlag !== false">
          <SC_ReasonItem
            v-for="gid in REASON_GIDS"
            :key="gid"
            type="button"
            :active="selected === gid"
            :danger="gid === CSAM_GID"
            :disabled="sending"
            @click="selected = gid"
          >
            <SC_ReasonRadio :class="{ checked: selected === gid }" />
            <span>{{ t(`report.reason${gid}`) }}</span>
          </SC_ReasonItem>
        </SC_ReasonList>

        <SC_FieldError v-if="error">{{ error }}</SC_FieldError>
      </SC_ReportBody>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <template v-if="canFlag === false">
          <Button type="default" @click="handleCancel">{{ t('report.close') }}</Button>
          <Button v-if="canBlockAuthor" type="primary" danger @click="onBlockAuthor">
            {{ t('postCard.blockAuthor') }}
          </Button>
        </template>
        <template v-else>
          <Button type="default" :disabled="sending" @click="handleCancel">
            {{ t('report.cancel') }}
          </Button>
          <Button
            type="primary"
            danger
            :loading="sending || canFlag === undefined"
            :disabled="!canSend"
            @click="onSubmit"
          >
            {{ t('report.submit') }}
          </Button>
        </template>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { useReportStore, useUserRelationsStore } from '@/stores'
import { useAuthStore } from '@/blockchain'
import { useRelationActions } from '@/composables/use-relation-actions'
import { SC_ModalBody, SC_ModalActions } from '@/components/modal'
import {
  SC_ReportBody,
  SC_ReportIntro,
  SC_ReasonList,
  SC_ReasonItem,
  SC_ReasonRadio,
  SC_FieldError,
} from './report-modal.styled'

// Причины для контента (пост/коммент) = gid'ы [1,2,3,4,6] из legacy (без #5
// «копирайт», который только для жалоб на пользователя). См. mdls.js complain.
const REASON_GIDS = [1, 2, 3, 4, 6] as const
// gid 2 — «Детская эксплуатация» (CSAM): подсвечиваем как самую серьёзную.
const CSAM_GID = 2

const { t } = useI18n()
const reportStore = useReportStore()

const selected = ref<number | null>(null)
const sending = ref(false)
const error = ref<string | null>(null)
/**
 * Есть ли у аккаунта право жаловаться (бейдж «shark»): undefined — ещё
 * проверяем, null — не узнали (решит сеть при отправке).
 */
const canFlag = ref<boolean | null | undefined>(undefined)

const authStore = useAuthStore()
const relations = useUserRelationsStore()
const { confirmBlock } = useRelationActions()
const canBlockAuthor = computed<boolean>(
  () => !!reportStore.authorAddress && !relations.isBlocked(reportStore.authorAddress)
)

const title = computed<string>(() =>
  reportStore.type === 'comment' ? t('report.titleComment') : t('report.titlePost')
)

const canSend = computed<boolean>(
  () => !sending.value && selected.value !== null && canFlag.value !== undefined
)

// Сбрасываем выбор при каждом открытии.
watch(
  () => reportStore.isOpen,
  (isOpen) => {
    if (isOpen) {
      selected.value = null
      error.value = null
      sending.value = false
      void checkFlagRight()
    }
  }
)

let check = 0
async function checkFlagRight(): Promise<void> {
  const mine = ++check
  canFlag.value = undefined
  const { accountCanFlag } = await import('@/blockchain/core/actions/complain-action')
  const result = await accountCanFlag(authStore.getUserAddress ?? '')
  if (mine === check) canFlag.value = result
}

/** Не «акуле» вместо жалобы — блокировка автора: его посты и комментарии пропадут. */
function onBlockAuthor(): void {
  const address = reportStore.authorAddress
  reportStore.close()
  confirmBlock(address)
}

function handleCancel(): void {
  if (sending.value) return
  reportStore.close()
}

async function onSubmit(): Promise<void> {
  if (!canSend.value || selected.value === null) return
  sending.value = true
  error.value = null
  try {
    const { sendComplaint } = await import('@/blockchain/core/actions/complain-action')
    await sendComplaint({
      contentHash: reportStore.contentHash,
      authorAddress: reportStore.authorAddress,
      reason: selected.value,
    })
    appToast.success({ message: t('report.sentToast') })
    reportStore.close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('report.failed')
  } finally {
    sending.value = false
  }
}
</script>
