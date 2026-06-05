<template>
  <SC_QrScanner>
    <SC_QrActions>
      <SC_QrUploadLabel>
        <PictureOutlined />
        {{ t('auth.qrUpload') }}
        <SC_QrHiddenInput
          ref="fileInputRef"
          type="file"
          accept="image/*"
          @change="handleFileChange"
        />
      </SC_QrUploadLabel>

      <Button v-if="!cameraActive" type="default" :disabled="busy" @click="startCamera">
        <template #icon><CameraOutlined /></template>
        {{ t('auth.qrUseCamera') }}
      </Button>
      <Button v-else type="default" danger @click="stopCamera">
        {{ t('auth.qrStopCamera') }}
      </Button>
    </SC_QrActions>

    <SC_QrVideoWrap v-show="cameraActive">
      <SC_QrVideo ref="videoRef" playsinline muted />
      <SC_QrFrame />
    </SC_QrVideoWrap>

    <SC_QrHint v-if="cameraActive">{{ t('auth.qrScanning') }}</SC_QrHint>
    <SC_QrHint v-else>{{ t('auth.qrHint') }}</SC_QrHint>

    <SC_QrError v-if="errorMessage">{{ errorMessage }}</SC_QrError>
  </SC_QrScanner>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { CameraOutlined, PictureOutlined } from '@ant-design/icons-vue'
import Button from '@/components/button/button.vue'
import { readQRCode, decodeQRFromImageData } from '@/blockchain/utils/qr-code'
import {
  SC_QrScanner,
  SC_QrActions,
  SC_QrUploadLabel,
  SC_QrHiddenInput,
  SC_QrVideoWrap,
  SC_QrVideo,
  SC_QrFrame,
  SC_QrHint,
  SC_QrError,
} from './qr-scanner.styled'

const emit = defineEmits<{
  /** Успешно декодированный текст QR-кода (мнемоника / приватный ключ / payload). */
  decoded: [text: string]
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const cameraActive = ref(false)
const busy = ref(false)
const errorMessage = ref<string | null>(null)

let stream: MediaStream | null = null
let rafId: number | null = null
let scanCanvas: HTMLCanvasElement | null = null

function onDecoded(text: string): void {
  stopCamera()
  errorMessage.value = null
  emit('decoded', text)
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем значение, чтобы повторный выбор того же файла снова триггерил change.
  input.value = ''
  if (!file) return

  errorMessage.value = null
  busy.value = true
  try {
    const text = await readQRCode(file)
    onDecoded(text)
  } catch {
    errorMessage.value = t('auth.qrDecodeError')
  } finally {
    busy.value = false
  }
}

async function startCamera(): Promise<void> {
  errorMessage.value = null
  if (!navigator?.mediaDevices?.getUserMedia) {
    errorMessage.value = t('auth.qrCameraUnavailable')
    return
  }
  busy.value = true
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    cameraActive.value = true
    const video = videoRef.value
    if (!video) {
      stopCamera()
      return
    }
    video.srcObject = stream
    await video.play()
    scanCanvas = document.createElement('canvas')
    rafId = requestAnimationFrame(scanFrame)
  } catch {
    errorMessage.value = t('auth.qrCameraError')
    stopCamera()
  } finally {
    busy.value = false
  }
}

function scanFrame(): void {
  const video = videoRef.value
  const canvas = scanCanvas
  if (!cameraActive.value || !video || !canvas) return

  const width = video.videoWidth
  const height = video.videoHeight
  if (width && height) {
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height)
      try {
        const { data } = ctx.getImageData(0, 0, width, height)
        const text = decodeQRFromImageData(data, width, height)
        if (text) {
          onDecoded(text)
          return
        }
      } catch {
        // getImageData может бросить на «грязном» canvas — игнорируем кадр.
      }
    }
  }
  rafId = requestAnimationFrame(scanFrame)
}

function stopCamera(): void {
  cameraActive.value = false
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
  const video = videoRef.value
  if (video) {
    video.pause()
    video.srcObject = null
  }
  scanCanvas = null
}

onBeforeUnmount(stopCamera)

defineExpose({ stopCamera })
</script>
