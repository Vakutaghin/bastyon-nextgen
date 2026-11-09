<template>
  <div data-testid="playlists-tab">
    <SC_Block>
      <SC_BlockHead>
        <SC_BlockTitle><GlobalOutlined /> {{ t('lists.publicPlaylists') }}</SC_BlockTitle>
        <SC_HeadActions>
          <router-link to="/collections" class="manage" data-testid="shelf-link">
            {{ t('shelf.manage') }}
          </router-link>
          <Button data-testid="playlists-create" @click="create">
            <template #icon><PlusOutlined /></template>
            {{ t('collections.newPlaylist') }}
          </Button>
        </SC_HeadActions>
      </SC_BlockHead>
      <SC_Note>{{ t('collections.publicNote') }}</SC_Note>
      <SC_CardsGrid v-if="own.length" :class="{ square: kind === 'audio' }">
        <CollectionCard v-for="c in own" :key="c.txid" :collection="c" />
      </SC_CardsGrid>
      <SC_Empty v-else-if="status !== 'loading'">
        <p>{{ t(`collections.noneYet.${kind}`) }}</p>
      </SC_Empty>
    </SC_Block>

    <SC_Block>
      <SC_BlockHead>
        <SC_BlockTitle><LockOutlined /> {{ t('library.privatePlaylists') }}</SC_BlockTitle>
      </SC_BlockHead>
      <SC_Note>{{ t('library.privateNote') }}</SC_Note>
      <SC_ListRows v-if="privateIds.length">
        <li v-for="id in privateIds" :key="id">
          <router-link :to="`/library/${id}`">
            <AudioPlaylistIcon v-if="kind === 'audio'" class="icon" />
            <VideoPlaylistIcon v-else class="icon" />
            <span class="name">{{ library.nameOf(id) || t('library.untitledPlaylist') }}</span>
            <span class="count">{{ library.ids(id).length }}</span>
          </router-link>
        </li>
      </SC_ListRows>
      <SC_Empty v-else>
        <p>{{ t('library.noPrivatePlaylists') }}</p>
      </SC_Empty>
    </SC_Block>
  </div>
</template>

<script setup lang="ts">
// Вкладка «Плейлисты» раздела: свои публичные плейлисты (в блокчейне, видят
// все) и личные (на сервере чатов, видит только владелец). «Новый плейлист»
// открывает окно «Создать» — там и выбирают, кто его видит.

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import CollectionCard from '../collection-card/collection-card.vue'
import {
  SC_Block,
  SC_BlockHead,
  SC_BlockTitle,
  SC_CardsGrid,
  SC_Empty,
  SC_HeadActions,
  SC_ListRows,
  SC_Note,
} from '@/pages/media-section/media-section.styled'

const props = defineProps<{ kind: 'video' | 'audio' }>()

const { t } = useI18n()
const authStore = useAuthStore()
const editor = useCollectionEditorStore()
const { library, collections } = useMediaLibrary()

const me = computed(() => authStore.getUserAddress || '')
const own = computed(() => (me.value ? collections.ofKind(me.value, props.kind) : []))
const status = computed(() => collections.statusOf(me.value))
const privateIds = computed(() => library.playlists(props.kind))

watch(
  me,
  (address) => {
    if (address) void collections.loadAuthor(address)
  },
  { immediate: true }
)

function create(): void {
  editor.open({ mode: 'create', kind: props.kind, kinds: [props.kind] })
}
</script>
