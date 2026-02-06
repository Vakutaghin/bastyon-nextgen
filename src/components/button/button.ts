import { computed } from 'vue'
import { SC_ButtonMore } from './styled'
import type { ButtonProps } from './types'

export function useButton(p: ButtonProps) {
  // Маппинг старого типа 'default' на 'secondary' для обратной совместимости
  const buttonType = computed(() => {
    if (p.type === 'default') {
      return 'secondary'
    }

    return p.type || 'secondary'
  })

  const buttonClass = computed(() => {
    const classes = ['bastyon-button']

    // Определяем основной тип кнопки
    if (buttonType.value === 'primary') {
      classes.push('bastyon-button-primary')
    } else if (buttonType.value === 'secondary') {
      classes.push('bastyon-button-secondary')
    } else if (buttonType.value === 'danger') {
      // Если type="danger", это secondary с danger стилями
      classes.push('bastyon-button-secondary')
      classes.push('bastyon-button-danger')
    }

    // Если есть проп danger, добавляем класс danger
    if (p.danger && buttonType.value !== 'danger') {
      classes.push('bastyon-button-danger')
    }

    if (p.loading) {
      classes.push('bastyon-button-loading')
    }

    return classes.join(' ')
  })

  const buttonProps = computed(() => ({
    size: p.size || 'middle',
    disabled: p.disabled || p.loading,
    block: p.block,
    htmlType: p.htmlType || 'button'
  }))

  return {
    SC_ButtonMore,
    buttonProps,
    buttonClass
  }
}
