/**
 * Готовые `:style`-объекты для AntDesign-иконок.
 *
 * Иконки `@ant-design/icons-vue` управляют размером и цветом через inline-style;
 * styled-обёртка ломает их собственную типографику. Поэтому конвенция:
 * вместо `:style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }"` — импорт
 * готового объекта из этого модуля.
 *
 * Если нужно динамическое значение — собирай объект в setup() и используй
 * `:style="computedIconStyle"`, ссылаясь на эти константы как на базу.
 */

import { COLORS } from './theme-colors'

export const ICON_SIZE_10 = { fontSize: '10px' } as const
export const ICON_SIZE_11 = { fontSize: '11px' } as const
export const ICON_SIZE_XS = { fontSize: '12px' } as const
export const ICON_SIZE_13 = { fontSize: '13px' } as const
export const ICON_SIZE_SM = { fontSize: '14px' } as const
export const ICON_SIZE_MD = { fontSize: '16px' } as const
export const ICON_SIZE_LG = { fontSize: '18px' } as const
export const ICON_SIZE_XL = { fontSize: '20px' } as const
export const ICON_SIZE_XXL = { fontSize: '24px' } as const

// Загрузка (primary spinner — самый частый паттерн)
export const ICON_PRIMARY_24 = { fontSize: '24px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_40 = { fontSize: '40px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_50 = { fontSize: '50px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_120 = { fontSize: '120px', color: COLORS.PRIMARY }

// Акцент (hero-иконки загрузчика видео)
export const ICON_PRIMARY_64 = { fontSize: '64px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_64_MB = {
  fontSize: '64px',
  color: COLORS.PRIMARY,
  marginBottom: '16px',
}
export const ICON_PRIMARY_72 = { fontSize: '72px', color: COLORS.PRIMARY }

// Состояния (success/danger без размера — используем дефолт иконки)
export const ICON_SUCCESS = { color: COLORS.SUCCESS }
export const ICON_SUCCESS_64 = { fontSize: '64px', color: COLORS.SUCCESS, marginBottom: '16px' }
export const ICON_DANGER = { color: COLORS.RED_ANT }
export const ICON_DANGER_MR_8 = { color: COLORS.RED_ANT, marginRight: '8px' }
export const ICON_DANGER_64 = { fontSize: '64px', color: COLORS.RED_ANT }
export const ICON_PRIMARY_18 = { fontSize: '18px', color: COLORS.PRIMARY }

// Warning (универсальный жёлтый — рейтинги, alerts)
export const ICON_WARNING = { color: COLORS.WARNING }
// Ant warning icon с фиксированным размером для шапок модалок (#faad14 — стандартный ant warning).
export const ICON_WARNING_24 = { fontSize: '24px', color: '#faad14' }

export const ICON_STAR_18 = { color: COLORS.WARNING, fontSize: '18px', marginRight: '4px' }

// Danger (ant-red) с фиксированным размером для шапок модалок подтверждения
export const ICON_DANGER_24 = { fontSize: '24px', color: COLORS.RED_ANT }

// Warning-icon (#faad14) нестандартного размера
export const ICON_WARNING_ICON_22 = { fontSize: '22px', color: COLORS.WARNING_ICON }
// Трек пустой звезды рейтинга
export const ICON_WARNING_TRACK = { color: COLORS.WARNING_TRACK }

// Акцент 16px (спиннер загрузки комментариев); 18px — ICON_PRIMARY_18
export const ICON_PRIMARY_16 = { fontSize: '16px', color: COLORS.PRIMARY }

// Полупрозрачный тёмный (книжная иконка в шапке поста)
export const ICON_OVERLAY_45_18 = { fontSize: '18px', color: COLORS.OVERLAY_45 }

// Белые иконки оверлеев видеоплеера / бейджей аватара
export const ICON_WHITE_9 = { fontSize: '9px', color: COLORS.WHITE }
export const ICON_WHITE_10 = { fontSize: '10px', color: COLORS.WHITE }
export const ICON_WHITE_64 = { fontSize: '64px', color: COLORS.WHITE }
export const ICON_WHITE_85_48 = { fontSize: '48px', color: COLORS.WHITE_85 }
// Play/pause, мелькающие поверх видео: светлые в обеих темах. Раньше были
// «цветом рамки», который в тёмной теме почти чёрный, — на видео не видно.
export const ICON_WHITE_85_24 = { fontSize: '24px', color: COLORS.WHITE_85 }
// Приглушённая иконка mute видеоплеера (под крестом)
export const ICON_MUTED_18 = {
  fontSize: '18px',
  color: COLORS.TEXT_MUTED,
  position: 'relative',
  zIndex: 0,
} as const

// Danger-иконка плейсхолдера ошибки ленты (крупная, с отступом снизу)
export const ICON_DANGER_30_MB = { fontSize: '30px', marginBottom: '15px', color: COLORS.DANGER }
