import styled from 'vue3-styled-components'
import { noSelect } from '@/styles/chrome-styles'

/**
 * Панель над выделенными сообщениями — на месте поля ввода, как в Telegram на
 * телефоне. Высотой с панель ввода, чтобы лента не прыгала. В узкой панели
 * подписи кнопок прячутся (правило @container — в style.css: stylis 3 его
 * выбрасывает), у кнопок остаются aria-label и подсказки.
 */
export const SC_SelectionBar = styled.div`
  ${noSelect}
  container: selection-bar / inline-size;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 57px;
  padding: 8px 12px;
  box-sizing: border-box;
  background-color: var(--ui-bg);
  border-top: 1px solid var(--ui-border);
`

export const SC_SelectionCount = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_SelectionButton = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: var(--ui-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  .anticon {
    font-size: 18px;
  }

  &:hover {
    background: var(--color-overlay-6);
  }

  &.danger {
    color: var(--color-red-ant);
  }

  &.close {
    padding: 0 10px;
    color: var(--ui-text-muted);
  }
`
