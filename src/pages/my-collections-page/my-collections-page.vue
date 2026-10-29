<template>
  <SC_SectionWork>
    <SC_SectionPage class="narrow" data-testid="my-collections">
      <SC_SectionHead>
        <SC_SectionTitle><CollectionIcon /> {{ t('shelf.title') }}</SC_SectionTitle>
        <SC_HeadEnd v-if="me">
          <Dropdown :trigger="['click']" placement="bottomRight">
            <Button type="primary" data-testid="shelf-create">
              <template #icon><PlusOutlined /></template>
              {{ t('shelf.create') }}
            </Button>
            <template #overlay>
              <Menu :items="createItems" @click="onCreate" />
            </template>
          </Dropdown>
        </SC_HeadEnd>
      </SC_SectionHead>
      <SC_Lead>{{ t('shelf.lead') }}</SC_Lead>

      <SC_Empty v-if="!me">
        <p>{{ t('shelf.signIn') }}</p>
        <Button type="primary" @click="modalStore.openAuthModal('login')">
          {{ t('shelf.signInButton') }}
        </Button>
      </SC_Empty>

      <template v-else>
        <SC_Toolbar>
          <SC_Chips role="group" :aria-label="t('shelf.filterLabel')">
            <SC_Chip
              v-for="option in FILTERS"
              :key="option"
              type="button"
              :class="{ active: filter === option }"
              :aria-pressed="filter === option"
              :data-testid="`shelf-filter-${option}`"
              @click="filter = option"
            >
              {{ t(`shelf.filters.${option}`) }}
              <SC_ChipCount>{{ counts[option] }}</SC_ChipCount>
            </SC_Chip>
          </SC_Chips>
          <div v-if="rows.length > SEARCH_FROM" class="search">
            <Input
              v-model:value="search"
              allow-clear
              :placeholder="t('shelf.search')"
              :aria-label="t('shelf.search')"
            >
              <template #prefix><SearchOutlined /></template>
            </Input>
          </div>
        </SC_Toolbar>

        <SC_Empty v-if="searching && !shown.length">
          <p>{{ t('shelf.nothingFound') }}</p>
        </SC_Empty>

        <template v-for="group in groups" :key="group.id">
          <SC_Block :data-testid="`shelf-group-${group.id}`">
            <SC_BlockHead>
              <SC_BlockTitle>{{ t(`shelf.groups.${group.id}`) }}</SC_BlockTitle>
            </SC_BlockHead>
            <SC_Note v-if="group.id === 'private'">
              <LockOutlined /> {{ t('library.privateNote') }}
            </SC_Note>
            <SC_Rows v-if="group.rows.length">
              <ShelfRowItem
                v-for="row in group.rows"
                :key="row.key"
                :row="row"
                :label="labelOf(row)"
                @action="(action) => onAction(row, action)"
              />
            </SC_Rows>
            <SC_GroupNote v-else-if="publicStatus === 'loading' || publicStatus === 'idle'">
              {{ t('collections.loading') }}
            </SC_GroupNote>
            <SC_GroupNote v-else-if="publicStatus === 'error'" role="alert">
              {{ t('shelf.loadFailed') }}
              <Button type="link" size="small" @click="reload">{{ t('shelf.retry') }}</Button>
            </SC_GroupNote>
            <SC_GroupNote v-else>{{ t(`shelf.none.${group.id}`) }}</SC_GroupNote>
          </SC_Block>
        </template>
      </template>
    </SC_SectionPage>

    <!-- Новый личный плейлист и переименование — одно окно с названием. -->
    <Modal
      :open="!!naming"
      :title="naming ? namingTitle : ''"
      :ok-text="naming?.mode === 'create' ? t('library.create') : t('library.save')"
      :cancel-text="t('library.cancel')"
      :ok-button-props="{ disabled: !nameDraft.trim() }"
      destroy-on-close
      @ok="saveName"
      @cancel="naming = null"
    >
      <Input
        v-model:value="nameDraft"
        :maxlength="100"
        :placeholder="t('library.newPlaylistName')"
        :aria-label="t('library.newPlaylistName')"
        data-testid="shelf-name"
        autofocus
        @press-enter="saveName"
      />
    </Modal>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// «Коллекции и плейлисты» — всё своё в одном месте: публичные коллекции
