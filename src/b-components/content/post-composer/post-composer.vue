<template>
  <SC_Composer @dragover="onDragOver" @drop="onDrop">
    <!-- Окно поста, как у современных лент: текст без рамки, вложения под ним,
         внизу панель — фото, видео, опрос, эмодзи, голос — и сводка настроек
         «Все · Русский · Сразу», которая раскрывает сами настройки. Статья —
         отдельный вид: крупный заголовок и редактор, как у Medium. -->
    <ComposerRepost v-if="isRepost && repostSource" :source="repostSource" />

    <SC_ModeSwitch
      v-if="!isRepost && !isEdit"
      role="group"
      :aria-label="t('postComposer.modeLabel')"
    >
      <SC_ModeButton
        type="button"
        :class="{ active: !articleMode }"
        :aria-pressed="!articleMode"
        :disabled="submitting"
        @click="articleMode = false"
      >
        {{ t('postComposer.modePost') }}
      </SC_ModeButton>
      <SC_ModeButton
        type="button"
        :class="{ active: articleMode }"
        :aria-pressed="articleMode"
        :disabled="submitting"
        @click="articleMode = true"
      >
        {{ t('postComposer.modeArticle') }}
      </SC_ModeButton>
    </SC_ModeSwitch>

    <!-- Заголовок статьи / видео (peertube-видео требует caption) -->
    <SC_TitleInput
      v-if="articleMode || needsCaption"
      :class="{ article: articleMode }"
      :value="caption"
      :placeholder="titlePlaceholder"
      :aria-label="titlePlaceholder"
      :disabled="submitting"
      @input="onCaptionInput(($event.target as HTMLInputElement).value)"
    />

    <!-- Тело статьи -->
    <ComposerArticleEditor
      v-if="articleMode"
      :model-value="articleContent"
      :disabled="submitting"
      @update:model-value="onArticleChange"
      @uploading="setArticleUploading"
    />

    <!-- Тело обычного поста -->
    <SC_MentionAnchor v-if="!articleMode">
      <SC_Textarea
        ref="textareaRef"
        :value="message"
        :placeholder="
          isRepost ? t('postComposer.repostPlaceholder') : t('postComposer.placeholder')
        "
        :aria-label="t('postComposer.placeholder')"
        :disabled="submitting"
        @input="onComposerInput"
        @paste="onPaste"
        @keydown="onMentionKeydown"
        @keyup="updateMentions"
        @click="updateMentions"
        @blur="onComposerBlur"
      />

      <SC_MentionDropdown v-if="mentionShow">
        <SC_MentionRow
          v-for="(user, idx) in mentionResults"
          :key="user.address"
          :class="{ active: mentionHighlight === idx }"
          @mousedown.prevent="selectMention(user)"
        >
          <SC_MentionAvatar>
            <img v-if="user.avatar" :src="user.avatar" :alt="user.name || user.address" />
            <span v-else>{{ (user.name || user.address).charAt(0).toUpperCase() }}</span>
          </SC_MentionAvatar>
          <SC_MentionName>{{ user.name || user.address }}</SC_MentionName>
        </SC_MentionRow>
        <SC_MentionStatus v-if="!mentionResults.length && mentionSearching">
          {{ t('postComposer.mentionSearching') }}
        </SC_MentionStatus>
      </SC_MentionDropdown>
    </SC_MentionAnchor>

    <!-- Превью видео по ссылке (youtube/vimeo/peertube), найденной в тексте -->
    <ComposerUrlPreview
      v-if="!articleMode && parsedVideo.kind && !hasUploadedVideo"
      :parsed="parsedVideo"
    />
    <LinkPreviewCard
      v-else-if="!articleMode && linkPreviewUrl"
      :url="linkPreviewUrl"
      removable
      fallback
      :disabled="submitting"
      @remove="dismissLinkPreview"
    />

    <!-- Своё видео или аудио: файл → PeerTube → peertube://… в `u` поста.
         Файл выбирают кнопкой панели; здесь — загрузка, обложка, «Убрать». -->
    <ComposerVideo
      v-if="canAttachVideo"
      ref="videoRef"
      hide-pick
      :pointer="uploadedVideoUrl"
      :get-auth="videoAuth"
      :get-title="() => caption"
      :disabled="submitting"
      @uploaded="onVideoUploaded"
      @removed="clearUploadedVideoUrl"
      @uploading="setVideoUploading"
      @auth-required="requireLogin"
    />

    <!-- Картинки и своё видео в одном посте не живут: в ленте картинки заслонили бы плеер. -->
    <ComposerImages
      v-if="canAttachImages && images.length"
      :images="images"
      :full="imagesFull"
      :disabled="submitting"
      @add="addImageFiles"
      @remove="removeImage"
      @rotate="rotateImage"
      @edit="onEditImage"
    />

    <!-- Опрос опубликованного поста не меняется: голоса привязаны к вариантам. -->
    <ComposerPoll
      v-if="canPoll"
      :active="pollActive"
      :title="pollTitle"
      :options="pollOptions"
      :disabled="submitting"
      @toggle="togglePoll"
      @update:title="setPollTitle"
      @update-option="setPollOption"
      @add-option="addPollOption"
      @remove-option="removePollOption"
    />

    <ComposerTags
      v-if="!isRepost"
      :tags="tags"
      :full="tagsFull"
      :max="MAX_TAGS"
      :input-value="tagInput"
      :disabled="submitting"
      :language="language"
      @update:input-value="tagInput = $event"
      @add="addTag"
      @remove="removeTag"
      @backspace="onTagBackspace"
    />

    <SC_Divider />

    <SC_Toolbar>
      <SC_ToolGroup v-if="!articleMode">
        <!-- Картинки и своё видео вместе не живут: недоступная кнопка не видна. -->
        <template v-if="canAddImages">
          <SC_ToolButton
            type="button"
            :aria-label="t('postComposer.addImages')"
            :title="t('postComposer.addImages')"
            :disabled="submitting"
            @click="imagesInputRef?.click()"
          >
            <PictureOutlined />
          </SC_ToolButton>
          <input
            ref="imagesInputRef"
            type="file"
            accept="image/*"
            multiple
            hidden
            :aria-label="t('postComposer.addImages')"
            :disabled="submitting"
            @change="onImagesPicked"
          />
        </template>
        <template v-if="canAddVideo">
          <SC_ToolButton
            type="button"
            :aria-label="t('postComposer.videoUpload')"
            :title="t('postComposer.videoUpload')"
            :disabled="submitting"
            @click="videoInputRef?.click()"
          >
            <VideoCameraAddOutlined />
          </SC_ToolButton>
          <input
            ref="videoInputRef"
            type="file"
            :accept="VIDEO_ACCEPT"
            hidden
            :aria-label="t('postComposer.videoUpload')"
            :disabled="submitting"
            @change="onVideoPicked"
          />
        </template>
        <SC_ToolButton
          v-if="canPoll"
          type="button"
          :class="{ active: pollActive }"
          :aria-label="t('postComposer.pollToggle')"
          :aria-pressed="pollActive"
          :title="t('postComposer.pollToggle')"
          :disabled="submitting"
          @click="togglePoll(!pollActive)"
        >
          <PollIcon />
        </SC_ToolButton>
        <APopover v-model:open="emojiOpen" trigger="click" placement="topLeft">
          <template #content>
            <CommentEmojiPicker @select="insertEmoji" />
          </template>
          <SC_ToolButton
            type="button"
            :aria-label="t('postComposer.emoji')"
            :title="t('postComposer.emoji')"
            :disabled="submitting"
            @click.stop
          >
            <SmileOutlined />
          </SC_ToolButton>
        </APopover>
        <!-- Голосовой ввод: речь на языке поста, текст — в позицию курсора. -->
        <VoiceInputButton
          :get-element="getTextareaEl"
          :language="language"
          :disabled="submitting"
        />
      </SC_ToolGroup>

      <SC_SettingsChip
        type="button"
        :class="{ open: settingsOpen }"
        :aria-expanded="settingsOpen"
        :aria-label="t('postComposer.settingsLabel', { summary: settingsSummary })"
        :disabled="submitting"
        @click="settingsOpen = !settingsOpen"
      >
        <SettingOutlined />
        <SC_SettingsSummary>{{ settingsSummary }}</SC_SettingsSummary>
        <CaretDownOutlined />
      </SC_SettingsChip>
    </SC_Toolbar>

    <SC_SettingsPanel v-if="settingsOpen">
      <ComposerSettings
        :visibility="visibility"
        :language="language"
        :is-trial="isTrial"
        :paid-available="paidVisibilityAvailable"
        :scheduled-time="scheduledTime"
        :disabled="submitting"
        @update:visibility="visibility = $event"
        @update:language="language = $event"
        @update:scheduled-time="setScheduledTime"
      />
    </SC_SettingsPanel>

    <SC_Footer>
      <SC_Hint v-if="hintText" :danger="showError">
        {{ hintText }}
      </SC_Hint>
      <SC_FooterActions>
        <!-- Черновик хранится целиком; «Очистить» стирает его вместе с формой. -->
        <Button v-if="canReset" type="text" :disabled="submitting" @click="confirmReset">
          {{ t('postComposer.reset') }}
        </Button>
        <Button type="primary" :loading="submitting" :disabled="!canPublish" @click="publish">
          {{ publishLabel }}
        </Button>
      </SC_FooterActions>
    </SC_Footer>
  </SC_Composer>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Popover } from 'ant-design-vue'
