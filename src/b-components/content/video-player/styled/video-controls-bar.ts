// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_VideoControlsBar = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 10px 14px;
  /* Подложка панели следует теме: в тёмной она была белой, а иконки на ней
     глобальное правило ant-карточки перекрашивало в светлые — белое на белом. */
  background: var(--color-surface-frosted);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: relative;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  min-height: 50px;
  height: 50px;
  pointer-events: auto;

  button span {
    color: inherit;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    gap: 6px;
    padding: 8px 10px;
    min-height: 56px;
    height: auto;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    gap: 4px;
    padding: 6px 8px;
  }
`

export const SC_VideoPlayPauseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-sm);
  transition: background-color var(--transition-fast);
  color: var(--color-text-primary);
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  box-sizing: border-box;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }

  &:hover {
    background: var(--color-overlay-8);
  }

  &:active {
    background: var(--color-overlay-12);
  }

  &:focus {
    outline: none;
  }
`

export const SC_VideoPlayButton = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgb(var(--color-black-rgb) / 30%);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--transition-normal),
    transform var(--transition-normal),
    box-shadow var(--transition-normal);
  z-index: 10;
  box-shadow: 0 4px 16px rgb(var(--color-black-rgb) / 40%);
  backdrop-filter: blur(4px);

  /* Контурная иконка Lucide: заливка превращала её в серый диск без треугольника. */
  svg {
    color: var(--color-white-85);
    fill: none;
    stroke-width: 1.5;
  }

  &:hover {
    background: rgb(var(--color-black-rgb) / 40%);
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: 0 6px 20px rgb(var(--color-black-rgb) / 50%);
  }

  &:active {
    transform: translate(-50%, -50%) scale(1.05);
    box-shadow: 0 2px 12px rgb(var(--color-black-rgb) / 40%);
  }
`

export const SC_VideoTimeDisplay = styled.span`
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 500;
  user-select: none;
  flex-shrink: 0;
  min-width: 100px;
  text-align: center;
  font-family: var(--font-family);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-sizing: border-box;
`

export const SC_VideoChapterMarker = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--color-white-95);
  pointer-events: none;
  z-index: 3;
  transform: translateX(-1px);
`

export const SC_VideoChapterTitle = styled.span`
  color: var(--ui-text-highlighted);
  font-size: 12px;
  font-weight: 500;
  user-select: none;
  flex-shrink: 1;
  min-width: 0;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-family);
  padding: 0 4px;
  opacity: 0.85;
`
