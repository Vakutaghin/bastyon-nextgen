import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

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
  /* Готовые суммы — outline-кнопки Nuxt; выбранная — soft-акцент. */
  flex: 1;
  min-width: 56px;
  padding: 7px 10px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border-accented);
  background-color: var(--ui-bg);
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    background-color: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  &.active,
  &.active:hover {
    border-color: rgb(var(--ui-primary-rgb) / 25%);
    color: var(--ui-primary);
    background-color: rgb(var(--ui-primary-rgb) / 10%);
  }
`

export const SC_AmountInput = styled.input`
  ${nuxtField}
  /* Сумма — главное поле окна: размер xl (40px, 16px). */
  padding: 9px 12px;
  font-size: 16px;
  font-weight: 500;
`

export const SC_BalanceHint = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

export const SC_FieldError = styled.div`
  font-size: 14px;
  color: var(--color-red-ant);
`

export const SC_OtherWallets = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border);
`

export const SC_OtherWalletsTitle = styled.div`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_WalletRow = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: var(--ui-text-highlighted);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast);

  &:hover {
    border-color: var(--ui-primary);
  }
`

export const SC_WalletCurrency = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-muted);
`

export const SC_WalletAddress = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
`
