import styled from 'vue3-styled-components'

export const SC_SecurityCard = styled.div`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_SecurityLevel = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_SecurityDesc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);

  &.warn {
    color: var(--color-danger);
  }
`

export const SC_SecurityForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_SecurityWarning = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-danger);
`

export const SC_SecurityFieldError = styled.div`
  font-size: 12px;
  color: var(--color-danger);
`
