<template>
  <SC_PrivateKeySection>
    <SC_SettingsSectionTitle>Приватный ключ</SC_SettingsSectionTitle>

    <!-- Confirm dialog -->
    <template v-if="pkConfirmVisible">
      <SC_ConfirmOverlay>
        <SC_ConfirmTitle> ⚠️ Показать приватный ключ? </SC_ConfirmTitle>
        <SC_ConfirmText>
          Передавать приватный ключ или сид-фразу кому-либо небезопасно. Любой, кто получит доступ к
          ним, сможет получить полный контроль над вашим аккаунтом и средствами.
        </SC_ConfirmText>
        <SC_ConfirmButtons>
          <SC_ConfirmBtnDefault type="button" @click="pkCancelConfirm">Отмена</SC_ConfirmBtnDefault>
          <SC_ConfirmBtnPrimary type="button" @click="pkConfirmAndReveal">
            Да, показать
          </SC_ConfirmBtnPrimary>
        </SC_ConfirmButtons>
      </SC_ConfirmOverlay>
    </template>

    <!-- Revealed keys -->
    <template v-else-if="pkRevealed">
      <SC_PrivateKeyWarning>
        ⚠️ Никогда не делитесь приватным ключом или сид-фразой. Сохраните их в безопасном месте.
      </SC_PrivateKeyWarning>

      <SC_PrivateKeyBox v-if="pkMnemonic">
        <SC_PrivateKeyLabel>Сид-фраза</SC_PrivateKeyLabel>
        <SC_PrivateKeyValue>{{ pkMnemonic }}</SC_PrivateKeyValue>
        <SC_CopyIconBtn type="button" title="Копировать сид-фразу" @click="pkCopyMnemonic">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>

      <SC_PrivateKeyBox v-if="pkPrivateKeyHex">
        <SC_PrivateKeyLabel>Приватный ключ (hex)</SC_PrivateKeyLabel>
        <SC_PrivateKeyValue>{{ pkPrivateKeyHex }}</SC_PrivateKeyValue>
        <SC_CopyIconBtn type="button" title="Копировать приватный ключ" @click="pkCopyKey">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>

      <SC_HideKeyButton type="button" @click="pkHide"> Скрыть </SC_HideKeyButton>
    </template>

    <!-- Initial state: show button -->
    <template v-else>
      <SC_PrivateKeyWarning>
        Приватный ключ обеспечивает полный доступ к вашему аккаунту. Убедитесь, что рядом нет
        посторонних, прежде чем показывать его.
      </SC_PrivateKeyWarning>
      <SC_ShowKeyButton type="button" :disabled="pkLoading" @click="pkShowConfirm">
        {{ pkLoading ? 'Загрузка...' : 'Показать приватный ключ' }}
      </SC_ShowKeyButton>
    </template>
  </SC_PrivateKeySection>
</template>

<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { usePrivateKeyReveal } from '../use-private-key-reveal'
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
