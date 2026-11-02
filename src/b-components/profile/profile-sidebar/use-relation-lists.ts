// Списки подписчиков и подписок профиля — из боковой колонки и из шапки
// профиля на телефоне.
import { computed, ref, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import { fetchUserBlockings } from '@/services/user-blockings'
import type { RelationListType } from '@/composables/use-followers-list'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export function useRelationLists(
  profile: Ref<UserProfile | null | undefined>,
  isOwnProfile: Ref<boolean>
) {
  const listOpen = ref(false)
  const listType = ref<RelationListType>('followers')

  const address = computed(() => profile.value?.address ?? '')

  // Профиль открыт по лёгкому, а в нём списка блокировок нет — спрашиваем
  // отдельно, когда открыли список.
  const { data: blockings } = useQuery({
    queryKey: computed(() => ['user-blockings', address.value]),
    queryFn: () => fetchUserBlockings(address.value),
    enabled: computed(() => listOpen.value && !isOwnProfile.value && !!address.value),
    staleTime: 5 * 60 * 1000,
  })

  /**
   * Кого владелец профиля заблокировал — в его списках их нет (как у старого
   * клиента). Свой блок-лист — из стора: он свежее профиля и знает о блокировках,
   * ждущих блока.
   */
  const listHiddenAddresses = computed<readonly string[]>(() => {
    if (isOwnProfile.value) return [...useUserRelationsStore().blocked]
    if (blockings.value) return blockings.value
    const blocking = profile.value?.blocking
    return Array.isArray(blocking) ? blocking : []
  })

  function openList(type: RelationListType): void {
    listType.value = type
    listOpen.value = true
  }

  return { listOpen, listType, listHiddenAddresses, openList }
}
