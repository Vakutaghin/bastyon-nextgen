import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

export const SC_PaidWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_PaidPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 24px;
`

export const SC_PaidTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 24px 0 16px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 20px;
    margin: 16px 0 12px;
  }
`

export const SC_PaidTabs = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--ui-border);
`

export const SC_PaidTab = styled.button`
  padding: 10px 14px;
  margin-bottom: -1px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    color: var(--ui-primary);
    border-bottom-color: var(--ui-primary);
  }
`

export const SC_PaidSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
`

export const SC_PaidSectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_PaidLead = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_PaidCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px 18px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 14px;
  }
`

// ── Цена ───────────────────────────────────────────────────────────────

export const SC_PriceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
`

export const SC_PriceField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_PriceInput = styled.input`
  ${nuxtField}
  width: 140px;
  font-size: 16px;
  font-weight: 600;
`

export const SC_PriceTerms = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 13px;
  color: var(--ui-text-muted);

  strong {
    color: var(--ui-text-highlighted);
    font-weight: 600;
  }
`

export const SC_PriceActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_PriceState = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ui-text);

  strong {
    font-weight: 600;
    color: var(--ui-text-highlighted);
  }

  &.pending {
    color: var(--ui-text-muted);
  }
`

export const SC_FieldError = styled.div`
  font-size: 13px;
  color: var(--color-red-ant);
`

// ── Сводка ─────────────────────────────────────────────────────────────

export const SC_Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`

export const SC_Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
`

export const SC_StatLabel = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_StatValue = styled.span`
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

// ── Список ─────────────────────────────────────────────────────────────

export const SC_List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_Row = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  min-width: 0;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-wrap: wrap;
  }
`

export const SC_RowMain = styled.div`
  flex: 1 1 220px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`

export const SC_RowNameLink = styled(RouterLink)`
  min-width: 0;
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--ui-primary);
  }
`

export const SC_RowName = styled.span`
  font-weight: 600;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_RowMeta = styled.span`
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_RowWarning = styled.span`
  font-size: 12px;
  color: var(--ui-warning);
`

/** Статус срока: действует — зелёный, закончился — приглушённый. */
export const SC_Term = styled.span`
  flex: 0 0 auto;
  padding: 3px 10px;
  border-radius: var(--ui-radius-full);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);

  &.active {
    background: rgb(var(--ui-success-rgb) / 12%);
    color: var(--ui-success-deep);
  }
`

export const SC_RowAction = styled.button`
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }
`

export const SC_Empty = styled.div`
  padding: 24px 16px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-lg);
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  text-align: center;
`

export const SC_Collapse = styled.button`
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--ui-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
`
