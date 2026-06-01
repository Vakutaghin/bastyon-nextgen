/**
 * Общие styled-примитивы страниц блок-эксплорера (audit §3.1).
 *
 * Раньше дублировались 1:1 в address-page / block-page / tx-page / peers-page /
 * top-addresses-card. Страницы либо ре-экспортируют их as-is, либо расширяют
 * через `styled(SC_Base)` под свою специфику (например, мелкий шрифт плейсхолдера).
 */

import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

// Inline-ссылка (router-link) фирменным цветом без подчёркивания.
export const SC_InlineLink = styled(RouterLink)`
  color: ${COLORS.PRIMARY};
  text-decoration: none;
`

// Плейсхолдер «нет данных» по центру блока.
export const SC_Placeholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
`

// Тот же плейсхолдер, но для ошибки.
export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: ${COLORS.DANGER};
`

// Футер пагинации со ссылкой «показать ещё».
export const SC_LoadMoreFooter = styled.div`
  display: flex;
  justify-content: center;
  padding: 14px 18px;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.PRIMARY};
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover:not(:disabled) {
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  &:disabled {
    color: ${COLORS.TEXT_MUTED};
    background: ${COLORS.BG_DISABLED};
    border-color: ${COLORS.BORDER_LIGHTER};
    cursor: not-allowed;
  }
`