// публикаций, видео- и аудиоплейлисты (блокчейн) и личные списки (сервер
// чатов). Раньше они жили по разным углам: коллекции — только во вкладке
// профиля, плейлисты — во вкладках разделов «Видео» и «Аудио». Здесь же их
// создают, правят, переименовывают, удаляют и копируют ссылку.

import { computed, h, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Dropdown, Input, Menu, Modal, type MenuProps } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  CollectionIcon,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useAuthStore } from '@/blockchain'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { draftOf } from '@/stores/collections-store'
import { useModalStore } from '@/stores/modal-store'
import { copyText } from '@/helpers/common/clipboard'
import { publicCollectionUrl } from '@/helpers/common/share-origin'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  WATCH_LATER,
  type LibraryKind,
} from '@/services/media-library/media-library-doc'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  SC_Block,
  SC_BlockHead,
  SC_BlockTitle,
  SC_Chip,
  SC_Chips,
  SC_Empty,
  SC_Note,
  SC_SectionHead,
  SC_SectionPage,
  SC_SectionTitle,
  SC_SectionWork,
} from '../media-section/media-section.styled'
import {
  SHELF_GROUPS,
  filterShelf,
  privateRows,
  publicRows,
  shelfCounts,
  type ShelfFilter,
  type ShelfGroup,
  type ShelfRow,
} from './collection-shelf'
import ShelfRowItem, { type ShelfAction } from './shelf-row.vue'
import {
  SC_ChipCount,
  SC_GroupNote,
  SC_HeadEnd,
  SC_Lead,
  SC_Rows,
  SC_Toolbar,
} from './my-collections-page.styled'

const FILTERS: readonly ShelfFilter[] = ['all', ...SHELF_GROUPS]
/** Поиск — когда строк больше, чем видно глазом. */
const SEARCH_FROM = 8

const { t } = useI18n()
const authStore = useAuthStore()
const modalStore = useModalStore()
const editor = useCollectionEditorStore()
const { library, collections } = useMediaLibrary()

useDocumentTitle(() => t('shelf.title'))

const me = computed(() => authStore.getUserAddress || '')

watch(
  me,
  (address) => {
    if (address) void collections.loadAuthor(address)
  },
  { immediate: true }
)

function reload(): void {
  if (me.value) void collections.loadAuthor(me.value, true)
}

const publicStatus = computed(() => (me.value ? collections.statusOf(me.value) : 'idle'))

const rows = computed<ShelfRow[]>(() =>
  me.value ? [...publicRows(collections.collectionsOf(me.value)), ...privateRows(library)] : []
)

const SYSTEM_LABELS: Record<string, string> = {
  [SAVED_VIDEOS]: 'shelf.savedVideos',
  [WATCH_LATER]: 'library.watchLater',
  [MY_MUSIC]: 'library.myMusic',
}

function labelOf(row: ShelfRow): string {
  if (row.system) return t(SYSTEM_LABELS[row.key] ?? 'library.untitledPlaylist')
  return row.name || (row.collection ? t('media.untitled') : t('library.untitledPlaylist'))
}

const filter = ref<ShelfFilter>('all')
const search = ref('')
const searching = computed(() => !!search.value.trim())

const counts = computed(() => shelfCounts(rows.value))
const shown = computed(() => filterShelf(rows.value, filter.value, search.value, labelOf))

/** Группы по порядку; при поиске пустые прячутся, без него — с подсказкой. */
const groups = computed(() =>
  SHELF_GROUPS.filter((id) => filter.value === 'all' || filter.value === id)
    .map((id) => ({ id, rows: shown.value.filter((r) => r.group === id) }))
    .filter((g) => g.rows.length || (!searching.value && g.id !== 'private'))
)

// ─── создать ────────────────────────────────────────────────────────────────

const icon = (c: Component) => () => h(c)

