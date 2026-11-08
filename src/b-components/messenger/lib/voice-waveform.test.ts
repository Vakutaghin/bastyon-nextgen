// Волна голосового в событии: формат Forta Chat (целые 0…1024) и дробные
// 0…1 читаются оба, ровная и пустая волна — не волна; отправляем целыми, с
// самым громким куском 1024; столбики для рисунка — средние, самый высокий — 1.
// Волна зашифрованного чата открывается только ключом своего голосового.

import { describe, expect, it } from 'vitest'
import { hasWaveformShape, waveformBars, waveformFromInfo, waveformToInfo } from './voice-waveform'
import { openWaveform, sealWaveform } from '../services/encryption-service'

describe('voice-waveform', () => {
  it('целые MSC3245 (Forta Chat) — делятся на 1024, шкала по всему массиву', () => {
    expect(waveformFromInfo({ waveform: [1, 0, 512, 1024] })).toEqual([1 / 1024, 0, 0.5, 1])
  })

  it('дробные 0…1 — как есть', () => {
    expect(waveformFromInfo({ waveform: [0.1, 0.5, 1] })).toEqual([0.1, 0.5, 1])
  })

  it('пустая, ровная, битая волна — нет волны (нарисуем по звуку)', () => {
    expect(waveformFromInfo({})).toBeNull()
    expect(waveformFromInfo({ waveform: [] })).toBeNull()
    expect(waveformFromInfo({ waveform: [300, 300, 300] })).toBeNull()
    expect(waveformFromInfo({ waveform: [0, 0, 0] })).toBeNull()
    expect(waveformFromInfo({ waveform: [1, 'x', 3] })).toBeNull()
    expect(waveformFromInfo({ waveform: 'abc' })).toBeNull()
    expect(hasWaveformShape([0.2])).toBe(false)
  })

  it('в событие — целыми, самый громкий кусок 1024', () => {
    expect(waveformToInfo([0.05, 0.1, 0.025])).toEqual([512, 1024, 256])
    expect(waveformToInfo([0, 0])).toEqual([0, 0])
  })

  it('столбики: средние по кускам, самый высокий — 1, тишина — не ноль', () => {
    const bars = waveformBars([0, 0, 0.5, 0.5, 1, 1], 3)
    expect(bars).toHaveLength(3)
    expect(bars[2]).toBe(1)
    expect(bars[1]).toBe(0.5)
    expect(bars[0]).toBeGreaterThan(0)
    // Волна короче столбиков — растягивается повтором.
    expect(waveformBars([0.5, 1], 4)).toEqual([0.5, 0.5, 1, 1])
  })

  it('зашифрованная волна: открывается ключом голосового, чужим — нет', async () => {
    const samples = [0, 0.25, 0.5, 1]
    const sealed = await sealWaveform(samples, 'a'.repeat(64))
    expect(sealed).toMatch(/^[0-9a-f]+$/)
    const opened = await openWaveform(sealed, 'a'.repeat(64))
    expect(opened!.map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.25, 0.5, 1])
    expect(await openWaveform(sealed, 'b'.repeat(64))).toBeNull()
    expect(await openWaveform('zz', 'a'.repeat(64))).toBeNull()
    // Один и тот же секрет — разный шифротекст: IV случайный.
    expect(await sealWaveform(samples, 'a'.repeat(64))).not.toBe(sealed)
  })
})
