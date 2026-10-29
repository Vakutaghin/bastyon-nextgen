import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

/** Вкладки «Обзор» и «Сеть» — как вкладки платных подписок: подчёркивание. */
export const SC_ExplorerTabs = styled.nav`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--ui-border);
`

export const SC_ExplorerTab = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: color ${() => TRANSITIONS.QUICK};

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    color: var(--ui-primary);
    border-bottom-color: var(--ui-primary);
  }
`
