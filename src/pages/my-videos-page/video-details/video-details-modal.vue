<template>
  <!-- Окно ролика, как «Сведения» и «Аналитика» в творческой студии YouTube:
       слева — то, что можно поменять на видеосервере (название, описание,
       обложка), справа — что о ролике известно и в каких он постах. -->
  <Modal
    :open="true"
    :footer="null"
    :width="980"
    :z-index="1100"
    wrap-class-name="video-details-modal"
    @cancel="requestClose"
  >
    <template #title>
      <SC_ModalTitle :title="video.name">{{ video.name }}</SC_ModalTitle>
    </template>

    <SC_Tabs role="tablist" :aria-label="t('mediaStudio.detailsTitle')">
      <SC_Tab
        v-for="item in tabs"
        :id="`video-details-tab-${item.key}`"
        :key="item.key"
        type="button"
        role="tab"
        :class="{ active: tab === item.key }"
        :aria-selected="tab === item.key"
        :aria-controls="`video-details-panel-${item.key}`"
        @click="tab = item.key"
      >
        <component :is="item.icon" />
        {{ item.label }}
      </SC_Tab>
    </SC_Tabs>

    <SC_Panel
      v-show="tab === 'details'"
      id="video-details-panel-details"
      role="tabpanel"
      aria-labelledby="video-details-tab-details"
    >
      <Spin v-if="details.status.value === 'loading'" />
      <SC_PanelNote v-else-if="details.status.value === 'gone'" role="alert">
        {{ t('mediaStudio.gone') }}
      </SC_PanelNote>
      <SC_PanelNote v-else-if="details.status.value === 'error'" class="error" role="alert">
        {{ t('mediaStudio.loadFailed') }}
        <Button size="small" @click="details.load()">{{ t('mediaStudio.retry') }}</Button>
      </SC_PanelNote>

      <SC_DetailsGrid v-else>
        <SC_Form @submit.prevent="save">
          <SC_Field>
            <label for="video-details-name">{{ t('mediaStudio.nameLabel') }}</label>
            <Input
              id="video-details-name"
              v-model:value="details.form.name"
              :maxlength="details.limits.nameMax"
              show-count
              :disabled="details.saving.value"
              :status="details.nameError.value ? 'error' : undefined"
            />
            <SC_FieldError v-if="details.nameError.value" role="alert">
              {{ t('mediaStudio.nameShort', { min: details.limits.nameMin }) }}
            </SC_FieldError>
          </SC_Field>

          <SC_Field>
            <label for="video-details-description">{{ t('mediaStudio.descriptionLabel') }}</label>
            <Textarea
              id="video-details-description"
              v-model:value="details.form.description"
              :maxlength="details.limits.descriptionMax"
              :auto-size="{ minRows: 4, maxRows: 12 }"
              show-count
              :disabled="details.saving.value"
              :status="details.descriptionError.value ? 'error' : undefined"
            />
            <SC_FieldError v-if="details.descriptionError.value" role="alert">
              {{ t('mediaStudio.descriptionShort', { min: details.limits.descriptionMin }) }}
            </SC_FieldError>
            <SC_FieldHint>{{ t('mediaStudio.descriptionHint') }}</SC_FieldHint>
          </SC_Field>

          <VideoCoverPicker
            :key="video.pointer"
            :media="coverMedia"
            :cover="details.cover"
            mode="edit"
            :aspect="details.details.value?.aspectRatio ?? null"
            :no-frames-text="coverNoFrames"
            :disabled="details.saving.value"
            @pick="(image, source, time) => details.pickCover(image, source, time)"
          />

          <SC_FormFooter>
            <SC_Unsaved v-if="details.dirty.value" role="status">
              {{ t('mediaStudio.unsaved') }}
            </SC_Unsaved>
            <Button
              :disabled="!details.dirty.value || details.saving.value"
              @click="details.reset()"
            >
              {{ t('mediaStudio.reset') }}
            </Button>
            <Button
              type="primary"
              html-type="submit"
              :loading="details.saving.value"
              :disabled="!details.canSave.value"
            >
              {{ t('mediaStudio.save') }}
            </Button>
          </SC_FormFooter>
        </SC_Form>

        <SC_Aside>
          <SC_Facts>
            <div>
              <dt>{{ t('mediaStudio.facts.type') }}</dt>
              <dd>
                {{
                  facts.audio ? t('mediaStudio.facts.typeAudio') : t('mediaStudio.facts.typeVideo')
                }}
              </dd>
            </div>
            <div>
              <dt>{{ t('mediaStudio.facts.state') }}</dt>
              <dd>
                {{
                  facts.processing
                    ? t('mediaStudio.facts.stateProcessing')
                    : t('mediaStudio.facts.stateReady')
                }}
              </dd>
            </div>
            <div v-if="facts.duration">
              <dt>{{ t('mediaStudio.facts.duration') }}</dt>
              <dd>{{ formatDuration(facts.duration) }}</dd>
            </div>
            <div v-if="facts.uploaded">
              <dt>{{ t('mediaStudio.facts.uploaded') }}</dt>
              <dd>{{ facts.uploaded }}</dd>
            </div>
            <div v-if="facts.quality">
              <dt>{{ t('mediaStudio.facts.quality') }}</dt>
              <dd>{{ facts.quality }}</dd>
            </div>
            <div v-if="facts.size">
              <dt>{{ t('mediaStudio.facts.size') }}</dt>
              <dd>{{ facts.size }}</dd>
            </div>
            <div v-if="facts.views !== null">
              <dt>{{ t('mediaStudio.facts.views') }}</dt>
              <dd>{{ formatCount(facts.views) }}</dd>
            </div>
            <div>
              <dt>{{ t('mediaStudio.facts.server') }}</dt>
              <dd>{{ video.host }}</dd>
            </div>
          </SC_Facts>

          <SC_AsideSection>
            <SC_AsideTitle>{{ t('mediaStudio.postsTitle') }}</SC_AsideTitle>
            <SC_Posts v-if="video.posts.length">
              <li v-for="post in video.posts" :key="post.txid">
                <button type="button" @click="emit('open-post', post.txid)">
                  <span>{{ post.caption || t('mediaStudio.untitledPost') }}</span>
                  <small>{{ formatStudioDateTime(post.time) }}</small>
                </button>
              </li>
            </SC_Posts>
            <SC_AsideText v-else-if="publishing">{{
              t('mediaStudio.publishingNote')
            }}</SC_AsideText>
            <SC_AsideText v-else>{{ t('mediaStudio.notInPost') }}</SC_AsideText>
            <Button block @click="emit('create-post')">{{ t('videoStudio.createPost') }}</Button>
          </SC_AsideSection>

          <SC_Danger>
            <Button danger block @click="emit('remove')">
              <template #icon><DeleteOutlined /></template>
              {{ t('mediaStudio.deleteVideo') }}
            </Button>
          </SC_Danger>
        </SC_Aside>
      </SC_DetailsGrid>
    </SC_Panel>

    <SC_Panel
      v-if="statsOpened"
      v-show="tab === 'stats'"
      id="video-details-panel-stats"
      role="tabpanel"
      aria-labelledby="video-details-tab-stats"
    >
      <VideoStatsPanel
        :video="video"
        :views="facts.views"
        :active="tab === 'stats'"
        :deps="{ token: tokenFor }"
      />
    </SC_Panel>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal, Spin } from 'ant-design-vue'

