import type { SidebarItemId } from '@/stores/header-layout'

/**
 * Разделы левой панели в порядке по умолчанию. `key` — имя раздела в
 * раскладке (Настройки → «Шапка и панели»), `id` — номер вкладки в
 * filters-store и адресе.
 */
export const tabsData: {
  id: number
  key: SidebarItemId
  labelKey: string
  icon: string
  active: boolean
  disabled: boolean
}[] = [
  {
    id: 1,
    key: 'feed',
    labelKey: 'sidebarData.tabs.feed',
    icon: 'HomeOutlined',
    active: true,
    disabled: false,
  },
  {
    id: 2,
    key: 'subscriptions',
    labelKey: 'sidebarData.tabs.subscriptions',
    icon: 'TeamOutlined',
    active: false,
    disabled: true,
  },
  {
    id: 3,
    key: 'video',
    labelKey: 'sidebarData.tabs.video',
    icon: 'PlayCircleOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 4,
    key: 'audio',
    labelKey: 'sidebarData.tabs.audio',
    icon: 'SoundOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 5,
    key: 'articles',
    labelKey: 'sidebarData.tabs.articles',
    icon: 'FileTextOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 6,
    key: 'favorites',
    labelKey: 'sidebarData.tabs.favorites',
    icon: 'BookOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 12,
    key: 'collections',
    labelKey: 'sidebarData.tabs.collections',
    icon: 'CollectionIcon',
    active: false,
    disabled: false,
  },
  {
    id: 7,
    key: 'discussed',
    labelKey: 'sidebarData.tabs.discussed',
    icon: 'StarOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 8,
    key: 'miniApps',
    labelKey: 'sidebarData.tabs.miniApps',
    icon: 'AppstoreOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 11,
    key: 'topAccounts',
    labelKey: 'sidebarData.tabs.topAccounts',
    icon: 'TrophyOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 9,
    key: 'explorer',
    labelKey: 'sidebarData.tabs.explorer',
    icon: 'BlockOutlined',
    active: false,
    disabled: false,
  },
  {
    id: 10,
    key: 'help',
    labelKey: 'sidebarData.tabs.help',
    icon: 'HelpBookIcon',
    active: false,
    disabled: false,
  },
]
