<template>
  <SC_InviteWrap data-testid="chat-invite">
    <SC_InviteCard>
      <GroupAvatar
        v-if="dialog?.group"
        :src="dialog.partner.avatar"
        :name="dialog.partner.name"
        :member-ids="dialog.group.previewIds"
        :size="64"
      />
      <Avatar
        v-else
        :src="dialog?.partner.avatar"
        :alt="inviterName"
        :fallback-text="inviterName"
        :size="64"
        :verified="dialog?.partner.verified"
        :mark="dialog?.partner.mark"
        shape="circle"
      />

      <SC_InviteTitle>{{ title }}</SC_InviteTitle>

      <SC_InviteText v-if="state === 'gone'" class="error" role="alert">
        {{ t('messenger.invite.gone') }}
      </SC_InviteText>
      <SC_InviteText v-else-if="state === 'failed'" class="error" role="alert">
        {{ t('messenger.invite.failed') }}
      </SC_InviteText>
      <SC_InviteText v-else-if="state === 'accepting'" role="status">
        {{ t('messenger.invite.accepting') }}
      </SC_InviteText>
      <SC_InviteText v-else>{{ t('messenger.invite.hint') }}</SC_InviteText>

      <SC_InviteActions>
        <Button v-if="state === 'gone'" type="primary" @click="decline">
          {{ t('messenger.invite.remove') }}
        </Button>
        <template v-else>
          <Button :disabled="state === 'accepting'" data-testid="invite-decline" @click="decline">
            {{ t('messenger.invite.decline') }}
          </Button>
          <Button
            type="primary"
            :loading="state === 'accepting'"
            data-testid="invite-accept"
            @click="accept"
          >
            {{ t('messenger.invite.accept') }}
          </Button>
        </template>
      </SC_InviteActions>
    </SC_InviteCard>
  </SC_InviteWrap>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Avatar from '@/components/avatar/avatar.vue'
import Button from '@/components/button'
import { logger } from '@/services/logger'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import { chatUserName, getAddressFromMatrixId } from '../../helpers'
import { isInviteGone } from '../../lib/invite-error'
import { useMessengerStore } from '../../store'
import type { Dialog } from '../../types'
import {
  SC_InviteActions,
  SC_InviteCard,
  SC_InviteText,
  SC_InviteTitle,
  SC_InviteWrap,
} from './styled'

/**
 * Приглашение в чат или группу: принять или отклонить, как в прежнем
 * клиенте. Раньше чат вступал сам при открытии, а окна не было вовсе.
 */
const props = defineProps<{
  chatId: string
  /** Чат из списка; без него (открыли раньше, чем пришёл список) — только кто пригласил. */
  dialog: Dialog | null
  /** Matrix-id пригласившего. */
  inviterId: string
}>()

const { t } = useI18n()
const store = useMessengerStore()
const log = logger.scope('[ChatInvite]')

type InviteState = 'idle' | 'accepting' | 'failed' | 'gone'
const state = ref<InviteState>('idle')
watch(
  () => props.chatId,
  () => (state.value = 'idle')
)

// В группе пригласивший — не собеседник из списка: его профиль может быть не загружен.
watch(
  () => props.inviterId,
  (id) => {
    const address = id ? getAddressFromMatrixId(id) : null
    if (address && !store.userProfiles[address]) void store.fetchProfiles([address])
  },
  { immediate: true }
)

const inviterName = computed<string>(() => {
  const known = props.dialog?.group ? undefined : props.dialog?.partner.name
  // Отправитель приглашения неизвестен — список подставляет id комнаты, а не человека.
  const id = props.inviterId.startsWith('@') ? props.inviterId : ''
  return id ? chatUserName(id, store.userProfiles, known) : known || ''
})

const title = computed<string>(() => {
  const name = inviterName.value
  const group = props.dialog?.group ? props.dialog.partner.name : ''
  if (group) {
    return name
      ? t('messenger.invite.titleGroup', { name, group })
      : t('messenger.invite.titleGroupNoInviter', { group })
  }
  return name ? t('messenger.invite.title', { name }) : t('messenger.invite.titleNoInviter')
})

async function accept(): Promise<void> {
  if (state.value === 'accepting') return
  state.value = 'accepting'
  try {
    // Окно закроется само: история загрузится, как только синк принесёт вступление.
    await store.acceptInvite(props.chatId)
  } catch (e) {
    log.warn('Приглашение не принято:', e)
    state.value = isInviteGone(e) ? 'gone' : 'failed'
  }
}

function decline(): void {
  store.declineInvite(props.chatId)
}
</script>
