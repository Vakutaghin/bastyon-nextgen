import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { SC_TopHeader, SC_TopToggle } from '../top-addresses/top-addresses-card.styled'

// Рамка, заголовок, номер места — как у «Активных адресов».
export {
  SC_TopCard as SC_WalletsCard,
  SC_TopTitleGroup as SC_WalletsTitleGroup,
  SC_TopTitle as SC_WalletsTitle,
  SC_TopHint as SC_WalletsHint,
  SC_TopRank as SC_WalletsRank,
  SC_Placeholder as SC_WalletsPlaceholder,
} from '../top-addresses/top-addresses-card.styled'

export const SC_WalletsHeader = styled(SC_TopHeader)`
  gap: 12px;
`

// На узком телефоне «Показать все (97)» не переносится, подпись слева ужимается.
export const SC_WalletsToggle = styled(SC_TopToggle)`
  flex-shrink: 0;
  white-space: nowrap;
`

export const SC_WalletsNote = styled.p`
  margin: 0;
  padding: 10px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  font-size: 12px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--color-text-secondary);
  background: var(--color-overlay-3);
`

/** Место · кошелёк (адрес, имя, пометки) · баланс и доля эмиссии. */
export const SC_WalletsRow = styled.div`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
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

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 22px minmax(0, 1fr) auto;
    gap: 8px;
    padding: 10px 12px;
  }
`

export const SC_WalletsMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_WalletsMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_WalletsName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

/** Пометка «стейкинг: N из M» или «активный адрес». */
export const SC_WalletsTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--ui-radius-sm);
  font-size: 11px;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-overlay-3);

  &.staker {
    color: var(--ui-success);
    background: rgb(var(--ui-success-rgb) / 12%);
  }
`

export const SC_WalletsAmount = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const SC_WalletsBalance = styled.span`
  font-weight: 600;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 13px;
  }
`

export const SC_WalletsShare = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`
