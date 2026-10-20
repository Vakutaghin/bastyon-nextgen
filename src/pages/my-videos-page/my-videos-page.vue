<template>
  <!-- «Мои видео» — как раздел «Контент» творческой студии YouTube: загрузка
       и свои ролики — из постов и на видеосерверах. -->
  <SC_MyVideosWork>
    <SC_MyVideosPage>
      <SC_Header>
        <SC_MyVideosTitle>{{ t('misc.myVideos') }}</SC_MyVideosTitle>
        <SC_HeaderActions>
          <Button
            v-if="signedIn"
            :loading="loading"
            :title="t('videoStudio.refresh')"
            :aria-label="t('videoStudio.refresh')"
            @click="load"
          >
            <template #icon><ReloadOutlined /></template>
          </Button>
          <Button type="primary" @click="uploads.openDialog()">
            <template #icon><UploadOutlined /></template>
            {{ t('videoStudio.upload') }}
          </Button>
        </SC_HeaderActions>
      </SC_Header>

      <SC_Note v-if="!signedIn">
        {{ t('videoStudio.signIn') }}
        <Button type="link" @click="modalStore.openAuthModal('login')">
          {{ t('videoStudio.signInButton') }}
        </Button>
      </SC_Note>

      <SC_Section v-else>
        <SC_Note v-if="failedHosts.length" class="warning" role="alert">
          {{ t('videoStudio.loadFailed') }}
        </SC_Note>
        <Spin v-if="loading && !videos.length" />
        <SC_Note v-else-if="loaded && !videos.length && !failedHosts.length">
          {{ t('videoStudio.empty') }}
        </SC_Note>
        <SC_Grid v-if="videos.length">
          <SC_Card v-for="video in videos" :key="video.pointer">
            <SC_Thumb>
              <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" loading="lazy" />
              <SC_Duration v-if="video.duration">{{ formatDuration(video.duration) }}</SC_Duration>
            </SC_Thumb>
            <SC_CardTitle :title="video.name">{{ video.name }}</SC_CardTitle>
            <SC_Badges>
              <SC_Badge v-if="video.processing">{{ t('videoStudio.processing') }}</SC_Badge>
              <SC_Badge v-if="video.posted" class="posted">{{ t('videoStudio.posted') }}</SC_Badge>
              <SC_Badge v-else-if="isPublishing(video)" class="publishing">{{
                t('videoStudio.publishing')
              }}</SC_Badge>
              <SC_Badge v-else>{{ t('videoStudio.notPosted') }}</SC_Badge>
            </SC_Badges>
            <SC_CardActions>
              <Button
                v-if="video.posts.length === 1"
                size="small"
                :loading="openingTxid === video.posts[0]!.txid"
                @click="openPost(video.posts[0]!.txid)"
              >
                {{ t('videoStudio.openPost') }}
              </Button>
              <Dropdown
                v-else-if="video.posts.length > 1"
                :trigger="['click']"
                placement="bottomLeft"
              >
                <Button
                  size="small"
                  :loading="video.posts.some((post) => post.txid === openingTxid)"
                >
                  {{ t('videoStudio.openPosts', { count: video.posts.length }) }}
                </Button>
                <template #overlay>
                  <Menu :items="postItems(video)" @click="onPostItem" />
                </template>
              </Dropdown>
              <Button size="small" @click="createPost(video)">
                {{ t('videoStudio.createPost') }}
              </Button>
              <Popconfirm
                :title="t('videoStudio.deleteConfirm')"
                :ok-text="t('videoStudio.delete')"
                :cancel-text="t('videoStudio.cancel')"
                @confirm="removeVideo(video)"
              >
                <Button size="small" danger>{{ t('videoStudio.delete') }}</Button>
              </Popconfirm>
            </SC_CardActions>
          </SC_Card>
        </SC_Grid>
      </SC_Section>
    </SC_MyVideosPage>
  </SC_MyVideosWork>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Dropdown, Menu, Popconfirm, Spin } from 'ant-design-vue'

import { ReloadOutlined, UploadOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useModalStore } from '@/stores/modal-store'
import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import { useOpenComposerWithVideo } from '@/b-components/video-studio/use-open-composer-with-video'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import { formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { useServerVideos, type ServerVideo } from './use-server-videos'
import { fetchVideoPost } from './fetch-video-post'
import {
  SC_MyVideosWork,
  SC_MyVideosPage,
  SC_Header,
  SC_HeaderActions,
  SC_MyVideosTitle,
  SC_Section,
  SC_Note,
  SC_Grid,
  SC_Card,
  SC_Thumb,
  SC_Duration,
  SC_CardTitle,
  SC_Badges,
  SC_Badge,
  SC_CardActions,
} from './my-videos-page.styled'

const { t } = useI18n()
const modalStore = useModalStore()
const uploads = useVideoUploadsStore()
const openComposer = useOpenComposerWithVideo()
const { videos, loading, loaded, failedHosts, signedIn, load, remove, isPublishing } =
  useServerVideos()

onMounted(() => void load())

// Загрузка закончилась — ролик уже на сервере.
const doneCount = computed(() => uploads.jobs.filter((job) => job.status === 'done').length)
watch(doneCount, (now, before) => {
  if (now > before) void load()
})

watch(signedIn, (yes) => {
  if (yes) void load()
})

/** Пост, который сейчас грузится для окна поста. */
const openingTxid = ref<string | null>(null)

async function openPost(txid: string): Promise<void> {
  if (openingTxid.value) return
  openingTxid.value = txid
  try {
    const post = await fetchVideoPost(txid)
    if (!post) throw new Error('post_not_found')
    // Окно поста типизировано под пост ленты; адаптер отдаёт тот же формат.
    modalStore.openPostModal(post as never)
  } catch {
    appToast.error({ message: t('videoStudio.openPostFailed') })
  } finally {
    openingTxid.value = null
  }
}

/** Постов с роликом несколько — выбрать, какой открыть: дата и заголовок. */
function postItems(video: ServerVideo) {
  return video.posts.map((post) => ({
    key: post.txid,
    label: [post.time ? formatDateTimeFromString(post.time) : '', post.caption]
      .filter(Boolean)
      .join(' · '),
  }))
}

function onPostItem({ key }: { key: string | number }): void {
  void openPost(String(key))
}

function createPost(video: ServerVideo): void {
  openComposer({ pointer: video.pointer, title: video.name })
}

async function removeVideo(video: ServerVideo): Promise<void> {
  try {
    await remove(video)
    appToast.success({ message: t('videoStudio.deleted') })
  } catch {
    appToast.error({ message: t('videoStudio.deleteFailed') })
  }
}
</script>
