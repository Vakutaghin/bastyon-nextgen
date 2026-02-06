<template>
  <Modal
    v-model:open="isOpen"
    :width="600"
    :centered="true"
    :closable="true"
    :maskClosable="false"
    :destroyOnClose="true"
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
          Сохраните эту сид-фразу в безопасном месте. Если вы потеряете её, вы не сможете восстановить доступ к своему аккаунту.
          <strong> Никогда не делитесь этой фразой ни с кем!</strong>
        </SC_WarningText>
      </SC_WarningBox>

      <SC_MnemonicBox>
        <SC_MnemonicText>
          {{ formattedMnemonic }}
        </SC_MnemonicText>
        <SC_CopyButton>
          <Button @click="copyMnemonic" :type="copied ? 'default' : 'primary'">
            {{ copied ? '✓ Скопировано' : 'Копировать' }}
          </Button>
        </SC_CopyButton>
      </SC_MnemonicBox>

      <SC_DontShowAgain>
        <SC_CheckboxLabel>
          <SC_Checkbox
            type="checkbox"
            v-model="dontShowAgain"
          />
          <span>Я записал(а) сид-фразу, больше не показывать это окно</span>
        </SC_CheckboxLabel>
      </SC_DontShowAgain>
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
