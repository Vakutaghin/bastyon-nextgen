import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING, Z_INDEX } from '@/styles/design-tokens'

/** Поле статьи без рамки: текст читается так же, как в ленте. */
export const SC_ArticleEditor = styled.div`
  position: relative;
  min-height: 240px;
  font-size: 17px;
  line-height: calc(1.65 * var(--leading-scale));
  color: var(--color-text-primary);

  & .ProseMirror {
    min-height: 240px;
    padding: ${() => SPACING.XS} 0 ${() => SPACING.LG};
    outline: none;
    overflow-wrap: anywhere;
  }

  & .ProseMirror > * + * {
    margin-top: 0.75em;
  }

  & .ProseMirror p {
    margin: 0;
  }

  & .ProseMirror h1,
  & .ProseMirror h2 {
    margin: 1.2em 0 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--ui-text-highlighted);
  }

  & .ProseMirror h3,
  & .ProseMirror h4,
  & .ProseMirror h5,
  & .ProseMirror h6 {
    margin: 1em 0 0;
    font-size: 19px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--ui-text-highlighted);
  }

  & .ProseMirror > :first-child {
    margin-top: 0;
  }

  & .ProseMirror ul,
  & .ProseMirror ol {
    margin: 0;
    padding-left: 1.4em;
  }

  & .ProseMirror li + li {
    margin-top: 0.25em;
  }

  & .ProseMirror blockquote {
    margin: 0;
    padding: 0 0 0 ${() => SPACING.MD};
    color: var(--color-text-secondary);
    border-left: 3px solid var(--ui-primary);
  }

  & .ProseMirror pre {
    margin: 0;
    padding: ${() => SPACING.SM} ${() => SPACING.MD};
    overflow-x: auto;
    font-family: var(--font-family-mono);
    font-size: ${() => FONT_SIZE.MD};
    line-height: 1.5;
    background: var(--ui-bg-muted);
    border-radius: var(--ui-radius-md);
  }

  & .ProseMirror code {
    font-family: var(--font-family-mono);
    font-size: 0.9em;
  }

  & .ProseMirror :not(pre) > code {
    padding: 1px 5px;
    background: var(--ui-bg-muted);
    border-radius: var(--ui-radius-sm);
  }

  & .ProseMirror a {
    color: var(--ui-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  & .ProseMirror hr {
    height: 0;
    margin: 1.5em auto;
    border: 0;
    text-align: center;
  }

  & .ProseMirror hr::before {
    content: '* * *';
    color: var(--ui-text-muted);
    letter-spacing: 0.6em;
  }

  & .ProseMirror hr.ProseMirror-selectednode::before {
    color: var(--ui-primary);
  }

  /* Подсказка в пустой строке (Placeholder). */
  & .ProseMirror .is-empty::before {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    color: var(--ui-text-dimmed);
    pointer-events: none;
  }

  /* Панель над выделением и меню блоков — поверх тегов и настроек ниже. */
  & .article-menu {
    z-index: ${() => Z_INDEX.DROPDOWN};
  }

  /* Идёт публикация — текст притушен. */
  &.disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`

/** Панель над выделением: жирный, курсив, ссылка, заголовки, цитата, код. */
export const SC_Bubble = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-md);
`

export const SC_BubbleButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 16px;
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-muted);
  }

  &.active {
    color: var(--ui-primary);
    background: var(--ui-bg-muted);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

export const SC_LinkInput = styled.input`
  width: 260px;
  height: 32px;
  padding: 0 ${() => SPACING.SM};
  font-size: ${() => FONT_SIZE.MD};
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  outline: none;
`

/** «+» на пустой строке и список блоков под ним. */
export const SC_BlockMenu = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
`

export const SC_BlockToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 16px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--ui-primary);
    border-color: var(--ui-primary);
  }

  &.open {
    transform: rotate(45deg);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`

export const SC_BlockList = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 220px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-md);
`

export const SC_BlockItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${() => SPACING.SM};
  padding: 7px ${() => SPACING.SM};
  font-size: ${() => FONT_SIZE.MD};
  color: var(--color-text-primary);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  & svg {
    font-size: 16px;
    color: var(--ui-text-muted);
  }

  &.active,
  &:hover {
    background: var(--ui-bg-muted);
  }
`

/** Картинка в статье: подпись — прямо под ней. */
export const SC_ArticleFigure = styled.figure`
  position: relative;
  margin: 0;

  & img {
    display: block;
    max-width: 100%;
    max-height: 520px;
    margin: 0 auto;
    border-radius: var(--ui-radius-md);
  }

  &.selected img {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_ArticleCaption = styled.input`
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 2px 0;
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
  text-align: center;
  background: transparent;
  border: 0;
  outline: none;

  &::placeholder {
    color: var(--ui-text-dimmed);
  }
`

export const SC_ArticleFigureRemove = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  color: var(--color-white);
  background: rgb(var(--color-black-rgb) / 55%);
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: pointer;
`

/** Блок из прежней версии, которого редактор не знает. */
export const SC_ArticleRawBlock = styled.div`
  padding: ${() => SPACING.SM} ${() => SPACING.MD};
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  border: 1px dashed var(--ui-border);
  border-radius: var(--ui-radius-md);

  &.selected {
    border-color: var(--ui-primary);
  }
`

export const SC_ArticleStatus = styled.div`
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
`
