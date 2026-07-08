<template>
  <SC_PrivateKeySection>
    <SC_SettingsSectionTitle>{{ t('settings.tabs.privateKey') }}</SC_SettingsSectionTitle>

    <!-- Confirm dialog -->
    <template v-if="pkConfirmVisible">
      <SC_ConfirmOverlay>
        <SC_ConfirmTitle> {{ t('settings.privateKey.confirmTitle') }} </SC_ConfirmTitle>
        <SC_ConfirmText>
          {{ t('settings.privateKey.confirmText') }}
        </SC_ConfirmText>
        <SC_ConfirmButtons>
          <SC_ConfirmBtnDefault type="button" @click="pkCancelConfirm">{{
            t('common.cancel')
          }}</SC_ConfirmBtnDefault>
          <SC_ConfirmBtnPrimary type="button" @click="pkConfirmAndReveal">
            {{ t('settings.privateKey.confirmReveal') }}
          </SC_ConfirmBtnPrimary>
        </SC_ConfirmButtons>
      </SC_ConfirmOverlay>
    </template>

    <!-- Revealed keys -->
    <template v-else-if="pkRevealed">
      <SC_PrivateKeyWarning>
        {{ t('settings.privateKey.warningRevealed') }}
      </SC_PrivateKeyWarning>

      <SC_PrivateKeyBox v-if="pkMnemonic">
        <SC_PrivateKeyLabel>{{ t('settings.privateKey.seedPhrase') }}</SC_PrivateKeyLabel>
        <SC_PrivateKeyValue>{{ pkMnemonic }}</SC_PrivateKeyValue>
        <SC_CopyIconBtn
          type="button"
          :title="t('settings.privateKey.copySeed')"
          @click="pkCopyMnemonic"
        >
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>

      <SC_PrivateKeyBox v-if="pkPrivateKeyHex">
        <SC_PrivateKeyLabel>{{ t('settings.privateKey.keyHex') }}</SC_PrivateKeyLabel>
        <SC_PrivateKeyValue>{{ pkPrivateKeyHex }}</SC_PrivateKeyValue>
        <SC_CopyIconBtn type="button" :title="t('settings.privateKey.copyKey')" @click="pkCopyKey">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>

      <SC_HideKeyButton type="button" @click="pkHide">
        {{ t('settings.privateKey.hide') }}
      </SC_HideKeyButton>
    </template>

    <!-- Initial state: show button -->
    <template v-else>
      <SC_PrivateKeyWarning>
        {{ t('settings.privateKey.warningInitial') }}
      </SC_PrivateKeyWarning>
      <SC_ShowKeyButton type="button" :disabled="pkLoading" @click="pkShowConfirm">
        {{ pkLoading ? t('settings.privateKey.loading') : t('settings.privateKey.show') }}
      </SC_ShowKeyButton>
    </template>

    <!-- P0-1: безопасность сида at-rest (passwordless по умолчанию + opt-in passphrase). -->
    <SecuritySection />
  </SC_PrivateKeySection>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CopyOutlined } from '@ant-design/icons-vue'
import { usePrivateKeyReveal } from '../use-private-key-reveal'
import SecuritySection from './security-section.vue'
import {
  SC_PrivateKeySection,
  SC_SettingsSectionTitle,
  SC_PrivateKeyWarning,
  SC_PrivateKeyBox,
  SC_PrivateKeyLabel,
  SC_PrivateKeyValue,
  SC_CopyIconBtn,
  SC_ShowKeyButton,
  SC_HideKeyButton,
  SC_ConfirmOverlay,
  SC_ConfirmTitle,
  SC_ConfirmText,
  SC_ConfirmButtons,
  SC_ConfirmBtnPrimary,
  SC_ConfirmBtnDefault,
} from '../settings-page.styled'

const { t } = useI18n()

// Composable вызывается локально — при переключении вкладок таб
// размонтируется, и весь pk-state «сам» очищается; родителю
// не нужно знать о существовании ключа.
const {
  pkConfirmVisible,
  pkRevealed,
  pkLoading,
  pkMnemonic,
  pkPrivateKeyHex,
  pkShowConfirm,
  pkCancelConfirm,
  pkConfirmAndReveal,
  pkHide,
  pkCopyMnemonic,
  pkCopyKey,
} = usePrivateKeyReveal()
</script>
