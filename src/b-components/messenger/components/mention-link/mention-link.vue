<template>
  <SC_Mention
    :to="{ name: 'profile', params: { userName: address } }"
    :class="{ me: isMe }"
    :title="t('messenger.openProfile', { name: shown })"
    data-testid="mention"
    @click.stop="onClick"
    >@{{ shown }}</SC_Mention
  >
</template>

<script setup lang="ts">
// Упоминание в тексте сообщения (lib/mentions): «@имя» ссылкой на профиль.
// Имя — из профиля, если он уже есть (могли сменить), иначе как прислали.
// Упомянули вас — подсвечено, как в Telegram.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId } from '../../helpers'
import { SC_Mention } from './styled'

const props = defineProps<{
  address: string
  name: string
}>()

const { t } = useI18n()
const store = useMessengerStore()

const shown = computed<string>(() => store.userProfiles[props.address]?.name || props.name)

const isMe = computed<boolean>(() => {
  const id = store.currentUser?.id
  return !!id && getAddressFromMatrixId(id) === props.address
})

/** Полноэкранный чат закрывает страницу — к профилю уходим из него (как ProfileLink). */
function onClick(e: MouseEvent): void {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (store.isFullScreen) store.closeFullScreen()
}
</script>
