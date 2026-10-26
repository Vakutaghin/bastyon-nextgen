import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

// Кнопка «Скачать» поверх просмотрщика картинок: у ленты он на 9998, у чата —
// на 9999. Стоит в слое просмотрщика или выше.
export const SC_DownloadBtn = styled.button`
  position: fixed;
  /* Мимо выреза экрана — у телефона боком он сбоку. */
  top: calc(var(--safe-top) + 16px);
  left: calc(var(--safe-left) + 16px);
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--color-overlay-40);
  color: var(--color-white-85);
  font-size: 20px;
  cursor: pointer;
  opacity: 0.85;
  transition:
    opacity ${TRANSITIONS.FAST},
    background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    opacity: 1;
    background: var(--color-overlay-65);
    color: var(--color-white);
  }

  &:disabled {
    opacity: 0.75;
    cursor: progress;
  }
`

// Тосты приложения (3000) под просмотрщиком не видны — ошибка рядом с кнопкой.
export const SC_DownloadError = styled.div`
  position: fixed;
  top: calc(var(--safe-top) + 20px);
  left: calc(var(--safe-left) + 72px);
  z-index: 10000;
  max-width: calc(100vw - var(--safe-left) - 88px);
  padding: 8px 14px;
  border-radius: var(--ui-radius-full);
  background: var(--color-overlay-65);
  color: var(--color-white);
  font-size: 14px;
  line-height: 20px;
`
