<template>
  <!-- Фильтр входящих: правила и люди. Только на этом устройстве. -->
  <SC_ArchiveHead>
    <SC_SystemTitle>{{ t('settings.chats.screen') }}</SC_SystemTitle>
    <SC_SystemHint>{{ t('settings.chats.screenHint') }}</SC_SystemHint>
  </SC_ArchiveHead>
  <SC_SystemSection>
    <SC_ScreenRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.chats.screenReputation') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.chats.screenReputationHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <SC_ScreenControls>
        <SC_ScreenNumber
          type="number"
          inputmode="numeric"
          step="1"
          :value="screen.prefs.reputation.below"
          :disabled="!screen.prefs.reputation.on"
          :aria-label="t('settings.chats.screenReputationValue')"
          data-testid="screen-reputation-below"
          @change="onBelow"
        />
        <Switch
          :checked="screen.prefs.reputation.on"
          :aria-label="t('settings.chats.screenReputation')"
          data-testid="screen-reputation"
          @change="(on: SwitchValue) => screen.setReputation(on === true)"
        />
      </SC_ScreenControls>
    </SC_ScreenRow>

    <SC_ScreenRow v-for="mark in SCREEN_MARKS" :key="mark">
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t(`settings.chats.screenMark_${mark}`) }}</SC_SystemTitle>
        <SC_SystemHint>{{ t(`settings.chats.screenMark_${mark}Hint`) }}</SC_SystemHint>
      </SC_SystemLabel>
      <SC_ScaleRow role="radiogroup" :aria-label="t(`settings.chats.screenMark_${mark}`)">
        <SC_ScaleButton
          v-for="rule in MARK_RULES"
          :key="rule"
          type="button"
          role="radio"
          :active="screen.prefs.marks[mark] === rule"
          :aria-checked="screen.prefs.marks[mark] === rule"
          :data-testid="`screen-mark-${mark}-${rule}`"
          @click="screen.setMark(mark, rule)"
        >
          {{ t(`settings.chats.screenRule_${rule}`) }}
        </SC_ScaleButton>
      </SC_ScaleRow>
    </SC_ScreenRow>
    <SC_SystemHint>{{ t('settings.chats.screenOnlyHint') }}</SC_SystemHint>
  </SC_SystemSection>

  <SC_ArchiveHead>
    <SC_SystemTitle>{{ t('settings.chats.screenPeople') }}</SC_SystemTitle>
    <SC_SystemHint v-if="messenger.dialogs.length" data-testid="screen-hidden-count">
      {{
        screen.hiddenIds.size
          ? t('settings.chats.screenHiddenNow', { n: screen.hiddenIds.size }, screen.hiddenIds.size)
          : t('settings.chats.screenHiddenNone')
      }}
    </SC_SystemHint>
  </SC_ArchiveHead>
  <SC_ArchiveLead>{{ t('settings.chats.screenPeopleHint') }}</SC_ArchiveLead>

  <SC_ScreenAdd @submit.prevent="onAdd">
    <SC_ScreenInput
      v-model="nick"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="done"
      :placeholder="t('settings.chats.screenAddPlaceholder')"
      :aria-label="t('settings.chats.screenAddPlaceholder')"
      data-testid="screen-add-input"
    />
    <SC_ScreenAddButton type="submit" :disabled="adding || !nick.trim()" data-testid="screen-add">
      {{ t('settings.chats.screenAdd') }}
    </SC_ScreenAddButton>
  </SC_ScreenAdd>
  <SC_ScreenError v-if="addError" role="alert" data-testid="screen-add-error">
    {{ addError }}
  </SC_ScreenError>

  <SC_ArchiveList v-if="people.length">
    <SC_ArchiveRow v-for="p in people" :key="p.address" data-testid="screen-person">
      <Avatar :src="p.avatar" :alt="p.name" :fallback-text="p.name" :size="36" shape="circle" />
      <SC_ArchiveInfo>
        <SC_ArchiveName>{{ p.name }}</SC_ArchiveName>
        <SC_ArchiveMeta>{{ shortAddress(p.address) }}</SC_ArchiveMeta>
      </SC_ArchiveInfo>
      <SC_ScaleRow role="radiogroup" :aria-label="p.name">
        <SC_ScaleButton
          v-for="rule in PERSON_RULES"
          :key="rule"
          type="button"
          role="radio"
          :active="p.rule === rule"
          :aria-checked="p.rule === rule"
          :data-testid="`screen-person-${rule}`"
          @click="screen.setPerson(p.address, rule)"
        >
          {{ t(`settings.chats.screenPerson_${rule}`) }}
        </SC_ScaleButton>
      </SC_ScaleRow>
      <SC_ArchiveDelete
        type="button"
        :title="t('settings.chats.screenRemove')"
        :aria-label="t('settings.chats.screenRemoveOf', { name: p.name })"
        data-testid="screen-person-remove"
        @click="screen.setPerson(p.address, null)"
      >
        <CloseOutlined />
      </SC_ArchiveDelete>
    </SC_ArchiveRow>
  </SC_ArchiveList>
