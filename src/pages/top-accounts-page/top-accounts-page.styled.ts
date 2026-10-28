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

/** Поиск по топу над списком. */
export const SC_TopFilter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 420px;
  margin-bottom: 16px;
`

export const SC_FilterHint = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Строка: ссылка на профиль и рядом кнопка подписки. */
export const SC_TopItem = styled.li`
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ui-border);
  transition: background-color var(--transition-fast);

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: var(--ui-bg-elevated);
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
  flex: 1;
  min-width: 0;
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

export const SC_FollowCell = styled.span`
  flex-shrink: 0;
  padding-right: 16px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding-right: 12px;
  }
`

/** «Подписаться» / «Вы подписаны»; на телефоне — только значок. */
export const SC_FollowButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 132px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ui-primary);
  border-radius: var(--ui-radius-md);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--ui-primary-strong);
    border-color: var(--ui-primary-strong);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  &.subscribed {
    border-color: var(--ui-border-accented);
    background: var(--ui-bg);
    color: var(--ui-text);
  }

  &.subscribed:hover:not(:disabled) {
    background: var(--ui-bg-muted);
    border-color: var(--ui-border-accented);
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    min-width: 0;
    width: 32px;
    padding: 0;

    .label {
      display: none;
    }
  }
`

/** Невидимая метка в конце списка: дошли до неё — показываем следующие строки. */
export const SC_Sentinel = styled.li`
  height: 1px;
`
