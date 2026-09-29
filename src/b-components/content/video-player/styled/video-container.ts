// @ts-expect-error vue3-styled-components types
import styled, { keyframes } from 'vue3-styled-components'

const pulse = keyframes`
  50% {
    opacity: 0.5;
  }
`

/** Заглушка до загрузки ролика — как скелетон Nuxt UI (раньше светлый блик и в тёмной теме). */
export const SC_VideoSkeleton = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  background: var(--ui-bg-elevated);
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
`

export const SC_VideoContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 100%;
  /* Под роликом чёрное, как у YouTube: полосы по краям вертикального видео. */
  background-color: var(--color-black);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  margin-bottom: 15px;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 0;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  &:fullscreen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  /* Safari до 16.4 знает полноэкранный режим только с префиксом. */
  /* stylelint-disable-next-line selector-no-vendor-prefix */
  &:-webkit-full-screen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
    z-index: 2147483647;
    background: black;
  }

  /* Панель спряталась, ролик идёт — курсор тоже, как у YouTube. */
  &.hide-cursor {
    cursor: none;
  }

  /* Фокус от клика или тапа не обводим: после него любая клавиша включает
     :focus-visible, и пробел рисовал рамку вокруг ролика. С Tab обводка
     остаётся — по ней видно, что клавиши теперь у плеера. */
  &.pointer-mode:focus-visible {
    outline: none;
  }

  /* Телефон: двойное касание — перемотка, а не масштаб страницы; прокрутка
     ленты по ролику остаётся. Удержание — 2×, а не меню «Сохранить видео». */
  &.touch-ui {
    touch-action: manipulation;
    -webkit-touch-callout: none;
  }

  /* Во весь экран листать нечего: жесты целиком наши (свайп вниз — выход). */
  &.touch-ui.is-fullscreen {
    touch-action: none;
  }
`

export const SC_VideoWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
`

export const SC_VideoElement = styled.video`
  width: 100%;
  height: 100%;
  /* object-fit управляется динамически через inline стили или остается contain по умолчанию */
  object-fit: contain;
  display: block;
`

/** Размытый фон из превью — заполняет контейнер (cover), под основной превьюшкой */
export const SC_VideoThumbnailBackdrop = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 0;
  pointer-events: none;
  filter: blur(20px);
  -webkit-filter: blur(20px);
  transform: scale(1.05);
`

export const SC_VideoThumbnail = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  z-index: 2;
  pointer-events: none;
  transition: opacity var(--transition-normal);
  background-color: transparent;
`

export const SC_VideoError = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  background-color: rgb(var(--color-black-rgb) / 80%);
  color: white;
  padding: 20px 30px;
  border-radius: var(--ui-radius-lg);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;

  p {
    margin: 0;
    font-size: 16px;
    color: white;
  }
`

/** Текст предупреждения «видео пойдёт мимо Tor» внутри SC_VideoError. */
export const SC_VideoTorBody = styled.p`
  max-width: 360px;
  font-size: 14px;
  opacity: 0.85;
`

export const SC_VideoTorActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
`

export const SC_VideoRetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid rgb(var(--color-white-rgb) / 35%);
  border-radius: var(--ui-radius-md);
  background-color: rgb(var(--color-white-rgb) / 10%);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: rgb(var(--color-white-rgb) / 22%);
  }
`