</template>

<script setup lang="ts">
// Фильтр входящих (lib/chat-screen): кого прятать из списка чатов — по
// репутации, статусу и вручную по нику.

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Switch } from 'ant-design-vue'

import Avatar from '@/components/avatar/avatar.vue'
import { CloseOutlined } from '@/components/icons'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { shortAddress } from '@/services/user-names'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useMessengerScreenStore } from '@/b-components/messenger/store/messenger-screen-store'
import { MARK_RULES, SCREEN_MARKS, type PersonRule } from '@/b-components/messenger/lib/chat-screen'
import { resolvePerson } from '@/b-components/messenger/lib/resolve-person'
import {
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemSection,
  SC_SystemTitle,
} from './system-tab.styled'
import {
  SC_ArchiveDelete,
  SC_ArchiveHead,
  SC_ArchiveInfo,
  SC_ArchiveLead,
  SC_ArchiveList,
  SC_ArchiveMeta,
  SC_ArchiveName,
  SC_ArchiveRow,
} from './chats-tab.styled'
import {
  SC_ScreenAdd,
  SC_ScreenAddButton,
  SC_ScreenControls,
  SC_ScreenError,
  SC_ScreenInput,
  SC_ScreenNumber,
  SC_ScreenRow,
} from './chats-screen-section.styled'

/** Тип значения, который отдаёт ant-свитч. */
type SwitchValue = string | number | boolean

const PERSON_RULES: PersonRule[] = ['hide', 'show']
/** Порог — в пределах, какие бывают у репутации в сети. */
const BELOW_MIN = -1000
const BELOW_MAX = 100_000

const { t } = useI18n()
const messenger = useMessengerStore()
const screen = useMessengerScreenStore()

function onBelow(e: Event): void {
  const input = e.target as HTMLInputElement
  const value = Math.round(Number(input.value))
  if (!Number.isFinite(value) || input.value === '') {
    input.value = String(screen.prefs.reputation.below)
    return
  }
  const below = Math.min(BELOW_MAX, Math.max(BELOW_MIN, value))
  input.value = String(below)
  screen.setReputation(screen.prefs.reputation.on, below)
}

interface PersonRow {
  address: string
  name: string
  avatar?: string
  rule: PersonRule
}

/** Сначала скрытые, потом «всегда видны»; внутри — по нику. */
const people = computed<PersonRow[]>(() =>
  Object.entries(screen.prefs.people)
    .map(([address, p]) => {
      const profile = messenger.userProfiles[address]
      const image = typeof profile?.i === 'string' ? profile.i : undefined
      return {
        address,
        name: profile?.name || p.name || shortAddress(address),
        avatar: resolveImageUrl(image),
        rule: p.rule,
      }
    })
    .sort((a, b) => (a.rule === b.rule ? a.name.localeCompare(b.name) : a.rule === 'hide' ? -1 : 1))
)

// Аватары и свежие ники людей из списка.
watch(
  () => Object.keys(screen.prefs.people),
  (addresses) => {
    const missing = addresses.filter((a) => !messenger.userProfiles[a])
    if (missing.length) void messenger.fetchProfiles(missing)
  },
  { immediate: true }
)

const nick = ref('')
const adding = ref(false)
const addError = ref('')

async function onAdd(): Promise<void> {
  const value = nick.value.trim()
  if (!value || adding.value) return
  adding.value = true
  addError.value = ''
  try {
    const address = await resolvePerson(value)
    if (!address) {
      addError.value = t('settings.chats.screenNotFound', { name: value })
      return
    }
    if (address === screen.owner) {
      addError.value = t('settings.chats.screenSelf')
      return
    }
    await messenger.fetchProfiles([address])
    const name = messenger.userProfiles[address]?.name || value.replace(/^@/, '')
    screen.setPerson(address, 'hide', name)
    nick.value = ''
  } catch {
    addError.value = t('settings.chats.screenAddFailed')
  } finally {
    adding.value = false
  }
}
</script>
