import styled from 'vue3-styled-components'

// Полоса прокрутки — как у YouTube. Компьютер: над рядом кнопок, 3 px, при
// наведении 5 px, красный ползунок и подсказка времени над курсором.
// Телефон (.touch-ui): по нижнему краю ролика; пока панель спрятана, а ролик
// идёт, — тонкая линия без ползунка (.mini).

export const SC_Progress = styled.div`
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 47px;
  z-index: 11;
  height: 5px;
  cursor: pointer;
  touch-action: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition-player),
    visibility var(--transition-player);

  /* Зона наведения шире самой полосы: в тонкую полоску трудно попасть. */
  &::before {
    content: '';
    position: absolute;
    inset: -8px 0 -6px;
  }

  &.visible {
    opacity: 1;
    visibility: visible;
  }

  .is-fullscreen & {
    left: 20px;
    right: 20px;
    bottom: 53px;
  }

  .touch-ui & {
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
  }

  .touch-ui &::before {
    top: -16px;
    bottom: -4px;
  }

  .touch-ui.is-fullscreen & {
    left: calc(24px + var(--safe-left));
    right: calc(24px + var(--safe-right));
    bottom: calc(28px + var(--safe-bottom));
  }

  /* Панель спрятана, ролик идёт: линия у края, нажать на неё нельзя. */
  .touch-ui &.mini {
    opacity: 1;
    visibility: visible;
    pointer-events: none;
  }
`

export const SC_ProgressTrack = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  background: rgb(var(--color-white-rgb) / 20%);
  transform: scaleY(0.6);
  transform-origin: bottom;
  transition: transform var(--transition-player-quick);

  .hover > &,
  .dragging > & {
    transform: none;
  }

  .touch-ui & {
    transform: none;
  }
`

const FILL = `
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
`

export const SC_ProgressLoaded = styled.div`
  ${() => FILL}

  width: var(--progress-loaded);
  background: rgb(var(--color-white-rgb) / 40%);
`

/** До курсора — светлее: видно, куда перемотает клик. */
export const SC_ProgressHoverFill = styled.div`
  ${() => FILL}

  width: var(--progress-hover);
  background: rgb(var(--color-white-rgb) / 50%);
`

export const SC_ProgressPlayed = styled.div`
  ${() => FILL}

  width: var(--progress-played);
  background: linear-gradient(to right, var(--player-red) 80%, var(--player-red-end) 100%);
`

/** Граница глав — разрыв в полосе, как у YouTube. */
export const SC_ChapterGap = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: rgb(var(--color-black-rgb) / 60%);
  pointer-events: none;
`

export const SC_Scrubber = styled.div`
  position: absolute;
  left: var(--progress-played);
  bottom: -4px;
  width: 13px;
  height: 13px;
  margin-left: -6.5px;
  border-radius: 50%;
  background: var(--player-red);
  pointer-events: none;
  transform: scale(0);
  transition: transform var(--transition-player-quick);

  .hover > &,
  .dragging > & {
    transform: none;
  }

  .touch-ui & {
    bottom: -4.5px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    transform: none;
  }

  .touch-ui .dragging > & {
    transform: scale(1.4);
  }

  .touch-ui .mini > & {
    transform: scale(0);
  }
`

/** Время (и глава) над курсором или пальцем. */
export const SC_ProgressTooltip = styled.div`
  position: absolute;
  left: var(--progress-tip);
  bottom: calc(100% + 14px);
  padding: 5px 9px;
  border-radius: var(--ui-radius-sm);
  background: rgb(var(--player-panel-rgb) / 90%);
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 15px;
  text-align: center;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  transform: translateX(-50%);

  span {
    display: block;
    max-width: 240px;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
  }

  .touch-ui & {
    bottom: calc(100% + 28px);
    padding: 6px 12px;
    font-size: 16px;
    line-height: 20px;
  }
`
