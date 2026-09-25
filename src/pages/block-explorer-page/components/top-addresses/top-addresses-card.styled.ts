import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'
import { SC_Placeholder as SC_PlaceholderBase } from '../shared/explorer-primitives.styled'

export const SC_TopCard = styled.section`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  margin-bottom: 24px;
`

export const SC_TopHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
`

export const SC_TopTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_TopTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_TopHint = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_TopToggle = styled.button`
  background: transparent;
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-md);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary-light-30);
    background: var(--color-primary-light);
  }
`

export const SC_TopRow = styled.div`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 90px 70px;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  font-size: 14px;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-overlay-3);
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 24px minmax(0, 1fr) 60px;

    & > :nth-child(4) {
      display: none;
    }
  }
`

export const SC_TopRank = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const SC_TopVolume = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const SC_TopCount = styled.div`
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
`

// Общий плейсхолдер (audit §3.1) + мелкий шрифт карточки топ-адресов.
export const SC_Placeholder = styled(SC_PlaceholderBase)`
  font-size: 14px;
`
