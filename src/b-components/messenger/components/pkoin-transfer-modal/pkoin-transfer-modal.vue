<template>
  <Teleport to="body">
    <SC_Backdrop v-if="open" @click.self="onCancel">
      <SC_Modal>
        <SC_Header>
          <span aria-hidden="true">💎</span>
          <span>Отправить PKOIN</span>
        </SC_Header>

        <SC_Body>
          <SC_Field>
            <SC_Label>Получатель</SC_Label>
            <SC_Recipient>{{ toAddress }}</SC_Recipient>
          </SC_Field>

          <SC_Field>
            <SC_Label for="pkoin-amount-input">Сумма (PKOIN)</SC_Label>
            <SC_Input
              id="pkoin-amount-input"
              :ref="setAmountInputRef"
              :value="amount"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              :disabled="sending"
              @input="onAmountInput"
            />
            <SC_Error v-if="amountError">{{ amountError }}</SC_Error>
          </SC_Field>

          <SC_Field>
            <SC_Label for="pkoin-msg-input">Сообщение (необязательно)</SC_Label>
            <SC_Textarea
              id="pkoin-msg-input"
              v-model="messageText"
              placeholder="За кофе, спасибо…"
              rows="2"
              maxlength="200"
              :disabled="sending"
            />
          </SC_Field>

          <SC_Error v-if="submitError">{{ submitError }}</SC_Error>
        </SC_Body>

        <SC_Footer>
          <SC_Button type="button" :disabled="sending" @click="onCancel">Отмена</SC_Button>
          <SC_Button
            type="button"
            :primary="true"
            :disabled="!canSubmit || sending"
            @click="onSubmit"
          >
            {{ sending ? 'Отправляем…' : 'Отправить' }}
          </SC_Button>
        </SC_Footer>
      </SC_Modal>
    </SC_Backdrop>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMessengerStore } from '../../store'
import {
  SC_Backdrop,
  SC_Modal,
  SC_Header,
  SC_Body,
  SC_Field,
  SC_Label,
  SC_Input,
  SC_Textarea,
  SC_Recipient,
  SC_Error,
  SC_Footer,
  SC_Button,
} from './styled'

const props = defineProps<{
  open: boolean
  chatId: string
  toAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent', txid: string): void
}>()

const store = useMessengerStore()

const amount = ref('')
const messageText = ref('')
const amountError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const sending = ref(false)
const amountInputRef = ref<HTMLInputElement | null>(null)

const setAmountInputRef = (el: unknown) => {
  if (!el) {
    amountInputRef.value = null
    return
  }
  if (el instanceof HTMLInputElement) {
    amountInputRef.value = el
    return
  }
  const maybe = (el as { $el?: unknown }).$el
  amountInputRef.value = maybe instanceof HTMLInputElement ? maybe : null
}

const numericAmount = computed<number>(() => {
  const v = parseFloat((amount.value || '').replace(',', '.'))
  return Number.isFinite(v) ? v : NaN
})

const canSubmit = computed<boolean>(() => {
  return Number.isFinite(numericAmount.value) && numericAmount.value > 0 && !amountError.value
})

const onAmountInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value
  // Допускаем цифры + один разделитель . или ,
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/([.,])(?=.*[.,])/g, '')
  amount.value = cleaned
  amountError.value = null
  submitError.value = null
}

const reset = () => {
  amount.value = ''
  messageText.value = ''
  amountError.value = null
  submitError.value = null
  sending.value = false
}

const onCancel = () => {
  if (sending.value) return
  reset()
  emit('close')
}

const onSubmit = async () => {
  if (sending.value) return
  if (!canSubmit.value) return
  sending.value = true
  submitError.value = null
  try {
    const txid = await store.sendPkoin(
      props.chatId,
      numericAmount.value,
      messageText.value.trim() || undefined
    )
    if (txid) {
      emit('sent', txid)
      reset()
      emit('close')
    } else {
      submitError.value = 'Не удалось отправить транзакцию'
    }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Ошибка отправки'
  } finally {
    sending.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => amountInputRef.value?.focus())
    }
  }
)
</script>
