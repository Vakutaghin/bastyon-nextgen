import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_PayloadCard = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-left: 3px solid ${COLORS.PRIMARY};
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 24px;
`

export const SC_PayloadHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`

export const SC_PayloadIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${COLORS.PRIMARY_LIGHT};
  border-radius: 8px;
  color: ${COLORS.PRIMARY};
  font-size: 18px;
  flex-shrink: 0;
`

export const SC_PayloadTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_PayloadFields = styled.div`
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px 16px;
  font-size: 13px;
  margin-bottom: 14px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
    gap: 2px 0;
  }
`

export const SC_PayloadFieldLabel = styled.div`
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  align-self: center;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-top: 8px;
  }
`

export const SC_PayloadFieldValue = styled.div`
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_PayloadActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
`

export const SC_PayloadBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY_LIGHT};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: ${COLORS.PRIMARY_LIGHT_15};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }
`

export const SC_PayloadScore = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-weight: 700;
  font-size: 13px;
  color: ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY_LIGHT};
  border-radius: 6px;
  margin-right: 6px;
`

export const SC_PayloadScoreNeg = styled(SC_PayloadScore)`
  color: ${COLORS.DANGER};
  background: ${COLORS.RED_BG};
`
