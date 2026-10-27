import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

/**
 * Шапка профиля на телефоне и планшете: там боковой колонки нет. Здесь —
 * главное из неё: имя, отметки, счётчики, начало «О себе» и кнопки; остальное
 * — в «Подробнее» (profile-info-sheet).
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

/** Имя и отметки под ним. */
export const SC_IdentityText = styled.div`
  display: flex;
  flex-direction: column;
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

/**
 * Репутация, подписчики, подписки — как в колонке, в одну строку. По центру:
 * у кнопок-счётчиков есть поле, у репутации нет, и подписи стояли вразнобой.
 */
export const SC_Stats = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  & > * {
    flex: 1 1 0;
    min-width: 0;
  }
`

/** Начало «О себе» — три строки. */
export const SC_About = styled.div`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;

  a {
    color: var(--ui-primary);
    text-decoration: none;
  }
`

export const SC_MoreButton = styled.button`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: -4px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--ui-primary);
  font-size: 14px;
  cursor: pointer;
  transition: opacity ${() => TRANSITIONS.FAST};

  &:hover {
    opacity: 0.8;
  }

  .anticon {
    font-size: 15px;
  }
`

/**
 * Кнопки переносятся на вторую строку, если в ширину не влезают. Поле справа
 * у кнопок колонки здесь не нужно.
 */
export const SC_Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  &:empty {
    display: none;
  }

  & > button {
    margin: 0;
  }

  & > .grow {
    flex: 1 1 140px;
    width: auto;
  }

  & > .wide {
    flex: 1 1 100%;
  }

  & > .icon {
    flex: 0 0 40px;
    min-height: 40px;
  }
`
