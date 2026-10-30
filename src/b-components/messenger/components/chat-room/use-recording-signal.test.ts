// «Записывает голосовое…»: кто записывает (отметка гаснет сама), и отправка
// сигнала, пока идёт запись, — с повтором и «перестал» в ту же комнату.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const matrix = vi.hoisted(() => ({ sendRecording: vi.fn(async () => {}) }))
vi.mock('../../services/matrix-service', () => ({
  matrixService: { sendRecording: matrix.sendRecording, getClient: () => null },
}))

import {
  activeRecorders,
  applyRecordingSignal,
  useRecordingBroadcast,
} from './use-recording-signal'
import { RECORDING_REFRESH_MS, RECORDING_TTL_MS } from '../../lib/chat-privacy'

describe('applyRecordingSignal / activeRecorders', () => {
  it('начал — виден, перестал — нет, без повтора гаснет сам', () => {
    let map = applyRecordingSignal(new Map(), { roomId: '!a', sender: '@b', recording: true }, 0)
    expect(activeRecorders(map, '!a', 1000)).toEqual(['@b'])
    expect(activeRecorders(map, '!other', 1000)).toEqual([])
    expect(activeRecorders(map, '!a', RECORDING_TTL_MS + 1)).toEqual([])

    map = applyRecordingSignal(map, { roomId: '!a', sender: '@b', recording: false }, 1000)
    expect(activeRecorders(map, '!a', 1000)).toEqual([])
    expect(map.has('!a')).toBe(false)
  })
})

describe('useRecordingBroadcast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    matrix.sendRecording.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  function setup(allowed = true) {
    const roomId = ref<string | null>('!a:x')
    const recording = ref(false)
    const allow = ref(allowed)
    const wrapper = mount(
      defineComponent({
        setup() {
          useRecordingBroadcast(roomId, recording, () => allow.value)
          return () => h('div')
        },
      })
    )
    return { roomId, recording, allow, wrapper }
  }

  it('запись: «начал», повтор, «перестал» в ту же комнату', async () => {
    const { recording } = setup()
    recording.value = true
    await nextTick()
    expect(matrix.sendRecording).toHaveBeenLastCalledWith('!a:x', true)
    await vi.advanceTimersByTimeAsync(RECORDING_REFRESH_MS)
    expect(matrix.sendRecording).toHaveBeenCalledTimes(2)
    recording.value = false
    await nextTick()
    expect(matrix.sendRecording).toHaveBeenLastCalledWith('!a:x', false)
    await vi.advanceTimersByTimeAsync(RECORDING_REFRESH_MS * 2)
    expect(matrix.sendRecording).toHaveBeenCalledTimes(3)
  })

  it('выключено в настройках — не шлём; выключили посреди записи — «перестал»', async () => {
    const { recording, allow } = setup(false)
    recording.value = true
    await nextTick()
    expect(matrix.sendRecording).not.toHaveBeenCalled()

    allow.value = true
    await nextTick()
    expect(matrix.sendRecording).toHaveBeenLastCalledWith('!a:x', true)
    allow.value = false
    await nextTick()
    expect(matrix.sendRecording).toHaveBeenLastCalledWith('!a:x', false)
  })

  it('чат закрыли посреди записи — «перестал»', async () => {
    const { recording, wrapper } = setup()
    recording.value = true
    await nextTick()
    wrapper.unmount()
    expect(matrix.sendRecording).toHaveBeenLastCalledWith('!a:x', false)
  })

  it('mesh-диалог — не Matrix, не шлём', async () => {
    const { recording, roomId } = setup()
    roomId.value = 'mesh:abc'
    recording.value = true
    await nextTick()
    expect(matrix.sendRecording).not.toHaveBeenCalled()
  })
})
