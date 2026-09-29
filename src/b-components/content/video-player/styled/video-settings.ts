import styled from 'vue3-styled-components'

// Меню настроек — как у YouTube. Компьютер: тёмная панель над шестерёнкой,
// строка «значок — название — значение ›», в подменю заголовок «‹ Качество» и
// галочка у выбранного. Телефон: лист снизу экрана в цветах темы, как в
// приложении YouTube.

export const SC_SettingsMenu = styled.div`
  position: absolute;
  right: 12px;
  bottom: 61px;
  z-index: 12;
  min-width: 251px;
  max-height: calc(100% - 72px);
  padding: 8px 0;
  overflow-y: auto;
  border-radius: var(--ui-radius-xl);
  background: rgb(var(--player-panel-rgb) / 90%);
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 13px;
  text-shadow: 0 0 2px rgb(var(--color-black-rgb) / 50%);
  box-shadow: 0 0 20px rgb(var(--color-black-rgb) / 50%);
  cursor: default;

  .is-fullscreen & {
    right: 20px;
    bottom: 70px;
    font-size: 16px;
  }
`

export const SC_SettingsBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgb(var(--color-black-rgb) / 40%);
`

export const SC_SettingsSheet = styled.div`
  position: fixed;
  left: 8px;
  right: 8px;
  bottom: calc(8px + var(--safe-bottom));
  z-index: 3001;
  max-width: 560px;
  max-height: 70vh;
  margin: 0 auto;
  padding: 8px 0;
  overflow-y: auto;
  border-radius: var(--ui-radius-xl);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 15px;
  box-shadow: var(--ui-shadow-lg);
`

/** Строка меню: значок, название, справа — текущее значение и стрелка. */
export const SC_MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  height: 40px;
  padding: 0 15px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    outline: none;
    background: rgb(var(--color-white-rgb) / 10%);
  }

  svg {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .is-fullscreen & {
    height: 48px;
  }

  /* Лист на телефоне — светлый в светлой теме: подсветка и высота строк свои. */
  .settings-sheet & {
    height: 48px;
  }

  .settings-sheet &:hover,
  .settings-sheet &:focus-visible {
    background: var(--ui-bg-elevated);
  }
`

export const SC_MenuLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_MenuValue = styled.span`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.9;

  .settings-sheet & {
    color: var(--ui-text-muted);
  }
`

/** Заголовок подменю: «‹ Качество», нажатие возвращает в главное меню. */
export const SC_MenuHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  height: 48px;
  margin-bottom: 8px;
  padding: 0 15px;
  border: 0;
  border-bottom: 1px solid rgb(var(--color-white-rgb) / 20%);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: none;
    background: rgb(var(--color-white-rgb) / 10%);
  }

  svg {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .settings-sheet & {
    border-bottom-color: var(--ui-border);
  }
`

/** Место под галочку в подменю: у невыбранных пустое, чтобы строки не прыгали. */
export const SC_MenuCheck = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
`
