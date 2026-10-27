import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_ModalTitle = styled.span`
  display: block;
  max-width: calc(100% - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Tabs = styled.div`
  display: flex;
  gap: 0;
  margin: -4px 0 ${() => SPACING.MD};
  border-bottom: 1px solid var(--ui-border);
`

export const SC_Tab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: -1px;
  padding: 10px 14px;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.MD};
  font-weight: 500;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    color: var(--ui-text-highlighted);
    border-bottom-color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: -2px;
  }
`

export const SC_Panel = styled.div`
  min-height: 240px;
`

export const SC_PanelNote = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM};
  padding: ${() => SPACING.LG} 0;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.MD};

  &.error {
    color: var(--ui-error);
  }
`

/** Слева форма, справа сведения; на телефоне — одна колонка. */
export const SC_DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: ${() => SPACING.LG};
  align-items: start;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const SC_Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.MD};
  min-width: 0;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    color: var(--ui-text-highlighted);
    font-size: 13px;
    font-weight: 500;
  }
`

export const SC_FieldHint = styled.div`
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  line-height: calc(1.5 * var(--leading-scale));
`

export const SC_FieldError = styled.div`
  color: var(--ui-error);
  font-size: ${() => FONT_SIZE.SM};
`

/** «Сохранить» прилипает к низу окна, пока форма длиннее экрана. */
export const SC_FormFooter = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: ${() => SPACING.SM};
  padding: ${() => SPACING.SM} 0;
  background: var(--ui-bg);
  border-top: 1px solid var(--ui-border);
`

export const SC_Unsaved = styled.span`
  margin-right: auto;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
`

export const SC_Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.MD};
  min-width: 0;
  padding: ${() => SPACING.MD};
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-lg);
`

export const SC_Facts = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
  margin: 0;

  dt {
    color: var(--ui-text-muted);
    font-size: ${() => FONT_SIZE.SM};
  }

  dd {
    margin: 0;
    color: var(--ui-text-highlighted);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
`

export const SC_AsideSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
  padding-top: ${() => SPACING.MD};
  border-top: 1px solid var(--ui-border);
`

export const SC_AsideTitle = styled.h3`
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-weight: 600;
`

export const SC_AsideText = styled.p`
  margin: 0;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
`

/** Посты с роликом: заголовок и дата, нажатие открывает пост. */
export const SC_Posts = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;

  button {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 6px 8px;
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--ui-radius-md);
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-bg-elevated);
  }

  button:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }

  span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--ui-primary);
    font-size: 13px;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  small {
    color: var(--ui-text-muted);
    font-size: ${() => FONT_SIZE.SM};
  }
`

export const SC_Danger = styled.div`
  padding-top: ${() => SPACING.MD};
  border-top: 1px solid var(--ui-border);
`
