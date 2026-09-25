// Стили вкладки «Балансы» (карточки сумм, таблицы кошельков, диалог переименования).
// Перенесены из wallets-page.styled.ts вместе с выделением саб-компонента.
import styled from 'vue3-styled-components'
import { BORDER_RADIUS, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

export const SC_WalletLabel = styled.span`
  display: inline-block;
  margin-right: 8px;
  padding: 1px 7px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
`

export const SC_WalletRenameBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 2px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color ${TRANSITIONS.FAST};

  &:hover {
    color: var(--color-primary);
  }
`

export const SC_RenameOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z_INDEX.MODAL};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-overlay-55);
`

export const SC_RenameDialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 360px;
  padding: 18px;
  border-radius: ${BORDER_RADIUS.LG};
  background: var(--color-bg-primary);
`

export const SC_RenameTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_RenameInput = styled.input`
  ${nuxtField}
`

export const SC_RenameActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_RenameBtn = styled('button', { primary: Boolean })`
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  border: 0;
  box-shadow: ${(p) => (p.primary ? 'none' : 'inset 0 0 0 1px var(--ui-border-accented)')};
  background: ${(p) => (p.primary ? 'var(--ui-primary)' : 'var(--ui-bg)')};
  color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  /* Как у Nuxt UI: сплошная — акцент на 75%, контурная — подложка. */
  &:hover {
    background: ${(p) =>
      p.primary ? 'rgb(var(--ui-primary-rgb) / 75%)' : 'var(--ui-bg-elevated)'};
    color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  }
`

/** Три суммы в ряд на широком экране, одна колонка на телефоне: раньше карточки
 * стояли по 33% без переноса, и длинные подписи вылезали за край. */
export const SC_WalletBalanceCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
`

/** Карточка суммы — как карточка статистики у Nuxt UI (и в эксплорере). */
export const SC_WalletBalanceCard = styled.div`
  min-width: 0;
  padding: 16px 20px;
  background: var(--ui-bg);
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-border);
`

export const SC_WalletBalanceLabel = styled.div`
  font-size: 14px;
  color: var(--ui-text-muted);
  margin-bottom: 4px;
`

export const SC_WalletBalanceValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_WalletTableSection = styled.section`
  margin-top: 8px;
`

export const SC_WalletTableSectionSecondary = styled.section`
  margin-top: 24px;
`

export const SC_WalletTableTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 12px;
  gap: 12px;
`

/** Пояснение под заголовком доп. кошельков: почему они только для просмотра. */
export const SC_WalletReadOnlyNote = styled.p`
  font-size: 14px;
  line-height: 1.4;
  color: var(--color-text-secondary);
  margin: 0 10px 12px;
`

export const SC_WalletTableTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 10px;
`

export const SC_WalletTable = styled.div`
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_WalletTableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid var(--color-overlay-6);
  background: var(--color-bg-primary);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_WalletTableHeader = styled(SC_WalletTableRow)`
  /* Шапка как у UTable: без заливки, 14px/600 цвета заголовков. Подписи
     колонок набраны обычным шрифтом, а не моноширинным, как адреса. */
  background: var(--ui-bg);
  font-weight: 600;
  color: var(--ui-text-highlighted);

  & > span {
    font-family: inherit;
    font-size: 14px;
    font-weight: inherit;
    color: inherit;
  }
`

export const SC_WalletTableAddress = styled.span`
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--ui-text-highlighted);
  word-break: break-all;
`

export const SC_WalletAddressCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const SC_WalletExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--ui-text-muted);
  cursor: pointer;
  border-radius: var(--ui-radius-sm);
  flex-shrink: 0;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};
  text-decoration: none;

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-bg-soft);
  }
`

export const SC_WalletTableBalance = styled.span`
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_WalletLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--ui-text-muted);
`

export const SC_WalletError = styled.div`
  padding: 24px;
  background: var(--color-danger-bg-soft);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  color: var(--color-danger-deep);
`
