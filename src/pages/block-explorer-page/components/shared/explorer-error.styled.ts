/**
 * Стили блока ошибки эксплорера (explorer-error.vue): сообщение + действия
 * «повторить» / «сбросить ноду». Кнопки повторяют вид SC_LoadMoreBtn из
 * explorer-primitives, но компонент самодостаточен — используется на всех
 * страницах эксплорера в местах, где раньше был голый SC_PlaceholderError.
 */

import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
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
  color: ${COLORS.DANGER};
`

export const SC_ExplorerErrorActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
`

export const SC_ExplorerErrorBtn = styled.button`
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

  &:hover {
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  &.secondary {
    color: ${COLORS.TEXT_SECONDARY};
    border-color: ${COLORS.BORDER_LIGHTER};
  }

  &.secondary:hover {
    background: ${COLORS.BG_HOVER};
  }
`