import {
  CaretDownOutlined,
  PictureOutlined,
  PollIcon,
  SettingOutlined,
  SmileOutlined,
  VideoCameraAddOutlined,
} from '@/components/icons'
import { bcp47, LOCALE_NAMES, type Locale } from '@/i18n'

import Button from '@/components/button'
// Переиспользуем компактный пикер из формы комментария (общий список COMMON_EMOJIS).
import CommentEmojiPicker from '@/b-components/content/post-card/components/post-card-comments/comment-emoji-picker.vue'

// Редактор статьи (TipTap) — отдельным чанком: нужен, только когда пишут статью.
const ComposerArticleEditor = defineAsyncComponent(() => import('./composer-article-editor.vue'))
import ComposerImages from './composer-images.vue'
import ComposerPoll from './composer-poll.vue'
import ComposerRepost from './composer-repost.vue'
import ComposerSettings from './composer-settings.vue'
import ComposerTags from './composer-tags.vue'
import ComposerUrlPreview from './composer-url-preview.vue'
import ComposerVideo from './composer-video.vue'
import LinkPreviewCard from '@/b-components/content/link-preview-card/link-preview-card.vue'
import VoiceInputButton from '@/b-components/voice-input/voice-input-button.vue'
import type { ComposerMode, ComposerSource, ComposerVideoPrefill } from './composer-source'
import { useComposerMentions } from './use-composer-mentions'
import {
  SC_Composer,
  SC_Divider,
  SC_Footer,
  SC_FooterActions,
  SC_Hint,
  SC_MentionAnchor,
  SC_MentionAvatar,
  SC_MentionDropdown,
  SC_MentionName,
  SC_MentionRow,
  SC_MentionStatus,
  SC_ModeButton,
  SC_ModeSwitch,
  SC_SettingsChip,
  SC_SettingsPanel,
  SC_SettingsSummary,
  SC_Textarea,
  SC_TitleInput,
  SC_ToolButton,
  SC_ToolGroup,
  SC_Toolbar,
} from './post-composer.styled'
import { MAX_TAGS, VIDEO_ACCEPT } from './consts'
import { usePostComposer } from './use-post-composer'

