<template>
  <!-- Ролик в «Медиастудии»: плиткой или строкой списка, как «Контент» в
       творческой студии YouTube. Разметка одна, раскладку задаёт CSS. Обложка
       и название открывают окно ролика; строка списка — тоже, целиком. -->
  <SC_Item :class="layout" @click="onItemClick">
    <SC_Thumb
      type="button"
      :aria-label="t('mediaStudio.openDetails', { name: video.name })"
      @click="emit('details', 'details')"
    >
      <img v-if="thumbSrc" :src="thumbSrc" alt="" loading="lazy" @error="onThumbError" />
      <SC_ThumbEmpty v-else aria-hidden="true">
        <MusicIcon v-if="video.isAudio" />
        <PlayCircleOutlined v-else />
      </SC_ThumbEmpty>
      <SC_ThumbTag v-if="video.isAudio"><MusicIcon />{{ t('mediaStudio.audio') }}</SC_ThumbTag>
      <SC_Duration v-if="video.duration">{{ formatDuration(video.duration) }}</SC_Duration>
    </SC_Thumb>

    <SC_Main>
      <SC_Title>
        <button type="button" :title="video.name" @click="emit('details', 'details')">
          {{ video.name }}
        </button>
      </SC_Title>
      <SC_Description :class="{ empty: !video.description }">
        {{ video.description || t('mediaStudio.noDescription') }}
      </SC_Description>
      <SC_Meta>{{ metaLine }}</SC_Meta>
    </SC_Main>

    <SC_Status>
      <SC_Badge v-if="video.processing">{{ t('videoStudio.processing') }}</SC_Badge>
      <SC_Badge v-if="video.posted" class="posted">{{ t('videoStudio.posted') }}</SC_Badge>
      <SC_Badge v-else-if="publishing" class="publishing">{{
        t('videoStudio.publishing')
      }}</SC_Badge>
      <SC_Badge v-else>{{ t('videoStudio.notPosted') }}</SC_Badge>
    </SC_Status>

    <SC_Cell class="date">{{ date }}</SC_Cell>
    <SC_Cell class="views">{{ video.views === null ? '—' : formatCount(video.views) }}</SC_Cell>

    <SC_Actions>
      <Button
        v-if="video.posts.length === 1"
        size="small"
        :loading="openingTxid === video.posts[0]!.txid"
        @click="emit('open-post', video.posts[0]!.txid)"
      >
        {{ t('videoStudio.openPost') }}
      </Button>
      <Dropdown v-else-if="video.posts.length > 1" :trigger="['click']" placement="bottomLeft">
        <Button size="small" :loading="video.posts.some((post) => post.txid === openingTxid)">
          {{ t('videoStudio.openPosts', { count: video.posts.length }) }}
        </Button>
        <template #overlay>
          <Menu :items="postItems" @click="({ key }) => emit('open-post', String(key))" />
        </template>
      </Dropdown>
      <Button v-else-if="!video.posted && !publishing" size="small" @click="emit('create-post')">
        {{ t('videoStudio.createPost') }}
      </Button>
    </SC_Actions>

    <SC_More>
      <Dropdown :trigger="['click']" placement="bottomRight">
        <SC_MoreButton
          type="button"
          :aria-label="t('mediaStudio.more')"
          :title="t('mediaStudio.more')"
        >
          <MoreOutlined />
        </SC_MoreButton>
        <template #overlay>
          <Menu :items="menuItems" @click="onMenu" />
        </template>
      </Dropdown>
    </SC_More>
  </SC_Item>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Dropdown, Menu } from 'ant-design-vue'

import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  MusicIcon,
  PlayCircleOutlined,
  PlusOutlined,
  StatsIcon,
} from '@/components/icons'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import { formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { useThumbnailFallback } from '@/composables/use-thumbnail-fallback'
import type { StudioView } from './studio-list'
import { formatCompact, formatCount, formatStudioDate } from './studio-format'
import type { ServerVideo } from './use-server-videos'
import type { DetailsTab } from './video-details/video-details-modal.vue'
import {
  SC_Actions,
  SC_Badge,
  SC_Cell,
  SC_Description,
  SC_Duration,
  SC_Item,
  SC_Main,
  SC_Meta,
  SC_More,
  SC_MoreButton,
  SC_Status,
  SC_Thumb,
  SC_ThumbEmpty,
  SC_ThumbTag,
  SC_Title,
} from './studio-video-item.styled'

const props = defineProps<{
  video: ServerVideo
  layout: StudioView
  /** Пост с роликом отправлен и ждёт блока. */
  publishing: boolean
  /** Пост, который сейчас открывается. */
  openingTxid: string | null
}>()
const emit = defineEmits<{
  (e: 'details', tab: DetailsTab): void
  (e: 'open-post', txid: string): void
  (e: 'create-post'): void
  (e: 'remove'): void
}>()

const { t } = useI18n()

const date = computed(() => formatStudioDate(props.video.time))
// Превью не загрузилось (сервер выведен, сертификат просрочен) — ищем, как плеер.
const { src: thumbSrc, onError: onThumbError } = useThumbnailFallback(
  () => props.video.thumbnailUrl,
  () => props.video.pointer
)

const metaLine = computed(() =>
  [
    date.value,
    props.video.views === null
      ? ''
      : t(
          'mediaStudio.viewsCount',
          { n: formatCompact(props.video.views) },
          // «1,2 тыс. просмотров», а не «просмотра»: слово — по сокращённому числу.
          props.video.views >= 1000 ? 1000 : props.video.views
        ),
  ]
    .filter(Boolean)
    .join(' · ')
)

/** Постов с роликом несколько — выбрать, какой открыть: дата и заголовок. */
const postItems = computed(() =>
  props.video.posts.map((post) => ({
    key: post.txid,
    label: [post.time ? formatDateTimeFromString(post.time) : '', post.caption]
      .filter(Boolean)
      .join(' · '),
  }))
)

const menuItems = computed(() => [
  { key: 'details', label: t('mediaStudio.tabDetails'), icon: () => h(EditOutlined) },
  { key: 'stats', label: t('mediaStudio.tabStats'), icon: () => h(StatsIcon) },
  // Пост уже есть — ещё один создаётся отсюда, а не главной кнопкой.
  ...(props.video.posted || props.publishing
    ? [{ key: 'create-post', label: t('videoStudio.createPost'), icon: () => h(PlusOutlined) }]
    : []),
  { type: 'divider' as const },
  { key: 'remove', label: t('videoStudio.delete'), danger: true, icon: () => h(DeleteOutlined) },
])

function onMenu({ key }: { key: string | number }): void {
  if (key === 'details' || key === 'stats') emit('details', key)
  else if (key === 'create-post') emit('create-post')
  else if (key === 'remove') emit('remove')
}

/** Строка списка открывает ролик целиком — кроме кнопок и меню в ней. */
function onItemClick(event: MouseEvent): void {
  if (props.layout !== 'list') return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, .ant-dropdown, .ant-dropdown-trigger')) return
  emit('details', 'details')
}
</script>
