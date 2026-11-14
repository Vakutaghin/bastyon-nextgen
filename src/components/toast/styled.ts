import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'

// Тост как был у antd notification в нашей теме: ширина 384, отступ 16,
// радиус 8, фон страницы с кольцом-рамкой и тенью оверлеев Nuxt; значок 24px
// цвета вида, заголовок 14px/500, описание приглушённое. Кнопка крестика
// 20×20 — там же, где у antd, но жмётся по площадке 32×32.
//
// Части для styled родителя: .ui-toast, __icon, __message, __description,
// __close; вид — data-type. Цвет значка — --ui-toast-color.
export const SC_Toast = styled.div`
  --ui-toast-color: var(--ui-info);

  position: relative;
  box-sizing: border-box;
  width: 384px;
  max-width: calc(100vw - 48px);
  margin-bottom: 16px;
  padding: 16px;
  overflow: hidden;
  overflow-wrap: break-word;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;
  pointer-events: auto;

  &[data-type='success'] {
    --ui-toast-color: var(--ui-success);
  }

  &[data-type='warning'] {
    --ui-toast-color: var(--ui-warning);
  }

  &[data-type='error'] {
    --ui-toast-color: var(--ui-error);
  }

  &[data-type='loading'] {
    --ui-toast-color: var(--ui-primary);
  }

  &[data-clickable] {
    cursor: pointer;
  }

  .ui-toast__icon {
    position: absolute;
    top: 16px;
    left: 16px;
    color: var(--ui-toast-color);
    font-size: 24px;
    line-height: 0;
  }

  .ui-toast__message {
    margin: 0 0 4px 36px;
    padding-right: 24px;
    color: var(--ui-text-highlighted);
    font-weight: 500;
    line-height: 21px;
  }

  .ui-toast__description {
    margin-left: 36px;
    color: var(--ui-text-muted);
  }

  .ui-toast__close {
    position: absolute;
    top: 20px;
    right: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-dimmed);
    /* Крестик lucide занимает половину квадрата: 20px — как 14px у antd. */
    font-size: 20px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .ui-toast__close::before {
    position: absolute;
    inset: -6px;
    content: '';
  }

  .ui-toast__close:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  .ui-toast__close:focus {
    outline: 0;
  }

  .ui-toast__close:focus-visible {
    outline: var(--ui-focus-outline);
  }
`

// Список тостов одного места. Сам нажатия не ловит — только тосты в нём.
// Появление как у antd: внизу слева — выезд слева, сверху — сверху; уход —
// схлопывание по высоте (--ui-toast-height ставит хост), соседи съезжают.
export const SC_ToastList = styled.div`
  position: fixed;
  z-index: ${() => Z_INDEX.TOAST};
  display: flex;
  flex-direction: column;
  pointer-events: none;

  &[data-placement='bottomLeft'] {
    bottom: 24px;
    left: 24px;
    align-items: flex-start;
  }

  &[data-placement='top'] {
    top: calc(var(--header-height-total) + 8px);
    right: 0;
    left: 0;
    align-items: center;
  }

  .ui-toast-enter-active,
  .ui-toast-move {
    transition:
      transform var(--transition-fast),
      opacity var(--transition-fast);
  }

  .ui-toast-leave-active {
    transition:
      max-height var(--transition-fast),
      margin-bottom var(--transition-fast),
      padding var(--transition-fast),
      opacity var(--transition-fast);
  }

  .ui-toast-enter-from {
    opacity: 0;
  }

  &[data-placement='bottomLeft'] .ui-toast-enter-from {
    transform: translateX(-100%);
  }

  &[data-placement='top'] .ui-toast-enter-from {
    transform: translateY(-100%);
  }

  .ui-toast-leave-from {
    max-height: var(--ui-toast-height);
  }

  .ui-toast-leave-to {
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-placement] .ui-toast-enter-from {
      transform: none;
    }

    .ui-toast-move {
      transition: none;
    }
  }
`
