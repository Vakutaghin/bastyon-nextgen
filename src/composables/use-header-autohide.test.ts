// Шапка телефона: сдвиг равен прокрутке, у верха — не дальше самой прокрутки,
// остановленная на полпути доезжает туда, куда шла прокрутка.

import { describe, expect, it } from 'vitest'

import { nextHeaderOffset, snapHeaderOffset } from './use-header-autohide'

const H = 80

describe('nextHeaderOffset', () => {
  it('у верха страницы шапка уходит ровно на прокрутку', () => {
    expect(nextHeaderOffset(0, 20, 20, H)).toBe(20)
    expect(nextHeaderOffset(20, 50, 30, H)).toBe(50)
  })

  it('дальше своей высоты не уезжает', () => {
    expect(nextHeaderOffset(50, 600, 550, H)).toBe(H)
  })

  it('вверх — выезжает на пройденное расстояние', () => {
    expect(nextHeaderOffset(H, 570, -30, H)).toBe(50)
    expect(nextHeaderOffset(50, 400, -170, H)).toBe(0)
  })

  it('вернулись к верху — шапка на месте, даже если была спрятана', () => {
    expect(nextHeaderOffset(H, 10, -5, H)).toBe(10)
    expect(nextHeaderOffset(H, 0, -600, H)).toBe(0)
  })

  it('оттяжка за верх (отрицательная прокрутка) шапку не прячет', () => {
    expect(nextHeaderOffset(0, -30, -30, H)).toBe(0)
  })
})

describe('snapHeaderOffset', () => {
  it('целиком показанную или спрятанную не трогает', () => {
    expect(snapHeaderOffset(0, 500, 10, H)).toBe(0)
    expect(snapHeaderOffset(H, 500, -10, H)).toBe(H)
  })

  it('шли вверх — показывает', () => {
    expect(snapHeaderOffset(30, 500, -10, H)).toBe(0)
  })

  it('шли вниз — прячет, но у верха не дальше прокрутки', () => {
    expect(snapHeaderOffset(30, 500, 10, H)).toBe(H)
    expect(snapHeaderOffset(30, 30, 10, H)).toBe(30)
  })
})
