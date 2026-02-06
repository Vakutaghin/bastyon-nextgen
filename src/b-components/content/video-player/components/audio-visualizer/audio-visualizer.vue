<template>
  <div ref="container" class="audio-visualizer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, type PropType } from 'vue'
import * as PIXI from 'pixi.js'

const p = defineProps({
  videoElement: {
    type: Object as PropType<HTMLVideoElement | null>,
    default: null
  },
  isPlaying: {
    type: Boolean,
    default: false
  }
})

const container = ref<HTMLElement | null>(null)
let app: PIXI.Application | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null
let dataArray: Uint8Array | null = null
let graphics: PIXI.Graphics | null = null

// Use a static map to track if a video element has been connected to an AudioContext
// to prevent "MediaElementAudioSourceNode has already been created" error.
// We store the source node itself.
const elementSourceMap = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>()

const initVisualizer = async () => {
  if (!container.value) return

  // Init PixiJS
  app = new PIXI.Application()

  // PixiJS v8 init is async
  await app.init({
    resizeTo: container.value,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  if (!container.value) {
     app.destroy()
     return
  }
  container.value.appendChild(app.canvas)

  graphics = new PIXI.Graphics()
  app.stage.addChild(graphics)

  app.ticker.add(drawWave)
}

const setupAudio = () => {
  if (!p.videoElement) return

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    if (elementSourceMap.has(p.videoElement)) {
      source = elementSourceMap.get(p.videoElement)!
    } else {
      source = audioContext.createMediaElementSource(p.videoElement)
      elementSourceMap.set(p.videoElement, source)
    }

    // Re-create analyser for this session
    if (!analyser) {
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
    }

    // Connect graph: Source -> Analyser -> Destination
    // Note: We need to check if source is already connected to something to avoid fan-out issues if dependent on strict graph
    // But WebAudio allows multiple connections.

    // Disconnect old connections if any (tricky with shared source)
    // Instead, we just ensure connection.
    try {
        source.connect(analyser)
        analyser.connect(audioContext.destination)
    } catch (e) {
        // Already connected or similar benign issue
    }

    const bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)

  } catch (e) {
    console.error('AudioVisualizer setup error:', e)
  }
}

const drawWave = () => {
  if (!analyser || !dataArray || !graphics || !app) return

  analyser.getByteFrequencyData(dataArray)

  const width = app.screen.width
  const height = app.screen.height

  // Frequency range mapping
  // Default sample rate is usually 44100 Hz or 48000 Hz.
  // Nyquist frequency is half of that (approx 22000-24000 Hz).
  // analyser.fftSize = 256 => frequencyBinCount = 128 bins.
  // Each bin covers approx 24000 / 128 = 187.5 Hz (if 48kHz).

  const sampleRate = audioContext?.sampleRate || 44100
  const binSize = sampleRate / analyser.fftSize // Frequency width of each bin

  const minFreq = 100
  const maxFreq = 12000

  // Calculate start and end indices for the desired frequency range
  const startIndex = Math.floor(minFreq / binSize)
  const endIndex = Math.ceil(maxFreq / binSize)
  const rangeLength = endIndex - startIndex

  // We want to display a fixed number of bars
  const barCount = 64
  const barWidth = (width / barCount) * 0.8
  const spacing = (width / barCount) * 0.2

  graphics.clear()

  const centerY = height / 2

  // How many bins per bar
  const binsPerBar = Math.max(1, rangeLength / barCount)

  for (let i = 0; i < barCount; i++) {
    // Calculate which bins correspond to this bar
    // We use a logarithmic scale for better visualization of music
    // or linear if range is small. Let's stick to linear mapping within the cropped range for simplicity first,
    // but mapping the cropped range (100-12000) to the 64 bars.

    const rangeStart = startIndex + Math.floor(i * binsPerBar)
    const rangeEnd = startIndex + Math.floor((i + 1) * binsPerBar)

    let sum = 0
    let count = 0

    for (let j = rangeStart; j < rangeEnd && j < dataArray.length; j++) {
      sum += dataArray[j]
      count++
    }

    // Fallback if range is too narrow
    if (count === 0 && rangeStart < dataArray.length) {
        sum = dataArray[rangeStart]
        count = 1
    }

    const value = count > 0 ? sum / count : 0

    const percent = value / 255

    // Non-linear height for better visual effect (squared to emphasize peaks)
    // Max height is 50% of container
    const maxBarHeight = height * 0.5
    const barHeight = Math.max(4, maxBarHeight * (percent * percent + percent) * 0.5)

    // Color
    const color = 0x00A4DB
    const alpha = 0.8

    const x = i * (barWidth + spacing) + spacing / 2

    // Draw rounded rect from bottom up
    // y = height - barHeight (starts from bottom)
    // To avoid overlap with controls (if any), we might want to offset, but "с самого низа" implies bottom 0.
    // If we want it to look like it sits on the bottom edge:
    graphics.roundRect(x, height - barHeight, barWidth, barHeight, barWidth / 2)
    graphics.fill({ color, alpha })
  }
}

watch(() => p.videoElement, () => {
  if (p.videoElement) {
    setupAudio()
  }
})

watch(() => p.isPlaying, (playing) => {
  if (playing && audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
  }
})

onMounted(() => {
  initVisualizer()
  if (p.videoElement) {
    setupAudio()
  }
})

onBeforeUnmount(() => {
  if (app) {
    app.destroy(true, { children: true, texture: true })
  }

  // We don't close AudioContext as it might be global or reused,
  // and we definitely don't want to stop the audio if we just unmount the visualizer but keep playing (e.g. background)
  // But in this case, the visualizer is inside the player component.
})
</script>

<style scoped>
.audio-visualizer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 5; /* Above thumbnail (2), below controls (10) */
}
</style>
