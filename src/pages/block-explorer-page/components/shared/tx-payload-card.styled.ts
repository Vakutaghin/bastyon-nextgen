import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_PayloadCard = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary-light-30);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--ui-radius-lg);
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
  background: var(--color-primary-light);
  border-radius: var(--ui-radius-lg);
  color: var(--color-primary);
  font-size: 18px;
  flex-shrink: 0;
`

export const SC_PayloadTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
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
  color: var(--color-text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  align-self: center;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-top: 8px;
  }
`

export const SC_PayloadFieldValue = styled.div`
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

/** Второстепенный текст в значении поля (единица, тип операции). */
export const SC_PayloadMuted = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
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
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary-light-30);
  border-radius: var(--ui-radius-md);
  text-decoration: none;
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-primary-light-15);
    border-color: var(--color-primary-light-50);
  }
`

export const SC_PayloadScore = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-weight: 700;
  font-size: 13px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-radius: var(--ui-radius-md);
  margin-right: 6px;
`

export const SC_PayloadScoreNeg = styled(SC_PayloadScore)`
  color: var(--color-danger);
  background: var(--color-red-bg);
`
