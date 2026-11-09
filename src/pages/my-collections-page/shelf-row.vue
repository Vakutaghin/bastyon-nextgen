<template>
  <SC_Row data-testid="shelf-row" :data-key="row.key" :data-visibility="row.visibility">
    <router-link :to="row.to" class="main">
      <SC_Thumb :class="{ square: row.kind === 'audio' }">
        <img v-if="coverSrc" :src="coverSrc" alt="" loading="lazy" @error="onCoverError" />
        <component :is="kindIcon" v-else />
      </SC_Thumb>
      <SC_Text>
        <span class="name">{{ label }}</span>
        <span class="meta">
          <SC_Badge data-testid="shelf-row-kind">
            <component :is="kindIcon" />
            {{ t(`collections.kindCount.${row.kind}`, { n: row.count }, row.count) }}
          </SC_Badge>
          <SC_Badge
            :class="row.visibility"
            :title="t(`lists.visibilityHint.${row.visibility}`)"
            data-testid="shelf-row-visibility"
          >
            <GlobalOutlined v-if="row.visibility === 'public'" />
            <LockOutlined v-else />
            {{ t(`lists.visibility.${row.visibility}`) }}
          </SC_Badge>
        </span>
      </SC_Text>
      <SC_State v-if="stateLabel" :class="{ failed: row.collection?.failed }">
        {{ stateLabel }}
      </SC_State>
    </router-link>
    <Dropdown
      v-if="items.length"
      v-model:open="menuOpen"
      :trigger="['click']"
      placement="bottomRight"
    >
      <SC_More type="button" :aria-label="t('shelf.more')" data-testid="shelf-row-menu">
        <MoreOutlined />
      </SC_More>
      <template #overlay>
        <Menu :items="items" @click="onClick" />
      </template>
    </Dropdown>
  </SC_Row>
</template>

<script setup lang="ts">
// Строка на странице «Коллекции и плейлисты»: обложка, название, что внутри
// и сколько, кто видит, состояние своего изменения; «⋯» — изменить или
// переименовать, поделиться, сделать личным или публичным, удалить. У
// публичной в меню — сколько правок осталось в этом месяце (нода пускает 5):
// узнаём, когда меню открыли.

import { computed, h, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu, type MenuProps } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  CollectionIcon,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  LockOutlined,
  MoreOutlined,
  ShareAltOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import { useEditsLeft } from '@/b-components/media/add-to-list-modal/use-edits-left'
import { COLLECTION_EDIT_LIMIT } from '@/services/collections/collection-model'
import type { CollectionView } from '@/stores/collections-store'
import type { ShelfRow } from './collection-shelf'
import {
  SC_Badge,
  SC_More,
  SC_Row,
  SC_State,
  SC_Text,
  SC_Thumb,
} from './my-collections-page.styled'

export type ShelfAction =
  | 'edit'
  | 'share'
  | 'delete'
  | 'rename'
  | 'dismiss'
  | 'make-public'
  | 'make-private'

const props = defineProps<{ row: ShelfRow; label: string }>()
const emit = defineEmits<{ action: [action: ShelfAction] }>()

const { t } = useI18n()
const menuOpen = ref(false)

const kindIcon = computed<Component>(() =>
  props.row.kind === 'audio'
    ? AudioPlaylistIcon
    : props.row.kind === 'video'
      ? VideoPlaylistIcon
      : CollectionIcon
)

// Своя обложка не загрузилась — превью первого элемента, потом значок.
const coverFailed = ref(false)
const fallbackFailed = ref(false)
const coverSrc = computed(() => {
  const { cover, fallbackCover } = props.row
  if (!coverFailed.value) return cover
  return !fallbackFailed.value && fallbackCover && fallbackCover !== cover ? fallbackCover : null
})
function onCoverError(): void {
  if (coverFailed.value) fallbackFailed.value = true
  coverFailed.value = true
}

const stateLabel = computed(() => {
  if (props.row.replacing) return t('collections.publishing')
  const c = props.row.collection
  if (!c) return ''
  if (c.failed) return t('collections.notInBlock')
  if (c.pending === 'delete') return t('collections.deleting')
  if (c.pending || c.queued) return t('collections.publishing')
  return ''
})

// ─── меню ───────────────────────────────────────────────────────────────────

const target = ref<CollectionView[]>([])
const { editsLeft, refresh } = useEditsLeft(target)

watch(menuOpen, (open) => {
  const c = props.row.collection
  if (!open || !c || c.pending === 'create') return
  target.value = [c]
  void refresh()
})

const icon = (c: Component) => () => h(c)

type MenuItems = NonNullable<MenuProps['items']>

const items = computed<MenuItems>(() => {
  const { row } = props
  const c = row.collection
  if (c) {
    if (c.failed) return [{ key: 'dismiss', label: t('collections.dismissFailed') }]
    const out: MenuItems = [
      { key: 'share', label: t('collections.share'), icon: icon(ShareAltOutlined) },
    ]
    // Своё изменение ещё не в блоке — править и удалять нечего: страница коллекции так же.
    if (!c.pending) {
      const left = editsLeft.value[c.txid]
      out.unshift({ key: 'edit', label: t('collections.edit'), icon: icon(EditOutlined) })
      if (left !== undefined)
        out.splice(1, 0, {
          key: 'edits-left',
          label: t('collections.editsLeft', { n: left, max: COLLECTION_EDIT_LIMIT }),
          disabled: true,
        })
      out.push(
        { key: 'make-private', label: t('lists.makePrivate'), icon: icon(LockOutlined) },
        { type: 'divider' },
        { key: 'delete', label: t('collections.delete'), icon: icon(DeleteOutlined), danger: true }
      )
    }
    return out
  }
  if (row.replacing) return []
  return [
    { key: 'rename', label: t('library.rename'), icon: icon(EditOutlined) },
    { key: 'make-public', label: t('lists.makePublic'), icon: icon(GlobalOutlined) },
    { type: 'divider' },
    { key: 'delete', label: t('library.delete'), icon: icon(DeleteOutlined), danger: true },
  ]
})

function onClick({ key }: { key: string | number }): void {
  menuOpen.value = false
  if (key === 'edits-left') return
  emit('action', key as ShelfAction)
}
</script>
