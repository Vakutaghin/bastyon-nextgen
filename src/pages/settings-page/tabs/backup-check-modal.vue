<template>
  <!-- Проверка бэкапа (VP-7): три слова из 12 или хвост приватного ключа. -->
  <Modal
    :open="open"
    :title="t('vault.backupCheckTitle')"
    :confirm-loading="loading"
    :ok-text="t('vault.backupCheckSubmit')"
    :cancel-text="t('vault.cancel')"
    :ok-button-props="{ disabled: !canSubmit || loading }"
    :z-index="2850"
    :destroy-on-close="true"
    @ok="onSubmit"
    @cancel="onCancel"
  >
    <SC_SecurityForm>
      <SC_SecurityDesc>
        {{
          kind === 'words'
            ? t('vault.backupCheckWordsHint')
            : t('vault.backupCheckKeyHint', { n: keyTailChars })
        }}
      </SC_SecurityDesc>

      <template v-if="kind === 'words'">
        <Input
          v-for="(pos, i) in positions"
          :key="pos"
          v-model:value="answers[i]"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="t('vault.backupWordN', { n: pos })"
          @press-enter="onSubmit"
        />
      </template>
      <Input
        v-else
        v-model:value="answers[0]"
        autocomplete="off"
        spellcheck="false"
        :placeholder="t('vault.backupKeyTail', { n: keyTailChars })"
        @press-enter="onSubmit"
      />

      <SC_SecurityFieldError v-if="error">{{ error }}</SC_SecurityFieldError>
    </SC_SecurityForm>
  </Modal>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Input } from 'ant-design-vue'
import { useBackupVerification } from '../use-backup-verification'
import { SC_SecurityForm, SC_SecurityDesc, SC_SecurityFieldError } from './security-section.styled'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'verified'): void; (e: 'cancel'): void }>()

const { t } = useI18n()
const {
  kind,
  positions,
  answers,
  loading,
  error,
  canSubmit,
  keyTailChars,
  start,
  submit,
  dispose,
} = useBackupVerification()

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      dispose()
      return
    }
    // Секрета нет / не читается — ошибка остаётся в модалке (кнопка «Проверить»
    // заблокирована: полей для ввода нет), закрыть можно «Отменой».
    await start()
  },
  { immediate: true }
)

function onSubmit(): void {
  if (!canSubmit.value || loading.value) return
  if (submit()) emit('verified')
}

function onCancel(): void {
  emit('cancel')
}
</script>
