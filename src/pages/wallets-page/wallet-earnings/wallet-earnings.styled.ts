import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'

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
  gap: 4px;
  padding: 16px 20px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
`

/** Карточки — как карточки сумм на вкладке «Балансы» (и статистика у Nuxt). */
export const SC_EarningsLabel = styled.span`
  font-size: 14px;
  color: var(--ui-text-muted);
`

export const SC_EarningsValue = styled.span`
  font-size: 20px;
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

/* Путь на страницу «Монетизация»: карточка-ссылка под суммами. */
export const SC_MonetizationBanner = styled(RouterLink)`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid rgb(var(--ui-primary-rgb) / 25%);
  border-radius: var(--ui-radius-lg);
  background: rgb(var(--ui-primary-rgb) / 6%);
  color: inherit;
  text-decoration: none;
  transition: var(--transition-fast);

  &:hover {
    color: inherit;
    border-color: rgb(var(--ui-primary-rgb) / 50%);
    background: rgb(var(--ui-primary-rgb) / 10%);
  }
`

export const SC_MonetizationIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-lg);
  font-size: 20px;
  color: var(--ui-primary);
  background: rgb(var(--ui-primary-rgb) / 14%);
`

export const SC_MonetizationBody = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_MonetizationTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_MonetizationText = styled.span`
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-text-muted);
`

export const SC_MonetizationChevron = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 16px;
  color: var(--ui-text-muted);
`
