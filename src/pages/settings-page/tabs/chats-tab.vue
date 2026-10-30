<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.chats') }}</SC_SettingsSectionTitle>

  <SC_ArchiveLead v-if="!auth.isUserAuthenticated">{{ t('settings.chats.signIn') }}</SC_ArchiveLead>
  <template v-else>
    <!-- Что собеседники видят о вас: общее для всех устройств аккаунта. -->
    <SC_ArchiveHead>
      <SC_SystemTitle>{{ t('settings.chats.privacy') }}</SC_SystemTitle>
      <SC_SystemHint>{{ t('settings.chats.privacyHint') }}</SC_SystemHint>
    </SC_ArchiveHead>
    <SC_SystemSection>
      <SC_SystemRow v-for="key in PRIVACY_KEYS" :key="key">
        <SC_SystemLabel>
          <SC_SystemTitle>{{ t(`settings.chats.privacy_${key}`) }}</SC_SystemTitle>
          <SC_SystemHint>{{ t(`settings.chats.privacy_${key}Hint`) }}</SC_SystemHint>
        </SC_SystemLabel>
        <Switch
          :checked="privacy.prefs[key]"
          :data-testid="`privacy-${key}`"
          :aria-label="t(`settings.chats.privacy_${key}`)"
          @change="(on: SwitchValue) => void privacy.set(key, on === true)"
        />
      </SC_SystemRow>
    </SC_SystemSection>

    <SC_SystemSection>
      <SC_SystemRow>
        <SC_SystemLabel>
          <SC_SystemTitle>{{ t('settings.chats.archive') }}</SC_SystemTitle>
          <SC_SystemHint>{{ t('settings.chats.archiveHint') }}</SC_SystemHint>
        </SC_SystemLabel>
        <Switch
          :checked="archive.prefs.enabled"
          :disabled="!archive.ready"
          data-testid="archive-enabled"
          @change="onEnabled"
        />
      </SC_SystemRow>

      <SC_SystemRow v-if="archive.prefs.enabled">
        <SC_SystemLabel>
          <SC_SystemTitle>{{ t('settings.chats.mode') }}</SC_SystemTitle>
          <SC_SystemHint>
            {{
              archive.prefs.mode === 'all'
                ? t('settings.chats.modeAllHint')
                : t('settings.chats.modeSelectedHint')
            }}
          </SC_SystemHint>
        </SC_SystemLabel>
        <SC_ScaleRow role="radiogroup" :aria-label="t('settings.chats.mode')">
          <SC_ScaleButton
            v-for="mode in MODES"
            :key="mode"
            :active="archive.prefs.mode === mode"
            type="button"
            role="radio"
            :aria-checked="archive.prefs.mode === mode"
            :data-testid="`archive-mode-${mode}`"
            @click="archive.setMode(mode)"
          >
            {{ mode === 'all' ? t('settings.chats.modeAll') : t('settings.chats.modeSelected') }}
          </SC_ScaleButton>
        </SC_ScaleRow>
      </SC_SystemRow>
    </SC_SystemSection>

    <SC_ArchiveHead>
      <SC_SystemTitle>{{ t('settings.chats.list') }}</SC_SystemTitle>
      <SC_SystemHint data-testid="archive-total">
        {{
          totalMessages
            ? t('settings.chats.total', { n: totalMessages, chats: savedChats }, totalMessages)
            : t('settings.chats.totalNone')
        }}
      </SC_SystemHint>
    </SC_ArchiveHead>

    <SC_ArchiveSearch
      v-if="rows.length > SEARCH_FROM"
      v-model="query"
      type="search"
      :placeholder="t('settings.chats.search')"
      :aria-label="t('settings.chats.search')"
    />

    <SC_ArchiveLead v-if="!archive.ready">{{ t('settings.chats.loading') }}</SC_ArchiveLead>
    <SC_ArchiveLead v-else-if="!rows.length">{{ t('settings.chats.noChats') }}</SC_ArchiveLead>

    <SC_ArchiveList v-else>
      <SC_ArchiveRow v-for="row in shownRows" :key="row.id" data-testid="archive-chat">
        <Avatar
          :src="row.avatar"
          :alt="row.name"
          :fallback-text="row.name"
          :size="36"
          shape="circle"
        />
        <SC_ArchiveInfo>
          <SC_ArchiveName>{{ row.name }}</SC_ArchiveName>
          <SC_ArchiveMeta>{{ rowMeta(row) }}</SC_ArchiveMeta>
        </SC_ArchiveInfo>
        <Switch
          v-if="row.joined"
          size="small"
          :checked="row.saving"
          :aria-label="t('settings.chats.saveChat', { name: row.name })"
          data-testid="archive-chat-switch"
          @change="(on: SwitchValue) => archive.setChat(row.id, Boolean(on))"
        />
        <SC_ArchiveDelete
          v-if="row.count"
          type="button"
          :title="t('settings.chats.deleteCopy')"
          :aria-label="t('settings.chats.deleteCopyOf', { name: row.name })"
          data-testid="archive-chat-delete"
          @click="onDeleteChat(row)"
        >
          <DeleteOutlined />
        </SC_ArchiveDelete>
      </SC_ArchiveRow>
    </SC_ArchiveList>

    <SC_ArchiveFooter v-if="totalMessages">
      <SC_DangerButton type="button" data-testid="archive-delete-all" @click="onDeleteAll">
        {{ t('settings.chats.deleteAll') }}
      </SC_DangerButton>
    </SC_ArchiveFooter>
  </template>
