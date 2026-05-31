// Централизованная палитра цветов приложения.
//
// Все цвета — ссылки на CSS-переменные, объявленные в `src/style.css` под
// селекторами `:root` (light) и `:root[data-theme="dark"]` (dark). Это позволяет
// переключать тему одной правкой атрибута `data-theme` без перерисовки
// styled-components.
//
// Хардкод rgb/hex в styled-файлах запрещён — см. stylelint правило
// `declaration-property-value-disallowed-list` в `.stylelintrc.json`.
//
// `var(--color-X, FALLBACK)` — fallback гарантирует, что цвет отображается
// корректно даже если CSS-переменная по какой-то причине не загрузилась
// (например, в Storybook без глобального CSS).

export const COLORS = {
  // Основные цвета
  PRIMARY: 'var(--color-primary, rgb(0, 123, 255))',
  PRIMARY_HOVER: 'var(--color-primary-hover, rgb(0, 105, 217))',
  PRIMARY_ACTIVE: 'var(--color-primary-active, rgb(0, 86, 179))',
  PRIMARY_DARK: 'var(--color-primary-dark, rgb(0, 70, 150))',
  PRIMARY_LIGHT: 'var(--color-primary-light, rgba(0, 123, 255, 0.1))',
  PRIMARY_LIGHT_15: 'var(--color-primary-light-15, rgba(0, 123, 255, 0.15))',
  PRIMARY_LIGHT_20: 'var(--color-primary-light-20, rgba(0, 123, 255, 0.2))',
  PRIMARY_LIGHT_30: 'var(--color-primary-light-30, rgba(0, 123, 255, 0.3))',
  PRIMARY_LIGHT_50: 'var(--color-primary-light-50, rgba(0, 123, 255, 0.5))',

  // Ant Design синий (используется в некоторых компонентах)
  ANT_BLUE: 'var(--color-ant-blue, #1890ff)',
  ANT_BLUE_HOVER: 'var(--color-ant-blue-hover, #40a9ff)',
  ANT_BLUE_LIGHT: 'var(--color-ant-blue-light, #91d5ff)',
  ANT_BLUE_BG: 'var(--color-ant-blue-bg, #e6f7ff)',
  ANT_BLUE_BG_LIGHT: 'var(--color-ant-blue-bg-light, #e6f4ff)',

  // Бренд-акцент (PKOIN / мессенджер) — фирменный циан. Общий для обеих тем.
  BRAND_CYAN: 'var(--color-brand-cyan, #00a4db)',
  BRAND_CYAN_HOVER: 'var(--color-brand-cyan-hover, #0091c2)',
  BRAND_CYAN_LIGHT: 'var(--color-brand-cyan-light, rgba(0, 164, 219, 0.12))',
  BRAND_CYAN_SOFT: 'var(--color-brand-cyan-soft, rgba(0, 164, 219, 0.06))',

  // Текст
  TEXT_PRIMARY: 'var(--color-text-primary, rgb(33, 37, 41))',
  TEXT_SECONDARY: 'var(--color-text-secondary, rgb(108, 117, 125))',
  TEXT_MUTED: 'var(--color-text-muted, rgb(173, 181, 189))',
  TEXT_DARK: 'var(--color-text-dark, rgb(73, 80, 87))',
  TEXT_HINT: 'var(--color-text-hint, rgb(134, 142, 150))',

  // Фоны
  BG_PRIMARY: 'var(--color-bg-primary, rgb(255, 255, 255))',
  BG_SECONDARY: 'var(--color-bg-secondary, rgb(248, 249, 250))',
  BG_TERTIARY: 'var(--color-bg-tertiary, #f5f5f5)',
  BG_DISABLED: 'var(--color-bg-disabled, rgb(233, 236, 239))',
  BG_LIGHT: 'var(--color-bg-light, #f9f9f9)',
  BG_HOVER: 'var(--color-bg-hover, #f0f0f0)',
  BG_HOVER_BLUE: 'var(--color-bg-hover-blue, #f0f7ff)',
  BG_INPUT: 'var(--color-bg-input, #fafafa)',
  // Полупрозрачная «матовая» поверхность (sticky-бары, backdrop-blur). Флипается.
  SURFACE_FROSTED: 'var(--color-surface-frosted, rgba(248, 249, 250, 0.8))',

  // Границы
  BORDER: 'var(--color-border, rgb(206, 212, 218))',
  BORDER_LIGHT: 'var(--color-border-light, rgba(206, 212, 218, 0.5))',
  BORDER_LIGHTER: 'var(--color-border-lighter, rgba(206, 212, 218, 0.3))',
  BORDER_DEFAULT: 'var(--color-border-default, #d9d9d9)',
  BORDER_DARK: 'var(--color-border-dark, rgb(222, 226, 230))',

  // Состояния
  SUCCESS: 'var(--color-success, rgb(40, 167, 69))',
  SUCCESS_DEEP: 'var(--color-success-deep, rgb(34, 120, 60))',
  SUCCESS_BG_SOFT: 'var(--color-success-bg-soft, rgba(40, 167, 69, 0.08))',
  SUCCESS_BG_TINT: 'var(--color-success-bg-tint, rgba(40, 167, 69, 0.1))',
  SUCCESS_BG_12: 'var(--color-success-bg-12, rgba(40, 167, 69, 0.12))',
  SUCCESS_BG_PULSE: 'var(--color-success-bg-pulse, rgba(40, 167, 69, 0.4))',
  DANGER: 'var(--color-danger, rgb(220, 53, 69))',
  DANGER_HOVER: 'var(--color-danger-hover, rgb(200, 35, 51))',
  DANGER_ACTIVE: 'var(--color-danger-active, rgb(180, 20, 35))',
  DANGER_DEEP: 'var(--color-danger-deep, rgb(180, 50, 50))',
  DANGER_BG_SOFT: 'var(--color-danger-bg-soft, rgba(220, 53, 69, 0.08))',
  WARNING: 'var(--color-warning, rgb(255, 193, 7))',
  WARNING_HEX: 'var(--color-warning-hex, #fa8c16)',
  WARNING_YELLOW: 'var(--color-warning-yellow, rgb(245, 180, 0))',
  WARNING_BG_SOFT: 'var(--color-warning-bg-soft, rgba(250, 140, 22, 0.12))',
  WARNING_TRACK: 'var(--color-warning-track, rgba(255, 193, 7, 0.3))', // пустые звёзды рейтинга
  INFO: 'var(--color-info, rgb(23, 162, 184))',
  PRIMARY_BG_SOFT: 'var(--color-primary-bg-soft, rgba(0, 123, 255, 0.08))',
  PRIMARY_BG_12: 'var(--color-primary-bg-12, rgba(0, 123, 255, 0.12))',

  // Акцентные оттенки (бейджи статусов/категорий в хедере). *_SOFT — полупрозрачные
  // фоны пилюль (общие для тем: акцент с альфой читается и на светлом, и на тёмном).
  PURPLE: 'var(--color-purple, #722ed1)',
  PURPLE_DEEP: 'var(--color-purple-deep, #531dab)',
  PURPLE_SOFT: 'var(--color-purple-soft, rgba(114, 46, 209, 0.12))',
  PINK: 'var(--color-pink, #c41d7f)',
  PINK_SOFT: 'var(--color-pink-soft, rgba(235, 47, 150, 0.12))',
  GREEN_ANT: 'var(--color-green-ant, #52c41a)',
  GREEN_ANT_DEEP: 'var(--color-green-ant-deep, #389e0d)',
  GREEN_ANT_SOFT: 'var(--color-green-ant-soft, rgba(82, 196, 26, 0.14))',
  AMBER_SOFT: 'var(--color-amber-soft, rgba(245, 166, 35, 0.14))',

  // Красные оттенки (ошибки, удаление)
  RED_ANT: 'var(--color-red-ant, #ff4d4f)',
  RED_DARK: 'var(--color-red-dark, #cf1322)',
  RED_BRIGHT: 'var(--color-red-bright, #ff3b30)',
  RED_BG: 'var(--color-red-bg, #fff2f0)',
  RED_BORDER: 'var(--color-red-border, #ffccc7)',

  // Жёлтые/оранжевые оттенки (предупреждения)
  WARNING_BG: 'var(--color-warning-bg, #fff3cd)',
  WARNING_BORDER: 'var(--color-warning-border, #ffc107)',
  WARNING_TEXT: 'var(--color-warning-text, #856404)',
  WARNING_BORDER_LIGHT: 'var(--color-warning-border-light, #ffe58f)',
  WARNING_ICON: 'var(--color-warning-icon, #faad14)',
  ORANGE_BG: 'var(--color-orange-bg, #fff7e6)',
  ORANGE_BORDER: 'var(--color-orange-border, #ffd591)',
  ORANGE_TEXT: 'var(--color-orange-text, #d46b08)',

  // Белый с прозрачностью
  WHITE: 'var(--color-white, #ffffff)',
  WHITE_20: 'var(--color-white-20, rgba(255, 255, 255, 0.2))',
  WHITE_60: 'var(--color-white-60, rgba(255, 255, 255, 0.6))',
  WHITE_75: 'var(--color-white-75, rgba(255, 255, 255, 0.75))',
  WHITE_85: 'var(--color-white-85, rgba(255, 255, 255, 0.85))',
  WHITE_95: 'var(--color-white-95, rgba(255, 255, 255, 0.95))',

  // Чёрный с прозрачностью (оверлеи, тени)
  BLACK: 'var(--color-black, #000000)',
  OVERLAY_2: 'var(--color-overlay-2, rgba(0, 0, 0, 0.02))',
  OVERLAY_3: 'var(--color-overlay-3, rgba(0, 0, 0, 0.03))',
  OVERLAY_4: 'var(--color-overlay-4, rgba(0, 0, 0, 0.04))',
  OVERLAY_5: 'var(--color-overlay-5, rgba(0, 0, 0, 0.05))',
  OVERLAY_6: 'var(--color-overlay-6, rgba(0, 0, 0, 0.06))',
  OVERLAY_8: 'var(--color-overlay-8, rgba(0, 0, 0, 0.08))',
  OVERLAY_10: 'var(--color-overlay-10, rgba(0, 0, 0, 0.1))',
  OVERLAY_12: 'var(--color-overlay-12, rgba(0, 0, 0, 0.12))',
  OVERLAY_15: 'var(--color-overlay-15, rgba(0, 0, 0, 0.15))',
  OVERLAY_20: 'var(--color-overlay-20, rgba(0, 0, 0, 0.2))',
  OVERLAY_25: 'var(--color-overlay-25, rgba(0, 0, 0, 0.25))',
  OVERLAY_30: 'var(--color-overlay-30, rgba(0, 0, 0, 0.3))',
  OVERLAY_40: 'var(--color-overlay-40, rgba(0, 0, 0, 0.4))',
  OVERLAY_45: 'var(--color-overlay-45, rgba(0, 0, 0, 0.45))',
  OVERLAY_50: 'var(--color-overlay-50, rgba(0, 0, 0, 0.5))',
  OVERLAY_55: 'var(--color-overlay-55, rgba(0, 0, 0, 0.55))',
  OVERLAY_65: 'var(--color-overlay-65, rgba(0, 0, 0, 0.65))',
  OVERLAY_70: 'var(--color-overlay-70, rgba(0, 0, 0, 0.7))',
  OVERLAY_80: 'var(--color-overlay-80, rgba(0, 0, 0, 0.8))',
  OVERLAY_85: 'var(--color-overlay-85, rgba(0, 0, 0, 0.85))',
  OVERLAY_88: 'var(--color-overlay-88, rgba(0, 0, 0, 0.88))',

  // Серые тона
  GRAY_212: 'var(--color-gray-212, rgb(33, 33, 33))',
  GRAY_120: 'var(--color-gray-120, rgb(120, 120, 120))',
  GRAY_333: 'var(--color-gray-333, #333)',
  GRAY_555: 'var(--color-gray-555, #555)',
  GRAY_666: 'var(--color-gray-666, #666)',
  GRAY_888: 'var(--color-gray-888, #888)',
  GRAY_999: 'var(--color-gray-999, #999)',
  GRAY_AAA: 'var(--color-gray-aaa, #aeb8c2)',
  GRAY_CCC: 'var(--color-gray-ccc, #ccc)',
  GRAY_DDD: 'var(--color-gray-ddd, #ddd)',
  GRAY_EEE: 'var(--color-gray-eee, #eee)',
  GRAY_E0: 'var(--color-gray-e0, #e0e0e0)',
  GRAY_E8: 'var(--color-gray-e8, #e8e8e8)',
  GRAY_F0: 'var(--color-gray-f0, #f0f2f5)',
  GRAY_F1: 'var(--color-gray-f1, #f1f2f4)',

  // Тени
  SHADOW_SM: 'var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1))',
  SHADOW_MD: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15))',
  SHADOW_LG: 'var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.15))',

  // Специфические цвета
  LINK: 'var(--color-link, #007bff)',
  DARK_BG: 'var(--color-dark-bg, #1b1f24)',
  SLATE: 'var(--color-slate, #5c6370)',
  BLUE_GRAY: 'var(--color-blue-gray, #607d8b)',
} as const
