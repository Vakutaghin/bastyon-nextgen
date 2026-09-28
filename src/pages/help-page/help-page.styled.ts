import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

// Брейкпоинт — функцией: строка в шаблоне styled не проходит проверку типов.

export const SC_HelpWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_HelpPage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: calc(var(--header-height-total) + 20px) 24px 48px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    padding: calc(var(--header-height-total) + 12px) 16px 32px;
  }
`

export const SC_Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
`

export const SC_ToolbarSpacer = styled.span`
  flex: 1;
`

export const SC_ToolButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  font: inherit;
  font-size: 14px;
  color: var(--ui-text-toned);
  background: none;
  cursor: pointer;
  transition:
    background-color ${() => TRANSITIONS.FAST},
    color ${() => TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-muted);
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: default;
  }

  &.active {
    color: var(--ui-warning);
  }

  .anticon {
    font-size: 18px;
  }
`

export const SC_Layout = styled.div`
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 32px;
  align-items: start;

  &.nav-hidden {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Без навигатора статья — по центру, как колонка текста. */
  &.nav-hidden > * {
    width: 100%;
    margin: 0 auto;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const SC_Nav = styled.aside`
  position: sticky;
  top: calc(var(--header-height-total) + 16px);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--header-height-total) - 32px);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  overflow: hidden;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    position: static;
    max-height: none;
  }
`

export const SC_Main = styled.div`
  min-width: 0;
  max-width: 780px;
`

export const SC_Tabs = styled.div`
  display: flex;
  gap: 2px;
  padding: 6px;
  border-bottom: 1px solid var(--ui-border);
`

/**
 * Вкладка навигатора. В узкой панели на компьютере подпись только у открытой
 * вкладки, у остальных — значок с подсказкой; на телефоне панель во всю
 * ширину, там только подписи.
 */
export const SC_Tab = styled.button`
  display: inline-flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  font: inherit;
  font-size: 13px;
  color: var(--ui-text-muted);
  background: none;
  cursor: pointer;
  white-space: nowrap;

  .anticon {
    font-size: 16px;
  }

  .tab-label {
    display: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    flex: 1 1 auto;
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-accented);
  }

  &.active .tab-label {
    display: inline;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    flex: 1 1 0;
    padding: 7px 2px;

    &.active {
      flex: 1 1 0;
    }

    .anticon {
      display: none;
    }

    .tab-label {
      display: inline;
    }
  }
`

export const SC_Pane = styled.div`
  flex: 1;
  min-height: 0;
  padding: 10px 8px 12px;
  overflow-y: auto;
`

export const SC_PaneInput = styled.div`
  padding: 0 4px 8px;
`

export const SC_PaneHint = styled.p`
  margin: 4px 6px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_TreeChildren = styled.ul`
  margin: 0;
  padding: 0 0 0 16px;
  list-style: none;
`

export const SC_Row = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--ui-bg-muted);
  }

  &.draft a {
    color: var(--ui-text-dimmed);
    font-style: italic;
  }

  &.active {
    background: rgb(var(--ui-primary-rgb) / 10%);
  }

  &.active a {
    color: var(--ui-primary);
    font-weight: 500;
  }
`

export const SC_Toggle = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-sm);
  color: var(--ui-text-muted);
  background: none;
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
  }

  .anticon {
    font-size: 13px;
    transition: transform ${() => TRANSITIONS.FAST};
  }

  &.open .anticon {
    transform: rotate(90deg);
  }
`

export const SC_ToggleSpacer = styled.span`
  flex-shrink: 0;
  width: 22px;
`

export const SC_RowLink = styled.a`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px;
  font-size: 14px;
  color: var(--ui-text);
  text-decoration: none;

  .anticon {
    flex-shrink: 0;
    font-size: 15px;
    color: var(--ui-text-muted);
  }

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export const SC_ItemButton = styled.button`
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  font: inherit;
  font-size: 14px;
  text-align: left;
  color: var(--ui-text);
  background: none;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-muted);
  }
`

export const SC_Count = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_SubList = styled.ul`
  margin: 0 0 4px;
  padding: 0 0 0 14px;
  list-style: none;
`

export const SC_Result = styled.a`
  display: block;
  padding: 8px;
  border-radius: var(--ui-radius-md);
  text-decoration: none;

  &:hover {
    background: var(--ui-bg-muted);
  }
`

export const SC_ResultTitle = styled.span`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_ResultWhere = styled.span`
  display: block;
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_ResultSnippet = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-text-toned);

  mark {
    padding: 0 1px;
    border-radius: var(--ui-radius-xs);
    color: inherit;
    background: rgb(var(--ui-warning-rgb) / 30%);
  }
`

export const SC_FavoriteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;

  & > a {
    flex: 1;
    min-width: 0;
  }
`

export const SC_Empty = styled.p`
  margin: 16px 8px;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  color: var(--ui-text-muted);
`

export const SC_HomeTitle = styled.h1`
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.4px;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 24px;
  }
`

export const SC_Books = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 20px;
`

export const SC_BookLead = styled.p`
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_Book = styled.section`
  padding: 14px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);

  ul {
    margin: 8px 0 0;
    padding: 0;
    font-size: 14px;
    list-style: none;
  }

  li {
    margin: 4px 0;
  }

  a {
    color: var(--ui-text);
    text-decoration: none;
  }

  a:hover {
    color: var(--ui-primary);
  }
`

export const SC_BookTitle = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;

  && {
    color: var(--ui-text-highlighted);
  }

  .anticon {
    color: var(--ui-primary);
  }
`

export const SC_MobileBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
`
