import styled from 'vue3-styled-components'

export const SC_Earnings = styled.div`
  padding: 8px 0;
`

export const SC_EarningsTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_EarningsCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
`

export const SC_EarningsCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-secondary);
`

export const SC_EarningsLabel = styled.span`
  font-size: 13px;
  color: var(--color-text-secondary);
`

export const SC_EarningsValue = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_EarningsUnit = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-left: 4px;
`

export const SC_EarningsState = styled.div`
  padding: 24px 0;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
`
