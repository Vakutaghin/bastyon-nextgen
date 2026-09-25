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

  <!-- Резервная копия (VP-8): статус проверки + повторная проверка по желанию. -->
  <SC_SecurityCard>
    <SC_SecurityLevel>{{ t('vault.backupTitle') }}</SC_SecurityLevel>
    <SC_SecurityDesc :class="{ warn: backupStatus.state !== 'ok' }">{{
      backupStatusLabel
    }}</SC_SecurityDesc>
    <div>
      <Button @click="openBackupCheck('standalone')">{{ t('vault.backupCheckButton') }}</Button>
    </div>
  </SC_SecurityCard>

  <!-- Шаг 1 включения passphrase и самостоятельная проверка: челлендж по словам. -->
  <BackupCheckModal
    :open="backupCheckOpen"
    @verified="onBackupVerified"
    @cancel="backupCheckOpen = false"
  />

  <!-- Шаг 2 включения passphrase: пароль + повтор (только после проверенного бэкапа). -->
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
import { Modal, Button, Input } from 'ant-design-vue'

import { useVaultSecurity } from '../use-vault-security'
import { getBackupStatus, type BackupState } from '@/helpers/backup/backup-verification'
import { useAuthStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import BackupCheckModal from './backup-check-modal.vue'
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

// ─── backup check (VP-7/VP-8) ─────────────────────────────────────────────────
const authStore = useAuthStore()
const backupStatus = ref<{ state: BackupState; verifiedAt: number | null }>(
  getBackupStatus(authStore.getUserAddress || '')
)
const backupStatusLabel = computed(() => {
  const st = backupStatus.value
  if (st.state === 'never' || !st.verifiedAt) return t('vault.backupStatusNever')
  const date = new Date(st.verifiedAt).toLocaleDateString()
  return st.state === 'ok'
    ? t('vault.backupStatusOk', { date })
    : t('vault.backupStatusStale', { date })
})

const backupCheckOpen = ref(false)
// Зачем открыли челлендж: сама по себе проверка или шаг 1 включения passphrase.
let backupCheckPurpose: 'standalone' | 'enable' = 'standalone'

function openBackupCheck(purpose: 'standalone' | 'enable'): void {
  backupCheckPurpose = purpose
  backupCheckOpen.value = true
}

function onBackupVerified(): void {
  backupCheckOpen.value = false
  backupStatus.value = getBackupStatus(authStore.getUserAddress || '')
  appToast.success({ message: t('vault.backupVerifiedToast') })
  if (backupCheckPurpose === 'enable') openEnableForm()
}

// ─── enable ───────────────────────────────────────────────────────────────────
const enableOpen = ref(false)
// Включение уничтожает device-ключ: забытый пароль = только 12 слов. Поэтому
// сначала челлендж по словам (не галочка «я записал»), потом пароль.
const backupConfirmed = ref(false)
const pw1 = ref('')
const pw2 = ref('')
const enableError = ref('')

const canEnable = computed(
  () => backupConfirmed.value && pw1.value.length >= MIN_LEN && pw1.value === pw2.value
)

function openEnable(): void {
  backupConfirmed.value = false
  openBackupCheck('enable')
}

function openEnableForm(): void {
  backupConfirmed.value = true
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
  if (ok) {
    // Пароль после включения в состоянии не держим (N6).
    pw1.value = ''
    pw2.value = ''
    enableOpen.value = false
  }
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
  // После попытки пароль не нужен: при ошибке его всё равно вводят заново (N6).
  pwCurrent.value = ''
  if (ok) disableOpen.value = false
}
</script>
