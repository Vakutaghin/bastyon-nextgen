<template>
  <!-- Окно загрузки, как в творческой студии YouTube: файл выбран — загрузка
       уже идёт, пока человек пишет название, описание и теги. Одна кнопка
       «Опубликовать» — и во время загрузки: пост уйдёт сам, когда ролик
       загрузится. Закрыть окно = свернуть: загрузка продолжается в плашке
       «Загрузки». -->
  <Modal
    :open="store.dialogOpen"
    :title="job ? job.title.trim() || job.fileName : t('videoStudio.title')"
    :footer="null"
    :width="560"
    :z-index="1100"
    @cancel="store.closeDialog()"
  >
    <SC_Body v-if="!job">
      <SC_Drop
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <SC_DropIcon><UploadOutlined /></SC_DropIcon>
        <SC_DropTitle>{{ t('videoStudio.dropTitle') }}</SC_DropTitle>
        <SC_Hint>{{ t('videoStudio.dropHint', { max: maxSize }) }}</SC_Hint>
        <SC_PrimaryButton type="button" @click="pick">{{ t('videoStudio.pick') }}</SC_PrimaryButton>
        <input
          ref="fileInput"
          type="file"
          accept="video/*,audio/*"
          hidden
          :aria-label="t('videoStudio.pick')"
          @change="onPicked"
        />
      </SC_Drop>
      <template v-if="desktop">
        <template v-if="compression.available">
          <Checkbox v-model:checked="compress">{{ t('videoStudio.compress') }}</Checkbox>
          <SC_Hint>{{ t('videoStudio.compressHint') }}</SC_Hint>
        </template>
        <!-- Сжимать нечем — модуль сжатия скачивается по кнопке: видео грузят не все. -->
        <SC_Module v-else-if="compression.supported">
          <SC_Hint>{{ t('videoStudio.module.offer', { size: moduleSize }) }}</SC_Hint>
          <template v-if="compression.installing">
            <Progress
              :percent="compression.percent"
              :show-info="false"
              status="active"
              stroke-color="var(--ui-primary)"
            />
            <SC_ModuleRow>
              <SC_Status role="status">{{
                t('videoStudio.module.downloading', { percent: percent(compression.percent) })
              }}</SC_Status>
              <SC_GhostButton type="button" @click="compression.cancel()">
                {{ t('videoStudio.module.cancel') }}
              </SC_GhostButton>
            </SC_ModuleRow>
          </template>
          <SC_ModuleRow v-else>
            <SC_GhostButton type="button" @click="compression.install()">
              {{ t('videoStudio.module.download') }}
            </SC_GhostButton>
          </SC_ModuleRow>
          <SC_Status v-if="compression.error" class="error" role="alert">{{
            compression.error
          }}</SC_Status>
        </SC_Module>
        <SC_Hint v-else-if="compression.available === false">
          {{ t('videoStudio.compressNeedsFfmpeg') }} {{ getFfmpegMissingInstruction() }}
        </SC_Hint>
      </template>
      <SC_Hint>{{ t('videoStudio.backgroundHint') }}</SC_Hint>
    </SC_Body>

    <SC_Body v-else>
      <SC_FileLine>{{ job.fileName }} · {{ formatFileSize(job.size) }}</SC_FileLine>
      <SC_Field>
        <label for="video-studio-title">{{ t('videoStudio.titleLabel') }}</label>
        <Input
          id="video-studio-title"
          :value="job.title"
          :maxlength="120"
          @update:value="(value: string) => store.setTitle(job!.id, value)"
          @blur="store.commitTitle(job.id)"
        />
        <SC_Hint>{{ t('videoStudio.titleHint') }}</SC_Hint>
      </SC_Field>
      <VideoCoverPicker
        v-if="job.cover && coverFile"
        :key="job.id"
        :media="coverFile"
        :cover="job.cover"
        @pick="(image, source, time) => store.setCover(job!.id, image, source, time)"
        @retry="store.retryCover(job!.id)"
      />
      <Progress
        v-if="active"
        :percent="job.progress"
        :show-info="false"
        status="active"
        stroke-color="var(--ui-primary)"
      />
      <SC_Status role="status" :class="{ error: job.status === 'error' }">{{
        statusText
      }}</SC_Status>
      <SC_Hint v-if="job.compressSkipped">{{
        t(`videoStudio.skipped.${job.compressSkipped}`)
      }}</SC_Hint>
      <SC_Hint v-if="active">{{ t('videoStudio.backgroundHint') }}</SC_Hint>

      <!-- Пост к ролику: заголовок — название выше, здесь текст, теги и настройки. -->
      <SC_Field>
        <label for="video-studio-text">{{ t('videoStudio.textLabel') }}</label>
        <Textarea
          id="video-studio-text"
          :value="job.post.message"
          :placeholder="t('videoStudio.textPlaceholder')"
          :auto-size="{ minRows: 3, maxRows: 10 }"
          :disabled="sending"
          @update:value="(value: string) => store.updatePost(job!.id, { message: value })"
        />
      </SC_Field>
      <ComposerTags
        :tags="job.post.tags"
        :full="job.post.tags.length >= MAX_TAGS"
        :max="MAX_TAGS"
        :input-value="job.post.tagInput"
        :disabled="sending"
        :language="job.post.language"
        @update:input-value="(value: string) => store.updatePost(job!.id, { tagInput: value })"
        @add="addTag"
        @remove="removeTag"
        @backspace="removeLastTag"
      />
      <SC_SettingsToggle
        type="button"
        :aria-expanded="settingsOpen"
        :aria-label="t('postComposer.settingsLabel', { summary: settingsSummary })"
        :disabled="sending"
        @click="settingsOpen = !settingsOpen"
      >
        <SettingOutlined />
        <span>{{ settingsSummary }}</span>
        <CaretDownOutlined />
      </SC_SettingsToggle>
      <ComposerSettings
        v-if="settingsOpen"
        :visibility="job.post.visibility"
        :language="job.post.language"
        :is-trial="isTrial"
        :paid-available="paidAvailable"
        :scheduled-time="job.post.scheduledTime"
        :disabled="sending"
        @update:visibility="(value: string) => store.updatePost(job!.id, { visibility: value })"
        @update:language="(value: string) => store.updatePost(job!.id, { language: value })"
        @update:scheduled-time="
          (value: number) => store.updatePost(job!.id, { scheduledTime: value > 1 ? value : 0 })
        "
      />

      <!-- Почему «Опубликовать» серая или что с постом сейчас. -->
      <SC_Status
        v-if="postHint"
        role="status"
        :class="{ error: job.postStatus === 'error' }"
        data-testid="video-post-hint"
        >{{ postHint }}</SC_Status
      >

      <SC_Footer>
        <template v-if="job.status === 'error'">
          <SC_GhostButton type="button" @click="store.dismiss(job.id)">
            {{ t('videoStudio.remove') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="store.retry(job.id)">
            {{ t('videoStudio.retry') }}
          </SC_PrimaryButton>
        </template>
        <template v-else-if="job.postStatus === 'waiting'">
          <SC_GhostButton type="button" @click="store.cancelPublish(job.id)">
            {{ t('videoStudio.cancelPublish') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="store.closeDialog()">
            {{ t('videoStudio.minimize') }}
          </SC_PrimaryButton>
        </template>
        <template v-else>
          <template v-if="active">
            <SC_GhostButton type="button" @click="store.cancel(job.id)">
              {{ t('videoStudio.cancelUpload') }}
            </SC_GhostButton>
            <SC_GhostButton type="button" @click="store.closeDialog()">
              {{ t('videoStudio.minimize') }}
            </SC_GhostButton>
          </template>
          <SC_GhostButton v-else type="button" :disabled="sending" @click="store.closeDialog()">
            {{ t('videoStudio.saveWithoutPost') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" :disabled="!canPublish" @click="publish">
            {{ t('postComposer.publish') }}
          </SC_PrimaryButton>
        </template>
      </SC_Footer>
    </SC_Body>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Checkbox, Input, Modal, Progress } from 'ant-design-vue'

import { bcp47 } from '@/i18n'
import { CaretDownOutlined, SettingOutlined, UploadOutlined } from '@/components/icons'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { appToast } from '@/b-components/app-toast'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import ComposerSettings from '@/b-components/content/post-composer/composer-settings.vue'
import ComposerTags from '@/b-components/content/post-composer/composer-tags.vue'
import { MAX_TAGS } from '@/b-components/content/post-composer/consts'
import { postSettingsSummary } from '@/b-components/content/post-composer/post-settings-summary'
import { withTypedTag } from '@/b-components/content/post-composer/use-post-tags'
import { validatePost } from '@/b-components/content/post-composer/validate-post'
import { MAX_VIDEO_SIZE_BYTES } from '@/services/peertube/peertube-validation'
import { useVideoUploadsStore, type VideoUploadJob } from '@/stores/video-uploads-store'
import { useCompressionModuleStore } from '@/stores/compression-module-store'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { getFfmpegMissingInstruction } from './ffmpeg-instruction'
import VideoCoverPicker from './video-cover-picker.vue'
import {
  SC_Body,
  SC_Drop,
  SC_DropIcon,
  SC_DropTitle,
  SC_Hint,
  SC_FileLine,
  SC_Field,
  SC_Status,
  SC_Footer,
  SC_Module,
  SC_ModuleRow,
  SC_PrimaryButton,
  SC_GhostButton,
  SC_SettingsToggle,
} from './upload-dialog.styled'

const Textarea = Input.TextArea

const { t, locale } = useI18n()
const store = useVideoUploadsStore()
const authStore = useAuthStore()

const job = computed<VideoUploadJob | null>(() => store.dialogJob)
const active = computed(
  () => job.value?.status === 'compressing' || job.value?.status === 'uploading'
)
/** Исходный файл задачи: из него выбирают кадр обложки. */
const coverFile = computed(() => (job.value ? store.fileOf(job.value.id) : null))
/** Пост уходит: форма заблокирована. */
const sending = computed(() => job.value?.postStatus === 'sending')

/** Чего не хватает посту; пока ролик грузится — проверяем его как видео. */
const validationError = computed(() => {
  const post = job.value ? store.postFor(job.value.id) : null
  return post ? validatePost(post) : null
})
const canPublish = computed(() => !sending.value && validationError.value === null)

const postHint = computed<string>(() => {
  const current = job.value
  if (!current) return ''
  switch (current.postStatus) {
    case 'waiting':
      return t('videoStudio.postWaiting')
    case 'sending':
      return t('videoStudio.postSending')
    case 'error':
      return t('videoStudio.postFailedReason', { error: current.postError })
    default:
      return validationError.value ? t(`postMsg.validation.${validationError.value}`) : ''
  }
})

// ── Настройки поста: видимость, язык, время ─────────────────────────────
const settingsOpen = ref(false)
const settingsSummary = computed<string>(() =>
  job.value ? postSettingsSummary(job.value.post, locale.value) : ''
)
/** Пробным аккаунтам видимость не ограничить — как в окне поста. */
const isTrial = computed(() => authStore.getUserState?.trial === true)
const paidSubscriptions = usePaidSubscriptionsStore()
/** «Платным подписчикам» — только у автора с ценой подписки; цену спрашиваем, когда открыли настройки. */
const paidAvailable = computed(() => {
  const address = authStore.getUserAddress
  return !!address && (paidSubscriptions.priceOf(address) ?? 0) > 0
})
watch(settingsOpen, (open) => {
  const address = authStore.getUserAddress
  if (open && address) void paidSubscriptions.ensurePrice(address)
})

const desktop = isTauri()
/** Чем сжимать: модуль сжатия или FFmpeg из системы. */
const compression = useCompressionModuleStore()
/** Сжимать по умолчанию: раньше окно на этой кнопке только это и делало. */
const compress = ref(true)
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Единицы (КБ/МБ/ГБ) — из словаря текущего языка.
const maxSize = computed(() => formatFileSize(MAX_VIDEO_SIZE_BYTES))
const moduleSize = computed(() => formatFileSize(compression.size))

onMounted(() => {
  if (desktop) void compression.refresh()
})

const percent = (value: number): string =>
  new Intl.NumberFormat(bcp47(locale.value), { style: 'percent' }).format(value / 100)

const statusText = computed<string>(() => {
  const current = job.value
  if (!current) return ''
  switch (current.status) {
    case 'compressing':
      return current.waiting
        ? t('videoStudio.statusQueued')
        : t('videoStudio.statusCompressing', { percent: percent(current.progress) })
    case 'uploading':
      return t('videoStudio.statusUploading', { percent: percent(current.progress) })
    case 'done':
      return current.result?.isAudio
        ? t('videoStudio.statusDoneAudio')
        : t('videoStudio.statusDone')
    default:
      return current.error
  }
})

function pick(): void {
  fileInput.value?.click()
}

function startWith(file: File | undefined): void {
  if (!file) return
  const video = file.type.startsWith('video/')
  const id = store.start(file, { compress: !!compression.available && compress.value && video })
  if (id) store.openDialog(id)
}

function onPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  startWith(input.files?.[0])
  input.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  startWith(event.dataTransfer?.files?.[0])
}

// ── Теги поста ───────────────────────────────────────────────────────────
function addTag(raw: string): void {
  const current = job.value
  if (!current) return
  const tags = withTypedTag(current.post.tags, raw)
  if (tags.length > current.post.tags.length) store.updatePost(current.id, { tags, tagInput: '' })
}

function removeTag(tag: string): void {
  const current = job.value
  if (current) store.updatePost(current.id, { tags: current.post.tags.filter((x) => x !== tag) })
}

/** Backspace в пустом поле тега убирает последний тег. */
function removeLastTag(): void {
  const current = job.value
  if (current && !current.post.tagInput && current.post.tags.length) {
    store.updatePost(current.id, { tags: current.post.tags.slice(0, -1) })
  }
}

/**
 * «Опубликовать». Ролик загружен — пост уходит сразу (окно закроется, когда
 * уйдёт). Ещё грузится — окно сворачивается, а пост уйдёт сам, когда ролик
 * загрузится: второй раз нажимать не нужно.
 */
function publish(): void {
  const current = job.value
  if (!current || !canPublish.value) return
  addTag(current.post.tagInput)
  const uploading = current.status !== 'done'
  store.publish(current.id)
  if (!uploading) return
  appToast.info({ message: t('videoStudio.postQueued') })
  store.closeDialog()
}
</script>
