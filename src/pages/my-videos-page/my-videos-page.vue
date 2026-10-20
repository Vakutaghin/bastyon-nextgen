<template>
  <!-- «Мои видео» — как раздел «Контент» творческой студии YouTube: загрузка
       и свои ролики на видеосерверах. -->
  <SC_MyVideosWork>
    <SC_MyVideosPage>
      <SC_Header>
        <SC_MyVideosTitle>{{ t('misc.myVideos') }}</SC_MyVideosTitle>
        <Button type="primary" @click="uploads.openDialog()">
          <template #icon><UploadOutlined /></template>
          {{ t('videoStudio.upload') }}
        </Button>
      </SC_Header>

      <SC_Note v-if="!signedIn">
        {{ t('videoStudio.signIn') }}
        <Button type="link" @click="modalStore.openAuthModal('login')">
          {{ t('videoStudio.signInButton') }}
        </Button>
      </SC_Note>

      <template v-else>
        <SC_Section>
          <SC_SectionHead>
            <SC_SectionTitle>{{ t('videoStudio.onServer') }}</SC_SectionTitle>
            <Button type="link" :disabled="loading" @click="load">
              {{ t('videoStudio.refresh') }}
            </Button>
          </SC_SectionHead>
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
                <SC_Duration v-if="video.duration">{{
                  formatDuration(video.duration)
                }}</SC_Duration>
              </SC_Thumb>
              <SC_CardTitle :title="video.name">{{ video.name }}</SC_CardTitle>
              <SC_Badge v-if="video.processing">{{ t('videoStudio.processing') }}</SC_Badge>
              <SC_Badge v-else-if="video.posted" class="posted">{{
                t('videoStudio.posted')
              }}</SC_Badge>
              <SC_Badge v-else>{{ t('videoStudio.notPosted') }}</SC_Badge>
              <SC_CardActions>
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
      </template>
    </SC_MyVideosPage>
  </SC_MyVideosWork>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Popconfirm, Spin } from 'ant-design-vue'

import { UploadOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useModalStore } from '@/stores/modal-store'
import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import { useOpenComposerWithVideo } from '@/b-components/video-studio/use-open-composer-with-video'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import { useServerVideos, type ServerVideo } from './use-server-videos'
import {
  SC_MyVideosWork,
  SC_MyVideosPage,
  SC_Header,
  SC_MyVideosTitle,
  SC_Section,
  SC_SectionHead,
  SC_SectionTitle,
  SC_Note,
  SC_Grid,
  SC_Card,
  SC_Thumb,
  SC_Duration,
  SC_CardTitle,
  SC_Badge,
  SC_CardActions,
} from './my-videos-page.styled'

const { t } = useI18n()
const modalStore = useModalStore()
const uploads = useVideoUploadsStore()
const openComposer = useOpenComposerWithVideo()
const { videos, loading, loaded, failedHosts, signedIn, load, remove } = useServerVideos()

onMounted(() => void load())

// Загрузка закончилась — ролик уже на сервере.
const doneCount = computed(() => uploads.jobs.filter((job) => job.status === 'done').length)
watch(doneCount, (now, before) => {
  if (now > before) void load()
})

watch(signedIn, (yes) => {
  if (yes) void load()
})

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
