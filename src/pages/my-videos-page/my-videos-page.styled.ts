import styled from 'vue3-styled-components'
import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_MyVideosWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_MyVideosPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 60px 20px 24px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    padding: var(--header-height-total) 16px 24px;
  }
`

export const SC_Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 ${() => SPACING.MD};
`

export const SC_HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

/** «24 ролика · 3 410 просмотров». */
export const SC_Summary = styled.div`
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.MD};
`

export const SC_HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_MyVideosTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_Section = styled.section`
  margin-bottom: 32px;
`

export const SC_Note = styled.div`
  padding: 24px 0;
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Часть роликов уже в списке, остальные серверы ещё отвечают. */
export const SC_Loading = styled.div`
  display: flex;
  align-items: center;
  gap: ${() => SPACING.SM};
  margin-bottom: ${() => SPACING.MD};
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Поиск, фильтр, порядок и вид — одной строкой над списком. */
export const SC_Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM};
  margin-bottom: ${() => SPACING.MD};

  .ant-select {
    min-width: 150px;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    .ant-select {
      flex: 1;
      min-width: 0;
    }
  }
`

export const SC_Search = styled.div`
  flex: 1 1 260px;
  max-width: 420px;
  min-width: 0;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    flex-basis: 100%;
    max-width: none;
  }
`

/** Плиткой или списком: две кнопки-иконки, выбранная — на подложке. */
export const SC_ViewSwitch = styled.div`
  display: inline-flex;
  padding: 2px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-md);

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    padding: 0;
    color: var(--ui-text-muted);
    font-size: 16px;
    background: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
  }

  button:hover {
    color: var(--ui-text-highlighted);
  }

  button.active {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg);
    box-shadow: var(--ui-shadow-sm);
  }

  button:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }
`

/** Заголовки колонок списка — те же колонки, что у строки ролика. */
export const SC_ListHead = styled.div`
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 150px 110px 100px 150px 32px;
  gap: ${() => SPACING.MD};
  padding: 0 ${() => SPACING.SM} ${() => SPACING.SM};
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  font-weight: 500;
  border-bottom: 1px solid var(--ui-border);

  .video {
    grid-column: 1 / 3;
  }

  .views {
    text-align: right;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_Videos = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;

  &.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: ${() => SPACING.LG} ${() => SPACING.MD};
  }

  &.list {
    display: flex;
    flex-direction: column;
  }
`
