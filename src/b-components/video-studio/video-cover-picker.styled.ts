import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'

/** Высота ленты кадров. */
const STRIP_HEIGHT = '48px'

export const SC_Cover = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
`

export const SC_CoverHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${() => SPACING.XS};
  min-width: 0;
`

export const SC_CoverTitle = styled.span`
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-weight: 500;
`

export const SC_InfoButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 2px;
  font-size: ${() => FONT_SIZE.MD};
  color: var(--ui-text-muted);
  background: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: help;

  &:hover {
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

export const SC_CoverSource = styled.span`
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
`

/** Превью обложки: 16:9, кадр целиком. */
export const SC_Stage = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 220px;
  overflow: hidden;
  background: var(--color-black);
  border-radius: var(--ui-radius-md);

  & video,
  & img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

export const SC_StageEmpty = styled.span`
  padding: ${() => SPACING.MD};
  color: var(--color-white);
  font-size: ${() => FONT_SIZE.SM};
  text-align: center;
  opacity: 0.8;
`

/** Лента кадров, поверх — прозрачный ползунок с рамкой выбранного кадра. */
export const SC_Strip = styled.div`
  position: relative;
  height: ${() => STRIP_HEIGHT};

  & input[type='range'] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  & input[type='range']:disabled {
    cursor: progress;
  }

  & input[type='range']:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }

  & input[type='range']::-webkit-slider-runnable-track {
    height: ${() => STRIP_HEIGHT};
    background: transparent;
  }

  & input[type='range']::-webkit-slider-thumb {
    width: 14px;
    height: ${() => STRIP_HEIGHT};
    appearance: none;
    background: transparent;
    border: 3px solid var(--color-white);
    border-radius: var(--ui-radius-sm);
    box-shadow: var(--ui-shadow-md);
  }

  & input[type='range']::-moz-range-track {
    height: ${() => STRIP_HEIGHT};
    background: transparent;
  }

  & input[type='range']::-moz-range-thumb {
    width: 14px;
    height: ${() => STRIP_HEIGHT};
    background: transparent;
    border: 3px solid var(--color-white);
    border-radius: var(--ui-radius-sm);
    box-shadow: var(--ui-shadow-md);
  }
`

export const SC_StripFrames = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--ui-bg-accented);
  border-radius: var(--ui-radius-sm);
`

export const SC_StripFrame = styled.div`
  flex: 1 1 0;
  min-width: 0;

  & img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_CoverNote = styled.div`
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  line-height: calc(1.5 * var(--leading-scale));
`

export const SC_CoverActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM};
`

/** Кнопка «Загрузить картинку»: label вокруг скрытого input[type=file]. */
export const SC_CoverButton = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${() => SPACING.XS};
  padding: 6px 12px;
  font-size: 13px;
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);

  &:hover:not(.disabled) {
    color: var(--ui-primary);
    border-color: var(--ui-primary);
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-within {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }

  & input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
`

export const SC_CoverStatus = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};

  &.error {
    color: var(--ui-error);
  }
`

export const SC_CoverLink = styled.button`
  padding: 0;
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-primary);
  background: none;
  border: 0;
  cursor: pointer;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }
`
