<template>
  <Modal
    :open="store.isOpen"
    :width="460"
    :centered="true"
    :z-index="2700"
    :footer="null"
    :title="title"
    @cancel="store.close()"
  >
    <SC_Body v-if="target" data-testid="add-to-list">
      <SC_Preview v-if="target.title">«{{ target.title }}»</SC_Preview>

      <template v-if="mediaKind">
        <SC_Section>{{ t('library.myLists') }}</SC_Section>
        <SC_Row
          v-for="list in systemLists"
          :key="list.id"
          type="button"
          role="menuitemcheckbox"
          :aria-checked="library.has(list.id, target.postId)"
          @click="toggleLibrary(list.id)"
        >
          <SC_Check :class="{ on: library.has(list.id, target.postId) }"
            ><CheckOutlined
          /></SC_Check>
          <SC_RowText>{{ t(list.labelKey) }}</SC_RowText>
        </SC_Row>
        <SC_Row
          v-for="id in library.playlists(mediaKind)"
          :key="id"
          type="button"
          role="menuitemcheckbox"
          :aria-checked="library.has(id, target.postId)"
          @click="toggleLibrary(id)"
        >
          <SC_Check :class="{ on: library.has(id, target.postId) }"><CheckOutlined /></SC_Check>
          <SC_RowText>{{ library.nameOf(id) || t('library.untitledPlaylist') }}</SC_RowText>
          <SC_RowNote><LockOutlined /> {{ t('library.private') }}</SC_RowNote>
        </SC_Row>
        <SC_NewRow v-if="creatingPrivate" @submit.prevent="createPrivate">
          <input
            ref="privateInput"
            v-model="privateName"
            maxlength="100"
            :placeholder="t('library.newPlaylistName')"
            :aria-label="t('library.newPlaylistName')"
          />
          <Button type="primary" html-type="submit" :disabled="!privateName.trim()">
            {{ t('library.create') }}
          </Button>
        </SC_NewRow>
        <SC_LinkButton v-else type="button" @click="startPrivate">
          <PlusOutlined /> {{ t('library.newPrivatePlaylist') }}
        </SC_LinkButton>
      </template>

      <SC_Section>
        {{
          mediaKind
            ? t('collections.publicPlaylistsAndCollections')
            : t('collections.myCollections')
        }}
      </SC_Section>
      <SC_Hint>{{ t('collections.publicHint') }}</SC_Hint>

      <SC_Status v-if="loadingPublic">{{ t('collections.loading') }}</SC_Status>
      <SC_Row
        v-for="c in publicLists"
        :key="c.txid"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="c.contentIds.includes(target.postId)"
        :disabled="!canToggle(c)"
        @click="togglePublic(c)"
      >
        <SC_Check :class="{ on: c.contentIds.includes(target.postId) }"><CheckOutlined /></SC_Check>
        <SC_RowText>
          {{ c.caption || t('media.untitled') }}
          <SC_RowSub
            >{{ kindLabel(c.kind) }} ·
            {{ t('collections.items', { n: c.contentIds.length }, c.contentIds.length) }}</SC_RowSub
          >
        </SC_RowText>
        <SC_RowNote>
          <template v-if="c.queued || collections.busy(c.txid)">{{
            t('collections.waitingBlock')
          }}</template>
          <template v-else-if="editsLeft[c.txid] !== undefined">
            {{ t('collections.editsLeft', { n: editsLeft[c.txid], max: EDIT_LIMIT }) }}
          </template>
        </SC_RowNote>
      </SC_Row>
      <SC_Status v-if="!loadingPublic && !publicLists.length">
        {{ t('collections.noOwn') }}
      </SC_Status>
      <SC_LinkButton type="button" @click="createPublic">
        <PlusOutlined />
        {{ mediaKind ? t('collections.newPlaylist') : t('collections.newCollection') }}
      </SC_LinkButton>
      <SC_LinkButton v-if="mediaKind" type="button" @click="createPublic('posts')">
        <PlusOutlined /> {{ t('collections.newCollection') }}
      </SC_LinkButton>
    </SC_Body>
  </Modal>
</template>

<script setup lang="ts">
// «Добавить в…»: личные списки (видит только владелец, без ограничений) и свои
// публичные плейлисты и коллекции (в блокчейне: правка — транзакция, их 5 в
// месяц на коллекцию). Новое встаёт в конец.

