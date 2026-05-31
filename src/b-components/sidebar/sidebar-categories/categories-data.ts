export interface Category {
  id: string
  /**
   * i18n-ключ названия категории (для статических категорий из этого файла).
   * Резолвится через t() в компоненте-потребителе.
   */
  labelKey?: string
  /**
   * Сырое название (для кастомных/временных категорий, созданных пользователем
   * во время работы приложения — там лежит введённый тег, а не ключ).
   */
  name?: string
  icon: string
  tags: string[]
}

export const categoriesData: Category[] = [
  {
    id: 'c7',
    labelKey: 'sidebarData.categories.auto',
    icon: '🏎️',
    tags: [
      'auto',
      'racing'
    ]
  },
  {
    id: 'c55',
    labelKey: 'sidebarData.categories.religion',
    icon: '🛐',
    tags: [
      'вера',
      'религия'
    ]
  },
  {
    id: 'c14',
    labelKey: 'sidebarData.categories.stories',
    icon: '🔖',
    tags: [
      'истории'
    ]
  },
  {
    id: 'c9',
    labelKey: 'sidebarData.categories.games',
    icon: '🎮',
    tags: [
      'игры'
    ]
  },
  {
    id: 'c11',
    labelKey: 'sidebarData.categories.artMusic',
    icon: '🎨',
    tags: [
      'искусство',
      'музыка'
    ]
  },
  {
    id: 'c13',
    labelKey: 'sidebarData.categories.history',
    icon: '📜',
    tags: [
      'история'
    ]
  },
  {
    id: 'c15',
    labelKey: 'sidebarData.categories.cinema',
    icon: '🎬',
    tags: [
      'кино',
      'анимация'
    ]
  },
  {
    id: 'c10',
    labelKey: 'sidebarData.categories.space',
    icon: '🚀',
    tags: [
      'космос'
    ]
  },
  {
    id: 'c4',
    labelKey: 'sidebarData.categories.crypto',
    icon: '₿',
    tags: [
      'Криптовалюта'
    ]
  },
  {
    id: 'c2',
    labelKey: 'sidebarData.categories.memes',
    icon: '😂',
    tags: [
      'мемы',
      'юмор'
    ]
  },
  {
    id: 'c5',
    labelKey: 'sidebarData.categories.science',
    icon: '🔬',
    tags: [
      'технологии',
      'наука'
    ]
  },
  {
    id: 'c12',
    labelKey: 'sidebarData.categories.news',
    icon: '📰',
    tags: [
      'новости',
      'комментарии'
    ]
  },
  {
    id: 'c3',
    labelKey: 'sidebarData.categories.politics',
    icon: '⚖️',
    tags: [
      'политика'
    ]
  },
  {
    id: 'c16',
    labelKey: 'sidebarData.categories.nature',
    icon: '🐾',
    tags: [
      'Природа',
      'животные'
    ]
  },
  {
    id: 'c17',
    labelKey: 'sidebarData.categories.travel',
    icon: '🗺️',
    tags: [
      'путешествия',
      'архитектура'
    ]
  },
  {
    id: 'c18',
    labelKey: 'sidebarData.categories.diy',
    icon: '🔨',
    tags: [
      'сделайсам'
    ]
  },
  {
    id: 'c8',
    labelKey: 'sidebarData.categories.sport',
    icon: '⚽',
    tags: [
      'спорт'
    ]
  },
  {
    id: 'c6',
    labelKey: 'sidebarData.categories.finance',
    icon: '💰',
    tags: [
      'финансы',
      'инвестиции'
    ]
  }
]
