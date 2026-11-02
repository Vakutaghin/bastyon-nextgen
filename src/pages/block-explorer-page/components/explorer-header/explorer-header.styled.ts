import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

/** Вкладки «Обзор» и «Сеть» — как вкладки платных подписок: подчёркивание. */
export const SC_ExplorerTabs = styled.nav`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--ui-border);
  /* Четыре вкладки на узком телефоне не помещаются — листаются вбок. */
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const SC_ExplorerTab = styled.a`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
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
