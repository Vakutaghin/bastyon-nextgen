import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ShareBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    color: ${COLORS.PRIMARY};
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY_LIGHT_30};
  }
`
