import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { SafetyOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { recoverKeyPair, detectPrivateKeyFormat } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import type { Props, Emits } from './types'
import {
  SC_MnemonicModalContent,
  SC_WarningBox,
  SC_WarningTitle,
  SC_WarningText,
  SC_EquivalenceNote,
  SC_MnemonicBox,
  SC_MnemonicText,
  SC_PrivateKeyBox,
  SC_PrivateKeyLabel,
  SC_PrivateKeyText,
  SC_CopyIconBtn,
} from './styled'

export const mnemonicModalOptions = defineComponent({
  name: 'MnemonicModal',
  components: {
    Modal,
    Button,
    SafetyOutlined,
    CopyOutlined,
    SC_MnemonicModalContent,
    SC_WarningBox,
    SC_WarningTitle,
    SC_WarningText,
    SC_EquivalenceNote,
    SC_MnemonicBox,
    SC_MnemonicText,
    SC_PrivateKeyBox,
    SC_PrivateKeyLabel,
    SC_PrivateKeyText,
    SC_CopyIconBtn,
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
    privateKeyHex: {
      type: String,
      default: '',
    },
  },
  emits: [ 'update:open', 'close' ],
  setup(
    _p: Props,
    { emit }: { emit: (event: 'update:open' | 'close', ...args: any[]) => void },
  ) {
    return { emit }
  },
  data() {
    return {
      derivedPrivateKeyHex: '' as string,
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
    /** Только валидная сид-фраза (12/24 слова из словаря); иначе пусто */
    formattedMnemonic(): string {
      const raw = (this.mnemonic || '').trim()
      if (!raw) return ''
      return detectPrivateKeyFormat(raw) === 'mnemonic' ? raw : ''
    },
    displayPrivateKeyHex(): string {
      if ((this.privateKeyHex || '').trim()) {
        return this.privateKeyHex!.trim()
      }
      return this.derivedPrivateKeyHex
    },
    hasMnemonic(): boolean {
      return this.formattedMnemonic.length > 0
    },
    hasPrivateKey(): boolean {
      return this.displayPrivateKeyHex.length > 0
    },
  },
  watch: {
    open(newValue: boolean) {
      if (!newValue) {
        this.derivedPrivateKeyHex = ''
      } else if (this.formattedMnemonic && !this.privateKeyHex?.trim()) {
        this.derivePrivateKeyFromMnemonic()
      }
    },
    mnemonic: {
      handler(newMnemonic: string) {
        if (!newMnemonic || !newMnemonic.trim()) return
        if ((this.privateKeyHex || '').trim()) return
        this.derivePrivateKeyFromMnemonic()
      },
      immediate: true,
    },
  },
  methods: {
    derivePrivateKeyFromMnemonic() {
      const m = this.formattedMnemonic
      if (!m) return
      try {
        const { keyPair } = recoverKeyPair(m)
        if (keyPair?.privateKey) {
          this.derivedPrivateKeyHex = Buffer.isBuffer(keyPair.privateKey)
            ? keyPair.privateKey.toString('hex')
            : String(keyPair.privateKey)
        }
      } catch (_) {
        this.derivedPrivateKeyHex = ''
      }
    },

    async copyToClipboard(text: string): Promise<boolean> {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          return true
        } catch (err) {
          console.error('Failed to copy:', err)
          return false
        } finally {
          document.body.removeChild(textArea)
        }
      }
    },

    async copyMnemonic() {
      if (!this.formattedMnemonic) return
      const ok = await this.copyToClipboard(this.formattedMnemonic)
      if (ok) {
        appToast.success({ message: 'Сид-фраза скопирована' })
      }
    },

    async copyPrivateKey() {
      if (!this.displayPrivateKeyHex) return
      const ok = await this.copyToClipboard(this.displayPrivateKeyHex)
      if (ok) {
        appToast.success({ message: 'Приватный ключ скопирован' })
      }
    },

    handleClose() {
      this.$emit('close')
      this.$emit('update:open', false)
    },

    handleOk() {
      this.handleClose()
    },
  },
})
