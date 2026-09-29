// @ts-expect-error vue3-styled-components types
import styled, { keyframes } from 'vue3-styled-components'

// Знаки поверх ролика — как у YouTube: «пульс» пуска и паузы в центре,
// плашка сверху (громкость, скорость, 2×), волна перемотки у края, белый
// кольцевой спиннер и тёмное окно со списком клавиш.

const bezelFade = keyframes`
  from {
    opacity: 1;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(2);
  }
`

/** Круг со значком в центре — вспыхивает и расплывается за полсекунды. */
export const SC_Bezel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  background: rgb(var(--color-black-rgb) / 50%);
  color: var(--color-white);
  pointer-events: none;
  animation: ${() => bezelFade} 0.5s linear forwards;

  svg {
    width: 36px;
    height: 36px;
  }
`

/** Плашка сверху по центру: «50%», «1.5x», «2x ▸▸». */
export const SC_TopPill = styled.div`
  position: absolute;
  top: 10%;
  left: 50%;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--ui-radius-sm);
  background: rgb(var(--color-black-rgb) / 50%);
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 18px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);

  svg {
    width: 20px;
    height: 20px;
  }

  .touch-ui & {
    top: 8px;
    padding: 6px 14px;
    border-radius: var(--ui-radius-full);
    font-size: 14px;
  }
`

/**
 * Волна перемотки у края ролика — полукруг с бегущими стрелками и «10 секунд»,
 * как после двойного касания в приложении YouTube. На компьютере та же волна
 * после стрелок и J/L.
 */
export const SC_SeekRipple = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 42%;
  background: rgb(var(--color-white-rgb) / 20%);
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 0 2px rgb(var(--color-black-rgb) / 50%);
  pointer-events: none;

  &.left {
    left: 0;
    border-radius: 0 50% 50% 0 / 0 100% 100% 0;
  }

  &.right {
    right: 0;
    border-radius: 50% 0 0 50% / 100% 0 0 100%;
  }
`

const arrowBlink = keyframes`
  0% {
    opacity: 0;
  }

  17% {
    opacity: 0.9;
  }

  33% {
    opacity: 0.9;
  }

  50% {
    opacity: 0;
  }

  100% {
    opacity: 0;
  }
`

/** Три треугольника, загораются по очереди в сторону перемотки. */
export const SC_SeekArrows = styled.div`
  display: flex;

  svg {
    width: 14px;
    height: 14px;
    opacity: 0;
    animation: ${() => arrowBlink} 1s linear infinite;
  }

  svg:nth-child(2) {
    animation-delay: 0.2s;
  }

  svg:nth-child(3) {
    animation-delay: 0.4s;
  }

  .left & {
    flex-direction: row-reverse;
    transform: scaleX(-1);
  }
`

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

/** Белое кольцо загрузки — как у YouTube. */
export const SC_Spinner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 8;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  border: 4px solid var(--color-white-95);
  border-right-color: transparent;
  border-bottom-color: transparent;
  border-radius: 50%;
  pointer-events: none;
  animation: ${() => spin} 0.9s linear infinite;
`

export const SC_HotkeysHelpOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(var(--color-black-rgb) / 60%);
  cursor: default;
`

export const SC_HotkeysHelpContent = styled.div`
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 100%;
  padding: 20px 24px;
  overflow-y: auto;
  border-radius: var(--ui-radius-xl);
  background: rgb(var(--player-panel-rgb) / 95%);
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
`

export const SC_HotkeysHelpTitle = styled.h3`
  margin: 0 0 16px;
  color: var(--color-white);
  font-size: 18px;
  font-weight: 500;
`

export const SC_HotkeysHelpList = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px 16px;
  align-items: baseline;
`

export const SC_HotkeysHelpItem = styled.div`
  display: contents;
`

export const SC_HotkeysKey = styled.span`
  padding: 2px 8px;
  border-radius: var(--ui-radius-sm);
  background: rgb(var(--color-white-rgb) / 15%);
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  white-space: nowrap;
`

export const SC_HotkeysDescription = styled.span`
  color: var(--color-white-85);
  font-size: 14px;
`

export const SC_HotkeysCloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 6px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-white);
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-white-rgb) / 10%);
  }

  svg {
    width: 24px;
    height: 24px;
  }
`
