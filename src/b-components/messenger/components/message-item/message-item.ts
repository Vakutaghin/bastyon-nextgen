import { defineComponent, type PropType, computed } from 'vue'

import type { Message } from '../../types'
import { matrixFetch } from '@/helpers/api/request'
import { useMessengerStore } from '../../store'
import { SC_MessageItem, SC_MessageMeta, SC_MessageRow, SC_MessageTime } from './styled'
import AudioMessage from '../audio-message/audio-message.vue'


export const messageItemOptions = defineComponent({
  name: 'MessageItem',
  components: {
    SC_MessageItem,
    SC_MessageMeta,
    SC_MessageRow,
    SC_MessageTime,
    AudioMessage
  },
  props: {
    message: {
      type: Object as PropType<Message>,
      required: true
    },
    showName: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    const store = useMessengerStore()

    const isMine = computed(() => {
      return props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
    })

    const isCompact = computed(() => {
      return !store.isFullScreen
    })

    const displayName = computed(() => {
      if (isMine.value) return store.currentUser.name || 'Вы'
      return props.message.senderName || props.message.senderId
    })

    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp)
      const now = new Date()
      const isCurrentYear = date.getFullYear() === now.getFullYear()

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long'
      }

      if (!isCurrentYear) {
        dateOptions.year = 'numeric'
      }

      const dateStr = date.toLocaleDateString('ru-RU', dateOptions)

      return `${dateStr}, ${timeStr}`
    }

    const formattedText = computed(() => {
      const text = props.message.text || ''
      const urlPattern = /((?:https?|ftp|bastyon):\/\/[^\s]+)/g

      const parts = text.split(urlPattern)

      return parts.map(part => {
        if (part.match(urlPattern)) {
            return `<a href="${part}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">${part}</a>`
         }
        // Escape HTML in non-link parts
        return part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      }).join('')
    })

    const onAudioError = async (e: Event) => {
      const target = e.target as HTMLAudioElement
      const src = target.src || props.message.url

      if (!src) return

      // Prevent infinite loop if we already switched to blob
      if (src.startsWith('blob:')) {
        console.error('[MessageItem] Blob playback failed for:', src)
        return
      }

      console.error('[MessageItem] Audio error:', target.error?.code, src)

      // If error is MEDIA_ERR_SRC_NOT_SUPPORTED (4), it might be because of content-type
      if (target.error?.code === 4) {
        try {
          // Check for Bastyon encryption (secrets)
          if (props.message.info?.secrets) {
            try {
              const response = await matrixFetch(src, { mode: 'cors' })
              if (!response.ok) throw new Error(`HTTP ${response.status}`)

              const blob = await response.blob()
              const decryptedBlob = await store.decryptAudioData(blob, props.message)

              if (decryptedBlob) {
                const objectUrl = URL.createObjectURL(decryptedBlob)
                target.src = objectUrl
                target.load()
                return
              } else {
                console.error('[MessageItem] Decryption returned null')
              }
            } catch (e) {
              console.error('[MessageItem] Pcrypto decryption failed:', e)
            }
          }

          const fileInfo = props.message.info?.file || props.message.info?.secrets?.file

          if (fileInfo && fileInfo.key) {
             const response = await matrixFetch(src, { mode: 'cors' })
             const arrayBuffer = await response.arrayBuffer()

             try {
               const decryptedData = await decryptAttachment(arrayBuffer, fileInfo)
               const blob = new Blob([decryptedData], { type: 'audio/mpeg' })
               const objectUrl = URL.createObjectURL(blob)
               target.src = objectUrl
               target.load()
               return
             } catch (decryptErr) {
               console.error('[MessageItem] Decryption failed:', decryptErr)
             }
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          const response = await matrixFetch(src, {
            mode: 'cors',
            signal: controller.signal
          })
          clearTimeout(timeoutId)

          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          const blob = await response.blob()

          // Force correct MIME type if it's 'encrypted/audio/mpeg', 'application/octet-stream' or unknown
          const newBlob = new Blob([blob], { type: 'audio/mpeg' })
          const objectUrl = URL.createObjectURL(newBlob)

          target.src = objectUrl
          target.load()
        } catch (err) {
          console.error('[MessageItem] Failed to fetch audio blob:', err)
        }
      }
    }

    const decryptAttachment = async (ciphertext: ArrayBuffer, info: any): Promise<ArrayBuffer> => {
      if (!info.key || !info.iv || !info.key.k) {
        throw new Error('Missing key or iv')
      }

      // Decode Base64 key
      const keyString = atob(info.key.k.replace(/-/g, '+').replace(/_/g, '/'))
      const keyBytes = new Uint8Array(keyString.length)
      for (let i = 0; i < keyString.length; i++) keyBytes[i] = keyString.charCodeAt(i)

      // Decode Base64 IV
      const ivString = atob(info.iv.replace(/-/g, '+').replace(/_/g, '/'))
      const ivBytes = new Uint8Array(ivString.length)
      for (let i = 0; i < ivString.length; i++) ivBytes[i] = ivString.charCodeAt(i)

      // Import Key
      const key = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CTR' },
        false,
        ['encrypt', 'decrypt']
      )

      // Decrypt
      // Matrix uses AES-CTR with a counter. The IV provided is the initial counter block.
      // WebCrypto AES-CTR requires 'counter' (the initial block) and 'length' (bits of counter).
      // Usually length is 64.

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-CTR',
          counter: ivBytes,
          length: 64
        },
        key,
        ciphertext
      )

      return decrypted
    }

    return { formatTime, displayName, isMine, formattedText, onAudioError, isCompact }
  }
})
