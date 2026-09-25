import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_InfoPanel = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: ${BREAKPOINTS.DESKTOP}) {
    grid-template-columns: 1fr;
  }
`

export const SC_InfoSection = styled.div`
  background: var(--color-bg-input);
  border: 1px solid var(--color-gray-e8);
  border-radius: var(--ui-radius-lg);
  padding: 16px;
  box-sizing: border-box;
`

export const SC_SectionHeader = styled.div`
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-gray-e8);
`

export const SC_SectionTitle = styled.h4`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_InfoContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 16px;
`

export const SC_InfoLabel = styled.span`
  color: var(--color-text-secondary);
  font-weight: 500;
  flex-shrink: 0;
  margin-right: 12px;
`

export const SC_InfoValue = styled.span`
  color: var(--color-text-primary);
  text-align: right;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
`

export const SC_TranscoderBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: var(--ui-radius-sm);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
`
