import styled from 'vue3-styled-components'
import { BREAKPOINTS, SHELL } from '@/styles/design-tokens'

export const SC_HomeWork = styled.div`
  display: flex;
  flex: 1;
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 20px);
  gap: 20px;
  padding: 58px 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);

  &.is-mobile {
    gap: 0;
    padding: var(--header-height-total) 0 0;
  }
`

export const SC_HomeMainContent = styled.main`
  flex: 1;
  min-width: 0;
  /* Во всю ширину боковые колонки уходят к краям окна, а лента остаётся
     читаемой ширины посередине: пост в 1900 px шириной не читается. */
  max-width: var(--feed-max-width);
  margin: 0 auto;
  background: var(--color-bg-primary);
  padding: 20px 0;
  border-radius: var(--ui-radius-lg);

  &.sidebar-right-hidden {
    padding-right: 20px;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 16px;

    &.sidebar-right-hidden {
      padding-right: 8px;
    }
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Посты ленты перекрывают поля страницы и встают во всю ширину. */
    --page-gutter: 6px;

    padding: 8px 6px 12px;

    &.sidebar-right-hidden {
      padding-right: 6px;
    }
  }

  /* Телефон боком шире 768 px: боковых панелей нет, отступы с обеих сторон. */
  ${() => SHELL.RAIL} & {
    padding: 12px 12px 16px;

    &.sidebar-right-hidden {
      padding-right: 12px;
    }
  }
`
