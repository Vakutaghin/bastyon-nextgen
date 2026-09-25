/**
 * Стили блока ошибки эксплорера (explorer-error.vue): сообщение + действия
 * «повторить» / «сбросить ноду». Кнопки повторяют вид SC_LoadMoreBtn из
 * explorer-primitives, но компонент самодостаточен — используется на всех
 * страницах эксплорера в местах, где раньше был голый SC_PlaceholderError.
 */

import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ExplorerError = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
`

export const SC_ExplorerErrorMessage = styled.div`
  color: var(--color-danger);
`

export const SC_ExplorerErrorActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
`

export const SC_ExplorerErrorBtn = styled.button`
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary-light-30);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary-light-50);
  }

  &.secondary {
    color: var(--color-text-secondary);
    border-color: var(--color-border-lighter);
  }

  &.secondary:hover {
    background: var(--color-bg-hover);
  }
`
