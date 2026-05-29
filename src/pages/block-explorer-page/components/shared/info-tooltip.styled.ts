import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_InfoTooltipIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  font-size: 9px;
  font-weight: 700;
  color: ${COLORS.TEXT_MUTED};
  background: ${COLORS.OVERLAY_5};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 50%;
  cursor: help;
  user-select: none;
  vertical-align: middle;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    color: ${COLORS.PRIMARY};
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY_LIGHT_30};
  }
`
