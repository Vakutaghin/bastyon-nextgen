<template>
  <SC_Composer>
    <ComposerRepost v-if="isRepost && repostSource" :source="repostSource" />

    <SC_ArticleToggle v-if="!isRepost && !isEdit">
      <input type="checkbox" :checked="articleMode" @change="onToggleArticle" />
      {{ t('postComposer.articleToggle') }}
    </SC_ArticleToggle>

    <!-- Заголовок статьи / видео (peertube-видео требует caption) -->
    <SC_TitleInput
      v-if="articleMode || needsCaption"
      :value="caption"
      :placeholder="titlePlaceholder"
      :aria-label="titlePlaceholder"
      @input="onCaptionInput(($event.target as HTMLInputElement).value)"
    />

    <!-- Тело статьи (Editor.js) -->
    <ComposerArticleEditor
      v-if="articleMode"
      :model-value="articleContent"
      @update:model-value="onArticleChange"
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
        @input="onComposerInput"
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
      </SC_MentionDropdown>
    </SC_MentionAnchor>

    <SC_EmojiRow v-if="!articleMode">
      <APopover v-model:open="emojiOpen" trigger="click" placement="topLeft">
        <template #content>
          <CommentEmojiPicker @select="insertEmoji" />
        </template>
        <SC_EmojiBtn type="button" :title="t('postComposer.emoji')" @click.stop>
          <SmileOutlined />
        </SC_EmojiBtn>
      </APopover>
      <!-- Голосовой ввод: речь на языке поста, текст — в позицию курсора. -->
      <VoiceInputButton :get-element="getTextareaEl" :language="language" />
    </SC_EmojiRow>

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
      @remove="dismissLinkPreview"
    />

    <!-- Своё видео или аудио: файл → PeerTube → peertube://… в `u` поста. -->
    <ComposerVideo
      v-if="
        !isRepost &&
        !isEdit &&
        !articleMode &&
        (videoUploading || hasUploadedVideo || !images.length)
      "
      :pointer="uploadedVideoUrl"
      :get-auth="videoAuth"
      :get-title="() => caption"
      @uploaded="onVideoUploaded"
      @removed="clearUploadedVideoUrl"
      @uploading="setVideoUploading"
      @auth-required="requireLogin"
    />

    <!-- Картинки и своё видео в одном посте не живут: в ленте картинки заслонили бы плеер. -->
    <ComposerImages
      v-if="!isRepost && !articleMode && !videoUploading && !hasUploadedVideo"
      :images="images"
      :full="imagesFull"
      @add="addImageFiles"
      @remove="removeImage"
      @rotate="rotateImage"
      @edit="onEditImage"
    />

    <ComposerTags
      v-if="!isRepost"
      :tags="tags"
      :full="tagsFull"
      :input-value="tagInput"
      @update:input-value="tagInput = $event"
      @add="addTag"
      @remove="removeTag"
      @backspace="onTagBackspace"
    />

    <!-- Опрос опубликованного поста не меняется: голоса привязаны к вариантам. -->
    <ComposerPoll
      v-if="!isRepost && !isEdit && !articleMode"
      :active="pollActive"
      :title="pollTitle"
      :options="pollOptions"
      @toggle="togglePoll"
      @update:title="setPollTitle"
      @update-option="setPollOption"
      @add-option="addPollOption"
      @remove-option="removePollOption"
    />

    <ComposerSettings
      :visibility="visibility"
      :language="language"
      :is-trial="isTrial"
      :paid-available="paidVisibilityAvailable"
      :scheduled-time="scheduledTime"
      @update:visibility="visibility = $event"
      @update:language="language = $event"
      @update:scheduled-time="setScheduledTime"
    />

    <SC_Footer>
      <SC_Hint :danger="showError">
        {{ hintText }}
      </SC_Hint>
      <SC_FooterActions>
        <!-- Черновик хранится целиком; «Очистить» стирает его вместе с формой. -->
        <Button v-if="canReset" type="text" @click="confirmReset">
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
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Popover } from 'ant-design-vue'
import { SmileOutlined } from '@/components/icons'

import Button from '@/components/button'
// Переиспользуем компактный пикер из формы комментария (общий список COMMON_EMOJIS).
import CommentEmojiPicker from '@/b-components/content/post-card/components/post-card-comments/comment-emoji-picker.vue'

import ComposerArticleEditor from './composer-article-editor.vue'
import ComposerImages from './composer-images.vue'
import ComposerPoll from './composer-poll.vue'
import ComposerRepost from './composer-repost.vue'
import ComposerSettings from './composer-settings.vue'
import ComposerTags from './composer-tags.vue'
import ComposerUrlPreview from './composer-url-preview.vue'
import ComposerVideo from './composer-video.vue'
import LinkPreviewCard from '@/b-components/content/link-preview-card/link-preview-card.vue'
import VoiceInputButton from '@/b-components/voice-input/voice-input-button.vue'
import type { ComposerMode, ComposerSource } from './composer-source'
import { useComposerMentions } from './use-composer-mentions'
import {
  SC_ArticleToggle,
  SC_Composer,
  SC_EmojiBtn,
  SC_EmojiRow,
  SC_Footer,
  SC_FooterActions,
  SC_Hint,
  SC_MentionAnchor,
  SC_MentionAvatar,
  SC_MentionDropdown,
  SC_MentionName,
  SC_MentionRow,
  SC_Textarea,
  SC_TitleInput,
} from './post-composer.styled'
import { MAX_TAGS } from './consts'
import { usePostComposer } from './use-post-composer'

const props = defineProps<{ mode?: ComposerMode; source?: ComposerSource | null }>()
const emit = defineEmits<{
  (e: 'published', txid: string): void
  /** Идёт публикация — модалку закрывать нельзя (S29). */
  (e: 'busyChange', busy: boolean): void
}>()

const { t } = useI18n()

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

const onToggleArticle = (e: Event): void => {
  articleMode.value = (e.target as HTMLInputElement).checked
}

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

// Клик по строке (mousedown.prevent) успевает отработать до закрытия по blur.
function onComposerBlur(): void {
  window.setTimeout(closeMentions, 120)
}

const titlePlaceholder = computed(() =>
  articleMode.value
    ? t('postComposer.articleTitlePlaceholder')
    : t('postComposer.videoTitlePlaceholder')
)

// Подсказка: при ошибке валидации (когда уже что-то введено) — показать её; иначе счётчик тегов.
const hasContent = computed(
  () => message.value.trim().length > 0 || (articleMode.value && !!articleContent.value)
)
const showError = computed(() => validationError.value !== null && hasContent.value)
const hintText = computed(() => {
  if (showError.value) return t(`postMsg.validation.${validationError.value}`)
  if (isRepost) return ''
  return t('postComposer.tagsCount', { count: tags.value.length, max: MAX_TAGS })
})
</script>