import { DeleteOutlined, EditOutlined, StatsIcon } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import VideoCoverPicker from '@/b-components/video-studio/video-cover-picker.vue'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import { useTorMedia } from '@/composables/use-tor-media'
import { Z_INDEX } from '@/styles/design-tokens'
import { formatCount, formatSize, formatStudioDateTime } from '../studio-format'
import type { ServerVideo } from '../use-server-videos'
import { useVideoDetails, type ListChanges, type VideoDetailsDeps } from '../use-video-details'
import { useVideoServerToken } from '../video-server-token'
import VideoStatsPanel from './video-stats-panel.vue'
import {
  SC_Aside,
  SC_AsideSection,
  SC_AsideText,
  SC_AsideTitle,
  SC_Danger,
  SC_DetailsGrid,
  SC_Facts,
  SC_Field,
  SC_FieldError,
  SC_FieldHint,
  SC_Form,
  SC_FormFooter,
  SC_ModalTitle,
  SC_Panel,
  SC_PanelNote,
  SC_Posts,
  SC_Tab,
  SC_Tabs,
  SC_Unsaved,
} from './video-details-modal.styled'

export type DetailsTab = 'details' | 'stats'

const Textarea = Input.TextArea

const props = defineProps<{
  video: ServerVideo
  initialTab?: DetailsTab
  /** Пост с роликом отправлен и ждёт блока. */
  publishing?: boolean
  deps?: Partial<VideoDetailsDeps>
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'changed', changes: ListChanges): void
  (e: 'open-post', txid: string): void
  (e: 'create-post'): void
  (e: 'remove'): void
}>()

