// Меню «⋯» у играющей очереди (мини-плеер, «Далее» на странице поста):
// «Открыть плейлист», если известно, откуда очередь, и «Закрыть» — отдельно
// от кнопок управления, чтобы не закрыть очередь случайно.

import { h, type Component } from 'vue'
import type { MenuItem } from '@/components/menu'
import { AudioPlaylistIcon } from '@/components/icons'

export function playlistMenuItems(options: {
  /** Подпись «Открыть плейлист»; null — источника нет, пункта нет. */
  openLabel: string | null
  closeLabel: string
  closeIcon: Component
}): MenuItem[] {
  const items: MenuItem[] = []
  if (options.openLabel)
    items.push({ key: 'open', label: options.openLabel, icon: () => h(AudioPlaylistIcon) })
  items.push({
    key: 'close',
    label: options.closeLabel,
    danger: true,
    icon: () => h(options.closeIcon),
  })
  return items
}
