<template>
  <Modal
    :open="store.isOpen"
    :width="460"
    :centered="true"
    :z-index="2700"
    :footer="null"
    @cancel="store.close()"
  >
    <template #title>
      {{ t('collections.addToEllipsis') }} <HelpLink topic="collections#add" />
    </template>
    <SC_Body v-if="target" data-testid="add-to-list">
      <SC_Preview v-if="target.title">«{{ target.title }}»</SC_Preview>

      <SC_Section><LockOutlined /> {{ t('lists.visibility.private') }}</SC_Section>
      <SC_Row
        type="button"
        role="menuitemcheckbox"
        :aria-checked="library.isFavorite(target.postId)"
        data-testid="add-to-favorites"
        @click="toggleFavorite"
      >
        <SC_Check :class="{ on: library.isFavorite(target.postId) }"><CheckOutlined /></SC_Check>
        <SC_RowText>
          {{ t('library.favorites') }}
          <SC_RowSub>{{ t('lists.favoritesSub') }}</SC_RowSub>
        </SC_RowText>
      </SC_Row>
      <SC_Row
        v-if="mediaKind === 'video'"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="library.has(WATCH_LATER, target.postId)"
        @click="toggleLibrary(WATCH_LATER)"
      >
        <SC_Check :class="{ on: library.has(WATCH_LATER, target.postId) }"
          ><CheckOutlined
        /></SC_Check>
        <SC_RowText>{{ t('library.watchLater') }}</SC_RowText>
      </SC_Row>
      <SC_Row
        v-for="id in privateLists"
        :key="id"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="library.has(id, target.postId)"
        @click="toggleLibrary(id)"
      >
        <SC_Check :class="{ on: library.has(id, target.postId) }"><CheckOutlined /></SC_Check>
        <SC_RowText>
          {{ library.nameOf(id) || t('library.untitledPlaylist') }}
          <SC_RowSub>{{ subOf(library.kindOf(id) ?? 'posts', library.ids(id).length) }}</SC_RowSub>
        </SC_RowText>
      </SC_Row>

      <SC_Section><GlobalOutlined /> {{ t('lists.visibility.public') }}</SC_Section>
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
          <SC_RowSub>{{ subOf(c.kind, c.contentIds.length) }}</SC_RowSub>
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
        {{ t('lists.noPublic') }}
      </SC_Status>

      <SC_LinkButton type="button" data-testid="add-to-new-list" @click="createNew">
        <PlusOutlined /> {{ t('lists.newList') }}
      </SC_LinkButton>
    </SC_Body>
  </Modal>
</template>

<script setup lang="ts">
// «Добавить в…»: сначала то, что видите только вы («Избранное», «Смотреть
// позже», личные списки, без ограничений), потом свои публичные списки (в
// блокчейне: правка — транзакция, их 5 в месяц на коллекцию). У каждой строки
// — что внутри и сколько. Новое встаёт в конец; «Новый список…» открывает
// окно «Создать» с этой записью.

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { CheckOutlined, GlobalOutlined, LockOutlined, PlusOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
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
import { WATCH_LATER, type LibraryKind } from '@/services/media-library/media-library-doc'
import { useEditsLeft } from './use-edits-left'
import {
  SC_Body,
  SC_Check,
  SC_Hint,
  SC_LinkButton,
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
const mediaKind = computed<'video' | 'audio' | null>(() =>
  target.value?.type === 'video' ? 'video' : target.value?.type === 'audio' ? 'audio' : null
)
/** Куда эту запись можно положить: списки её типа и списки публикаций. */
const kinds = computed<CollectionKind[]>(() =>
  mediaKind.value ? [mediaKind.value, 'posts'] : ['posts']
)

const privateLists = computed(() => kinds.value.flatMap((k) => library.playlists(k)))

const me = computed(() => authStore.getUserAddress || '')
const loadingPublic = computed(
  () => collections.statusOf(me.value) === 'loading' && !publicLists.value.length
)

const publicLists = computed<CollectionView[]>(() => {
  if (!me.value) return []
  return collections
    .collectionsOf(me.value)
    .filter((c) => kinds.value.includes(c.kind) && c.pending !== 'delete' && !c.failed)
})

const { editsLeft, refresh: refreshEdits } = useEditsLeft(publicLists)

watch(
  () => store.isOpen,
  (open) => {
    if (!open || !me.value) return
    void collections.loadAuthor(me.value).then(refreshEdits)
  }
)

/** «12 видео», «5 треков», «3 публикации» — по подписи видно и что внутри, и сколько. */
function subOf(kind: LibraryKind, n: number): string {
  return t(`collections.kindCount.${kind}`, { n }, n)
}

function toggleFavorite(): void {
  const id = target.value?.postId
  if (!id) return
  const on = !library.isFavorite(id)
  if (!library.setFavorite(id, on) && on) appToast.warning({ message: t('library.full') })
}

function toggleLibrary(listId: string): void {
  const id = target.value?.postId
  if (!id) return
  const on = !library.has(listId, id)
  if (!library.toggle(listId, id, on) && on) appToast.warning({ message: t('library.full') })
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

function createNew(): void {
  const id = target.value?.postId
  if (!id) return
  store.close()
  editor.open({
    mode: 'create',
    kind: mediaKind.value ?? 'posts',
    kinds: kinds.value,
    initialIds: [id],
  })
}
</script>
