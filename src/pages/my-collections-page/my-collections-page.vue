<template>
  <SC_SectionWork>
    <SC_SectionPage class="narrow" data-testid="my-collections">
      <SC_SectionHead>
        <SC_SectionTitle>
          <CollectionIcon /> {{ t('shelf.title') }} <HelpLink topic="collections" />
        </SC_SectionTitle>
        <SC_HeadEnd v-if="me">
          <Button type="primary" data-testid="shelf-create" @click="create">
            <template #icon><PlusOutlined /></template>
            {{ t('shelf.create') }}
          </Button>
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
        <SC_Builtins :aria-label="t('shelf.builtins')">
          <SC_BuiltinCard
            v-for="item in builtins"
            :key="item.id"
            :data-testid="`shelf-builtin-${item.id}`"
          >
            <router-link :to="item.to">
              <span class="icon"><component :is="item.icon" /></span>
              <span class="name">{{ item.label }}</span>
              <span class="meta">
                <span>{{ item.count }}</span>
                <SC_Badge>
                  <DeviceCopyIcon v-if="item.id === 'downloads'" />
                  <LockOutlined v-else />
                  {{
                    item.id === 'downloads' ? t('shelf.onDevice') : t('lists.visibility.private')
                  }}
                </SC_Badge>
              </span>
            </router-link>
          </SC_BuiltinCard>
        </SC_Builtins>

        <SC_ListTitle>{{ t('shelf.mine') }}</SC_ListTitle>
        <SC_Toolbar>
          <SC_Filters>
            <SC_Chips role="group" :aria-label="t('lists.whatInside')">
              <SC_Chip
                v-for="option in KIND_FILTERS"
                :key="option"
                type="button"
                :class="{ active: kindFilter === option }"
                :aria-pressed="kindFilter === option"
                :data-testid="`shelf-filter-${option}`"
                @click="kindFilter = option"
              >
                {{ t(`shelf.kindFilters.${option}`) }}
                <SC_ChipCount>{{ kindTotals[option] }}</SC_ChipCount>
              </SC_Chip>
            </SC_Chips>
            <SC_Chips role="group" :aria-label="t('lists.whoSees')">
              <SC_Chip
                v-for="option in VISIBILITY_FILTERS"
                :key="option"
                type="button"
                :class="{ active: visibilityFilter === option }"
                :aria-pressed="visibilityFilter === option"
                :data-testid="`shelf-visibility-${option}`"
                @click="visibilityFilter = option"
              >
                <GlobalOutlined v-if="option === 'public'" />
                <LockOutlined v-else-if="option === 'private'" />
                {{ t(`shelf.visibilityFilters.${option}`) }}
                <SC_ChipCount>{{ visibilityTotals[option] }}</SC_ChipCount>
              </SC_Chip>
            </SC_Chips>
          </SC_Filters>
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

        <SC_Rows v-if="shown.length" data-testid="shelf-list">
          <ShelfRowItem
            v-for="row in shown"
            :key="row.key"
            :row="row"
            :label="labelOf(row)"
            @action="(action) => onAction(row, action)"
          />
        </SC_Rows>
        <SC_GroupNote v-else-if="filtering">{{ t('shelf.nothingFound') }}</SC_GroupNote>
        <SC_GroupNote v-else-if="!publicReady">{{ t('collections.loading') }}</SC_GroupNote>
        <SC_GroupNote v-else data-testid="shelf-empty">{{ t('shelf.none') }}</SC_GroupNote>

        <SC_GroupNote v-if="publicStatus === 'error'" role="alert" class="after">
          {{ t('shelf.loadFailed') }}
          <Button type="link" size="small" @click="reload">{{ t('shelf.retry') }}</Button>
        </SC_GroupNote>
        <SC_Note v-else-if="!publicReady && shown.length">{{ t('shelf.publicLoading') }}</SC_Note>
      </template>
    </SC_SectionPage>

    <!-- Переименование личного списка. -->
    <Modal
      :open="!!renaming"
      :title="t('shelf.renameTitle')"
      :ok-text="t('library.save')"
      :cancel-text="t('library.cancel')"
      :ok-button-props="{ disabled: !nameDraft.trim() }"
      destroy-on-close
      @ok="saveName"
      @cancel="renaming = null"
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
// «Коллекции и плейлисты» — всё своё в одном месте. Сверху встроенные списки:
// «Избранное», «Смотреть позже», «Скачанное». Ниже — один список своих
// плейлистов и коллекций, у каждой строки два значка: что внутри (видео, аудио,
// публикации) и кто видит (все — в блокчейне, только я — в данных аккаунта).
// «Создать» — одно окно с этими двумя вопросами; в «⋯» строки — изменить,
// поделиться, сделать личным или публичным, удалить.

import { computed, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal } from 'ant-design-vue'
import {
  BookOutlined,
  CollectionIcon,
  DeviceCopyIcon,
  DownloadOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  WatchLaterIcon,
} from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
import { useListVisibility } from '@/b-components/media/use-list-visibility'
import { useAuthStore } from '@/blockchain'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { draftOf } from '@/stores/collections-store'
import { useModalStore } from '@/stores/modal-store'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { copyText } from '@/helpers/common/clipboard'
import { chatLinks, publicCollectionUrl } from '@/helpers/common/share-origin'
import { useShareToChat } from '@/composables/use-share-to-chat'
import { WATCH_LATER } from '@/services/media-library/media-library-doc'
import { Z_INDEX } from '@/styles/design-tokens'
import {
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
  SHELF_KINDS,
  SHELF_VISIBILITIES,
  filterShelf,
  kindCounts,
  privateRows,
  publicRows,
  sortShelf,
  visibilityCounts,
  type ShelfKindFilter,
  type ShelfRow,
  type ShelfVisibilityFilter,
} from './collection-shelf'
import ShelfRowItem, { type ShelfAction } from './shelf-row.vue'
import {
  SC_Badge,
  SC_BuiltinCard,
  SC_Builtins,
  SC_ChipCount,
  SC_Filters,
  SC_GroupNote,
  SC_HeadEnd,
  SC_Lead,
  SC_ListTitle,
  SC_Rows,
  SC_Toolbar,
} from './my-collections-page.styled'