import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'
import { CheckOutlined, LockOutlined, PlusOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import { useAddToListStore } from '@/stores/add-to-list-store'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { useMediaLibrary } from '@/composables/use-media-library'
import {
  COLLECTION_EDIT_LIMIT,
  COLLECTION_MAX_ITEMS,
} from '@/services/collections/collection-model'
import type { CollectionKind } from '@/services/collections/collection-model'
import type { CollectionView } from '@/stores/collections-store'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  WATCH_LATER,
  type LibraryKind,
} from '@/services/media-library/media-library-doc'
import { useEditsLeft } from './use-edits-left'
import {
  SC_Body,
  SC_Check,
  SC_Hint,
  SC_LinkButton,
  SC_NewRow,
  SC_Preview,
  SC_Row,
  SC_RowNote,
  SC_RowSub,
  SC_RowText,
  SC_Section,
  SC_Status,
} from './add-to-list-modal.styled'

const EDIT_LIMIT = COLLECTION_EDIT_LIMIT

const { t } = useI18n()
const store = useAddToListStore()
const editor = useCollectionEditorStore()
const authStore = useAuthStore()
const { library, collections } = useMediaLibrary()

const target = computed(() => store.target)
const mediaKind = computed<LibraryKind | null>(() =>
  target.value?.type === 'video' ? 'video' : target.value?.type === 'audio' ? 'audio' : null
)
const title = computed(() =>
  mediaKind.value ? t('collections.addToPlaylist') : t('collections.addToCollection')
)

const systemLists = computed(() =>
  mediaKind.value === 'video'
    ? [
        { id: SAVED_VIDEOS, labelKey: 'library.savedVideos' },
        { id: WATCH_LATER, labelKey: 'library.watchLater' },
      ]
    : [{ id: MY_MUSIC, labelKey: 'library.myMusic' }]
)

const me = computed(() => authStore.getUserAddress || '')
const loadingPublic = computed(
  () => collections.statusOf(me.value) === 'loading' && !publicLists.value.length
)

/** Свои коллекции, куда этот пост можно положить: плейлисты его типа и коллекции публикаций. */
const publicLists = computed<CollectionView[]>(() => {
  if (!me.value) return []
  const kinds: CollectionKind[] = mediaKind.value ? [mediaKind.value, 'posts'] : ['posts']
  return collections
    .collectionsOf(me.value)
    .filter((c) => kinds.includes(c.kind) && c.pending !== 'delete' && !c.failed)
})

const { editsLeft, refresh: refreshEdits } = useEditsLeft(publicLists)

watch(
  () => store.isOpen,
  (open) => {
    if (!open || !me.value) return
    creatingPrivate.value = false
    void collections.loadAuthor(me.value).then(refreshEdits)
  }
)

function kindLabel(kind: CollectionKind): string {
  return t(`collections.kinds.${kind}`)
}

function toggleLibrary(listId: string): void {
  const id = target.value?.postId
  if (!id) return
  const on = !library.has(listId, id)
  if (!library.toggle(listId, id, on) && on) appToast.warning({ message: t('library.full') })
}

// --- Новый личный плейлист ---
const creatingPrivate = ref(false)
const privateName = ref('')
const privateInput = ref<HTMLInputElement | null>(null)

function startPrivate(): void {
  creatingPrivate.value = true
  privateName.value = ''
  void nextTick(() => privateInput.value?.focus())
}

function createPrivate(): void {
  const kind = mediaKind.value
  const id = target.value?.postId
  if (!kind || !id || !privateName.value.trim()) return
  const listId = library.createPlaylist(kind, privateName.value)
  if (!listId) {
    appToast.warning({ message: t('library.tooManyPlaylists') })
    return
  }
  library.toggle(listId, id, true)
  creatingPrivate.value = false
}

// --- Публичные ---

function canToggle(c: CollectionView): boolean {
  const id = target.value?.postId ?? ''
  if (!c.contentIds.includes(id) && c.contentIds.length >= COLLECTION_MAX_ITEMS) return false
  const left = editsLeft.value[c.txid]
  return left === undefined || left > 0 || collections.busy(c.txid)
}

async function togglePublic(c: CollectionView): Promise<void> {
  const id = target.value?.postId
  if (!id) return
  const on = !c.contentIds.includes(id)
  try {
    const result = await collections.toggleItem(c, id, on)
    appToast.success({
      message:
        result === 'queued'
          ? t('collections.queued', { name: c.caption })
          : on
            ? t('collections.added', { name: c.caption })
            : t('collections.removed', { name: c.caption }),
    })
    void refreshEdits()
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('collections.sendFailed') })
  }
}

function createPublic(kind?: CollectionKind | MouseEvent): void {
  const id = target.value?.postId
  if (!id) return
  const chosen: CollectionKind = typeof kind === 'string' ? kind : (mediaKind.value ?? 'posts')
  store.close()
  editor.open({ mode: 'create', kind: chosen, initialIds: [id] })
}
</script>
