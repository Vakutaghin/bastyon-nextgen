// Списки подписчиков и подписок профиля — из боковой колонки и из шапки
// профиля на телефоне.
import { computed, ref, type Ref } from 'vue'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import type { RelationListType } from '@/composables/use-followers-list'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export function useRelationLists(
  profile: Ref<UserProfile | null | undefined>,
  isOwnProfile: Ref<boolean>
) {
  const listOpen = ref(false)
  const listType = ref<RelationListType>('followers')

  /**
   * Кого владелец профиля заблокировал — в его списках их нет (как у старого
   * клиента). Свой блок-лист — из стора: он свежее профиля и знает о блокировках,
   * ждущих блока.
   */
  const listHiddenAddresses = computed<readonly string[]>(() => {
    if (isOwnProfile.value) return [...useUserRelationsStore().blocked]
    const blocking = profile.value?.blocking
    return Array.isArray(blocking) ? blocking : []
  })

  function openList(type: RelationListType): void {
    listType.value = type
    listOpen.value = true
  }

  return { listOpen, listType, listHiddenAddresses, openList }
}
