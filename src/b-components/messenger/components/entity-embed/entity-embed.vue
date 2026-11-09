<template>
  <!-- Профиль: аватар, ник, репутация; нажатие — в профиль (ProfileLink сам
       закрывает полноэкранный чат). -->
  <ProfileLink
    v-if="target.kind === 'profile'"
    class="entity-embed"
    :address="target.address"
    :name="profileName"
  >
    <SC_EntityCard data-testid="profile-embed">
      <Avatar
        :src="profileAvatar"
        :alt="profileName"
        :fallback-text="profileName"
        :size="40"
        shape="circle"
      />
      <SC_EntityInfo>
        <SC_EntityTitle>{{ profileName }}</SC_EntityTitle>
        <SC_EntityMeta>{{ profileMeta }}</SC_EntityMeta>
      </SC_EntityInfo>
    </SC_EntityCard>
  </ProfileLink>

  <!-- Коллекция или плейлист: обложка, название, сколько внутри. -->
  <RouterLink
    v-else
    class="entity-embed"
    :to="`/collection/${target.txid}`"
    data-testid="collection-embed"
    @click="leaveChat"
  >
    <SC_EntityCard>
      <SC_EntityCover>
        <img v-if="coverUrl && !coverFailed" :src="coverUrl" alt="" @error="coverFailed = true" />
        <CollectionIcon v-else />
      </SC_EntityCover>
      <SC_EntityInfo>
        <SC_EntityTitle>{{ collectionTitle }}</SC_EntityTitle>
        <SC_EntityMeta>{{ collectionMeta }}</SC_EntityMeta>
      </SC_EntityInfo>
    </SC_EntityCard>
  </RouterLink>
</template>

<script setup lang="ts">
// Карточка ссылки на профиль или коллекцию в сообщении (lib/entity-link) —
// как PostEmbed у ссылки на пост. Так приходит «Отправить в чат».

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CollectionIcon } from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatTopReputation } from '@/pages/top-accounts-page/top-format'
import { userName } from '@/services/user-names'
import type { ChainCollection } from '@/services/collections/collections-api'
import { kindOfContentTypes } from '@/services/collections/collection-model'
import ProfileLink from '../profile-link/profile-link.vue'
import { loadCollectionCard } from './load-collection'
import { useMessengerStore } from '../../store'
import type { EntityLinkTarget } from '../../lib/entity-link'
import {
  SC_EntityCard,
  SC_EntityCover,
  SC_EntityInfo,
  SC_EntityMeta,
  SC_EntityTitle,
} from './styled'

const props = defineProps<{ target: EntityLinkTarget }>()

const { t } = useI18n()
const store = useMessengerStore()

// --- Профиль ---

const profile = computed(() =>
  props.target.kind === 'profile' ? store.userProfiles[props.target.address] : undefined
)

watch(
  () => (props.target.kind === 'profile' ? props.target.address : ''),
  (address) => {
    if (address && !store.userProfiles[address]) void store.fetchProfiles([address])
  },
  { immediate: true }
)

const profileName = computed<string>(() => {
  if (props.target.kind !== 'profile') return ''
  return profile.value?.name || userName(props.target.address) || props.target.address
})
const profileAvatar = computed(() => resolveImageUrl(profile.value?.i) ?? undefined)
/** Репутация, когда профиль пришёл; до того — что это профиль. В окошке чата строка узкая. */
const profileMeta = computed<string>(() => {
  const reputation = Number(profile.value?.reputation)
  return Number.isFinite(reputation) && profile.value
    ? t('search.reputation', { n: formatTopReputation(reputation) })
    : t('chat.profileCard')
})

// --- Коллекция ---

const collection = ref<ChainCollection | null>(null)
const coverFailed = ref(false)

watch(
  () => (props.target.kind === 'collection' ? props.target.txid : ''),
  async (txid) => {
    collection.value = null
    coverFailed.value = false
    if (!txid) return
    const loaded = await loadCollectionCard(txid)
    if (props.target.kind === 'collection' && props.target.txid === txid) {
      collection.value = loaded
    }
  },
  { immediate: true }
)

const kind = computed(() => kindOfContentTypes(collection.value?.contentTypes) ?? 'posts')
const coverUrl = computed(() => resolveImageUrl(collection.value?.image) ?? null)
const collectionTitle = computed<string>(
  () => collection.value?.caption || t('chat.collectionCard')
)
const collectionMeta = computed<string>(() => {
  const c = collection.value
  if (!c) return t('chat.collectionCard')
  const n = c.contentIds.length
  // Тип и так виден по числу: «3 видео», «5 треков», «2 публикации».
  return [t(`collections.kindCount.${kind.value}`, { n }, n), userName(c.address) || '']
    .filter(Boolean)
    .join(' · ')
})

/** Полноэкранный чат закрывает страницу — к коллекции уходим из него (как ProfileLink). */
function leaveChat(e: MouseEvent): void {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (store.isFullScreen) store.closeFullScreen()
}
</script>
