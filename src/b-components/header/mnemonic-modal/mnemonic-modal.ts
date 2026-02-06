import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { SafetyOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import type { Props, Emits } from './types'
import {
  SC_MnemonicModalContent,
  SC_WarningBox,
  SC_WarningTitle,
  SC_WarningText,
  SC_MnemonicBox,
  SC_MnemonicText,
  SC_CopyButton,
  SC_DontShowAgain,
  SC_CheckboxLabel,
  SC_Checkbox,
} from './styled'

export const mnemonicModalOptions = defineComponent({
  name: 'MnemonicModal',
  components: {
    Modal,
    Button,
    SafetyOutlined,
    SC_MnemonicModalContent,
    SC_WarningBox,
    SC_WarningTitle,
    SC_WarningText,
    SC_MnemonicBox,
    SC_MnemonicText,
    SC_CopyButton,
    SC_DontShowAgain,
    SC_CheckboxLabel,
    SC_Checkbox,
  },
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    mnemonic: {
      type: String,
      default: '',
    },
  },
  emits: [ 'update:open', 'close', 'dontShowAgain' ],
  setup(
    _p: Props,
    { emit }: { emit: (event: 'update:open' | 'close' | 'dontShowAgain', ...args: any[]) => void },
  ) {
    const authStore = useAuthStore()

    return {
      authStore,
      emit,
    }
  },
  data() {
    return {
      dontShowAgain: false,
      copied: false,
    }
  },
  computed: {
    isOpen: {
      get(): boolean {
        return this.open
      },
      set(value: boolean) {
        this.$emit('update:open', value)
      },
    },
    formattedMnemonic(): string {
      return this.mnemonic || ''
    },
  },
  watch: {
    open(newValue: boolean) {
      if (!newValue) {
        this.dontShowAgain = false
        this.copied = false
      }
    },
  },
  methods: {
    // Копирование мнемоники в буфер обмена
    async copyMnemonic() {
      try {
        await navigator.clipboard.writeText(this.formattedMnemonic)
        this.copied = true
        setTimeout(() => {
          this.copied = false
        }, 2000)
      } catch (error) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea')
        textArea.value = this.formattedMnemonic
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          this.copied = true
          setTimeout(() => {
            this.copied = false
          }, 2000)
        } catch (err) {
          console.error('Failed to copy:', err)
        }
        document.body.removeChild(textArea)
      }
    },

    // Обработчик закрытия
    handleClose() {
      if (this.dontShowAgain) {
        this.$emit('dontShowAgain')
      }
      this.$emit('close')
      this.$emit('update:open', false)
    },

    // Обработчик кнопки "Понятно"
    handleOk() {
      this.handleClose()
    },
  },
})