const createItems = computed<MenuProps['items']>(() => [
  { key: 'video', label: t('shelf.createVideo'), icon: icon(VideoPlaylistIcon) },
  { key: 'audio', label: t('shelf.createAudio'), icon: icon(AudioPlaylistIcon) },
  { key: 'posts', label: t('shelf.createPosts'), icon: icon(CollectionIcon) },
  { type: 'divider' },
  { key: 'private-video', label: t('shelf.createPrivateVideo'), icon: icon(LockOutlined) },
  { key: 'private-audio', label: t('shelf.createPrivateAudio'), icon: icon(LockOutlined) },
])

function onCreate({ key }: { key: string | number }): void {
  if (key === 'video' || key === 'audio') {
    editor.open({ mode: 'create', kind: key })
    return
  }
  if (key === 'posts') {
    // Пустую коллекцию нода не примет: собирают её из публикаций.
    Modal.info({
      title: t('shelf.postsHowTitle'),
      content: t('shelf.postsHowText'),
      okText: t('shelf.understood'),
      zIndex: Z_INDEX.CONFIRM,
    })
    return
  }
  if (key === 'private-video' || key === 'private-audio') {
    nameDraft.value = ''
    naming.value = { mode: 'create', kind: key === 'private-video' ? 'video' : 'audio' }
  }
}

// ─── название личного плейлиста ─────────────────────────────────────────────

type Naming = { mode: 'create'; kind: LibraryKind } | { mode: 'rename'; listId: string }

const naming = ref<Naming | null>(null)
const nameDraft = ref('')

const namingTitle = computed(() => {
  const n = naming.value
  if (!n) return ''
  return n.mode === 'rename' ? t('shelf.renameTitle') : t(`shelf.newPrivateTitle.${n.kind}`)
})

function saveName(): void {
  const n = naming.value
  const name = nameDraft.value.trim()
  if (!n || !name) return
  if (n.mode === 'rename') {
    library.renamePlaylist(n.listId, name)
  } else if (library.createPlaylist(n.kind, name)) {
    appToast.success({ message: t('shelf.created', { name }) })
    if (filter.value !== 'all' && filter.value !== 'private') filter.value = 'private'
  } else {
    appToast.error({ message: t('library.tooManyPlaylists') })
  }
  naming.value = null
}

// ─── действия строки ────────────────────────────────────────────────────────

function onAction(row: ShelfRow, action: ShelfAction): void {
  const c = row.collection
  if (c) {
    if (action === 'edit') editor.open({ mode: 'edit', kind: c.kind, rootTxid: c.txid })
    else if (action === 'share') void share(c.txid)
    else if (action === 'delete') confirmDeletePublic(row)
    else if (action === 'dismiss') collections.dismissFailed(c.txid)
    return
  }
  if (action === 'rename') {
    nameDraft.value = library.nameOf(row.key)
    naming.value = { mode: 'rename', listId: row.key }
  } else if (action === 'delete') confirmDeletePrivate(row)
}

async function share(txid: string): Promise<void> {
  if (await copyText(publicCollectionUrl(txid)))
    appToast.success({ message: t('collections.linkCopied') })
}

function confirmDeletePublic(row: ShelfRow): void {
  const c = row.collection!
  Modal.confirm({
    title: t(`shelf.deletePublicTitle.${group(row)}`, { name: labelOf(row) }),
    content: t('collections.deleteConfirmText'),
    okText: t('collections.delete'),
    okType: 'danger',
    cancelText: t('collections.cancel'),
    zIndex: Z_INDEX.CONFIRM,
    onOk: async () => {
      try {
        await collections.remove(c.txid, draftOf(c))
        appToast.success({ message: t('collections.deleteSent') })
      } catch (e) {
        appToast.error({ message: e instanceof Error ? e.message : t('collections.sendFailed') })
      }
    },
  })
}

function confirmDeletePrivate(row: ShelfRow): void {
  Modal.confirm({
    title: t('shelf.deletePrivateTitle', { name: labelOf(row) }),
    content: t('library.deleteConfirmText'),
    okText: t('library.delete'),
    okType: 'danger',
    cancelText: t('library.cancel'),
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => {
      if (library.deletePlaylist(row.key)) appToast.success({ message: t('shelf.deleted') })
    },
  })
}

const group = (row: ShelfRow): Exclude<ShelfGroup, 'private'> =>
  row.group === 'private' ? 'posts' : row.group
</script>