const props = defineProps<{
  mode?: ComposerMode
  source?: ComposerSource | null
  /** Новый пост с уже загруженным видео (из «Моих видео»). */
  video?: ComposerVideoPrefill | null
}>()
const emit = defineEmits<{
  (e: 'published', txid: string): void
  /** Идёт публикация — модалку закрывать нельзя (S29). */
  (e: 'busyChange', busy: boolean): void
}>()

const { t, locale } = useI18n()

const {
  isEdit,
  isRepost,
  repostSource,
  publishLabel,
  message,
  caption,
  tags,
  tagInput,
  submitting,
  images,
  imagesFull,
  visibility,
  language,
  isTrial,
  paidVisibilityAvailable,
  articleMode,
  articleContent,
  parsedVideo,
  needsCaption,
  linkPreviewUrl,
  dismissLinkPreview,
  uploadedVideoUrl,
  clearUploadedVideoUrl,
  videoUploading,
  setVideoUploading,
  setArticleUploading,
  hasUploadedVideo,
  onVideoUploaded,
  videoAuth,
  requireLogin,
  pollActive,
  pollTitle,
  pollOptions,
  scheduledTime,
  validationError,
  canPublish,
  canReset,
  tagsFull,
  onMessageInput,
  onCaptionInput,
  onArticleChange,
  togglePoll,
  setPollTitle,
  setPollOption,
  addPollOption,
  removePollOption,
  setScheduledTime,
  addTag,
  removeTag,
  onTagBackspace,
  addImageFiles,
  removeImage,
  rotateImage,
  replaceImage,
  reset,
  publish,
} = usePostComposer({
  onPublished: (txid) => emit('published', txid),
  mode: props.mode,
  source: props.source,
  video: props.video,
})

