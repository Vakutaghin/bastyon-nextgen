<template>
  <SC_SecurityCard>
    <SC_SecurityLevel>{{ t('vault.security') }}: {{ levelLabel }}</SC_SecurityLevel>
    <SC_SecurityDesc>{{ levelDesc }}</SC_SecurityDesc>

    <div v-if="!degraded">
      <Button v-if="level !== 'passphrase'" type="primary" :loading="busy" @click="openEnable">
        {{ t('vault.enablePassphrase') }}
      </Button>
      <Button v-else danger :loading="busy" @click="openDisable">
        {{ t('vault.disablePassphrase') }}
      </Button>
    </div>
  </SC_SecurityCard>

  <!-- Включение passphrase: обязательный бэкап 12 слов + пароль + повтор. -->
  <Modal
    :open="enableOpen"
    :title="t('vault.enablePassphrase')"
    :confirm-loading="busy"
    :ok-text="t('vault.save')"
    :cancel-text="t('vault.cancel')"
    :ok-button-props="{ disabled: !canEnable }"
    :z-index="2800"
    @ok="onEnable"
    @cancel="enableOpen = false"
  >
    <SC_SecurityForm>
      <SC_SecurityWarning>{{ t('vault.enableWarning') }}</SC_SecurityWarning>
      <Checkbox v-model:checked="backupConfirmed">{{ t('vault.backupConfirm') }}</Checkbox>
      <Input v-model:value="pw1" type="password" :placeholder="t('vault.setPassphrase')" />
      <Input
        v-model:value="pw2"
        type="password"
        :placeholder="t('vault.confirmPassphrase')"
        @press-enter="onEnable"
      />
      <SC_SecurityFieldError v-if="enableError">{{ enableError }}</SC_SecurityFieldError>
    </SC_SecurityForm>
  </Modal>

  <!-- Выключение passphrase: подтверждение текущим паролем. -->
  <Modal
    :open="disableOpen"
    :title="t('vault.disablePassphrase')"
    :confirm-loading="busy"
    :ok-text="t('vault.save')"
    :cancel-text="t('vault.cancel')"
    :ok-button-props="{ disabled: !pwCurrent }"
    :z-index="2800"
    @ok="onDisable"
    @cancel="disableOpen = false"
  >
    <SC_SecurityForm>
      <Input
        v-model:value="pwCurrent"
        type="password"
        :placeholder="t('vault.currentPassphrase')"
        @press-enter="onDisable"
      />
    </SC_SecurityForm>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button, Input, Checkbox } from 'ant-design-vue'

import { useVaultSecurity } from '../use-vault-security'
import {
  SC_SecurityCard,
  SC_SecurityLevel,
  SC_SecurityDesc,
  SC_SecurityForm,
  SC_SecurityWarning,
  SC_SecurityFieldError,
} from './security-section.styled'

const { t } = useI18n()
const { level, degraded, busy, requestPersistentStorage, enable, disable } = useVaultSecurity()

const MIN_LEN = 8

const levelLabel = computed(() => {
  if (degraded.value) return t('vault.levelDegraded')
  return level.value === 'passphrase' ? t('vault.levelPassphrase') : t('vault.levelDevice')
})
const levelDesc = computed(() => {
  if (degraded.value) return t('vault.levelDegradedDesc')
  return level.value === 'passphrase' ? t('vault.levelPassphraseDesc') : t('vault.levelDeviceDesc')
})

onMounted(() => {
  // Снижаем риск вытеснения device-ключа (силент, decision «тихо + storage.persist»).
  requestPersistentStorage()
})

// ─── enable ───────────────────────────────────────────────────────────────────
const enableOpen = ref(false)
const backupConfirmed = ref(false)
const pw1 = ref('')
const pw2 = ref('')
const enableError = ref('')

const canEnable = computed(
  () => backupConfirmed.value && pw1.value.length >= MIN_LEN && pw1.value === pw2.value
)

function openEnable(): void {
  backupConfirmed.value = false
  pw1.value = ''
  pw2.value = ''
  enableError.value = ''
  enableOpen.value = true
}

async function onEnable(): Promise<void> {
  if (pw1.value.length < MIN_LEN) {
    enableError.value = t('vault.passphraseTooShort')
    return
  }
  if (pw1.value !== pw2.value) {
    enableError.value = t('vault.passphraseMismatch')
    return
  }
  if (!backupConfirmed.value) return
  const ok = await enable(pw1.value)
  if (ok) enableOpen.value = false
}

// ─── disable ────────────────────────────────────────────────────────────────────
const disableOpen = ref(false)
const pwCurrent = ref('')

function openDisable(): void {
  pwCurrent.value = ''
  disableOpen.value = true
}

async function onDisable(): Promise<void> {
  if (!pwCurrent.value) return
  const ok = await disable(pwCurrent.value)
  if (ok) disableOpen.value = false
}
</script>
