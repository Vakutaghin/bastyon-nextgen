import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import * as PIXI from 'pixi.js'

function resolveContainerEl(
  ref: Ref<HTMLElement | { $el: HTMLElement } | null>
): HTMLElement | null {
  const c = ref.value
  if (!c) return null
  return c instanceof HTMLElement ? c : c.$el
}

export function useAudioVisualizer(
  container: Ref<HTMLElement | { $el: HTMLElement } | null>,
  videoElement: Ref<HTMLVideoElement | null>,
  isPlaying: Ref<boolean>
) {
  let app: PIXI.Application | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaElementAudioSourceNode | null = null
  let dataArray: Uint8Array | null = null
  let graphics: PIXI.Graphics | null = null

  const elementSourceMap = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>()

  const initVisualizer = async () => {
    const el = resolveContainerEl(container)
    if (!el) return

    app = new PIXI.Application()

    await app.init({
      resizeTo: el,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    const elAfter = resolveContainerEl(container)
    if (!elAfter) {
      app.destroy()
      return
    }
    elAfter.appendChild(app.canvas)

    graphics = new PIXI.Graphics()
    app.stage.addChild(graphics)

    app.ticker.add(drawWave)
  }

  const setupAudio = () => {
    const el = videoElement.value
    if (!el) return

    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      if (elementSourceMap.has(el)) {
        source = elementSourceMap.get(el)!
      } else {
        source = audioContext.createMediaElementSource(el)
        elementSourceMap.set(el, source)
      }

      if (!analyser) {
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
      }

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

    const sampleRate = audioContext?.sampleRate || 44100
    const binSize = sampleRate / analyser.fftSize

    const minFreq = 100
    const maxFreq = 12000

    const startIndex = Math.floor(minFreq / binSize)
    const endIndex = Math.ceil(maxFreq / binSize)
    const rangeLength = endIndex - startIndex

    const barCount = 64
    const barWidth = (width / barCount) * 0.8
    const spacing = (width / barCount) * 0.2

    graphics.clear()

    const binsPerBar = Math.max(1, rangeLength / barCount)

    for (let i = 0; i < barCount; i++) {
      const rangeStart = startIndex + Math.floor(i * binsPerBar)
      const rangeEnd = startIndex + Math.floor((i + 1) * binsPerBar)

      let sum = 0
      let count = 0

      for (let j = rangeStart; j < rangeEnd && j < dataArray.length; j++) {
        sum += dataArray[j]
        count++
      }

      if (count === 0 && rangeStart < dataArray.length) {
        sum = dataArray[rangeStart]
        count = 1
      }

      const value = count > 0 ? sum / count : 0
      const percent = value / 255

      const maxBarHeight = height * 0.5
      const barHeight = Math.max(4, maxBarHeight * (percent * percent + percent) * 0.5)

      const color = 0x00a4db
      const alpha = 0.8

      const x = i * (barWidth + spacing) + spacing / 2

      graphics.roundRect(x, height - barHeight, barWidth, barHeight, barWidth / 2)
      graphics.fill({ color, alpha })
    }
  }

  watch(videoElement, () => {
    if (videoElement.value) {
      setupAudio()
    }
  })

  watch(isPlaying, (playing) => {
    if (playing && audioContext && audioContext.state === 'suspended') {
      audioContext.resume()
    }
  })

  onMounted(() => {
    initVisualizer()
    if (videoElement.value) {
      setupAudio()
    }
  })

  onBeforeUnmount(() => {
    if (app) {
      app.destroy(true, { children: true, texture: true })
    }
  })
}