// Пока идёт публикация, модалку закрывать нельзя: закрытая посреди отправки
// она оставляла черновик, и повторная публикация давала дубль поста (S29).
watch(submitting, (busy) => emit('busyChange', busy))

function confirmReset(): void {
  Modal.confirm({
    title: t('postComposer.resetConfirmTitle'),
    content: t('postComposer.resetConfirmText'),
    okText: t('postComposer.reset'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: reset,
  })
}

// ── Панель вложений ─────────────────────────────────────────────────
// Картинки, своё видео и опрос: статье и репосту — нет, видео и опрос при
// правке опубликованного поста — тоже нет. Картинки и видео вместе не живут.
const canAttachImages = computed(() => !isRepost && !articleMode.value)
const canAttachVideo = computed(() => !isRepost && !isEdit && !articleMode.value)
const canPoll = computed(() => !isRepost && !isEdit && !articleMode.value)
const canAddImages = computed(
  () =>
    canAttachImages.value && !imagesFull.value && !videoUploading.value && !hasUploadedVideo.value
)
const canAddVideo = computed(
  () =>
    canAttachVideo.value && !images.value.length && !videoUploading.value && !hasUploadedVideo.value
)

const imagesInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)
const videoRef = ref<{ start: (file: File) => Promise<void> } | null>(null)

function onImagesPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) addImageFiles(Array.from(input.files))
  input.value = '' // тот же файл можно выбрать снова
}

/** Картинки из буфера или перетащенные: в пост, если их сюда можно. */
function imageFiles(data: DataTransfer | null | undefined): File[] {
  return Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/'))
}

function onPaste(event: Event): void {
  const files = imageFiles((event as Event & { clipboardData?: DataTransfer | null }).clipboardData)
  if (!files.length || !canAddImages.value || submitting.value) return
  event.preventDefault()
  addImageFiles(files)
}

// Статья ловит перетаскивание сама (картинка встаёт в текст), пост — здесь.
function onDragOver(event: DragEvent): void {
  if (!articleMode.value && canAddImages.value && event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
  }
}

function onDrop(event: DragEvent): void {
  if (articleMode.value) return
  const files = imageFiles(event.dataTransfer)
  if (!files.length) return
  event.preventDefault()
  if (canAddImages.value && !submitting.value) addImageFiles(files)
}

function onVideoPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (picked) void videoRef.value?.start(picked)
}

// ── Настройки публикации: сводка и сами поля ───────────────────────────
const settingsOpen = ref(false)

