/**
 * Подложка раскладки «Карта»: векторная карта OpenFreeMap по данным
 * OpenStreetMap — без ключей и лимитов, светлая (Positron) и тёмная под тему
 * приложения. Растровые тайлы OSM и CARTO приложению закрыты: openstreetmap.org
 * отвечает 418 «Access blocked», CARTO требует ключ.
 *
 * Рисует MapLibre; камерой управляет схема (d3-zoom), сама подложка жестов не
 * ловит. Модуль грузится, только когда открывают карту. Под Tor все запросы
 * подложки идут через Tor (appFetch), мимо вебвью.
 */

import {
  addProtocol,
  Map as MapLibre,
  setWorkerUrl,
  type ExpressionSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

import { appFetch } from '@/helpers/api/fetch-strategies'
import { viewToCamera, type MapView } from './geo-map'

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/** Схема адресов, которые MapLibre отдаёт нам, а мы — Tor. */
const TOR_SCHEME = 'bastyon-tor'

let torRouted = false

function routeThroughTor(): void {
  if (torRouted) return
  torRouted = true
  addProtocol(TOR_SCHEME, async (params, abort) => {
    const res = await appFetch(params.url.replace(`${TOR_SCHEME}://`, 'https://'), {
      signal: abort.signal,
    })
    if (!res.ok) throw new Error(`base map: HTTP ${res.status}`)
    if (params.type === 'json') return { data: await res.json() }
    if (params.type === 'string') return { data: await res.text() }
    return { data: await res.arrayBuffer() }
  })
}

export interface BaseMap {
  /** Показать то же, что видно на схеме при этом виде d3-zoom. */
  setView(view: MapView, width: number, height: number): void
  setDark(dark: boolean): void
  resize(): void
  destroy(): void
}

export interface BaseMapOptions {
  dark: boolean
  /** Язык подписей, BCP 47 (`ru`, `ko`); где перевода нет — английский или местный. */
  language: string
  /** Запросы — через Tor. */
  viaTor: boolean
  /** Стиль загружен: подложку видно. */
  onReady: () => void
  /** Стиль не загрузился — остаётся фон из точек суши. */
  onError: () => void
}

/** Бросает, если у вебвью нет WebGL. */
export function createBaseMap(container: HTMLElement, opts: BaseMapOptions): BaseMap {
  setWorkerUrl(workerUrl)
  if (opts.viaTor) routeThroughTor()
  const map = new MapLibre({
    container,
    style: opts.dark ? STYLES.dark : STYLES.light,
    interactive: false,
    attributionControl: false,
    minZoom: -2,
    maxZoom: 20,
    fadeDuration: 0,
    transformRequest: opts.viaTor
      ? (url) => ({ url: url.replace(/^https:\/\//, `${TOR_SCHEME}://`) })
      : undefined,
  })
  // Подписи — на языке приложения: в стилях OpenFreeMap они английские с местными.
  const label: ExpressionSpecification = [
    'coalesce',
    ['get', `name:${opts.language}`],
    ['get', 'name_en'],
    ['get', 'name'],
  ]
  map.on('style.load', () => {
    for (const layer of map.getStyle().layers) {
      if (layer.type !== 'symbol') continue
      const field: unknown = map.getLayoutProperty(layer.id, 'text-field')
      if (JSON.stringify(field ?? '').includes('"name')) {
        map.setLayoutProperty(layer.id, 'text-field', label)
      }
    }
  })

  let ready = false
  map.once('load', () => {
    ready = true
    opts.onReady()
  })
  // После загрузки ошибки — это отдельные тайлы: подложка всё равно видна.
  map.on('error', () => {
    if (!ready) opts.onError()
  })

  let camera = ''
  return {
    setView(view, width, height) {
      const { center, zoom } = viewToCamera(view, width, height)
      const next = `${center[0]},${center[1]},${zoom}`
      if (next === camera) return
      camera = next
      map.jumpTo({ center, zoom })
    },
    setDark(dark) {
      map.setStyle(dark ? STYLES.dark : STYLES.light)
    },
    resize() {
      map.resize()
    },
    destroy() {
      map.remove()
    },
  }
}
