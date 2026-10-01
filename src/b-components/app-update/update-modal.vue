<template>
  <!-- Выше мобильного меню (z-index 1101): проверку запускают и из него. -->
  <!-- Пока обновление ставится, окно не закрывается: иначе не видно, что происходит. -->
  <Modal
    :open="shouldPrompt"
    :title="t('update.title')"
    :footer="null"
    :width="480"
    :z-index="1200"
    :destroy-on-close="true"
    :closable="!installing"
    :mask-closable="!installing"
    :keyboard="!installing"
    @cancel="onLater"
    @update:open="onOpenChange"
  >
    <SC_Wrap v-if="available">
      <SC_Headline>{{ t('update.available', { version: available.tag }) }}</SC_Headline>
      <SC_Meta>{{ t('update.current', { version: currentVersion }) }}</SC_Meta>
      <SC_Meta v-if="publishedLabel">
        {{ t('update.published', { date: publishedLabel }) }}
      </SC_Meta>
      <template v-if="installing">
        <Progress
          :percent="progressPercent"
          :show-info="false"
          status="active"
          stroke-color="var(--ui-primary)"
        />
        <SC_Meta role="status">{{ progressLabel }}</SC_Meta>
      </template>
      <SC_Meta v-else>{{ hint }}</SC_Meta>

      <SC_Footer>
        <SC_GhostButton type="button" :disabled="installing" @click="onSkip">
          {{ t('update.skip') }}
        </SC_GhostButton>
        <SC_GhostButton type="button" :disabled="installing" @click="onLater">
          {{ t('update.later') }}
        </SC_GhostButton>
        <SC_PrimaryButton
          v-if="installsItself"
          type="button"
          :disabled="installing"
          @click="onInstall"
        >
          {{ t('update.install') }}
        </SC_PrimaryButton>
        <SC_PrimaryButton v-else type="button" @click="onDownload">
          {{ t('update.download') }}
        </SC_PrimaryButton>
      </SC_Footer>
    </SC_Wrap>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { bcp47 } from '@/i18n'
import { Modal, Progress } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { useAppUpdate } from '@/composables/use-app-update'
import { copyText } from '@/helpers/common/clipboard'
import {
  SC_Wrap,
  SC_Headline,
  SC_Meta,
  SC_Footer,
  SC_GhostButton,
  SC_PrimaryButton,
} from './update-modal.styled'

const { t, locale } = useI18n()
const {
  available,
  shouldPrompt,
  currentVersion,
  maybeCheck,
  dismiss,
  skip,
  openReleasePage,
  canInstall,
  installing,
  installProgress,
  installFailed,
  install,
} = useAppUpdate()

/** Компьютер ставит обновление сам; не вышло — как раньше, страница релиза. */
const installsItself = computed<boolean>(() => canInstall && !installFailed.value)

const hint = computed<string>(() => {
  if (installFailed.value) return t('update.installFailed')
  return t(canInstall ? 'update.installHint' : 'update.downloadHint')
})

const progressPercent = computed<number>(() =>
  Math.round((installProgress.value?.fraction ?? 0) * 100)
)

const progressLabel = computed<string>(() => {
  const progress = installProgress.value
  if (progress?.phase === 'install') return t('update.installing')
  if (progress?.fraction == null) return t('update.downloadingNoSize')
  const percent = new Intl.NumberFormat(bcp47(locale.value), { style: 'percent' }).format(
    progress.fraction
  )
  return t('update.downloading', { percent })
})

const publishedLabel = computed<string>(() => {
  const iso = available.value?.publishedAt
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(bcp47(locale.value))
})

function onLater(): void {
  dismiss()
}

function onOpenChange(value: boolean): void {
  if (!value && !installing.value) onLater()
}

async function onInstall(): Promise<void> {
  // Удалось — приложение перезапускается; нет — окно предложит страницу релиза.
  await install()
}

async function onSkip(): Promise<void> {
  await skip()
}

async function onDownload(): Promise<void> {
  // Закрываем сразу: страница релиза открывается снаружи, и возвращаться
  // пользователю в висящую модалку незачем.
  const url = available.value?.pageUrl
  dismiss()
  if ((await openReleasePage()) || !url) return
  // Браузер не открылся (на компьютере до 0.9.3 — всегда): ссылка в буфер и
  // на экран, а не молча закрытое окно.
  const copied = await copyText(url)
  appToast.error({
    message: t(copied ? 'update.openFailed' : 'update.openFailedManual', { url }),
    duration: 15,
  })
}

onMounted(() => {
  void maybeCheck()
})
</script>
