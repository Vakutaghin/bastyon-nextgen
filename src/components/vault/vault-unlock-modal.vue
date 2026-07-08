<template>
  <Modal
    :open="modalStore.vaultUnlock.isOpen"
    :width="420"
    :centered="true"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    :z-index="3000"
    :footer="null"
  >
    <template #title>{{ t('vault.unlockTitle') }}</template>

    <SC_VaultBody>
      <SC_VaultPrompt>{{ t('vault.unlockPrompt') }}</SC_VaultPrompt>

      <Input
        v-model:value="pw"
        type="password"
        :placeholder="t('vault.passphrasePlaceholder')"
        :disabled="submitting || cooldownLeft > 0"
        autofocus
        @press-enter="onSubmit"
      />

      <SC_VaultError v-if="cooldownLeft > 0">
        {{ t('vault.cooldown', { sec: cooldownLeft }) }}
      </SC_VaultError>
      <SC_VaultError v-else-if="error">{{ error }}</SC_VaultError>

      <SC_ModalActions>
        <Button
          type="primary"
          block
          :loading="submitting"
          :disabled="!pw || cooldownLeft > 0"
          @click="onSubmit"
        >
          {{ t('vault.unlock') }}
        </Button>
      </SC_ModalActions>

      <SC_VaultForgot type="button" @click="onForgot">{{ t('vault.forgot') }}</SC_VaultForgot>
    </SC_VaultBody>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button, Input } from 'ant-design-vue'

import { useModalStore } from '@/stores/modal-store'
import {
  submitUnlockPassphrase,
  requestUnlockReset,
  getUnlockAttemptState,
} from '@/blockchain/storage/vault/vault-unlock'
import { SC_ModalActions } from '@/components/modal'
import { SC_VaultBody, SC_VaultPrompt, SC_VaultError, SC_VaultForgot } from './styled'

const { t } = useI18n()
const modalStore = useModalStore()

const pw = ref('')
const error = ref('')
const submitting = ref(false)
const cooldownUntil = ref(0)
const nowTs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | null = null

const cooldownLeft = computed(() =>
  Math.max(0, Math.ceil((cooldownUntil.value - nowTs.value) / 1000))
)

function startTimer(): void {
  if (timer) return
  timer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
}
function stopTimer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Модалка открывается мостом vault-unlock. При открытии поднимаем сохранённый
// (переживший перезагрузку) cooldown троттлинга.
watch(
  () => modalStore.vaultUnlock.isOpen,
  (open) => {
    if (open) {
      pw.value = ''
      error.value = ''
      nowTs.value = Date.now()
      cooldownUntil.value = getUnlockAttemptState().cooldownUntil
      startTimer()
    } else {
      stopTimer()
    }
  },
  { immediate: true }
)

onBeforeUnmount(stopTimer)

async function onSubmit(): Promise<void> {
  if (submitting.value || cooldownLeft.value > 0 || !pw.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await submitUnlockPassphrase(pw.value)
    if (!res.ok) {
      error.value = t('vault.wrongPassphrase')
      cooldownUntil.value = res.cooldownUntil
      nowTs.value = Date.now()
      pw.value = ''
    }
    // Успех: vault-unlock закрывает модалку через мост (isOpen → false).
  } finally {
    submitting.value = false
  }
}

function onForgot(): void {
  Modal.confirm({
    title: t('vault.resetConfirmTitle'),
    content: t('vault.resetConfirmBody'),
    okText: t('vault.resetConfirmYes'),
    okType: 'danger',
    cancelText: t('vault.cancel'),
    zIndex: 3100,
    onOk: () => {
      requestUnlockReset()
    },
  })
}
</script>
