<template>
  <Modal
    :open="shouldPrompt"
    :title="t('update.title')"
    :footer="null"
    :width="480"
    :destroy-on-close="true"
    @cancel="onLater"
    @update:open="onOpenChange"
  >
    <SC_Wrap v-if="available">
      <SC_Headline>{{ t('update.available', { version: available.tag }) }}</SC_Headline>
      <SC_Meta>{{ t('update.current', { version: currentVersion }) }}</SC_Meta>
      <SC_Meta v-if="publishedLabel">
        {{ t('update.published', { date: publishedLabel }) }}
      </SC_Meta>
      <SC_Meta>{{ t('update.downloadHint') }}</SC_Meta>

      <SC_Footer>
        <SC_GhostButton type="button" @click="onSkip">
          {{ t('update.skip') }}
        </SC_GhostButton>
        <SC_GhostButton type="button" @click="onLater">
          {{ t('update.later') }}
        </SC_GhostButton>
        <SC_PrimaryButton type="button" @click="onDownload">
          {{ t('update.download') }}
        </SC_PrimaryButton>
      </SC_Footer>
    </SC_Wrap>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { useAppUpdate } from '@/composables/use-app-update'
import {
  SC_Wrap,
  SC_Headline,
  SC_Meta,
  SC_Footer,
  SC_GhostButton,
  SC_PrimaryButton,
} from './update-modal.styled'

const { t, locale } = useI18n()
const { available, shouldPrompt, currentVersion, maybeCheck, dismiss, skip, openReleasePage } =
  useAppUpdate()

const publishedLabel = computed<string>(() => {
  const iso = available.value?.publishedAt
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale.value)
})

function onLater(): void {
  dismiss()
}

function onOpenChange(value: boolean): void {
  if (!value) onLater()
}

async function onSkip(): Promise<void> {
  await skip()
}

async function onDownload(): Promise<void> {
  // Закрываем сразу: страница релиза открывается снаружи, и возвращаться
  // пользователю в висящую модалку незачем.
  dismiss()
  await openReleasePage()
}

onMounted(() => {
  void maybeCheck()
})
</script>
