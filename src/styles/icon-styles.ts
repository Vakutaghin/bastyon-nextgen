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

// Размеры
export const ICON_SIZE_SM = { fontSize: '14px' } as const
export const ICON_SIZE_MD = { fontSize: '16px' } as const
export const ICON_SIZE_LG = { fontSize: '18px' } as const
export const ICON_SIZE_XL = { fontSize: '20px' } as const
export const ICON_SIZE_XXL = { fontSize: '24px' } as const

// Загрузка (primary spinner — самый частый паттерн)
export const ICON_PRIMARY_24 = { fontSize: '24px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_40 = { fontSize: '40px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_50 = { fontSize: '50px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_64 = { fontSize: '64px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_72 = { fontSize: '72px', color: COLORS.PRIMARY }
export const ICON_PRIMARY_120 = { fontSize: '120px', color: COLORS.PRIMARY }

// Состояния (success/danger без размера — используем дефолт иконки)
export const ICON_SUCCESS = { color: COLORS.SUCCESS }
export const ICON_SUCCESS_64 = { fontSize: '64px', color: COLORS.SUCCESS, marginBottom: '16px' }
export const ICON_DANGER = { color: COLORS.RED_ANT }
export const ICON_DANGER_64 = { fontSize: '64px', color: COLORS.RED_ANT }

// Звёзды (рейтинг / уведомления)
export const ICON_STAR = { color: COLORS.WARNING }
export const ICON_STAR_18 = { color: COLORS.WARNING, fontSize: '18px', marginRight: '4px' }
