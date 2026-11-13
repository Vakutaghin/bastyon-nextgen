import styled from 'vue3-styled-components'

export const SC_DevUiPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 48px;
`

export const SC_DevUiTitle = styled.h1`
  margin: 24px 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_DevUiLead = styled.p`
  margin: 0 0 24px;
  color: var(--ui-text-muted);
`

export const SC_DevUiSection = styled.section`
  margin-bottom: 32px;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
`

export const SC_DevUiSectionTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

/** Строка образцов: подпись слева, образцы с переносом. */
export const SC_DevUiRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--ui-border);

  &:first-of-type {
    border-top: 0;
  }
`

export const SC_DevUiRowLabel = styled.span`
  flex: 0 0 120px;
  font-size: 13px;
  color: var(--ui-text-dimmed);
`
