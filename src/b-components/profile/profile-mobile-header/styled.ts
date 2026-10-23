import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/**
 * Шапка профиля на телефоне и планшете: там боковой колонки нет, и без этой
 * шапки на странице не было ни имени, ни «Подписаться» — только посты.
 */
export const SC_MobileHeader = styled.div`
  display: none;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }
`

export const SC_Identity = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const SC_Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

/** Кнопки переносятся на вторую строку, если в ширину не влезают. */
export const SC_Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  & > .grow {
    flex: 1 1 140px;
  }

  & > .icon {
    flex: 0 0 40px;
    min-height: 40px;
  }
`
