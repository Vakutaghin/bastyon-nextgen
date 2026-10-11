import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'

/*
 * Ссылка на профиль и её замена без ссылки — одной формы: адрес приходит
 * позже имени (диалоги догружаются), и шапка не должна от этого сдвигаться.
 */

export const SC_ProfileLink = styled(RouterLink)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  color: inherit;
  text-decoration: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);

  &.chip {
    padding: 4px 10px 4px 4px;
    margin-left: -4px;
  }

  &:hover {
    color: inherit;
    opacity: 0.85;
  }

  &.chip:hover {
    background: var(--ui-bg-elevated);
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_ProfileStatic = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;

  &.chip {
    padding: 4px 10px 4px 4px;
    margin-left: -4px;
  }
`
