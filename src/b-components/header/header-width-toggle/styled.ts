import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_WidthToggleWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color ${() => TRANSITIONS.FAST};
  color: var(--color-text-primary);
  /* Значок — как у соседей в шапке (ICON_SIZE_XL). */
  font-size: 20px;

  &:hover {
    background-color: var(--ui-bg-elevated);
  }

  /* Окно уже колонки — переключать нечего. */
  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    display: none;
  }
`
