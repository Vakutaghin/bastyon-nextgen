import styled from 'vue3-styled-components'

export const SC_DonateBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const SC_Recipient = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);

  strong {
    color: var(--color-text-primary);
    word-break: break-all;
  }
`

export const SC_PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_PresetBtn = styled.button`
  flex: 1;
  min-width: 56px;
  padding: 8px 10px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s,
    background-color 0.2s;

  &:hover {
    border-color: var(--color-brand-cyan);
    color: var(--color-brand-cyan);
  }

  &.active {
    border-color: var(--color-brand-cyan);
    color: var(--color-brand-cyan);
    background-color: var(--color-brand-cyan-light);
  }
`

export const SC_AmountInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-frosted);
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--color-brand-cyan);
  }
`

export const SC_BalanceHint = styled.div`
  font-size: 12px;
  color: var(--color-gray-999);
`

export const SC_FieldError = styled.div`
  font-size: 13px;
  color: var(--color-red-ant);
`
