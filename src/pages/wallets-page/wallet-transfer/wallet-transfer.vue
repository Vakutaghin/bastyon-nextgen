<template>
  <SC_TransferWidget>
    <SC_TransferSwitch>
      <SC_TransferSwitchBtn
        type="button"
        :active="mode === 'send'"
        @click="mode = 'send'"
      >
        Отправка
      </SC_TransferSwitchBtn>
      <SC_TransferSwitchBtn
        type="button"
        :active="mode === 'receive'"
        @click="mode = 'receive'"
      >
        Получение
      </SC_TransferSwitchBtn>
    </SC_TransferSwitch>

    <SC_TransferBody>
      <!-- Отправка -->
      <template v-if="mode === 'send'">
        <SC_TransferField>
          <SC_TransferLabel>Получатель (имя или адрес)</SC_TransferLabel>
          <SC_TransferSearchWrap>
            <SC_TransferInput
              v-model="receiverSearchQuery"
              type="text"
              placeholder="Введите имя аккаунта или адрес (P / Z)"
              autocomplete="off"
              @input="onSearchInput"
              @blur="onReceiverBlur"
            />
            <SC_TransferSearchDropdown v-if="showSearchDropdown && searchResults.length">
              <SC_TransferSearchItem
                v-for="user in searchResults"
                :key="user.address"
                type="button"
                @click="selectReceiver(user)"
              >
                {{ user.name || user.address }}
              </SC_TransferSearchItem>
            </SC_TransferSearchDropdown>
          </SC_TransferSearchWrap>
          <SC_TransferFieldError v-if="receiverAddressValidationError">
            {{ receiverAddressValidationError }}
          </SC_TransferFieldError>
          <div v-else-if="searchLoading" style="font-size: 12px; color: rgb(120,120,120); margin-top: 4px;">
            Поиск…
          </div>
          <SC_TransferLoginChip v-else-if="receiverLogin">
            <SC_TransferLoginChipText>Логин: {{ receiverLogin }}</SC_TransferLoginChipText>
            <SC_TransferLoginChipRemove type="button" aria-label="Удалить" @click="clearReceiverLink">
              ×
            </SC_TransferLoginChipRemove>
          </SC_TransferLoginChip>
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel>Сумма (PKOIN)</SC_TransferLabel>
          <SC_TransferInput
            v-model="amount"
            type="number"
            step="0.00000001"
            min="0"
            placeholder="0.00"
          />
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel>Сообщение (необязательно)</SC_TransferLabel>
          <SC_TransferTextarea
            v-model="message"
            placeholder="Для чего эта транзакция?"
            maxlength="80"
          />
        </SC_TransferField>
        <SC_TransferField>
          <SC_TransferLabel>Комиссия</SC_TransferLabel>
          <SC_TransferSelect v-model="feemode">
            <option value="include">Получатель платит</option>
            <option value="exclude">Отправитель платит</option>
          </SC_TransferSelect>
        </SC_TransferField>
        <SC_TransferSubmit
          type="button"
          :disabled="!canSend || sending"
          @click="doSend"
        >
          {{ sending ? 'Отправка...' : 'Рассчитать комиссию и отправить' }}
        </SC_TransferSubmit>
      </template>

      <!-- Получение -->
      <template v-else>
        <SC_TransferField v-if="receiveAddressOptions.length > 1">
          <SC_TransferLabel>Получить на</SC_TransferLabel>
          <SC_TransferSelect v-model="receiveTarget">
            <option
              v-for="opt in receiveAddressOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </SC_TransferSelect>
        </SC_TransferField>
        <template v-else-if="receiveAddressOptions.length === 1">
          <SC_TransferField>
            <SC_TransferLabel>Получить на</SC_TransferLabel>
            <div>{{ receiveAddressOptions[0]?.label }}</div>
          </SC_TransferField>
        </template>

        <SC_TransferField v-if="!showReceiveAddress && selectedReceiveAddress">
          <SC_TransferSubmit type="button" @click="showReceiveAddress = true">
            Показать адрес для получения
          </SC_TransferSubmit>
        </SC_TransferField>

        <template v-if="showReceiveAddress && selectedReceiveAddress">
          <SC_TransferField>
            <SC_TransferLabel>Адрес для получения PKOIN</SC_TransferLabel>
            <SC_TransferRow>
              <SC_TransferAddress>{{ selectedReceiveAddress }}</SC_TransferAddress>
              <SC_TransferCopyBtn type="button" @click="copyAddress">
                {{ copied ? 'Скопировано' : 'Скопировать' }}
              </SC_TransferCopyBtn>
            </SC_TransferRow>
          </SC_TransferField>
        </template>

        <div v-else-if="!currentAddress" style="color: rgb(120,120,120); font-size: 14px;">
          Войдите в аккаунт, чтобы получить адрес.
        </div>
      </template>

      <SC_TransferError v-if="error">{{ error }}</SC_TransferError>
      <SC_TransferSuccess v-else-if="success">{{ success }}</SC_TransferSuccess>
    </SC_TransferBody>
  </SC_TransferWidget>
</template>

<script lang="ts">
import walletTransfer from './wallet-transfer'
export default walletTransfer
</script>
