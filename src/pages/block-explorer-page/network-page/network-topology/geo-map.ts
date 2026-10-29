/**
 * Раскладка «Карта» схемы сети: ноды на карте мира OpenStreetMap. Подложку
 * рисует MapLibre (base-map.ts), точки нод — схема поверх неё, в той же
 * проекции веб-Меркатора. Мир — квадрат WORLD × WORLD, масштаб — k d3-zoom.
 */

import { DOT_COLS, DOT_ROWS, DOT_STEP, LAND_BITS } from '@/services/network-map/data/world-dots'

/** Где нода на карте: широта и долгота, градусы. */
export interface NodePlace {
  lat: number
  lon: number
}

export const WORLD = 256
/** Самый крупный масштаб карты: уровень 18 — отдельные дома. */
export const MAP_MAX_ZOOM = 18
const MAX_LAT = 85.05112878

/** Широта и долгота → точка мира [0, WORLD]. */
export function mercator(lat: number, lon: number): { x: number; y: number } {
  const s = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180)
  return {
    x: ((lon + 180) / 360) * WORLD,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD,
  }
}

/** Подписи источников: подложка — OpenFreeMap на данных OSM, города нод — DB-IP. */
export const MAP_ATTRIBUTION = [
  { label: 'OpenFreeMap', href: 'https://openfreemap.org' },
  { label: '© OpenMapTiles', href: 'https://www.openmaptiles.org/' },
  { label: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'IP Geolocation by DB-IP', href: 'https://db-ip.com' },
] as const

/** Ноды в одном городе — подсолнухом вокруг точки: так видна и кликается каждая. */
export function spreadOffset(index: number, gap: number): { dx: number; dy: number } {
  if (index <= 0) return { dx: 0, dy: 0 }
  const r = gap * Math.sqrt(index)
  const angle = index * 2.399963
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r }
}

/** Контекст холста — для компонентов, где eslint не знает типов DOM. */
export type Canvas2D = CanvasRenderingContext2D

export interface MapView {
  x: number
  y: number
  k: number
}

/**
 * Камера MapLibre для вида d3-zoom: что в середине окна и уровень. Мир
 * MapLibre на уровне 0 — 512 px, у схемы при k = 1 — WORLD.
 */
export function viewToCamera(
  view: MapView,
  width: number,
  height: number
): { center: [lon: number, lat: number]; zoom: number } {
  const x = (width / 2 - view.x) / view.k
  const y = (height / 2 - view.y) / view.k
  const n = Math.PI - (2 * Math.PI * y) / WORLD
  return {
    center: [(x / WORLD) * 360 - 180, (180 / Math.PI) * Math.atan(Math.sinh(n))],
    zoom: Math.log2((view.k * WORLD) / 512),
  }
}

let land: Array<{ x: number; y: number }> | null = null

/** Суша сеткой точек (Natural Earth) в мире карты — фон, пока подложки нет. */
export function landPoints(): Array<{ x: number; y: number }> {
  if (land) return land
  const bits = Uint8Array.from(window.atob(LAND_BITS), (c) => c.charCodeAt(0))
  land = []
  for (let r = 0; r < DOT_ROWS; r++) {
    const lat = 90 - DOT_STEP / 2 - r * DOT_STEP
    for (let c = 0; c < DOT_COLS; c++) {
      const i = r * DOT_COLS + c
      if (bits[i >> 3]! & (1 << (i & 7)))
        land.push(mercator(lat, -180 + DOT_STEP / 2 + c * DOT_STEP))
    }
  }
  return land
}
