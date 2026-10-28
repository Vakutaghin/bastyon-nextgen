<template>
  <SC_SectionWork>
    <SC_SectionPage :class="{ narrow: kind === 'audio' }">
      <SC_SectionHead>
        <SC_SectionTitle>
          <AudioPlaylistIcon v-if="kind === 'audio'" />
          <VideoPlaylistIcon v-else />
          <template v-if="!renaming">{{ title }}</template>
          <SC_RenameForm v-else @submit.prevent="saveName">
            <input v-model="name" maxlength="100" :aria-label="t('library.newPlaylistName')" />
            <Button type="primary" html-type="submit" :disabled="!name.trim()">{{
              t('library.save')
            }}</Button>
            <Button @click="renaming = false">{{ t('library.cancel') }}</Button>
          </SC_RenameForm>
        </SC_SectionTitle>
        <SC_HeadActions v-if="isPlaylist && !renaming">
          <Button @click="startRename">
            <template #icon><EditOutlined /></template>
            {{ t('library.rename') }}
          </Button>
          <Button danger @click="confirmDelete">
            <template #icon><DeleteOutlined /></template>
            {{ t('library.delete') }}
          </Button>
        </SC_HeadActions>
      </SC_SectionHead>
      <SC_Back>
        <router-link :to="backPath">← {{ backLabel }}</router-link>
      </SC_Back>

      <SC_Empty v-if="!exists">
        <p>{{ t('library.notFound') }}</p>
      </SC_Empty>
      <LibraryListView v-else :list-id="listId" :kind="kind" />
    </SC_SectionPage>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// Страница личного списка: «Сохранённые», «Смотреть позже», «Моя музыка» или
// личный плейлист (его можно переименовать и удалить).

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Modal } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  DeleteOutlined,
  EditOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import LibraryListView from '@/b-components/media/library-list/library-list-view.vue'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useDocumentTitle } from '@/composables/use-document-title'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  SYSTEM_LISTS,
  WATCH_LATER,
  isPlaylistId,
} from '@/services/media-library/media-library-doc'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  SC_Empty,
  SC_SectionHead,
  SC_SectionPage,
  SC_SectionTitle,
  SC_SectionWork,
} from '../media-section/media-section.styled'
import { SC_Back, SC_HeadActions, SC_RenameForm } from './library-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { library } = useMediaLibrary()

const listId = computed(() => (typeof route.params.listId === 'string' ? route.params.listId : ''))
const isPlaylist = computed(() => isPlaylistId(listId.value))
const list = computed(() => library.doc.lists[listId.value])
const kind = computed<'video' | 'audio'>(
  () => SYSTEM_LISTS[listId.value] ?? list.value?.kind ?? 'video'
)
const exists = computed(
  () => !!SYSTEM_LISTS[listId.value] || (isPlaylist.value && !!list.value && !list.value.deleted)
)

const title = computed(() => {
  if (listId.value === SAVED_VIDEOS) return t('library.savedVideos')
  if (listId.value === WATCH_LATER) return t('library.watchLater')
  if (listId.value === MY_MUSIC) return t('library.myMusic')
  return library.nameOf(listId.value) || t('library.untitledPlaylist')
})
useDocumentTitle(() => title.value)

const backPath = computed(() => (kind.value === 'audio' ? '/audio/playlists' : '/video/playlists'))
const backLabel = computed(() =>
  kind.value === 'audio' ? t('audioSection.title') : t('videoSection.title')
)

const renaming = ref(false)
const name = ref('')

function startRename(): void {
  name.value = library.nameOf(listId.value)
  renaming.value = true
}

function saveName(): void {
  if (library.renamePlaylist(listId.value, name.value)) renaming.value = false
}

function confirmDelete(): void {
  Modal.confirm({
    title: t('library.deleteConfirmTitle'),
    content: t('library.deleteConfirmText'),
    okText: t('library.delete'),
    okType: 'danger',
    cancelText: t('library.cancel'),
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => {
      library.deletePlaylist(listId.value)
      void router.replace(backPath.value)
    },
  })
}
</script>
