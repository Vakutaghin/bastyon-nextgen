<template>
  <!-- На телефоне — шторкой снизу (style.css, .profile-info-modal): профиль
       остаётся виден над ней. -->
  <Modal
    :open="open"
    class="profile-info-modal"
    :title="name"
    :footer="null"
    @update:open="emit('update:open', $event)"
  >
    <SC_SheetBody data-testid="profile-info-sheet">
      <ProfileDetails :profile="profile" />

      <SC_SheetActions v-if="canShowSubscribe">
        <SC_BlockButton
          type="button"
          :class="{ blocked: isBlocked }"
          :disabled="isBlockPending"
          @click="onBlockClick"
        >
          <LoadingOutlined v-if="isBlockPending" spin />
          <StopOutlined v-else />
          {{ isBlocked ? t('comments.unblock') : t('comments.block') }}
        </SC_BlockButton>
      </SC_SheetActions>
    </SC_SheetBody>
  </Modal>
</template>

<script setup lang="ts">
// «Подробнее» профиля на телефоне: всё, что на компьютере в боковой колонке и
// не поместилось в шапку над постами, — «Информация» и «Заблокировать».
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modal/modal.vue'
import { LoadingOutlined, StopOutlined } from '@/components/icons'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import ProfileDetails from '../profile-details/profile-details.vue'
import { useProfileRelationsActions } from '../profile-sidebar/use-profile-relations-actions'
import { SC_BlockButton } from '../profile-sidebar/styled'
import { SC_SheetActions, SC_SheetBody } from './styled'

const props = defineProps<{ open: boolean; profile: UserProfile; name: string }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()
const { t } = useI18n()

const address = computed<string>(() => props.profile.address || '')
const { isBlocked, isBlockPending, canShowSubscribe, onBlockClick } =
  useProfileRelationsActions(address)
</script>