</template>

<script setup lang="ts">
// Переписка на устройстве: сервер чатов стирает сообщения через три месяца,
// здесь включают сохранение — для всех чатов или выбранных — и стирают копии.

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Switch, message } from 'ant-design-vue'

import { useAuthStore } from '@/blockchain'
import Avatar from '@/components/avatar/avatar.vue'
import { DeleteOutlined } from '@/components/icons'
import { formatLongDate } from '@/helpers/common/date-formatter'
import { Z_INDEX } from '@/styles/design-tokens'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useMessengerArchiveStore } from '@/b-components/messenger/store/messenger-archive-store'
import { archivableChatId, type ArchiveMode } from '@/b-components/messenger/lib/archive-prefs'
import { useMessengerPrivacyStore } from '@/b-components/messenger/store/messenger-privacy-store'
import type { ChatPrivacy } from '@/b-components/messenger/lib/chat-privacy'
import { SC_SettingsSectionTitle } from '../settings-page-main.styled'
import {
  SC_DangerButton,
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemRow,
  SC_SystemSection,
  SC_SystemTitle,
} from './system-tab.styled'
import {
  SC_ArchiveDelete,
  SC_ArchiveFooter,
  SC_ArchiveHead,
  SC_ArchiveInfo,
  SC_ArchiveLead,
  SC_ArchiveList,
  SC_ArchiveMeta,
  SC_ArchiveName,
  SC_ArchiveRow,
  SC_ArchiveSearch,
} from './chats-tab.styled'

/** Тип значения, который отдаёт ant-свитч. */
type SwitchValue = string | number | boolean

interface ChatRow {
  id: string
  name: string
  avatar?: string
  /** Чат в списке мессенджера: его можно включать и выключать. */
  joined: boolean
  saving: boolean
  count: number
  firstTs: number
  lastTs: number
}

const MODES: ArchiveMode[] = ['all', 'selected']
const PRIVACY_KEYS: Array<keyof ChatPrivacy> = ['online', 'typing', 'recording']
/** С какого числа чатов показывать поиск. */
const SEARCH_FROM = 8

const { t } = useI18n()
const auth = useAuthStore()
const messenger = useMessengerStore()
const archive = useMessengerArchiveStore()
const privacy = useMessengerPrivacyStore()
const query = ref('')

// Копию открывает вход в мессенджер; настройки могли открыть раньше него.
onMounted(() => {
  if (!archive.ready && auth.address && auth.keyPair) {
    void archive.attach(auth.address, auth.keyPair.privateKey)
  }
  // Настройки открыли раньше мессенджера — приватность аккаунта с прошлого раза.
  if (auth.address) privacy.attach(auth.address)
})

