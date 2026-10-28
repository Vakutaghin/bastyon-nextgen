import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_TopWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_TopPage = styled.main`
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: calc(var(--header-height-total) + 28px) 24px 48px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: calc(var(--header-height-total) + 16px) 16px 32px;
  }
`

export const SC_TopTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: var(--ui-text-highlighted);
`

export const SC_TopNote = styled.p`
  margin: 0 0 20px;
  font-size: 14px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_TopStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 0;
  color: var(--ui-text-muted);
`

export const SC_TopList = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_TopItem = styled.li`
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: 0;
  }

  &.me {
    background: rgb(var(--ui-primary-rgb) / 6%);
  }
`

/** Строка — ссылка на профиль целиком: место, аватар, имя со сведениями, репутация. */
const ROW = `
  display: grid;
  grid-template-columns: 40px 40px minmax(0, 1fr) 120px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: inherit;
  text-decoration: none;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 28px 36px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 10px 12px;
  }
`

export const SC_TopRow = styled.a`
  ${() => ROW}
  transition: background-color var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

/** Та же сетка без ссылки — строки-заготовки, пока топ собирается. */
export const SC_TopRowStatic = styled.div`
  ${() => ROW}
`

export const SC_Rank = styled.span`
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ui-text-muted);

  &.podium {
    color: var(--ui-text-highlighted);
  }
`

export const SC_Who = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_Name = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--ui-text-highlighted);

  .name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SC_You = styled.span`
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: var(--ui-radius-full);
  background: rgb(var(--ui-primary-rgb) / 12%);
  color: var(--ui-primary-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
`

export const SC_Meta = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Число и подпись под ним. */
export const SC_Metric = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  min-width: 0;

  .metric-value {
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-highlighted);
    white-space: nowrap;
  }

  .metric-label {
    font-size: 11px;
    color: var(--ui-text-dimmed);
  }
`

/** Невидимая метка в конце списка: дошли до неё — показываем следующие строки. */
export const SC_Sentinel = styled.li`
  height: 1px;
`
