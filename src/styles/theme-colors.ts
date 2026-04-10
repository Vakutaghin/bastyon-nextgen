// Централизованная палитра цветов приложения
// Все цвета берутся отсюда — хардкод rgb/hex в styled-файлах запрещён

export const COLORS = {
  // Основные цвета
  PRIMARY: 'rgb(0, 123, 255)',
  PRIMARY_HOVER: 'rgb(0, 105, 217)',
  PRIMARY_ACTIVE: 'rgb(0, 86, 179)',
  PRIMARY_DARK: 'rgb(0, 70, 150)',
  PRIMARY_LIGHT: 'rgba(0, 123, 255, 0.1)',
  PRIMARY_LIGHT_15: 'rgba(0, 123, 255, 0.15)',
  PRIMARY_LIGHT_20: 'rgba(0, 123, 255, 0.2)',
  PRIMARY_LIGHT_30: 'rgba(0, 123, 255, 0.3)',
  PRIMARY_LIGHT_50: 'rgba(0, 123, 255, 0.5)',

  // Ant Design синий (используется в некоторых компонентах)
  ANT_BLUE: '#1890ff',
  ANT_BLUE_HOVER: '#40a9ff',
  ANT_BLUE_LIGHT: '#91d5ff',
  ANT_BLUE_BG: '#e6f7ff',
  ANT_BLUE_BG_LIGHT: '#e6f4ff',

  // Текст
  TEXT_PRIMARY: 'rgb(33, 37, 41)',
  TEXT_SECONDARY: 'rgb(108, 117, 125)',
  TEXT_MUTED: 'rgb(173, 181, 189)',
  TEXT_DARK: 'rgb(73, 80, 87)',
  TEXT_HINT: 'rgb(134, 142, 150)',

  // Фоны
  BG_PRIMARY: 'rgb(255, 255, 255)',
  BG_SECONDARY: 'rgb(248, 249, 250)',
  BG_TERTIARY: '#f5f5f5',
  BG_DISABLED: 'rgb(233, 236, 239)',
  BG_LIGHT: '#f9f9f9',
  BG_HOVER: '#f0f0f0',
  BG_HOVER_BLUE: '#f0f7ff',
  BG_INPUT: '#fafafa',

  // Границы
  BORDER: 'rgb(206, 212, 218)',
  BORDER_LIGHT: 'rgba(206, 212, 218, 0.5)',
  BORDER_LIGHTER: 'rgba(206, 212, 218, 0.3)',
  BORDER_DEFAULT: '#d9d9d9',
  BORDER_DARK: 'rgb(222, 226, 230)',

  // Состояния
  SUCCESS: 'rgb(40, 167, 69)',
  DANGER: 'rgb(220, 53, 69)',
  DANGER_HOVER: 'rgb(200, 35, 51)',
  DANGER_ACTIVE: 'rgb(180, 20, 35)',
  WARNING: 'rgb(255, 193, 7)',
  WARNING_HEX: '#fa8c16',
  INFO: 'rgb(23, 162, 184)',

  // Красные оттенки (ошибки, удаление)
  RED_ANT: '#ff4d4f',
  RED_DARK: '#cf1322',
  RED_BRIGHT: '#ff3b30',
  RED_BG: '#fff2f0',
  RED_BORDER: '#ffccc7',

  // Жёлтые/оранжевые оттенки (предупреждения)
  WARNING_BG: '#fff3cd',
  WARNING_BORDER: '#ffc107',
  WARNING_TEXT: '#856404',
  WARNING_BORDER_LIGHT: '#ffe58f',
  WARNING_ICON: '#faad14',
  ORANGE_BG: '#fff7e6',
  ORANGE_BORDER: '#ffd591',
  ORANGE_TEXT: '#d46b08',

  // Белый с прозрачностью
  WHITE: '#ffffff',
  WHITE_20: 'rgba(255, 255, 255, 0.2)',
  WHITE_60: 'rgba(255, 255, 255, 0.6)',
  WHITE_85: 'rgba(255, 255, 255, 0.85)',
  WHITE_95: 'rgba(255, 255, 255, 0.95)',

  // Чёрный с прозрачностью (оверлеи, тени)
  BLACK: '#000000',
  OVERLAY_3: 'rgba(0, 0, 0, 0.03)',
  OVERLAY_5: 'rgba(0, 0, 0, 0.05)',
  OVERLAY_8: 'rgba(0, 0, 0, 0.08)',
  OVERLAY_10: 'rgba(0, 0, 0, 0.1)',
  OVERLAY_12: 'rgba(0, 0, 0, 0.12)',
  OVERLAY_15: 'rgba(0, 0, 0, 0.15)',
  OVERLAY_20: 'rgba(0, 0, 0, 0.2)',
  OVERLAY_30: 'rgba(0, 0, 0, 0.3)',
  OVERLAY_40: 'rgba(0, 0, 0, 0.4)',
  OVERLAY_45: 'rgba(0, 0, 0, 0.45)',
  OVERLAY_50: 'rgba(0, 0, 0, 0.5)',
  OVERLAY_65: 'rgba(0, 0, 0, 0.65)',
  OVERLAY_80: 'rgba(0, 0, 0, 0.8)',
  OVERLAY_85: 'rgba(0, 0, 0, 0.85)',
  OVERLAY_88: 'rgba(0, 0, 0, 0.88)',

  // Серые тона (hex)
  GRAY_333: '#333',
  GRAY_555: '#555',
  GRAY_666: '#666',
  GRAY_888: '#888',
  GRAY_999: '#999',
  GRAY_AAA: '#aeb8c2',
  GRAY_CCC: '#ccc',
  GRAY_DDD: '#ddd',
  GRAY_E0: '#e0e0e0',
  GRAY_E8: '#e8e8e8',
  GRAY_F0: '#f0f2f5',
  GRAY_F1: '#f1f2f4',

  // Тени
  SHADOW_SM: '0 1px 3px rgba(0, 0, 0, 0.1)',
  SHADOW_MD: '0 4px 12px rgba(0, 0, 0, 0.15)',
  SHADOW_LG: '0 8px 24px rgba(0, 0, 0, 0.15)',

  // Специфические цвета
  LINK: '#007bff',
  DARK_BG: '#1b1f24',
  SLATE: '#5c6370',
  BLUE_GRAY: '#607d8b',
} as const