const { t } = useI18n()
const { mediaBlocked } = useTorMedia()
const tokenFor = useVideoServerToken()

const tab = ref<DetailsTab>(props.initialTab ?? 'details')
/** Статистику грузим, только когда её открыли. */
const statsOpened = ref(tab.value === 'stats')
watch(tab, (next) => {
  if (next === 'stats') statsOpened.value = true
})

const tabs = computed(() => [
  { key: 'details' as const, label: t('mediaStudio.tabDetails'), icon: EditOutlined },
  { key: 'stats' as const, label: t('mediaStudio.tabStats'), icon: StatsIcon },
])

const details = useVideoDetails(toRef(props, 'video'), {
  deps: { token: tokenFor, ...props.deps },
  onChanged: (changes) => emit('changed', changes),
})
onBeforeUnmount(() => details.dispose())

/** Под Tor файл ролика с сервера не открываем: сервер увидел бы адрес. */
const coverMedia = computed(() => (mediaBlocked.value ? null : details.framesUrl.value))
const coverNoFrames = computed(() => (mediaBlocked.value ? t('videoCover.noFramesTor') : undefined))

const facts = computed(() => {
  const found = details.details.value
  const best = found?.files.find((file) => file.size > 0)
  const quality = found?.files
    .filter((file) => file.height > 0)
    .map((file) => file.label)
    .join(', ')
  return {
    audio: found?.isAudio ?? props.video.isAudio,
    processing: found ? found.stateId === 2 || found.stateId === 3 : props.video.processing,
    duration: found?.duration || props.video.duration || 0,
    uploaded: found?.createdAt ? formatStudioDateTime(Date.parse(found.createdAt)) : '',
    quality: found?.isAudio ? '' : quality || '',
    size: best
      ? best.height
        ? t('mediaStudio.facts.sizeOf', { size: formatSize(best.size), quality: best.label })
        : formatSize(best.size)
      : '',
    views: found?.views ?? props.video.views,
  }
})

async function save(): Promise<void> {
  const result = await details.save()
  if (result === 'saved') appToast.success({ message: t('mediaStudio.saved') })
  else if (result === 'coverFailed') appToast.error({ message: t('mediaStudio.coverSaveFailed') })
  else if (result === 'failed') appToast.error({ message: t('mediaStudio.saveFailed') })
}

function requestClose(): void {
  if (!details.dirty.value) {
    emit('close')
    return
  }
  Modal.confirm({
    title: t('mediaStudio.closeUnsavedTitle'),
    content: t('mediaStudio.closeUnsavedText'),
    okText: t('mediaStudio.closeUnsavedOk'),
    cancelText: t('mediaStudio.closeUnsavedCancel'),
    okButtonProps: { danger: true },
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => emit('close'),
  })
}
</script>
