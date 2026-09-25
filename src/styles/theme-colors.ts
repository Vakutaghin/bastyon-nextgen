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
// (например, в Storybook без глобального CSS). Фолбэки — значения светлой темы.
//
// С редизайна под Nuxt UI (_docs-todo/REDESIGN_NUXT_UI.md) старые `--color-*`
// перенаправлены на семантические `--ui-*`. В новом коде пиши `var(--ui-…)`
// прямо в шаблоне styled-компонента: интерполяция `${COLORS.X}` стоит ошибок
// vue-tsc. Синие ANT_BLUE* и BRAND_CYAN* и шкала GRAY_* удалены: их заменили
// семантические токены с теми же значениями.

export const COLORS = {
  // Основные цвета
  PRIMARY: 'var(--color-primary, #00c16a)',
  PRIMARY_HOVER: 'var(--color-primary-hover, rgb(0 193 106 / 0.75))',
  PRIMARY_ACTIVE: 'var(--color-primary-active, #00a155)',
  PRIMARY_DARK: 'var(--color-primary-dark, #007f45)',
  PRIMARY_LIGHT: 'var(--color-primary-light, rgb(0 193 106 / 0.1))',
  PRIMARY_LIGHT_15: 'var(--color-primary-light-15, rgb(0 193 106 / 0.15))',
  PRIMARY_LIGHT_20: 'var(--color-primary-light-20, rgb(0 193 106 / 0.25))',
  PRIMARY_LIGHT_30: 'var(--color-primary-light-30, rgb(0 193 106 / 0.25))',
  PRIMARY_LIGHT_50: 'var(--color-primary-light-50, rgb(0 193 106 / 0.5))',

  // Бывший синий antd — теперь тот же акцент, что PRIMARY.

  // Бывший «фирменный циан» (PKOIN, мессенджер) — теперь тот же акцент, что PRIMARY.

  // Текст
  TEXT_PRIMARY: 'var(--color-text-primary, #314158)',
  TEXT_SECONDARY: 'var(--color-text-secondary, #62748e)',
  TEXT_MUTED: 'var(--color-text-muted, #90a1b9)',
  TEXT_DARK: 'var(--color-text-dark, #45556c)',
  TEXT_HINT: 'var(--color-text-hint, #90a1b9)',

  // Фоны
  BG_PRIMARY: 'var(--color-bg-primary, #fff)',
  BG_SECONDARY: 'var(--color-bg-secondary, #f8fafc)',
  BG_TERTIARY: 'var(--color-bg-tertiary, #f1f5f9)',
  BG_DISABLED: 'var(--color-bg-disabled, #f1f5f9)',
  BG_LIGHT: 'var(--color-bg-light, #f8fafc)',
  BG_HOVER: 'var(--color-bg-hover, #f1f5f9)',
  BG_HOVER_BLUE: 'var(--color-bg-hover-blue, #f1f5f9)',
  BG_INPUT: 'var(--color-bg-input, #fff)',
  // Полупрозрачная «матовая» поверхность (sticky-бары, backdrop-blur). Флипается.
  SURFACE_FROSTED: 'var(--color-surface-frosted, rgb(255 255 255 / 0.75))',

  // Границы
  BORDER: 'var(--color-border, #cad5e2)',
  BORDER_LIGHT: 'var(--color-border-light, #e2e8f0)',
  BORDER_LIGHTER: 'var(--color-border-lighter, #e2e8f0)',
  BORDER_DEFAULT: 'var(--color-border-default, #cad5e2)',
  BORDER_DARK: 'var(--color-border-dark, #cad5e2)',

  // Состояния
  SUCCESS: 'var(--color-success, #00c16a)',
  SUCCESS_DEEP: 'var(--color-success-deep, #007f45)',
  SUCCESS_BG_SOFT: 'var(--color-success-bg-soft, rgb(0 193 106 / 0.08))',
  SUCCESS_BG_TINT: 'var(--color-success-bg-tint, rgb(0 193 106 / 0.1))',
  SUCCESS_BG_12: 'var(--color-success-bg-12, rgb(0 193 106 / 0.12))',
  SUCCESS_BG_PULSE: 'var(--color-success-bg-pulse, rgb(0 193 106 / 0.4))',
  DANGER: 'var(--color-danger, #fb2c36)',
  DANGER_HOVER: 'var(--color-danger-hover, #e7000b)',
  DANGER_ACTIVE: 'var(--color-danger-active, #c10007)',
  DANGER_DEEP: 'var(--color-danger-deep, #e7000b)',
  DANGER_BG_SOFT: 'var(--color-danger-bg-soft, rgb(251 44 54 / 0.08))',
  WARNING: 'var(--color-warning, #f0b100)',
  WARNING_HEX: 'var(--color-warning-hex, #f0b100)',
  WARNING_YELLOW: 'var(--color-warning-yellow, #f0b100)',
  WARNING_BG_SOFT: 'var(--color-warning-bg-soft, rgb(240 177 0 / 0.12))',
  WARNING_TRACK: 'var(--color-warning-track, rgb(240 177 0 / 0.3))', // пустые звёзды рейтинга
  INFO: 'var(--color-info, #2b7fff)',
  PRIMARY_BG_SOFT: 'var(--color-primary-bg-soft, rgb(0 193 106 / 0.08))',
  PRIMARY_BG_12: 'var(--color-primary-bg-12, rgb(0 193 106 / 0.12))',

  // Акцентные оттенки (бейджи статусов/категорий в хедере). *_SOFT — полупрозрачные
  // фоны пилюль (общие для тем: акцент с альфой читается и на светлом, и на тёмном).
  PURPLE: 'var(--color-purple, #8e51ff)',
  PURPLE_DEEP: 'var(--color-purple-deep, #7008e7)',
  PURPLE_SOFT: 'var(--color-purple-soft, rgb(142 81 255 / 0.12))',
  PINK: 'var(--color-pink, #f6339a)',
  PINK_SOFT: 'var(--color-pink-soft, rgb(246 51 154 / 0.12))',
  GREEN_ANT: 'var(--color-green-ant, #00c16a)',
  GREEN_ANT_DEEP: 'var(--color-green-ant-deep, #007f45)',
  GREEN_ANT_SOFT: 'var(--color-green-ant-soft, rgb(0 193 106 / 0.14))',
  AMBER_SOFT: 'var(--color-amber-soft, rgb(254 154 0 / 0.14))',

  // Красные оттенки (ошибки, удаление)
  RED_ANT: 'var(--color-red-ant, #fb2c36)',
  RED_DARK: 'var(--color-red-dark, #e7000b)',
  RED_BRIGHT: 'var(--color-red-bright, #fb2c36)',
  RED_BG: 'var(--color-red-bg, rgb(251 44 54 / 0.1))',
  RED_BORDER: 'var(--color-red-border, rgb(251 44 54 / 0.25))',

  // Жёлтые/оранжевые оттенки (предупреждения)
  WARNING_BG: 'var(--color-warning-bg, rgb(240 177 0 / 0.1))',
  WARNING_BORDER: 'var(--color-warning-border, rgb(240 177 0 / 0.25))',
  WARNING_TEXT: 'var(--color-warning-text, #a65f00)',
  WARNING_BORDER_LIGHT: 'var(--color-warning-border-light, rgb(240 177 0 / 0.25))',
  WARNING_ICON: 'var(--color-warning-icon, #f0b100)',
  ORANGE_BG: 'var(--color-orange-bg, rgb(240 177 0 / 0.1))',
  ORANGE_BORDER: 'var(--color-orange-border, rgb(240 177 0 / 0.25))',
  ORANGE_TEXT: 'var(--color-orange-text, #a65f00)',

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

  // Тени
  SHADOW_SM: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
  SHADOW_MD: 'var(--shadow-md, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))',
  SHADOW_LG:
    'var(--shadow-lg, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))',

  // Специфические цвета
  LINK: 'var(--color-link, #007f45)',
  DARK_BG: 'var(--color-dark-bg, #0f172b)',
  SLATE: 'var(--color-slate, #62748e)',
  BLUE_GRAY: 'var(--color-blue-gray, #62748e)',
} as const
