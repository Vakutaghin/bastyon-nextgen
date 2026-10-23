<template>
  <Modal
    :open="!!dialog?.group"
    :width="480"
    :centered="true"
    :z-index="2700"
    :destroy-on-close="true"
    :footer="null"
    :title="t('messenger.group.info')"
    wrap-class-name="group-info-modal"
    @cancel="store.closeGroupInfo()"
  >
    <SC_GroupBody v-if="dialog?.group">
      <SC_GroupHead>
        <GroupAvatar
          :src="dialog.partner.avatar"
          :name="dialog.partner.name"
          :member-ids="dialog.group.previewIds"
          :size="64"
        />
        <SC_GroupHeadText>
          <SC_GroupName>{{ dialog.partner.name }}</SC_GroupName>
          <SC_GroupMeta>
            {{
              dialog.group.isPublic ? t('messenger.group.kindPublic') : t('messenger.group.kind')
            }}
            ·
            {{ t('messenger.group.members', { n: memberCount }, memberCount) }}
          </SC_GroupMeta>
        </SC_GroupHeadText>
      </SC_GroupHead>
      <SC_GroupTopic v-if="dialog.group.topic">{{ dialog.group.topic }}</SC_GroupTopic>

      <SC_GroupActions>
        <SC_ActionBtn type="button" data-testid="group-mute" @click="toggleMuted">
          <BellOutlined v-if="dialog.muted" />
          <BellOffOutlined v-else />
          {{ dialog.muted ? t('messenger.notifyOn') : t('messenger.notifyOff') }}
        </SC_ActionBtn>
        <Popconfirm
          :title="t('messenger.group.leaveConfirmTitle')"
          :description="t('messenger.group.leaveConfirmText', { name: dialog.partner.name })"
          :ok-text="t('messenger.group.leave')"
          :cancel-text="t('messenger.cancel')"
          :ok-button-props="{ danger: true }"
          placement="bottom"
          :overlay-style="CONFIRM_OVERLAY_STYLE"
          @confirm="leave"
        >
          <SC_ActionBtn type="button" class="danger" data-testid="group-leave">
            <LogoutOutlined />
            {{ t('messenger.group.leave') }}
          </SC_ActionBtn>
        </Popconfirm>
      </SC_GroupActions>

      <SC_MembersHead>
        <span>{{ t('messenger.group.showMembers') }}</span>
        <SC_MembersCount>{{ loaded ? members.length : memberCount }}</SC_MembersCount>
      </SC_MembersHead>
      <SC_MemberSearch
        v-if="members.length > SEARCH_FROM"
        v-model="query"
        type="search"
        :placeholder="t('messenger.group.searchMembers')"
        :aria-label="t('messenger.group.searchMembers')"
      />

      <SC_MembersEmpty v-if="!loaded">{{ t('messenger.group.notLoaded') }}</SC_MembersEmpty>
      <SC_MembersEmpty v-else-if="!shown.length">{{
        t('messenger.group.noMatches')
      }}</SC_MembersEmpty>
      <SC_MemberList v-else data-testid="group-members">
        <SC_MemberRow
          v-for="m in shown"
          :key="m.id"
          :class="{ invited: m.membership === 'invite', ignored: m.ignored }"
        >
          <!-- Профиль открывается под мессенджером — окно группы закрываем. -->
          <SC_MemberMain @click="store.closeGroupInfo()">
            <ProfileLink :address="m.address" :name="m.name">
              <Avatar :src="m.avatar" alt="" :fallback-text="m.name" :size="36" :mark="m.mark" />
              <SC_MemberText>
                <SC_MemberName>
                  <span>{{ m.name }}</span>
                  <SC_YouTag v-if="m.isMe">{{ t('messenger.you') }}</SC_YouTag>
                </SC_MemberName>
                <SC_MemberSub v-if="memberSub(m)">{{ memberSub(m) }}</SC_MemberSub>
              </SC_MemberText>
            </ProfileLink>
          </SC_MemberMain>

          <SC_MemberActions v-if="!m.isMe">
            <SC_IconBtn
              v-if="m.address"
              type="button"
              :title="t('messenger.group.writePrivately')"
              :aria-label="`${t('messenger.group.writePrivately')}: ${m.name}`"
              @click="writeTo(m.address)"
            >
              <MessageOutlined />
            </SC_IconBtn>
            <Popconfirm
              :title="
                m.ignored ? t('messenger.unmuteConfirmTitle') : t('messenger.muteConfirmTitle')
              "
              :description="t('messenger.muteExplain')"
              :ok-text="m.ignored ? t('messenger.unmuteUser') : t('messenger.muteUser')"
              :cancel-text="t('messenger.cancel')"
              placement="bottomRight"
              :overlay-style="CONFIRM_OVERLAY_STYLE"
              @confirm="toggleIgnored(m.id)"
            >
              <SC_IconBtn
                type="button"
                :class="{ active: m.ignored }"
                :title="m.ignored ? t('messenger.unmuteUser') : t('messenger.muteUser')"
                :aria-label="`${m.ignored ? t('messenger.unmuteUser') : t('messenger.muteUser')}: ${m.name}`"
                :disabled="ignoreBusy"
              >
                <StopOutlined />
              </SC_IconBtn>
            </Popconfirm>
          </SC_MemberActions>
        </SC_MemberRow>
      </SC_MemberList>
    </SC_GroupBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Popconfirm } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import {
  BellOffOutlined,
  BellOutlined,
  LogoutOutlined,
  MessageOutlined,
  StopOutlined,
} from '@/components/icons'
import { Z_INDEX } from '@/styles/design-tokens'
import { useMessengerStore } from '../../store'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import ProfileLink from '../profile-link/profile-link.vue'
import { useGroupMembers, type GroupMemberView } from './use-group-members'
import {
  SC_ActionBtn,
  SC_GroupActions,
  SC_GroupBody,
  SC_GroupHead,
  SC_GroupHeadText,
  SC_GroupMeta,
  SC_GroupName,
  SC_GroupTopic,
  SC_IconBtn,
  SC_MemberActions,
  SC_MemberList,
  SC_MemberMain,
  SC_MemberName,
  SC_MemberRow,
  SC_MemberSearch,
  SC_MemberSub,
  SC_MemberText,
  SC_MembersCount,
  SC_MembersEmpty,
  SC_MembersHead,
  SC_YouTag,
} from './styled'

