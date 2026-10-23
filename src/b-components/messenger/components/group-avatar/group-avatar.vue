<template>
  <SC_GroupAvatar :size="size">
    <Avatar v-if="src || !tiles.length" :src="src" :alt="name" :fallback-text="name" :size="size" />
    <!-- Без картинки — мозаика из участников: сразу видно, что это группа, а не человек. -->
    <SC_Mosaic v-else :size="size" :class="`n${tiles.length}`" role="img" :aria-label="name">
      <SC_Tile v-for="(m, i) in tiles" :key="m.id" :class="`t${i}`">
        <Avatar :src="m.avatar" alt="" :fallback-text="m.name" :size="tileSize(i)" shape="square" />
      </SC_Tile>
    </SC_Mosaic>
    <SC_GroupBadge v-if="badge" :size="size" aria-hidden="true">
      <TeamOutlined />
    </SC_GroupBadge>
  </SC_GroupAvatar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/avatar/avatar.vue'
import { TeamOutlined } from '@/components/icons'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { useMessengerStore } from '../../store'
import { chatUserName, getAddressFromMatrixId } from '../../helpers'
import { SC_GroupAvatar, SC_GroupBadge, SC_Mosaic, SC_Tile } from './styled'

const props = withDefaults(
  defineProps<{
    /** Картинка группы; без неё — мозаика из участников. */
    src?: string
    name: string
    /** Matrix-id участников для мозаики (до четырёх). */
    memberIds: string[]
    size: number
    /** Значок «группа» в углу — для списка чатов. */
    badge?: boolean
  }>(),
  { src: undefined, badge: false }
)

const store = useMessengerStore()

const tiles = computed(() =>
  props.memberIds.slice(0, 4).map((id) => {
    const address = getAddressFromMatrixId(id)
    const p = address ? store.userProfiles[address] : undefined
    const img = p?.i || p?.avatar || p?.image
    return {
      id,
      name: chatUserName(id, store.userProfiles),
      avatar: typeof img === 'string' ? resolveImageUrl(img) : undefined,
    }
  })
)

/** Половинки — во всю высоту (лишнее по бокам обрезается), четвертинки — вдвое меньше. */
function tileSize(i: number): number {
  const n = tiles.value.length
  if (n <= 2 || (n === 3 && i === 0)) return props.size
  return Math.round(props.size / 2)
}
</script>