const KIND_FILTERS: readonly ShelfKindFilter[] = ['all', ...SHELF_KINDS]
const VISIBILITY_FILTERS: readonly ShelfVisibilityFilter[] = ['all', ...SHELF_VISIBILITIES]
/** Поиск — когда строк больше, чем видно глазом. */
const SEARCH_FROM = 8

const { t } = useI18n()
const { shareToChat } = useShareToChat()
const authStore = useAuthStore()
const modalStore = useModalStore()
const editor = useCollectionEditorStore()
const offline = useOfflineVideosStore()
const { library, collections } = useMediaLibrary()
const { makePublic, makePrivate } = useListVisibility()

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
const publicReady = computed(() => publicStatus.value === 'ready' || publicStatus.value === 'error')

// ─── встроенные списки ──────────────────────────────────────────────────────

interface Builtin {
  id: 'favorites' | 'later' | 'downloads'
  label: string
  icon: Component
  count: number
  to: string
}

/** «Скачанное» — туда, где оно есть: видео или аудио. */
const downloadsPath = computed(() =>
  offline.mine.some((i) => i.meta.kind === 'video') || !offline.mine.length
    ? '/video/downloads'
    : '/audio/downloads'
)

const builtins = computed<Builtin[]>(() => [
  {
    id: 'favorites',
    label: t('library.favorites'),
    icon: BookOutlined,
    count: library.favorites.length,
    to: '/?feedMode=favorites',
  },
  {
    id: 'later',
    label: t('library.watchLater'),
    icon: WatchLaterIcon,
    count: library.ids(WATCH_LATER).length,
    to: '/video/later',
  },
  ...(offline.available
    ? [
        {
          id: 'downloads' as const,
          label: t('videoSection.tabs.downloads'),
          icon: DownloadOutlined,
          count: offline.mine.length,
          to: downloadsPath.value,
        },
      ]
    : []),
])

// ─── свои списки ────────────────────────────────────────────────────────────

function labelOf(row: ShelfRow): string {
  return row.name || (row.collection ? t('media.untitled') : t('library.untitledPlaylist'))
}

const rows = computed<ShelfRow[]>(() =>
  me.value
    ? sortShelf(
        [
          ...publicRows(collections.collectionsOf(me.value)),
          ...privateRows(library, collections.replacing),
        ],
        labelOf
      )
    : []
)

const kindFilter = ref<ShelfKindFilter>('all')
const visibilityFilter = ref<ShelfVisibilityFilter>('all')
const search = ref('')
const filtering = computed(
  () => !!search.value.trim() || kindFilter.value !== 'all' || visibilityFilter.value !== 'all'
)

const kindTotals = computed(() => kindCounts(rows.value, visibilityFilter.value))
const visibilityTotals = computed(() => visibilityCounts(rows.value, kindFilter.value))
const shown = computed(() =>
  filterShelf(rows.value, kindFilter.value, visibilityFilter.value, search.value, labelOf)
)

/** «Создать»: что внутри — по выбранному фильтру, кто видит — тоже. */
function create(): void {
  editor.open({
    mode: 'create',
    kind: kindFilter.value === 'all' ? 'video' : kindFilter.value,
    visibility: visibilityFilter.value === 'public' ? 'public' : 'private',
  })
}

// ─── переименование личного списка ──────────────────────────────────────────

const renaming = ref<string | null>(null)
const nameDraft = ref('')

function saveName(): void {
  const listId = renaming.value
  const name = nameDraft.value.trim()
  if (!listId || !name) return
  library.renamePlaylist(listId, name)
  renaming.value = null
}

// ─── действия строки ────────────────────────────────────────────────────────

function onAction(row: ShelfRow, action: ShelfAction): void {
  const c = row.collection
  if (c) {
    if (action === 'edit') editor.open({ mode: 'edit', kind: c.kind, rootTxid: c.txid })
    else if (action === 'share') void share(c.txid)
    else if (action === 'chat')
      shareToChat({ link: chatLinks.collection(c.txid), title: labelOf(row) })
    else if (action === 'delete') confirmDeletePublic(row)
    else if (action === 'dismiss') collections.dismissFailed(c.txid)
    else if (action === 'make-private') makePrivate(c)
    return
  }
  if (action === 'rename') {
    nameDraft.value = library.nameOf(row.key)
    renaming.value = row.key
  } else if (action === 'make-public') makePublic(row.key)
  else if (action === 'delete') confirmDeletePrivate(row)
}

async function share(txid: string): Promise<void> {
  if (await copyText(publicCollectionUrl(txid)))
    appToast.success({ message: t('collections.linkCopied') })
}

function confirmDeletePublic(row: ShelfRow): void {
  const c = row.collection!
  Modal.confirm({
    title: t('shelf.deleteTitle', { name: labelOf(row) }),
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
    title: t('shelf.deleteTitle', { name: labelOf(row) }),
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
</script>
