// Меню «⋯» у играющей очереди (мини-плеер, «Далее» на странице поста):
// «Открыть плейлист», если известно, откуда очередь, и «Закрыть» — отдельно
// от кнопок управления, чтобы не закрыть очередь случайно.

import { h, type Component } from 'vue'
import type { MenuProps } from 'ant-design-vue'
import { AudioPlaylistIcon } from '@/components/icons'

export function playlistMenuItems(options: {
  /** Подпись «Открыть плейлист»; null — источника нет, пункта нет. */
  openLabel: string | null
  closeLabel: string
  closeIcon: Component
}): NonNullable<MenuProps['items']> {
  const items: NonNullable<MenuProps['items']> = []
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
