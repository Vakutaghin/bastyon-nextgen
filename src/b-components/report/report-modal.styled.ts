import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ReportBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const SC_ReportIntro = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_ReasonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const reasonProps = { active: Boolean, danger: Boolean }

export const SC_ReasonItem = styled('button', reasonProps)`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  font-size: 15px;
  line-height: 1.3;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.active ? COLORS.PRIMARY : COLORS.BORDER)};
  background: ${(p) => (p.active ? COLORS.PRIMARY_LIGHT : COLORS.BG_PRIMARY)};
  color: ${(p) => (p.danger ? COLORS.DANGER : COLORS.TEXT_PRIMARY)};
  transition:
    border-color ${TRANSITIONS.FAST},
    background-color ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    border-color: ${COLORS.PRIMARY};
    background: ${COLORS.PRIMARY_LIGHT};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_ReasonRadio = styled.span`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${COLORS.BORDER};
  position: relative;

  &.checked {
    border-color: ${COLORS.PRIMARY};
  }

  &.checked::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: ${COLORS.PRIMARY};
  }
`

export const SC_FieldError = styled.div`
  font-size: 13px;
  color: ${COLORS.DANGER};
`
