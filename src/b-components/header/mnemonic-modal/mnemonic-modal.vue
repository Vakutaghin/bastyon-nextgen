<template>
  <Modal
    v-model:open="isOpen"
    :width="600"
    :centered="true"
    :closable="true"
    :maskClosable="false"
    :destroyOnClose="true"
    :z-index="2700"
    @cancel="handleClose"
  >
    <template #title>
      <div style="display: flex; align-items: center; gap: 12px;">
        <SafetyOutlined style="font-size: 24px; color: #1890ff;" />
        <span>Сохраните вашу сид-фразу</span>
      </div>
    </template>
    <SC_MnemonicModalContent>
      <SC_WarningBox>
        <SC_WarningTitle>⚠️ ВАЖНО!</SC_WarningTitle>
        <SC_WarningText>
          Сохраните сид-фразу и/или приватный ключ в безопасном месте. Если вы потеряете оба, вы не сможете восстановить доступ к аккаунту.
          <strong> Никогда не делитесь ими ни с кем!</strong>
        </SC_WarningText>
      </SC_WarningBox>

      <SC_EquivalenceNote v-if="hasMnemonic && hasPrivateKey">
        Сид-фраза и приватный ключ (hex) равнозначны для восстановления доступа — достаточно сохранить что-то одно.
      </SC_EquivalenceNote>

      <SC_MnemonicBox v-if="hasMnemonic">
        <SC_PrivateKeyLabel>Сид-фраза</SC_PrivateKeyLabel>
        <SC_MnemonicText>
          {{ formattedMnemonic }}
        </SC_MnemonicText>
        <SC_CopyIconBtn type="button" title="Копировать сид-фразу" @click="copyMnemonic">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_MnemonicBox>

      <SC_PrivateKeyBox v-if="hasPrivateKey">
        <SC_PrivateKeyLabel>Приватный ключ (hex)</SC_PrivateKeyLabel>
        <SC_PrivateKeyText>
          {{ displayPrivateKeyHex }}
        </SC_PrivateKeyText>
        <SC_CopyIconBtn type="button" title="Копировать приватный ключ" @click="copyPrivateKey">
          <CopyOutlined />
        </SC_CopyIconBtn>
      </SC_PrivateKeyBox>
    </SC_MnemonicModalContent>

    <template #footer>
      <Button type="primary" @click="handleOk">
        Понятно
      </Button>
    </template>
  </Modal>
</template>

<script>
import { mnemonicModalOptions } from './mnemonic-modal.ts'

export default mnemonicModalOptions
</script>