const VISIBILITY_LABELS: Record<string, string> = {
  '0': 'postComposer.visibilityAll',
  '1': 'postComposer.visibilitySubscribers',
  '2': 'postComposer.visibilityRegistered',
  '3': 'postComposer.visibilityPaid',
}

/** «Все · Русский · Сразу» — что сейчас выбрано, одной строкой. */
const settingsSummary = computed<string>(() => {
  const when =
    scheduledTime.value > 1
      ? new Intl.DateTimeFormat(bcp47(locale.value), {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(scheduledTime.value * 1000)
      : t('postComposer.schedulePlaceholder')
  return [
    t(VISIBILITY_LABELS[visibility.value] ?? VISIBILITY_LABELS['0']!),
    LOCALE_NAMES[language.value as Locale] ?? language.value,
    when,
  ].join(' · ')
})

const onEditImage = (payload: { id: string; base64: string }): void => {
  replaceImage(payload.id, payload.base64)
}

// ── Эмодзи-пикер для тела поста ─────────────────────────────────────
const APopover = Popover
const textareaRef = ref<HTMLTextAreaElement | { $el?: HTMLTextAreaElement } | null>(null)
const emojiOpen = ref(false)

function getTextareaEl(): HTMLTextAreaElement | null {
  const r = textareaRef.value
  if (!r) return null
  if (typeof (r as HTMLTextAreaElement).focus === 'function') return r as HTMLTextAreaElement
  return (r as { $el?: HTMLTextAreaElement }).$el ?? null
}

function insertEmoji(emoji: string): void {
  emojiOpen.value = false
  const current = message.value || ''
  const el = getTextareaEl()
  if (!el) {
    onMessageInput(current + emoji)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  onMessageInput(current.slice(0, start) + emoji + current.slice(end))
  void nextTick(() => {
    el.focus()
    const pos = start + emoji.length
    try {
      el.setSelectionRange(pos, pos)
    } catch {
      /* noop */
    }
  })
}

// ── @-меншены в теле поста ──────────────────────────────────────────
const {
  show: mentionShow,
  results: mentionResults,
  searching: mentionSearching,
  highlight: mentionHighlight,
  update: updateMentions,
  close: closeMentions,
  select: selectMention,
  onKeydown: onMentionKeydown,
} = useComposerMentions({
  getText: () => message.value || '',
  getEl: getTextareaEl,
  setText: onMessageInput,
})

function onComposerInput(e: Event): void {
  onMessageInput((e.target as HTMLTextAreaElement).value)
  updateMentions()
}

// Пока идёт публикация, форма заблокирована целиком (поля — через :disabled):
// картинки уже грузятся по списку на момент нажатия, правка на полпути попала
// бы в пост лишь частично, а после публикации форма всё равно очищается.
// Пикер эмодзи и подсказки @-имён вставляют текст мимо поля — их закрываем.
watch(submitting, (busy) => {
  if (!busy) return
  emojiOpen.value = false
  closeMentions()
})

// Клик по строке (mousedown.prevent) успевает отработать до закрытия по blur.
function onComposerBlur(): void {
  window.setTimeout(closeMentions, 120)
}

const titlePlaceholder = computed(() =>
  articleMode.value
    ? t('postComposer.articleTitlePlaceholder')
    : t('postComposer.videoTitlePlaceholder')
)

// Подсказка — ошибка валидации, когда уже что-то введено (счётчик тегов — в их строке).
const hasContent = computed(
  () => message.value.trim().length > 0 || (articleMode.value && !!articleContent.value)
)
const showError = computed(() => validationError.value !== null && hasContent.value)
const hintText = computed(() =>
  showError.value ? t(`postMsg.validation.${validationError.value}`) : ''
)

// Поле текста растёт по мере набора, как в ленте: без своей прокрутки.
function autosize(): void {
  const el = getTextareaEl()
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(message, () => void nextTick(autosize))
watch(articleMode, (article) => {
  if (!article) void nextTick(autosize)
})
onMounted(autosize)
</script>