/** Чаты мессенджера и чаты, от которых осталась только копия. */
const rows = computed<ChatRow[]>(() => {
  const out = new Map<string, ChatRow>()
  for (const d of messenger.dialogs) {
    if (!archivableChatId(d.id) || d.invite) continue
    const stats = archive.stats[d.id]
    out.set(d.id, {
      id: d.id,
      name: d.partner.name || archive.infos[d.id]?.name || t('settings.chats.unnamed'),
      avatar: d.partner.avatar,
      joined: true,
      saving: archive.isArchived(d.id),
      count: stats?.count ?? 0,
      firstTs: stats?.firstTs ?? 0,
      lastTs: stats?.lastTs ?? 0,
    })
  }
  for (const [id, stats] of Object.entries(archive.stats)) {
    if (out.has(id)) continue
    const info = archive.infos[id]
    out.set(id, {
      id,
      name: info?.name || t('settings.chats.unnamed'),
      avatar: info?.avatar,
      joined: false,
      saving: false,
      ...stats,
    })
  }
  // Сначала те, где что-то сохранено (свежие сверху), потом остальные — как в списке.
  return [...out.values()].sort(
    (a, b) => (b.count ? b.lastTs || 1 : 0) - (a.count ? a.lastTs || 1 : 0)
  )
})

const shownRows = computed<ChatRow[]>(() => {
  const q = query.value.trim().toLowerCase()
  return q ? rows.value.filter((r) => r.name.toLowerCase().includes(q)) : rows.value
})

const totalMessages = computed<number>(() =>
  Object.values(archive.stats).reduce((sum, s) => sum + s.count, 0)
)
const savedChats = computed<number>(() => Object.keys(archive.stats).length)

function rowMeta(row: ChatRow): string {
  if (!row.joined) {
    return `${t('settings.chats.messages', { n: row.count }, row.count)} · ${t('settings.chats.left')}`
  }
  if (row.count) {
    const since = t('settings.chats.since', { date: formatLongDate(row.firstTs) })
    return `${t('settings.chats.messages', { n: row.count }, row.count)} · ${since}`
  }
  return row.saving ? t('settings.chats.nothingYet') : t('settings.chats.notSaving')
}

function onEnabled(on: SwitchValue): void {
  void archive.setEnabled(Boolean(on))
}

/** Копию одного чата — с подтверждением: то, что сервер уже стёр, пропадёт насовсем. */
function onDeleteChat(row: ChatRow): void {
  const lines = [t('settings.chats.deleteCopyText', { n: row.count }, row.count)]
  if (row.saving) lines.push(t('settings.chats.stillSaving'))
  Modal.confirm({
    title: t('settings.chats.deleteCopyTitle', { name: row.name }),
    content: lines.join(' '),
    okText: t('settings.chats.deleteCopy'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    zIndex: Z_INDEX.CONFIRM,
    onOk: async () => {
      await archive.removeChat(row.id)
      message.success(t('settings.chats.deleted'))
    },
  })
}

/** Всё сразу — двумя вопросами подряд: второй — о том, что не вернуть. */
function onDeleteAll(): void {
  const n = totalMessages.value
  const lines = [t('settings.chats.deleteAllText', { n, chats: savedChats.value }, n)]
  if (archive.prefs.enabled) lines.push(t('settings.chats.stillSaving'))
  Modal.confirm({
    title: t('settings.chats.deleteAllTitle'),
    content: lines.join(' '),
    okText: t('settings.chats.deleteAllOk'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => {
      Modal.confirm({
        title: t('settings.chats.deleteAllSureTitle'),
        content: t('settings.chats.deleteAllSureText'),
        okText: t('settings.chats.deleteAllSureOk'),
        okType: 'danger',
        cancelText: t('messenger.cancel'),
        centered: true,
        zIndex: Z_INDEX.CONFIRM,
        onOk: async () => {
          await archive.removeAll()
          message.success(t('settings.chats.deletedAll'))
        },
      })
    },
  })
}
</script>
