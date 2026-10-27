import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_MentionAnchor = styled.div`
  position: relative;
  width: 100%;
`

export const SC_MentionDropdown = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: ${Z_INDEX.DROPDOWN};
  margin: 4px 0 0;
  padding: 4px;
  list-style: none;
  max-height: min(320px, 50vh);
  overflow-y: auto;
  /* Тот же случай, что и у подсказок тегов: скролл списка не должен листать модалку. */
  overscroll-behavior: contain;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  box-shadow: 0 6px 24px var(--color-overlay-20);
`

export const SC_MentionRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;

  &.active,
  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_MentionAvatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_MentionName = styled.span`
  min-width: 0;
  font-size: 14px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

/** «Ищу…», пока сеть ищет, а своих совпадений нет. */
export const SC_MentionStatus = styled.li`
  padding: 7px 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
`

export const SC_Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    gap: 12px;
  }
`

/** «Пост / Статья» — переключатель вида публикации. */
export const SC_ModeSwitch = styled.div`
  display: inline-flex;
  align-self: flex-start;
  gap: 2px;
  padding: 3px;
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-lg);
`

export const SC_ModeButton = styled.button`
  padding: 5px 14px;
  font-size: ${() => FONT_SIZE.MD};
  font-weight: 500;
  color: var(--ui-text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background ${() => TRANSITIONS.FAST},
    color ${() => TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    color: var(--ui-text-highlighted);
  }

  &.active {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
    box-shadow: var(--ui-shadow-xs);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

/** Текст поста — без рамки, растёт по мере набора. */
export const SC_Textarea = styled.textarea`
  display: block;
  width: 100%;
  min-height: 112px;
  padding: 0;
  overflow: hidden;
  font-size: 17px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  outline: none;
  resize: none;

  &::placeholder {
    color: var(--ui-text-dimmed);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`

/** Заголовок статьи или видео — крупно, без рамки. */
export const SC_TitleInput = styled.input`
  display: block;
  width: 100%;
  padding: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
  background: transparent;
  border: 0;
  outline: none;

  &.article {
    font-size: 26px;
    font-weight: 700;
  }

  &::placeholder {
    color: var(--ui-text-dimmed);
    font-weight: 600;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`

/** Линия между текстом с вложениями и панелью публикации. */
export const SC_Divider = styled.hr`
  height: 1px;
  margin: 2px 0 0;
  background: var(--ui-border);
  border: 0;
`

/** Панель: вложения слева, сводка настроек справа. */
export const SC_Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${() => SPACING.SM};
`

export const SC_ToolGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`

export const SC_ToolButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 19px;
  color: var(--ui-primary);
  background: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: pointer;
  transition: background ${() => TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
  }

  &.active {
    background: var(--ui-bg-muted);
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }

  & input[type='file'] {
    display: none;
  }
`

/** Сводка настроек: «Все · Русский · Сразу»; нажатие раскрывает сами поля. */
export const SC_SettingsChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  margin-left: auto;
  padding: 6px 12px;
  overflow: hidden;
  font-size: ${() => FONT_SIZE.SM};
  color: var(--color-text-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
  background: var(--ui-bg-muted);
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: pointer;

  & > svg {
    flex-shrink: 0;
    font-size: 14px;
  }

  &:hover:not(:disabled),
  &.open {
    color: var(--ui-text-highlighted);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

export const SC_SettingsSummary = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_SettingsPanel = styled.div`
  padding: 12px;
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-lg);
`

export const SC_Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.MD};
`

export const SC_FooterActions = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  gap: ${() => SPACING.SM};
`

const hintProps = { danger: Boolean }

export const SC_Hint = styled('span', hintProps)`
  font-size: ${FONT_SIZE.SM};
  color: ${(props) => (props.danger ? COLORS.DANGER : COLORS.TEXT_SECONDARY)};
`
