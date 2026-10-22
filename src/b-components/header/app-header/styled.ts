import styled from 'vue3-styled-components'
import { BREAKPOINTS, SHELL } from '@/styles/design-tokens'

export const SC_Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--header-height-total);
  padding-top: var(--safe-top);
  padding-left: var(--safe-left);
  /* Хедер fixed: когда полноэкранный оверлей убирает скроллбар, он должен
     сдвинуться на ту же ширину, иначе содержимое прыгает вправо. Переменную
     ставит use-page-overlay; вне оверлея она пустая и остаётся один safe-area. */
  padding-right: calc(var(--safe-right) + var(--overlay-scrollbar-pad, 0px));
  /* Как шапка Nuxt UI: фон страницы на 75% с размытием и линия снизу, без тени. */
  background: rgb(var(--ui-bg-rgb) / 75%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--ui-border);
  z-index: 1000;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
`

export const SC_Sections = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 var(--content-padding-x);
  max-width: var(--content-max-width);
  margin: 0 auto;
  gap: 12px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    gap: 8px;
  }

  /* Телефон боком: логотип — у меню, над началом ленты, а не посередине
     широкой шапки (значки справа прижимает SC_Right). */
  ${() => SHELL.RAIL} & {
    justify-content: flex-start;
  }
`

export const SC_MessengerWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color var(--transition-fast);
  color: var(--ui-text);

  &:hover {
    background-color: var(--ui-bg-elevated);
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 6px;
  }
`

export const SC_UnreadBadge = styled.span`
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-error);
  color: var(--ui-text-inverted);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--ui-bg);
`

// Есть только в каркасе телефона (app-header.vue решает по useViewport): у
// телефона боком он шире 768 px, и ширина в CSS тут не указ.
export const SC_HamburgerButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 4px;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  color: var(--ui-text);
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;

  & .anticon {
    font-size: 22px;
  }

  &:hover,
  &:active {
    background: var(--ui-bg-elevated);
  }
`

export const SC_Left = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`

export const SC_Right = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  flex: 0 0 auto;
  gap: 10px;
  margin-left: 12px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    gap: 6px;
    margin-left: 8px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    gap: 4px;
    margin-left: 4px;
  }

  ${() => SHELL.RAIL} & {
    margin-left: auto;
  }
`
