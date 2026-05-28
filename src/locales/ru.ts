/**
 * Русский словарь интерфейса. Источник истины — этот файл; en.ts должен иметь
 * симметричную структуру ключей.
 *
 * Структура: первый уровень — домен (routes, common, app, ...), глубже — конкретные строки.
 * Для добавления новой строки: добавить ключ сюда, продублировать в en.ts.
 */

export default {
  app: {
    name: 'Bastyon',
  },
  routes: {
    home: 'Главная',
    settings: 'Настройки',
    limits: 'Лимиты',
    wallets: 'Кошельки',
    'my-videos': 'Мои видео',
    explorer: 'Блок-эксплорер',
    'explorer-block': 'Блок',
    'explorer-tx': 'Транзакция',
    'explorer-address': 'Адрес',
    'explorer-peers': 'Пиры сети',
    search: 'Поиск',
    miniapps: 'Мини-приложения',
    'mini-app': 'Мини-приложение',
    profile: 'Профиль',
  },
  language: {
    label: 'Язык',
    ru: 'Русский',
    en: 'English',
  },
} as const
