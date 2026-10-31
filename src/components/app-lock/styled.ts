import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'

/**
 * Экран замка — поверх всего приложения, непрозрачный: под ним не видно ни
 * ленты, ни переписки. Отступы — от вырезов и системных панелей телефона.
 */
export const SC_LockScreen = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${() => Z_INDEX.APP_LOCK};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--safe-top) + 24px) calc(var(--safe-right) + 16px)
    calc(var(--safe-bottom) + 24px) calc(var(--safe-left) + 16px);
  overflow-y: auto;
  background-color: var(--ui-bg);
  color: var(--ui-text);
  user-select: none;
  -webkit-user-select: none;
  outline: none;
`

export const SC_LockBody = styled.div`
  width: 100%;
  max-width: 340px;
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;

  &.form {
    align-items: stretch;
    gap: 14px;
  }
`

/** Надпись BASTYON, как в шапке: своя для светлой и тёмной темы. */
export const SC_LockLogo = styled.img`
  height: 30px;
  width: auto;
  margin-bottom: 8px;
`

export const SC_LockTitle = styled.h1`
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  color: var(--ui-text-highlighted);
`

export const SC_LockText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

/** Подсказка и ошибка под заголовком — место держится всегда, чтобы ничего не прыгало. */
export const SC_LockHint = styled.div`
  min-height: 20px;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: var(--ui-text-muted);

  &.error {
    color: var(--color-danger);
  }
`

export const SC_LockLink = styled.button`
  align-self: center;
  padding: 6px 8px;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--color-link);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--ui-radius-sm);
  }

  &.danger {
    color: var(--color-danger);
  }
`

// ─── пин-код ──────────────────────────────────────────────────────────────────

export const SC_PinPad = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
`

export const SC_PinDots = styled.div`
  display: flex;
  gap: 18px;
  height: 18px;
  align-items: center;

  &.shake {
    animation: app-lock-shake 0.36s ease-in-out;
  }
`

export const SC_PinDot = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--ui-border-accented);
  transition:
    transform var(--transition-tap),
    background-color var(--transition-tap),
    border-color var(--transition-tap);

  &.filled {
    background-color: var(--ui-text-highlighted);
    border-color: var(--ui-text-highlighted);
    transform: scale(1.15);
  }

  &.error {
    background-color: var(--color-danger);
    border-color: var(--color-danger);
  }
`

/** Клавиши мельчают на низком экране (телефон боком) плавно, без порогов. */
export const SC_Keypad = styled.div`
  --key: clamp(52px, 9.5vh, 72px);
  display: grid;
  grid-template-columns: repeat(3, var(--key));
  gap: clamp(8px, 1.7vh, 14px) clamp(18px, 3vh, 26px);

  &.compact {
    --key: 60px;
    gap: 10px 20px;
  }
`

/**
 * Клавиша. Ввод — по pointerdown, а не по click: цифра появляется в момент
 * касания, без задержки отпускания. Подсветка — классом pressed (ставит
 * pin-pad), :active на телефоне срабатывает не всегда.
 */
export const SC_Key = styled.button`
  width: var(--key);
  height: var(--key);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
  font-family: inherit;
  font-size: 28px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--transition-tap);

  /* Только с мышью: на телефоне :hover залипает на последней нажатой клавише. */
  @media (hover: hover) {
    &:hover:not(:disabled) {
      background-color: var(--ui-bg-accented);
    }

    &.plain:hover:not(:disabled) {
      background-color: var(--ui-bg-elevated);
    }
  }

  /* Не слабее :hover — иначе под мышью нажатие не видно. */
  &.pressed:not(:disabled) {
    background-color: var(--ui-border-accented);
    transition: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.plain {
    background-color: transparent;
    font-size: 22px;
    color: var(--ui-text-muted);
  }

  &.plain.pressed:not(:disabled) {
    background-color: var(--ui-bg-elevated);
  }
`

export const SC_KeyGap = styled.span`
  width: var(--key);
  height: var(--key);
`

// ─── графический ключ ─────────────────────────────────────────────────────────

/**
 * Поле 3×3. Линия — SVG в координатах 0…300 поверх точек; точки и линию
 * pattern-grid меняет прямо в DOM, без перерисовки Vue на каждое движение.
 */
export const SC_PatternGrid = styled.div`
  position: relative;
  width: min(276px, 78vw, 44vh);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  touch-action: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &.compact {
    width: min(240px, 70vw);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  & svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  & polyline,
  & line {
    fill: none;
    stroke: var(--color-primary);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.55;
  }

  &.error polyline {
    stroke: var(--color-danger);
  }

  &.error .on::before {
    background-color: var(--color-danger);
  }
`

export const SC_PatternDot = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  &::before {
    content: '';
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: var(--ui-text-dimmed);
    transition:
      transform var(--transition-tap),
      background-color var(--transition-tap);
  }

  &.on::before {
    background-color: var(--color-primary);
    transform: scale(1.45);
  }
`

export const SC_ConfirmBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0 4px;
`