/** Поиск по участникам — когда списком уже неудобно. */
const SEARCH_FROM = 8

// Подтверждения рендерятся в body, а окно группы стоит над полноэкранным
// мессенджером (2700): без своего слоя поповер оказался бы под ним.
const CONFIRM_OVERLAY_STYLE = {
  zIndex: Z_INDEX.REACTION_PICKER,
  width: 'min(300px, calc(100vw - 24px))',
}

const { t } = useI18n()
const store = useMessengerStore()

const dialog = computed(() => store.dialogs.find((d) => d.id === store.groupInfoChatId) ?? null)
const roomId = computed(() => (dialog.value?.group ? dialog.value.id : null))
const { members, loaded, ignoreBusy, toggleIgnored } = useGroupMembers(roomId)

const memberCount = computed(() =>
  loaded.value ? members.value.length : (dialog.value?.group?.memberCount ?? 0)
)

const query = ref('')
watch(roomId, () => {
  query.value = ''
})

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter(
    (m) => m.name.toLowerCase().includes(q) || m.address?.toLowerCase().includes(q)
  )
})

function memberSub(m: GroupMemberView): string {
  const parts: string[] = []
  if (m.role) parts.push(t(`messenger.group.${m.role}`))
  if (m.membership === 'invite') parts.push(t('messenger.group.invited'))
  return parts.join(' · ')
}

function toggleMuted(): void {
  const d = dialog.value
  if (d) void store.setDialogMuted(d.id, !d.muted)
}

function leave(): void {
  const d = dialog.value
  if (!d) return
  store.closeGroupInfo()
  store.deleteDialog(d.id)
}

function writeTo(address: string): void {
  store.closeGroupInfo()
  void store.openInviteWithAddress(address)
}
</script>
