import styled from 'vue3-styled-components'

// Панель плеера — как у YouTube. На компьютере: затемнение снизу, над ним
// полоса прокрутки и ряд белых кнопок с подсказками. На телефоне (.touch-ui):
// касание затемняет весь ролик, в центре большая кнопка пуска, наверху
// настройки, внизу время и полный экран. Состояния — классами (visible,
// is-fullscreen, touch-ui), а не пропсами styled.

/** Затемнение снизу под панелью: кнопки читаются на любом кадре. */
export const SC_GradientBottom = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120px;
  z-index: 6;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgb(var(--color-black-rgb) / 70%),
    rgb(var(--color-black-rgb) / 35%) 45%,
    transparent
  );
  opacity: 0;
  transition: opacity var(--transition-player);

  &.visible {
    opacity: 1;
  }

  .is-fullscreen & {
    height: 160px;
  }
`

/** Ряд кнопок внизу: слева пуск, звук, время и глава, справа настройки и экран. */
export const SC_ControlsRow = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition-player),
    visibility var(--transition-player);

  &.visible {
    opacity: 1;
    visibility: visible;
  }

  .is-fullscreen & {
    height: 54px;
    padding: 0 20px;
  }
`

export const SC_ControlsGroup = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  min-width: 0;
`

/** Кнопка ряда: белый значок, над ней при наведении — подсказка с клавишей. */
export const SC_PlayerButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 100%;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--color-white);
  opacity: 0.9;
  cursor: pointer;
  transition: opacity var(--transition-player-quick);

  svg {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 0 2px rgb(var(--color-black-rgb) / 50%));
    transition: transform var(--transition-player-quick);
  }

  &:hover {
    opacity: 1;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-white-85);
    outline-offset: -6px;
    border-radius: var(--ui-radius-md);
  }

  /* Шестерёнка поворачивается, пока меню открыто, — как у YouTube. */
  &.open svg {
    transform: rotate(30deg);
  }

  .is-fullscreen & {
    width: 54px;
  }

  .is-fullscreen & svg {
    width: 30px;
    height: 30px;
  }

  &[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 9px;
    border-radius: var(--ui-radius-sm);
    background: rgb(var(--player-panel-rgb) / 90%);
    color: var(--color-white);
    font-size: 13px;
    font-weight: 500;
    line-height: 15px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--transition-player-quick);
  }

  &[data-tip]:hover::after {
    opacity: 1;
  }

  /* Крайние кнопки: подсказка не вылезает за край ролика. */
  &.tip-start::after {
    left: 0;
    transform: none;
  }

  &.tip-end::after {
    left: auto;
    right: 0;
    transform: none;
  }

  .menu-open &::after {
    display: none;
  }
`

/** «0:05 / 3:24» — время рядом со звуком. */
export const SC_TimeDisplay = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 5px;
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 13px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 2px rgb(var(--color-black-rgb) / 50%);
  opacity: 0.93;

  .is-fullscreen & {
    font-size: 16px;
  }

  .touch-ui & {
    height: auto;
    padding: 0;
    font-size: 12px;
  }
`

/** «• Глава» после времени. */
export const SC_ChapterTitle = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 280px;
  height: 100%;
  padding: 0 5px;
  color: var(--color-white);
  font-family: Roboto, Arial, sans-serif;
  font-size: 13px;
  text-shadow: 0 0 2px rgb(var(--color-black-rgb) / 50%);
  opacity: 0.93;

  &::before {
    content: '•';
    margin-right: 6px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/** Большая кнопка пуска до первого запуска — круг с треугольником, как у YouTube. */
export const SC_BigPlayButton = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  margin: -34px 0 0 -34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(var(--color-black-rgb) / 60%);
  color: var(--color-white);
  cursor: pointer;
  transition: background-color var(--transition-player-quick);

  svg {
    width: 40px;
    height: 40px;
    /* Оптический центр треугольника правее геометрического. */
    margin-left: 4px;
  }

  &:hover {
    background: rgb(var(--color-black-rgb) / 80%);
  }
`

/** Телефон: касание затемняет весь ролик, пока видна панель. */
export const SC_TouchScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: rgb(var(--color-black-rgb) / 45%);
  opacity: 0;
  transition: opacity var(--transition-player);

  &.visible {
    opacity: 1;
  }
`

/**
 * Телефон: кнопки поверх затемнения. Сам слой касания пропускает — их ловит
 * ролик (жесты), нажимаются только кнопки.
 */
export const SC_TouchLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition-player),
    visibility var(--transition-player);

  &.visible {
    opacity: 1;
    visibility: visible;
  }

  button {
    pointer-events: auto;
  }
`

/** Телефон: пуск и пауза в центре. */
export const SC_TouchCenterButton = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(var(--color-black-rgb) / 35%);
  color: var(--color-white);

  svg {
    width: 40px;
    height: 40px;
  }

  .is-fullscreen & {
    width: 80px;
    height: 80px;
    margin: -40px 0 0 -40px;
  }

  .is-fullscreen & svg {
    width: 52px;
    height: 52px;
  }
`

/** Телефон: настройки в правом верхнем углу. */
export const SC_TouchTopBar = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  padding: 2px;

  .is-fullscreen & {
    padding: calc(8px + var(--safe-top)) calc(12px + var(--safe-right)) 0 0;
  }
`

/** Телефон: время слева и полный экран справа, над полосой у нижнего края. */
export const SC_TouchBottomBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 0 12px;

  .is-fullscreen & {
    bottom: 44px;
    padding: 0 calc(12px + var(--safe-right)) 0 calc(24px + var(--safe-left));
  }
`

export const SC_TouchButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 10px;
  border: 0;
  background: transparent;
  color: var(--color-white);

  svg {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 0 2px rgb(var(--color-black-rgb) / 50%));
  }
`
