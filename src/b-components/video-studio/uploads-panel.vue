<template>
  <!-- Свёрнутые загрузки, как плашка творческой студии YouTube: видна на любой
       странице, пока что-то грузится или только что загрузилось. -->
  <SC_Panel v-if="visible" :aria-label="t('videoStudio.panelTitle')">
    <SC_PanelHeader>
      <SC_PanelTitle>{{ headerText }}</SC_PanelTitle>
      <SC_IconButton
        type="button"
        :aria-label="store.panelCollapsed ? t('videoStudio.expand') : t('videoStudio.collapse')"
        :aria-expanded="!store.panelCollapsed"
        @click="store.panelCollapsed = !store.panelCollapsed"
      >
        <CaretUpOutlined v-if="store.panelCollapsed" />
        <CaretDownOutlined v-else />
      </SC_IconButton>
      <SC_IconButton
        type="button"
        :aria-label="t('videoStudio.closePanel')"
        @click="store.hidePanel()"
      >
        <CloseOutlined />
      </SC_IconButton>
    </SC_PanelHeader>
    <SC_List v-if="!store.panelCollapsed">
      <SC_Row v-for="job in store.jobs" :key="job.id">
        <SC_RowMain type="button" @click="store.openDialog(job.id)">
          <SC_RowTitle>{{ job.title.trim() || job.fileName }}</SC_RowTitle>
          <SC_RowStatus :class="{ error: job.status === 'error' }">{{
            statusOf(job)
          }}</SC_RowStatus>
          <Progress
            v-if="isActive(job)"
            :percent="job.progress"
            :show-info="false"
            size="small"
            status="active"
            stroke-color="var(--ui-primary)"
          />
        </SC_RowMain>
        <SC_RowAction v-if="job.status === 'done'" type="button" @click="createPost(job)">
          {{ t('videoStudio.createPost') }}
        </SC_RowAction>
      </SC_Row>
    </SC_List>
  </SC_Panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Progress } from 'ant-design-vue'

import { bcp47 } from '@/i18n'
import { CaretDownOutlined, CaretUpOutlined, CloseOutlined } from '@/components/icons'
import { useVideoUploadsStore, type VideoUploadJob } from '@/stores/video-uploads-store'
import { useOpenComposerWithVideo } from './use-open-composer-with-video'
import {
  SC_Panel,
  SC_PanelHeader,
  SC_PanelTitle,
  SC_IconButton,
  SC_List,
  SC_Row,
  SC_RowMain,
  SC_RowTitle,
  SC_RowStatus,
  SC_RowAction,
} from './uploads-panel.styled'

const { t, locale } = useI18n()
const store = useVideoUploadsStore()
const openComposer = useOpenComposerWithVideo()

const visible = computed(() => store.jobs.length > 0 && !store.dialogOpen && !store.panelHidden)

const isActive = (job: VideoUploadJob): boolean =>
  job.status === 'compressing' || job.status === 'uploading'

const headerText = computed(() =>
  store.activeJobs.length > 0
    ? t('videoStudio.panelUploading', { count: store.activeJobs.length })
    : t('videoStudio.panelDone')
)

const percent = (value: number): string =>
  new Intl.NumberFormat(bcp47(locale.value), { style: 'percent' }).format(value / 100)

function statusOf(job: VideoUploadJob): string {
  switch (job.status) {
    case 'compressing':
      return job.waiting
        ? t('videoStudio.statusQueued')
        : t('videoStudio.statusCompressing', { percent: percent(job.progress) })
    case 'uploading':
      return t('videoStudio.statusUploading', { percent: percent(job.progress) })
    case 'done':
      return t('videoStudio.rowDone')
    default:
      return job.error
  }
}

async function createPost(job: VideoUploadJob): Promise<void> {
  if (!job.result) return
  await store.commitTitle(job.id)
  openComposer({ pointer: job.result.pointer, title: job.title.trim() })
  store.dismiss(job.id)
}

// Веб: закрыть вкладку посреди загрузки — браузер переспросит.
function onBeforeUnload(event: Event): void {
  if (store.activeJobs.length === 0) return
  event.preventDefault()
  Reflect.set(event, 'returnValue', '')
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>
