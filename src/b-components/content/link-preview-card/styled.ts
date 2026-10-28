import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

/** Шире карточка не нужна: на странице поста строки текста иначе тянулись бы через весь экран. */
export const SC_LinkPreviewWrap = styled.div`
  max-width: 800px;
  margin: ${() => SPACING.SM} 0;

  &:empty {
    margin: 0;
  }
`

/**
 * Квадратная картинка слева, текст справа. Ссылка — SC_Body, а её ::after
 * растянут на всю карточку: нажатие мимо картинки открывает сайт, а кнопка
 * картинки лежит выше и не вложена в ссылку.
 */
export const SC_Card = styled.div`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  transition: background-color var(--transition-fast);

  &:hover {
    background: var(--ui-bg-muted);
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    gap: 12px;
    padding: 10px;
  }
`

export const SC_Media = styled.div`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 120px;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-accented);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Заглушка TorImage «Загрузить картинку» под Tor — на весь квадрат. */
  button {
    width: 100%;
    height: 100%;
    font-size: ${() => FONT_SIZE.SM};
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 80px;
  }
`

/** Кнопка поверх картинки: открыть в просмотрщике. Лупа — при наведении. */
export const SC_Zoom = styled.button`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-white);
  font-size: 22px;
  cursor: zoom-in;
  transition: background-color var(--transition-fast);

  .anticon,
  svg {
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  &:hover,
  &:focus-visible {
    background: rgb(var(--color-black-rgb) / 35%);

    .anticon,
    svg {
      opacity: 1;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: -2px;
  }
`

export const SC_Body = styled.a`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${() => SPACING.XS};
  min-width: 0;
  padding-top: 2px;
  color: var(--ui-text);
  text-decoration: none;

  &:hover {
    color: var(--ui-text);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--ui-radius-lg);
  }

  &:focus-visible {
    outline: none;
  }

  &:focus-visible::after {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }

  /* Композер: справа вверху крестик «Убрать превью ссылки». */
  &.has-remove {
    padding-right: 28px;
  }
`

export const SC_Site = styled.div`
  overflow: hidden;
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Title = styled.div`
  display: -webkit-box;
  overflow: hidden;
  font-size: ${() => FONT_SIZE.MD};
  font-weight: 600;
  line-height: calc(1.35 * var(--leading-scale));
  color: var(--ui-text-highlighted);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

export const SC_Description = styled.div`
  display: -webkit-box;
  overflow: hidden;
  font-size: ${() => FONT_SIZE.SM};
  line-height: calc(1.4 * var(--leading-scale));
  color: var(--ui-text-toned);
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    -webkit-line-clamp: 2;
  }
`

export const SC_Remove = styled.button`
  position: absolute;
  top: ${() => SPACING.XS};
  right: ${() => SPACING.XS};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-full);
  background: rgb(var(--color-black-rgb) / 55%);
  color: var(--color-white);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgb(var(--color-black-rgb) / 75%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`
