import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const props = {
  isOpen: Boolean,
}

/** Размер задаёт use-widget-size: окно растягивают за левый и верхний край. */
export const SC_Window = styled('div', props)`
  position: relative;
  background-color: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: ${COLORS.SHADOW_LG};
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  overflow: hidden;
  transform-origin: bottom right;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
  opacity: ${(props) => (props.isOpen ? '1' : '0')};
  transform: ${(props) => (props.isOpen ? 'scale(1)' : 'scale(0.9)')};
  pointer-events: ${(props) => (props.isOpen ? 'auto' : 'none')};

  /* Пока тянут, текст в окне не выделяется. */
  &.resizing {
    user-select: none;
  }

  /* Ручка угла видна, когда указатель над окном или ручка в фокусе. */
  &:hover > .resize-corner,
  & > .resize-corner:focus-visible {
    opacity: 1;
  }
`

/** Полоса у левого или верхнего края, за которую окно растягивают. */
export const SC_ResizeEdge = styled.div`
  position: absolute;
  z-index: 2;
  touch-action: none;

  &.left {
    top: 0;
    bottom: 0;
    left: 0;
    width: 6px;
    cursor: ew-resize;
  }

  &.top {
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    cursor: ns-resize;
  }
`

/** Левый верхний угол: тянет обе стороны; стрелки — с клавиатуры. */
export const SC_ResizeCorner = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  touch-action: none;
  opacity: 0;
  transition: opacity var(--transition-fast);
  outline: none;

  /* Две косые черты поперёк угла — знак, что окно тянется. */
  &::before,
  &::after {
    content: '';
    position: absolute;
    height: 1.5px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-dimmed);
    transform: rotate(-45deg);
  }

  &::before {
    top: 4px;
    left: 2px;
    width: 6px;
  }

  &::after {
    top: 8px;
    left: 3px;
    width: 11px;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--ui-primary);
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_Header = styled.div`
  /* Шапка окна как у Nuxt UI: фон страницы, линия снизу, яркий заголовок. */
  height: 48px;
  background-color: var(--ui-bg);
  color: var(--ui-text-highlighted);
  border-bottom: 1px solid var(--ui-border);
  display: flex;
  align-items: center;
  padding: 0 8px 0 12px;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
  gap: 8px;
`

/** Длинное имя собеседника — в одну строку с многоточием, целиком в подсказке. */
export const SC_Title = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background-color: var(--color-bg-primary);
`

export const SC_CloseButton = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  background: transparent;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-muted);
  font-size: 16px;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }
`
