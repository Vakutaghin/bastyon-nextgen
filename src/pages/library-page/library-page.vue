<template>
  <SC_SectionWork>
    <SC_SectionPage :class="{ narrow: kind !== 'video' }">
      <SC_SectionHead>
        <SC_SectionTitle>
          <component :is="kindIcon" />
          <template v-if="!renaming">{{ title }}</template>
          <SC_RenameForm v-else @submit.prevent="saveName">
            <input v-model="name" maxlength="100" :aria-label="t('library.newPlaylistName')" />
            <Button type="primary" html-type="submit" :disabled="!name.trim()">{{
              t('library.save')
            }}</Button>
            <Button @click="renaming = false">{{ t('library.cancel') }}</Button>
          </SC_RenameForm>
        </SC_SectionTitle>
        <SC_HeadActions v-if="exists && !renaming && !replacing">
          <Button @click="startRename">
            <template #icon><EditOutlined /></template>
            {{ t('library.rename') }}
          </Button>
          <Button data-testid="library-make-public" @click="makePublic(listId)">
            <template #icon><GlobalOutlined /></template>
            {{ t('lists.makePublic') }}
          </Button>
          <Button danger @click="confirmDelete">
            <template #icon><DeleteOutlined /></template>
            {{ t('library.delete') }}
          </Button>
        </SC_HeadActions>
      </SC_SectionHead>
      <SC_Back>
        <router-link to="/collections">← {{ t('shelf.title') }}</router-link>
      </SC_Back>
      <SC_Replacing v-if="replacing" role="status">{{ t('lists.publishingNote') }}</SC_Replacing>

      <SC_Empty v-if="!exists">
        <p>{{ t('library.notFound') }}</p>
      </SC_Empty>
      <LibraryListView v-else :list-id="listId" :kind="kind" />
    </SC_SectionPage>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// Страница личного плейлиста или коллекции: переименовать, сделать публичным
// (окно «Создать» с теми же записями), удалить. Встроенные списки сюда не
// ведут — это вкладки разделов и лента «Избранное» (редиректы в router).

import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button, Modal } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  CollectionIcon,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import LibraryListView from '@/b-components/media/library-list/library-list-view.vue'
import { useListVisibility } from '@/b-components/media/use-list-visibility'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useDocumentTitle } from '@/composables/use-document-title'
import { isPlaylistId, type LibraryKind } from '@/services/media-library/media-library-doc'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  SC_Empty,
  SC_SectionHead,
  SC_SectionPage,
  SC_SectionTitle,
  SC_SectionWork,
} from '../media-section/media-section.styled'
import { SC_Back, SC_HeadActions, SC_RenameForm, SC_Replacing } from './library-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { library, collections } = useMediaLibrary()
const { makePublic } = useListVisibility()

const listId = computed(() => (typeof route.params.listId === 'string' ? route.params.listId : ''))
const list = computed(() => library.doc.lists[listId.value])
const kind = computed<LibraryKind>(() => list.value?.kind ?? 'video')
const exists = computed(() => isPlaylistId(listId.value) && !!list.value && !list.value.deleted)
const replacing = computed(() => collections.replacing(listId.value))

const kindIcon = computed<Component>(() =>
  kind.value === 'audio'
    ? AudioPlaylistIcon
    : kind.value === 'posts'
      ? CollectionIcon
      : VideoPlaylistIcon
)

const title = computed(() => library.nameOf(listId.value) || t('library.untitledPlaylist'))
useDocumentTitle(() => title.value)

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
    title: t('shelf.deleteTitle', { name: title.value }),
    content: t('library.deleteConfirmText'),
    okText: t('library.delete'),
    okType: 'danger',
    cancelText: t('library.cancel'),
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => {
      library.deletePlaylist(listId.value)
      void router.replace('/collections')
    },
  })
}
</script>
