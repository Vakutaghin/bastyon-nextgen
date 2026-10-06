import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/**
 * Кнопка «Сервисы» в шапке — заметная, с подписью и акцентным фоном: пункт в
 * левой панели среди фильтров ленты люди не находили.
 */
export const SC_ServicesButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: rgb(var(--ui-primary-rgb) / 10%);
  color: var(--ui-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  & > svg,
  & > .anticon {
    font-size: 18px;
  }

  &:hover,
  &.active {
    background: rgb(var(--ui-primary-rgb) / 18%);
  }

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    padding: 0 7px;
  }
`

/** Узкое окно: только значок, подпись — в подсказке. */
export const SC_ServicesLabel = styled.span`
  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    display: none;
  }
`
