/**
 * Общие styled-примитивы страниц блок-эксплорера (audit §3.1).
 *
 * Раньше дублировались 1:1 в address-page / block-page / tx-page / peers-page /
 * top-addresses-card. Страницы либо ре-экспортируют их as-is, либо расширяют
 * через `styled(SC_Base)` под свою специфику (например, мелкий шрифт плейсхолдера).
 */

import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { TRANSITIONS } from '@/styles/design-tokens'

// Inline-ссылка (router-link) фирменным цветом без подчёркивания.
export const SC_InlineLink = styled(RouterLink)`
  color: var(--color-primary);
  text-decoration: none;
`

// Плейсхолдер «нет данных» по центру блока.
export const SC_Placeholder = styled.div`
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
`

// Тот же плейсхолдер, но для ошибки.
export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: var(--color-danger);
`

// Футер пагинации со ссылкой «показать ещё».
export const SC_LoadMoreFooter = styled.div`
  display: flex;
  justify-content: center;
  padding: 14px 18px;
  border-top: 1px solid var(--color-border-lighter);
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary-light-30);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover:not(:disabled) {
    background: var(--color-primary-light);
    border-color: var(--color-primary-light-50);
  }

  &:disabled {
    color: var(--color-text-muted);
    background: var(--color-bg-disabled);
    border-color: var(--color-border-lighter);
    cursor: not-allowed;
  }
`
