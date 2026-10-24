<template>
  <SC_BadgeRow v-if="badges.length" :class="align" data-testid="profile-badges">
    <APopover
      v-for="b in badges"
      :key="b"
      :open="openBadge === b"
      trigger="click"
      placement="bottom"
      @update:open="(v: boolean) => (openBadge = v ? b : null)"
    >
      <template #content>
        <SC_HintCard :data-testid="`badge-hint-${b}`">
          <SC_HintTitle>{{ t('profile.badges.' + b) }}</SC_HintTitle>
          <SC_HintText>{{ t('profile.badgeHints.' + b) }}</SC_HintText>
          <SC_HintMore type="button" @click="openHelp">{{ t('profile.badgeMore') }}</SC_HintMore>
        </SC_HintCard>
      </template>
      <SC_Badge type="button" :class="b" aria-haspopup="dialog" :data-badge="b">
        <CheckCircleFilled v-if="b === 'verified'" />
        <CrownFilled v-else-if="b === 'moderator'" />
        <FlagFilled v-else-if="b === 'shark'" />
        <TrophyFilled v-else />
        {{ t('profile.badges.' + b) }}
      </SC_Badge>
    </APopover>
  </SC_BadgeRow>
</template>

<script setup lang="ts">
// Отметки аккаунта под именем в профиле: «Проверен», «Модератор», «Акула»,
// «Авторитетный». Нажатие — короткая подсказка, что значит отметка и за что
// её дают; «Подробнее» открывает статью справки в боковой панели.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover as APopover } from 'ant-design-vue'
import { CheckCircleFilled, CrownFilled, FlagFilled, TrophyFilled } from '@/components/icons'
import { getProfileBadges, type ProfileBadgeKey } from '@/helpers/profile/profile-badges'
import { useHelpStore } from '@/stores/help-store'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import {
  SC_Badge,
  SC_BadgeRow,
  SC_HintCard,
  SC_HintMore,
  SC_HintText,
  SC_HintTitle,
} from './styled'

const props = withDefaults(
  defineProps<{
    profile: UserProfile | null | undefined
    /** По центру — в боковой колонке, слева — в шапке профиля на телефоне. */
    align?: 'center' | 'start'
  }>(),
  { align: 'center' }
)

const { t } = useI18n()
const help = useHelpStore()

const badges = computed(() => getProfileBadges(props.profile))
const openBadge = ref<ProfileBadgeKey | null>(null)

function openHelp(): void {
  openBadge.value = null
  help.openTopic('account-badges')
}
</script>
