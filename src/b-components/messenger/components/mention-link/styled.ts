import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'

/* «@имя» в строке текста: цветом ссылки, без подчёркивания; своё — подсвечено. */
export const SC_Mention = styled(RouterLink)`
  color: var(--ui-primary);
  font-weight: 600;
  text-decoration: none;
  border-radius: var(--ui-radius-xs);
  overflow-wrap: anywhere;
  cursor: pointer;

  &:hover {
    color: var(--ui-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &.me {
    padding: 0 2px;
    background: rgb(var(--ui-primary-rgb) / 14%);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 1px;
  }
`
